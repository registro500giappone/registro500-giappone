// 短い車両ページの URL /car/<番号> → /detail?doc=DOC_<番号>（2026-11-18）
// SNS のプロフィール・共有・QR に出す URL を短くするため。ページ本体は /detail のまま（相対パスの CSS・JS を壊さない）。
// 番号は cars.document_id の DOC_ の後ろ（500・126 で共通の通し番号）。数字でなければ素通し＝通常の 404。
export function onRequest({ params, request, next }) {
  const no = String(params.no || '');
  if (!/^[1-9][0-9]{0,5}$/.test(no)) return next();
  return Response.redirect(new URL('/detail?doc=DOC_' + no, request.url).toString(), 301);
}
