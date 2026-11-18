// 短い車両ページの URL /car/<番号> → /detail?doc=DOC_<番号>（2026-11-18）
// SNS のプロフィール・共有・QR に出す URL を短くするため。ページ本体は /detail のまま（相対パスの CSS・JS を壊さない）。
// 番号は cars.document_id の DOC_ の後ろ（500・126 で共通の通し番号）。数字でなければ素通し＝通常の 404。
// 【2026-11-19】X は転送（301）の先からカードを作らなかった＝カード用のクローラーにだけ、転送せずに
//   その車の head に書き換えた /detail をそのまま返す（人は従来どおり 301。人に返すと相対パスが /car/ 基準で壊れる）。
// 見分けるクローラーの一覧は detail.js の CARD_BOT_RE（検索エンジンは含めない＝検索は従来どおり 301 で /detail に集める）。
import { withCarHead, CARD_BOT_RE } from "../detail.js";

export async function onRequest({ params, request, env, next, waitUntil }) {
  const no = String(params.no || '');
  if (!/^[1-9][0-9]{0,5}$/.test(no)) return next();
  const dest = new URL('/detail?doc=DOC_' + no, request.url);
  const ua = request.headers.get('user-agent') || '';
  if ((request.method === 'GET' || request.method === 'HEAD') && CARD_BOT_RE.test(ua)) {
    try {
      const page = await env.ASSETS.fetch(new URL('/detail', request.url));
      const res = await withCarHead(page, env, 'DOC_' + no, waitUntil);
      return request.method === 'HEAD' ? new Response(null, res) : res;
    } catch { /* 下の 301 へ */ }
  }
  return Response.redirect(dest.toString(), 301);
}
