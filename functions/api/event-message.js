/**
 * イベントの「参加者の連絡欄」に書き込む — POST /api/event-message（2026-11-20）
 *
 *   body: { eventId, body, notify }   Authorization: Bearer <ログインの札>
 *
 * 連絡欄への書き込みはここだけが行う（event_messages にクライアントから insert する口は無い）。
 * 回数の歯止めとメール送信を1か所で握るため。
 *
 *   1. ログインの本人確認 → その人の車が、このイベントに参加表明しているかを確かめる（管理人は常に可）
 *   2. event_messages に1行入れる
 *   3. notify が真なら、ほかの参加者と管理人へ本文入りのメールを送る
 *
 * ⚠️ メールは Brevo ではなく Resend から送る（RESEND_API_KEY）。
 *    Brevo の無料枠（1日300通）は朝の便・週刊便り・ログインの確認コードと共用で、
 *    連絡欄が賑わって枠を使い切るとログインできなくなるため、別枠に分けた（2026-11-20 ユーザー決裁）。
 *    Resend の無料枠は1日100通。超える分は送らず、ページにだけ載せる（mail: "cap"）。
 *    キーが未設定でも書き込みは通る（mail: "off"）。
 *
 * 止める口は既存の /unsubscribe（mail_subscriptions.list = 'event_board'）。朝の便とは別に止まる。
 */
import { textToHtml } from "../_lib/mail_html.js";

const SENDER = "Registro500 Giappone <news@registro500.com>";
const ADMIN_EMAIL = "registro500giappone@gmail.com";
const SITE = "https://www.registro500.com";
const LIST = "event_board";
const MAX_BODY = 500;
const POSTS_PER_HOUR = 10;      // 1人が1つのイベントに書ける回数
const MAIL_CAP_24H = 90;        // Resend 無料枠（1日100通）の手前で止める

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
const fail = (error, status) => json({ success: false, error }, status);

// 開催日時。JST へ直してから読む。JST 0:00 ちょうどは「時刻未入力」の決まり（gen_event_pages.py と同じ）
export function eventWhen(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 9 * 3600 * 1000);
  let s = `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${"日月火水木金土"[d.getUTCDay()]}）`;
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h || m) s += ` ${h}:${String(m).padStart(2, "0")}〜`;
  return s;
}

export function buildMail({ handle, eventName, when, body, url, token }) {
  const subject = `【Registro500】${handle}さんから参加者への連絡：${eventName}`;
  const text = `${handle}さんから、参加者のみなさんへの連絡です。

【${eventName}】
${when ? when + "\n" : ""}
${body}

返信は、イベントページの連絡欄に書いてください（このメールに返信しても届きません）。
${url}

---------------------------------------------------------
このメールは、このイベントに参加表明した方にお送りしています。連絡欄は参加者だけが読めます。
Registro500 / Registro126 Giappone
このお知らせが不要な方は、次のリンクから配信を止められます（ログイン不要）。
${SITE}/unsubscribe?t=${token}
`;
  return { subject, text };
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    console.error("環境変数が未設定です");
    return fail("server", 500);
  }
  let form;
  try { form = await request.json(); } catch (e) { return fail("bad_request", 400); }
  const eventId = String(form.eventId || "").trim();
  const body = String(form.body || "").replace(/\r\n?/g, "\n").trim();
  const notify = form.notify === true;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(eventId)) return fail("bad_request", 400);
  if (!body) return fail("empty", 400);
  if (body.length > MAX_BODY) return fail("too_long", 400);

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const svc = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` };
  const get = async (path) => {
    const res = await fetch(`${base}/rest/v1/${path}`, { headers: svc });
    if (!res.ok) throw new Error(`${path.split("?")[0]} HTTP ${res.status}`);
    return res.json();
  };

  // 本人の確認
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return fail("login", 401);
  let user;
  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return fail("login", 401);
    user = await res.json();
  } catch (e) {
    console.error("Auth 確認エラー:", e);
    return fail("server", 502);
  }
  if (!user || !user.id) return fail("login", 401);
  const myEmail = String(user.email || "").trim().toLowerCase();
  const isAdmin = myEmail === ADMIN_EMAIL;

  try {
    // イベントと参加者
    const ev = (await get(`events?select=id,event_name,event_date&id=eq.${encodeURIComponent(eventId)}&limit=1`))[0];
    if (!ev) return fail("not_found", 404);
    const parts = await get(`event_participants?select=car_id,handle_name&event_id=eq.${encodeURIComponent(eventId)}`);

    // 自分の車（owns_car() と同じ見分け方＝持ち主の印が無い車だけメールで照合）
    const mine = await get(`cars?select=document_id,owner_user_id,owner_email&owner_user_id=eq.${user.id}`);
    if (myEmail) {
      const byMail = await get(`cars?select=document_id,owner_user_id,owner_email&owner_user_id=is.null`
        + `&owner_email=ilike.${encodeURIComponent(myEmail.replace(/[%_*\\]/g, ""))}`);
      for (const c of byMail) {
        if (String(c.owner_email || "").trim().toLowerCase() === myEmail) mine.push(c);
      }
    }
    const myCarIds = new Set(mine.map((c) => c.document_id));
    const me = parts.find((p) => p.car_id !== "ADMIN" && myCarIds.has(p.car_id));
    if (!me && !isAdmin) return fail("not_participant", 403);
    const carId = me ? me.car_id : "ADMIN";
    const handle = (me && me.handle_name) || (isAdmin ? "管理人" : "オーナー");

    // 連投の歯止め
    const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const recent = await get(`event_messages?select=id&event_id=eq.${encodeURIComponent(eventId)}`
      + `&car_id=eq.${encodeURIComponent(carId)}&created_at=gte.${encodeURIComponent(hourAgo)}`);
    if (recent.length >= POSTS_PER_HOUR) return fail("too_many", 429);

    // 書き込む
    const ins = await fetch(`${base}/rest/v1/event_messages`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ event_id: eventId, car_id: carId, handle_name: handle, body, notify }),
    });
    if (!ins.ok) throw new Error(`insert HTTP ${ins.status} / ${await ins.text()}`);
    const msg = (await ins.json())[0];

    // メール（失敗しても書き込みは成功として返す）
    let mail = "none", mailed = 0;
    if (notify) {
      try {
        ({ mail, mailed } = await sendMails({ env, request, base, svc, get, ev, parts, myCarIds, myEmail, handle, body, msg }));
      } catch (e) {
        console.error("event-message メール送信エラー:", e);
        mail = "failed";
      }
    }
    return json({ success: true, id: msg.id, mail, mailed });
  } catch (e) {
    console.error("event-message エラー:", e);
    return fail("server", 502);
  }
}

async function sendMails({ env, request, base, svc, get, ev, parts, myCarIds, myEmail, handle, body, msg }) {
  if (!env.RESEND_API_KEY) return { mail: "off", mailed: 0 };

  // 宛先＝ほかの参加者の車の持ち主＋管理人（書いた本人は除く）
  const carIds = [...new Set(parts.map((p) => p.car_id).filter((id) => id && id !== "ADMIN" && !myCarIds.has(id)))];
  const emails = new Set();
  if (carIds.length) {
    const inList = carIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
    const cars = await get(`cars?select=owner_email&document_id=in.(${encodeURIComponent(inList)})`);
    for (const c of cars) {
      const m = String(c.owner_email || "").trim().toLowerCase();
      if (m.includes("@")) emails.add(m);
    }
  }
  emails.add(ADMIN_EMAIL);
  emails.delete(myEmail);
  if (!emails.size) return { mail: "nobody", mailed: 0 };

  // 止めた人を除き、1人ずつの停止用の札を引く（無い人には作る）
  const subs = await fetch(`${base}/rest/v1/mail_subscriptions?on_conflict=list,email`, {
    method: "POST",
    headers: { ...svc, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify([...emails].map((email) => ({ list: LIST, email, source: "owner" }))),
  });
  if (!subs.ok) throw new Error(`mail_subscriptions HTTP ${subs.status} / ${await subs.text()}`);
  const rows = await get(`mail_subscriptions?select=email,unsub_token,unsubscribed_at&list=eq.${LIST}`);
  const targets = rows.filter((r) => emails.has(r.email) && !r.unsubscribed_at && r.unsub_token);
  if (!targets.length) return { mail: "nobody", mailed: 0 };

  // 1日の上限（直近24時間に送った通数で数える）
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const sent = await get(`event_messages?select=mailed_count&mailed_count=gt.0&created_at=gte.${encodeURIComponent(dayAgo)}`);
  const used = sent.reduce((n, r) => n + (r.mailed_count || 0), 0);
  if (used + targets.length > MAIL_CAP_24H) return { mail: "cap", mailed: 0 };

  // イベントページのURL（対応表はサイトの静的ファイル。引けなければ一覧へ）
  let url = `${SITE}/event`;
  try {
    const res = await env.ASSETS.fetch(new URL("/event-slugs.json", request.url));
    const slug = res.ok ? (await res.json())[ev.id] : null;
    if (slug && /^[a-z0-9-]+$/.test(slug)) url = `${SITE}/event/${slug}/#board`;
  } catch (e) { /* 一覧のURLのまま送る */ }

  const when = eventWhen(ev.event_date);
  const batch = targets.map((r) => {
    const { subject, text } = buildMail({ handle, eventName: ev.event_name, when, body, url, token: r.unsub_token });
    return {
      from: SENDER,
      to: [r.email],
      subject,
      text,
      html: textToHtml(text),
      headers: {
        "List-Unsubscribe": `<${SITE}/api/unsubscribe?t=${r.unsub_token}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });
  const send = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `event-message-${msg.id}`,
    },
    body: JSON.stringify(batch),
  });
  if (!send.ok) throw new Error(`Resend HTTP ${send.status} / ${await send.text()}`);

  await fetch(`${base}/rest/v1/event_messages?id=eq.${msg.id}`, {
    method: "PATCH",
    headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ mailed_count: batch.length }),
  });
  return { mail: "sent", mailed: batch.length };
}
