/**
 * メールのワンクリック配信停止 — /api/unsubscribe?t=<札>（2026-11-17・312 と同じ形）
 *
 * お知らせメールの List-Unsubscribe ヘッダーの行き先。Gmail などの「登録解除」ボタンはここへ POST する（RFC 8058）。
 * これが無いと Brevo が自動で付ける自分の停止リンクが使われ、その送信元（news@）からのメールが Brevo 側で全部止まる
 * （312 で実測）。ここで止めればそのお知らせの種類（朝の新着・反応のお知らせ・週刊便り）だけが止まる。
 *
 *   POST … 札が合えば mail_unsubscribe() で止める（何度押しても同じ）。応答はいつも 200（札の当否を外から探らせない）
 *   GET  … 止めずに /unsubscribe?t=<札> の確認ページへ送る（メールの安全確認ソフトがリンクを開いただけで止まらないように）
 *
 * 秘密キーは使わない＝公開キーで public.mail_unsubscribe（security definer）を呼ぶだけ。
 */
const SB_URL = "https://ttlttclfovuzafvghvaq.supabase.co";
// 公開キー（config.js と同じ・全訪問者に配られている値）
const PUBLISHABLE = "sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const token = request => new URL(request.url).searchParams.get("t") || "";

export async function onRequestPost({ request, env }) {
  const t = token(request);
  if (UUID.test(t)) {
    const key = env.SUPABASE_PUBLISHABLE_KEY || PUBLISHABLE;
    try {
      await fetch(`${SB_URL}/rest/v1/rpc/mail_unsubscribe`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: t }),
      });
    } catch (e) { /* 失敗しても応答は同じ（メールの「配信を止める」リンクからも止められる） */ }
  }
  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function onRequestGet({ request }) {
  const t = token(request);
  const to = new URL("/unsubscribe" + (UUID.test(t) ? `?t=${t}` : ""), request.url);
  return Response.redirect(to.toString(), 302);
}
