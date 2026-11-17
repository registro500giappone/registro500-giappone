/**
 * send-auth-email
 * Supabase Auth "Send Email Hook" 用 Edge Function
 *
 * Supabase標準のメール送信（HTML単体・送信元news@registro500.com共用）を置き換える。
 * 目的: ①text/plain併記のmultipartにしてキャリアメールでの本文消失を回避
 *       ②ログイン用メールの送信元をニュース配信と分離し「一斉配信」誤分類を回避
 *
 * 対応する email_action_type: 'magiclink' / 'signup'（OTPログイン）・'email_change'（メール変更）
 * 未対応のtypeは汎用テンプレートでフォールバック送信する（無言で握りつぶさない）。
 *
 * 必須のSupabase Edge Function Secrets（ダッシュボードで設定・ユーザー作業）:
 *   BREVO_API_KEY         - Brevo送信用APIキー（送信権限あり。py/.envのBREVO_API_KEYと同じ想定）
 *   AUTH_SENDER_EMAIL      - ログイン/認証メール専用の送信元（例: auth@registro500.com）
 *                            Brevo側で送信元として検証済みであること。未設定なら500を返す
 *                            （news@registro500.comへ黙ってフォールバックしない＝今回の不具合の再発防止）
 *   SEND_EMAIL_HOOK_SECRET - Auth Hook有効化時にSupabaseが発行する whsec_... 形式の署名鍵
 *
 * Supabase側の設定（ダッシュボード・ユーザー作業、Claude側では実行不可）:
 *   Authentication > Hooks > Send Email Hook を有効化し、
 *   この関数のURL（https://<project>.supabase.co/functions/v1/send-auth-email）を指定。
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "npm:standardwebhooks@1.0.0";

const BRAND_HEADER = "Registro500/126 Giappone";
const SITE_URL = "https://www.registro500.com";
// ほかのメール（py/mail_html.py・functions/_lib/mail_html.js）と同じ外枠＝クリームの地にロゴ（画像の背景も同じ色で焼き込み済）・白いカードに本文・下にフッター。
// 画像を止めているアプリでは alt の文字が出る。ログインのメールなのでロゴにリンクは付けない。
const C = { bg: "#f5f0e6", card: "#fffefb", border: "#d6c9b0", text: "#2e2a24", sub: "#7a705f", accent: "#1f5c3d" };
const FONT = "-apple-system,BlinkMacSystemFont,Hiragino Sans,Hiragino Kaku Gothic ProN,Meiryo,sans-serif";
const LOGOS: [string, string][] = [
  [`${SITE_URL}/mail/logo500-mail-v2.png`, "Registro500 Giappone"],
  [`${SITE_URL}/mail/logo126-mail-v2.png`, "Registro126 Giappone"],
];
const LOGO_ROW =
  `<tr><td align="center" style="padding:4px 4px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
  LOGOS.map(([src, alt]) =>
    `<td align="center" style="padding:0 8px;"><img src="${src}" width="150" alt="${alt}" ` +
    `style="display:block;width:150px;max-width:100%;height:auto;border:0;font-size:14px;font-weight:bold;color:${C.accent};"></td>`
  ).join("") +
  `</tr></table></td></tr>`;

interface EmailData {
  token: string;
  token_hash: string;
  email_action_type: string;
  redirect_to: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
}

interface HookPayload {
  user: { email: string };
  email_data: EmailData;
}

function buildContent(actionType: string, token: string): { subject: string; html: string; text: string } {
  if (actionType === "email_change") {
    const subject = "【Registro500/126】メールアドレス変更の確認コード（6桁）";
    const lead = "メールアドレスの変更を承りました。確認のためコードをお送りします。";
    const sub = "マイガレージの変更画面に、下の6桁の数字を入力してください。入力が完了すると、このメールアドレスが新しい登録アドレスになります。";
    const notice =
      "このメールは、あなたがマイガレージでメールアドレスの変更手続きをされたためにお送りしています。心当たりがない場合は、このメールを破棄してください。コードを入力しなければ、変更は行われません。このコードは、あなただけがお使いください。運営者を含め、第三者がこのコードをお尋ねすることは決してありません。";
    return { subject, html: buildHtml(lead, sub, token, notice), text: buildText(lead, sub, token, notice) };
  }

  if (actionType === "magiclink" || actionType === "signup") {
    const subject = "【Registro500/126】ログイン用の確認コード（6桁）";
    const lead = "マイガレージのログイン用に、確認コードをお送りします。";
    const sub = "サイトのログイン画面に、下の6桁の数字を入力してください。";
    const notice =
      "このメールは、あなたがマイガレージでログイン手続きをされたためにお送りしています。心当たりがない場合は、このメールを破棄してください。何も操作は不要です。このコードは、あなただけがお使いください。運営者を含め、第三者がこのコードをお尋ねすることは決してありません。";
    return { subject, html: buildHtml(lead, sub, token, notice), text: buildText(lead, sub, token, notice) };
  }

  // 未対応のtype（recovery/invite等）向け汎用フォールバック。無言で握りつぶさない。
  const subject = "【Registro500/126】確認コード（6桁）";
  const lead = "手続きの確認用にコードをお送りします。";
  const sub = "画面の案内に従って、下の6桁の数字を入力してください。";
  const notice =
    "このメールは、あなたが registro500.com で何らかの手続きをされたためにお送りしています。心当たりがない場合は、このメールを破棄してください。";
  return { subject, html: buildHtml(lead, sub, token, notice), text: buildText(lead, sub, token, notice) };
}

// HTML単体だとキャリアメールで本文が消えることがある教訓を踏まえ、装飾を最小限に留める。
// 過去の事故教訓: style属性内のシングルクォート・HTMLコメント・rgba/box-shadowは使わない。
function buildHtml(lead: string, sub: string, token: string, notice: string): string {
  return (
    `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">` +
    `</head><body style="margin:0;padding:0;background:${C.bg};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};"><tr><td align="center" style="padding:20px 10px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${FONT};">` +
    LOGO_ROW +
    `<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:26px 22px;">` +
    `<p style="margin:0 0 6px;font-size:15px;line-height:1.8;color:${C.text};">${lead}</p>` +
    `<p style="margin:0 0 18px;font-size:13px;line-height:1.8;color:${C.sub};">${sub}</p>` +
    `<p style="margin:0 0 8px;padding:16px 0;background:${C.bg};border-radius:8px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:${C.accent};font-family:Menlo,Consolas,monospace;">${token}</p>` +
    `<p style="margin:0;font-size:12px;color:${C.sub};text-align:center;">このコードは一定時間（およそ1時間）のみ有効です。</p>` +
    `<p style="margin:20px 0 0;padding-top:14px;border-top:1px solid ${C.border};font-size:11px;line-height:1.8;color:${C.sub};">${notice}</p>` +
    `</td></tr>` +
    `<tr><td style="padding:18px 8px 8px;font-size:12px;line-height:1.7;color:${C.sub};text-align:center;">${BRAND_HEADER}<br>${SITE_URL}</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}

function buildText(lead: string, sub: string, token: string, notice: string): string {
  return [BRAND_HEADER, "", lead, sub, "", `確認コード: ${token}`, "", "このコードは一定時間（およそ1時間）のみ有効です。", "", notice, "", `${BRAND_HEADER}　${SITE_URL}`].join(
    "\n"
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const rawHookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("AUTH_SENDER_EMAIL");

  if (!rawHookSecret || !brevoKey || !senderEmail) {
    console.error("Missing required secret(s): SEND_EMAIL_HOOK_SECRET / BREVO_API_KEY / AUTH_SENDER_EMAIL");
    return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });
  }
  // Supabaseダッシュボードが表示する値は "v1,whsec_..." 形式だが、
  // standardwebhooksライブラリにはバージョン接頭辞を除いた実体だけを渡す（公式サンプル準拠）。
  const hookSecret = rawHookSecret.replace("v1,whsec_", "");

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let verified: HookPayload;
  try {
    const wh = new Webhook(hookSecret);
    verified = wh.verify(payload, headers) as HookPayload;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const { user, email_data } = verified;
  const token = email_data.token_new || email_data.token;
  const { subject, html, text } = buildContent(email_data.email_action_type, token);

  const brevoResp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify({
      sender: { name: "Registro500/126", email: senderEmail },
      to: [{ email: user.email }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!brevoResp.ok) {
    const errText = await brevoResp.text();
    console.error("Brevo send failed:", brevoResp.status, errText);
    return new Response(JSON.stringify({ error: "Email send failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
});
