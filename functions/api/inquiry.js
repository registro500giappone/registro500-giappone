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
 * 必要な環境変数（Cloudflare Pages の設定画面で登録する）:
 *   SUPABASE_URL / SUPABASE_SECRET_KEY / BREVO_API_KEY
 */

const SENDER_EMAIL = "news@registro500.com";
const SENDER_NAME = "Registro500 Giappone";

const MAX_NAME = 50;
const MAX_MESSAGE = 2000;

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
  const senderEmail = String(form.senderEmail || "").trim();
  const message = String(form.message || "").trim();

  if (!targetDocId) return fail("送信先が指定されていません。", 400);
  if (!senderName || senderName.length > MAX_NAME) return fail("お名前を確認してください。", 400);
  if (!senderEmail.includes("@")) {
    return fail("あなたのメールアドレスが正しく取得できていません。ログインし直してください。", 400);
  }
  if (!message) return fail("メッセージが空です。", 400);
  if (message.length > MAX_MESSAGE) return fail("メッセージが長すぎます。", 400);

  // 送信先をSupabaseから引く
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/cars`
    + `?select=handle_name,owner_email,accept_inquiry`
    + `&document_id=eq.${encodeURIComponent(targetDocId)}&limit=1`;

  let car;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      },
    });
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

  return json({ success: true });
}
