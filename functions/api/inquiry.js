/**
 * オーナーへの問い合わせ転送 — POST /api/inquiry
 *
 * GAS main.gs sendOwnerInquiry() の移設先（Cloudflare Pages Functions）。
 *
 * 移設の理由は2つある。
 *  1. GASからSupabaseを叩けなくなった（詳細は CLAUDE.md「GASからSupabaseは叩けない」）。
 *     この機能自体はスプレッドシートで動いていたが、GASを畳む方針のため一緒に出す。
 *  2. GAS版は送信先メールを**スプレッドシートのMASTERシート**から引いていた。
 *     車両の正本はSupabaseの cars テーブルに移っているので、シートが古いと
 *     新しいオーナー宛の問い合わせが「送信先が見つかりません」で落ちる。
 *     ここではSupabaseを引くので、その取りこぼしが構造的に起きない。
 *
 * cars.owner_email は列単位の権限で匿名からは読めないため、シークレットキー
 * （sb_secret_）が要る。Workers実行なのでUser-Agentのブラウザ判定には掛からない。
 *
 * 送信者の確認（2026-09-30 セキュリティ点検で追加）:
 *   以前は senderEmail を本文の自己申告のまま使い、ログインも回数制限も無かった。
 *   targetDocId を回せば全オーナーへ当サイト名義で任意の文面を送れる踏み台になるので、
 *   フロントが送る Supabase のアクセストークン（Authorization: Bearer）を /auth/v1/user で
 *   検証し、送信者メールは本文ではなくトークン側の値を使う。あわせて inquiry_log に記録して
 *   1人あたり1時間 MAX_PER_HOUR 通・同じ相手へは MIN_INTERVAL_MS に1通で止める。
 *
 * 必要な環境変数（Cloudflare Pages の設定画面で登録する）:
 *   SUPABASE_URL / SUPABASE_SECRET_KEY / BREVO_API_KEY
 */

const SENDER_EMAIL = "news@registro500.com";
const SENDER_NAME = "Registro500 Giappone";

const MAX_NAME = 50;
const MAX_MESSAGE = 2000;
const MAX_PER_HOUR = 5;
const MIN_INTERVAL_MS = 10 * 60 * 1000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function fail(message, status) {
  return json({ success: false, error: message }, status);
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.BREVO_API_KEY) {
    console.error("環境変数が未設定です");
    return fail("サーバー設定が未完了です。運営にお問い合わせください。", 500);
  }

  let form;
  try {
    const payload = await request.json();
    // GAS時代のフロントは {action, formData} で投げてくるので両方受ける
    form = payload.formData || payload;
  } catch (e) {
    return fail("リクエストの形式が不正です。", 400);
  }

  const targetDocId = String(form.targetDocId || "").trim();
  const senderName = String(form.senderName || "").trim();
  const message = String(form.message || "").trim();

  if (!targetDocId) return fail("送信先が指定されていません。", 400);
  if (!senderName || senderName.length > MAX_NAME) return fail("お名前を確認してください。", 400);
  if (!message) return fail("メッセージが空です。", 400);
  if (message.length > MAX_MESSAGE) return fail("メッセージが長すぎます。", 400);

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const svc = {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
  };

  // 送信者＝ログイン中のユーザー。トークンを Supabase Auth に確かめさせ、メールはそこから取る
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return fail("ログインが必要です。ログインし直してください。", 401);

  let sender;
  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) return fail("ログインの有効期限が切れています。ログインし直してください。", 401);
    if (!res.ok) throw new Error(`Auth HTTP ${res.status} / ${await res.text()}`);
    sender = await res.json();
  } catch (e) {
    console.error("Auth 確認エラー:", e);
    return fail("ログイン状態の確認に失敗しました。時間をおいてお試しください。", 502);
  }
  const senderEmail = String((sender && sender.email) || "").trim();
  if (!sender || !sender.id || !senderEmail.includes("@")) {
    return fail("あなたのメールアドレスが正しく取得できていません。ログインし直してください。", 400);
  }

  // 回数制限（inquiry_log は Function だけが読み書きする）
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `${base}/rest/v1/inquiry_log?select=target_doc,created_at`
        + `&sender_uid=eq.${encodeURIComponent(sender.id)}&created_at=gte.${encodeURIComponent(since)}`,
      { headers: svc },
    );
    if (!res.ok) throw new Error(`inquiry_log HTTP ${res.status} / ${await res.text()}`);
    const recent = await res.json();
    if (recent.length >= MAX_PER_HOUR) return fail("送信回数が多すぎます。1時間ほど空けてからお試しください。", 429);
    const sameTarget = recent.find((r) => r.target_doc === targetDocId
      && Date.now() - Date.parse(r.created_at) < MIN_INTERVAL_MS);
    if (sameTarget) return fail("同じオーナーへの連続送信は10分間に1回までです。しばらくお待ちください。", 429);
  } catch (e) {
    console.error("回数確認エラー:", e);
    return fail("送信状況の確認に失敗しました。時間をおいてお試しください。", 502);
  }

  // 送信先をSupabaseから引く
  const url = `${base}/rest/v1/cars`
    + `?select=handle_name,owner_email,accept_inquiry`
    + `&document_id=eq.${encodeURIComponent(targetDocId)}&limit=1`;

  let car;
  try {
    const res = await fetch(url, { headers: svc });
    if (!res.ok) throw new Error(`Supabase HTTP ${res.status} / ${await res.text()}`);
    car = (await res.json())[0];
  } catch (e) {
    console.error("Supabase 参照エラー:", e);
    return fail("送信先の確認に失敗しました。時間をおいてお試しください。", 502);
  }

  const targetEmail = String((car && car.owner_email) || "").trim();
  if (!targetEmail) return fail("送信先が見つかりません。", 404);
  // 未設定(null)は受付とみなす。明示的にfalseのときだけ拒否する（GAS版と同じ扱い）
  if (car.accept_inquiry === false) {
    return fail("このオーナーは問い合わせを受け付けていません。", 403);
  }

  const subject = `【Registro500】${senderName}様からのお問い合わせ`;
  const body = `
${car.handle_name || "オーナー"} 様

Registro500のあなたの車両ページを見て、メッセージが届いています。
このメールにそのまま「返信」すると、相手の方に直接メールが届きます。
（※返信すると、あなたのメールアドレスが相手に伝わりますのでご注意ください）

--------------------------------------------------
送信者: ${senderName} 様
連絡先: ${senderEmail}

【メッセージ】
${message}
--------------------------------------------------
※このメールは Registro500 経由で転送されました。
`;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: targetEmail }],
        replyTo: { name: senderName, email: senderEmail },
        subject,
        textContent: body,
      }),
    });
    if (!res.ok) throw new Error(`Brevo HTTP ${res.status} / ${await res.text()}`);
  } catch (e) {
    console.error("Brevo 送信エラー:", e);
    return fail("メール送信に失敗しました。時間をおいてお試しください。", 502);
  }

  // 送れた分だけ記録する（記録に失敗しても送信自体は成功として返す）
  try {
    await fetch(`${base}/rest/v1/inquiry_log`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ sender_uid: sender.id, sender_email: senderEmail, target_doc: targetDocId }),
    });
  } catch (e) {
    console.error("inquiry_log 記録エラー:", e);
  }

  return json({ success: true });
}
