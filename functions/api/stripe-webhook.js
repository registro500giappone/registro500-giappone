/**
 * Stripe の応援を管理人へ即時に知らせる — POST /api/stripe-webhook
 *
 * Stripe の webhook（イベントの送り先）として登録する。届いたイベントの署名を確かめ、
 * 応援者がオーナー登録済みかを照合して、管理人宛てに1通だけメールを送る。
 *
 *   checkout.session.completed      … 応援の手続きが完了した瞬間（1回・月額の申し込み）
 *   invoice.paid（subscription_cycle）… 月額の2か月目以降の引き落とし
 *   invoice.payment_failed           … 月額の引き落としに失敗
 *   customer.subscription.deleted    … 月額の解約
 *
 * 宛先は固定の管理人アドレスだけ＝署名が正しくない呼び出しは何も送らない。
 * メールが送れなかったときは 500 を返す＝Stripe が自動で再送してくれる。
 *
 * 必要な環境変数:
 *   STRIPE_WEBHOOK_SECRET      … Registro500 アカウントの送り先の署名シークレット（whsec_…）
 *   STRIPE_WEBHOOK_SECRET_312  … 任意。Registro312 アカウントの送り先を同じURLに向けるとき
 *   SUPABASE_URL / SUPABASE_SECRET_KEY / BREVO_API_KEY（/api/tool-notify と同じ）
 *
 * ⛔応援者のメールアドレスはこのメール以外に書き出さない（ログにも出さない）。
 */

import { textToHtml } from "../_lib/mail_html.js";

const SENDER_EMAIL = "news@registro500.com";
const SENDER_NAME = "Registro500 Giappone";
const ADMIN_EMAIL = "registro500giappone@gmail.com";
const TOLERANCE_SEC = 5 * 60;

const SITE_BY_REF = { fiat: "Registro312（FIAT）", scorpione: "Registro Scorpione（ABARTH）" };

function res(status, text = "") {
  return new Response(text, { status });
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// Stripe-Signature: t=...,v1=...,v1=... を確かめる。合えば true
export async function verifyStripeSignature(rawBody, header, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length) return false;
  if (Math.abs(nowSec - Number(t)) > TOLERANCE_SEC) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`)));
  return sigs.some((s) => {
    if (s.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

const yen = (n) => `¥${Number(n || 0).toLocaleString("ja-JP")}`;

// 応援者のメールアドレスでオーナー照合（車の登録メール＋ログインIDに紐づく車）
async function lookupOwner(env, email) {
  if (!email) return { note: "メールアドレスなし" };
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const svc = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` };
  const lower = email.toLowerCase();

  let user = null;
  for (let page = 1; page <= 10 && !user; page++) {
    const r = await fetch(`${base}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: svc });
    if (!r.ok) throw new Error(`auth users HTTP ${r.status}`);
    const list = (await r.json()).users || [];
    user = list.find((u) => String(u.email || "").toLowerCase() === lower) || null;
    if (list.length < 1000) break;
  }

  const sel = "select=document_id,handle_name,model_display_c,car_type";
  const found = new Map();
  const add = async (q) => {
    const r = await fetch(`${base}/rest/v1/cars?${sel}&${q}`, { headers: svc });
    if (!r.ok) throw new Error(`cars HTTP ${r.status}`);
    for (const c of await r.json()) found.set(c.document_id, c);
  };
  await add(`owner_email=ilike.${encodeURIComponent(email)}`);
  if (user) await add(`owner_user_id=eq.${user.id}`);
  return { user, cars: [...found.values()] };
}

function describeOwner(o) {
  if (o.note) return `照合できず（${o.note}）`;
  if (o.cars.length) {
    return "✅ オーナー登録あり\n" + o.cars
      .map((c) => `　${c.document_id}「${c.handle_name || "—"}」 ${c.model_display_c || c.car_type || ""}`).join("\n");
  }
  if (o.user) {
    const last = o.user.last_sign_in_at ? o.user.last_sign_in_at.slice(0, 10) : "—";
    return `⚠️ ログインの記録はあるが車の登録なし（作成 ${String(o.user.created_at || "").slice(0, 10)}・最終ログイン ${last}）`;
  }
  return "— 登録なし（サイトのアカウントも無いメールアドレス）";
}

function thanksDraft(o, kind, stripeName, siteName) {
  const owner = o.cars?.[0];
  const to = owner ? `${owner.handle_name || stripeName}さま` : `〔${stripeName || "お名前"}〕さま`;
  const line = kind === "monthly"
    ? "毎月の応援、本当に心強いです。"
    : "いただいた応援は、サーバー代と次の機能づくりに大切に使わせていただきます。";
  const ownerLine = owner
    ? `\n${owner.document_id} の ${owner.model_display_c || "愛車"}で登録してくださっているオーナーさんからの応援と知って、\nいっそううれしく思いました。`
    : "";
  const nameAsk = owner
    ? `載せてもよいかどうか、また載せる場合の表記（ハンドルネーム「${owner.handle_name}」のままでよいか）を`
    : "載せてもよいかどうかと、載せる場合のお名前の表記を、";
  return `件名：応援ありがとうございます【${siteName}】

${to}

${siteName} 管理人です。
このたびはサイトを応援してくださり、本当にありがとうございます。
${ownerLine}
${line}

応援のページ（/support）には、ご希望の方だけお名前を載せています（金額は載せません）。
もしよろしければ、${nameAsk}
このメールへの返信で教えてください。載せなくても、もちろん大丈夫です。

引き続きよろしくお願いいたします。

${siteName} 管理人`;
}

async function sendAdmin(env, subject, body) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: ADMIN_EMAIL }],
      subject,
      textContent: body,
      htmlContent: textToHtml(body),
    }),
  });
  if (!r.ok) throw new Error(`Brevo HTTP ${r.status} / ${await r.text()}`);
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.BREVO_API_KEY) {
    console.error("stripe-webhook: 環境変数が未設定です");
    return res(500);
  }

  const raw = await request.text();
  const sigHeader = request.headers.get("stripe-signature");
  let account = null;
  if (await verifyStripeSignature(raw, sigHeader, env.STRIPE_WEBHOOK_SECRET)) account = "500";
  else if (env.STRIPE_WEBHOOK_SECRET_312
    && await verifyStripeSignature(raw, sigHeader, env.STRIPE_WEBHOOK_SECRET_312)) account = "312";
  if (!account) return res(400, "bad signature");

  let event;
  try { event = JSON.parse(raw); } catch (e) { return res(400); }
  const obj = event?.data?.object || {};
  const test = event.livemode ? "" : "【テスト】";
  const acct = event.account || "";
  const dashBase = `https://dashboard.stripe.com/${acct ? acct + "/" : ""}${event.livemode ? "" : "test/"}`;

  try {
    let kind, email, name, amount, ref, link;
    switch (event.type) {
      case "checkout.session.completed":
        kind = obj.mode === "subscription" ? "monthly" : "once";
        email = obj.customer_details?.email || obj.customer_email;
        name = obj.customer_details?.name || "";
        amount = obj.amount_total;
        ref = obj.client_reference_id;
        link = obj.payment_intent ? `${dashBase}payments/${obj.payment_intent}`
          : obj.subscription ? `${dashBase}subscriptions/${obj.subscription}` : `${dashBase}payments`;
        break;
      case "invoice.paid":
        if (obj.billing_reason !== "subscription_cycle") return res(200, "skip");  // 初回は checkout 側で通知済み
        kind = "renewal";
        email = obj.customer_email; name = obj.customer_name || ""; amount = obj.amount_paid;
        link = `${dashBase}invoices/${obj.id}`;
        break;
      case "invoice.payment_failed":
        kind = "failed";
        email = obj.customer_email; name = obj.customer_name || ""; amount = obj.amount_due;
        link = `${dashBase}invoices/${obj.id}`;
        break;
      case "customer.subscription.deleted":
        kind = "canceled";
        link = `${dashBase}customers/${obj.customer}`;
        break;
      default:
        return res(200, "ignored");
    }

    const siteName = account === "312"
      ? (SITE_BY_REF[ref] || "Registro312 / Registro Scorpione（サイト不明）")
      : "Registro500 Giappone";
    const mailSite = account === "312" ? (ref === "scorpione" ? "Registro Scorpione" : "Registro312") : "Registro500 Giappone";

    if (kind === "canceled") {
      await sendAdmin(env, `${test}【応援】月額の解約がありました（${siteName}）`,
        `月額の応援が解約されました。\n\nサイト: ${siteName}\n顧客: ${link}\n\n（このイベントには名前とメールアドレスが入っていないため、顧客ページで確認してください）`);
      return res(200, "ok");
    }

    let owner;
    try { owner = await lookupOwner(env, email); }
    catch (e) { console.error("stripe-webhook 照合エラー:", e); owner = { note: String(e.message || e) }; }

    const label = { once: "1回", monthly: "月額の申し込み", renewal: "月額の継続", failed: "月額の引き落とし失敗" }[kind];
    const who = owner.cars?.[0] ? `${owner.cars[0].handle_name || name}さん（${owner.cars[0].document_id}）` : (name || email || "");
    const subject = `${test}【応援】${yen(amount)}（${label}）${who}`;

    let body = `${kind === "failed" ? "月額の応援の引き落としに失敗しました。" : "応援がありました。"}

サイト　: ${siteName}
種類　　: ${label}
金額　　: ${yen(amount)}
名前　　: ${name || "—"}
メール　: ${email || "—"}
照合　　: ${account === "312" ? "（Registro500 側の登録との照合・312 の登録は未照合）" : ""}${describeOwner(owner)}

Stripe　: ${link}
`;
    if (kind === "once" || kind === "monthly") {
      body += `
──── お礼メールの下書き（${email || "宛先不明"} へ）────

${thanksDraft(owner, kind, name, mailSite)}
`;
    }
    await sendAdmin(env, subject, body);
    return res(200, "ok");
  } catch (e) {
    console.error("stripe-webhook エラー:", e);
    return res(500);  // Stripe が再送する
  }
}
