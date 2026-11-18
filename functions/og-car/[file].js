/**
 * SNS カードの写真 /og-car/<番号>.jpg — その車の表紙の写真を 1200×630 にして返す（2026-11-19）
 *
 * なぜ自前の短い URL か: Cloudflare の画像変換の URL（/cdn-cgi/image/…/<Firebase の URL>）を og:image に直接書くと、
 *   中の %2F・%23・?token= を X がほどいて取りに行き、変換が 404/400 になってカードが出なかった。
 * 写真は上下を切らず、左右をサイトの地色 #e3dac4 で埋める（fit=pad）。
 * 変換は fetch の cf.image で行い、効かなかったとき（cf-resized が無い）は /cdn-cgi/image/… へ 302 で回す。
 * 番号の形が違う・車が無い・写真が Firebase でないときは、サイト共通の絵 /og/site-ja.png へ 302。
 */
const SB_URL = "https://ttlttclfovuzafvghvaq.supabase.co";
// 公開キー（config.js で全訪問者に配っている値・RLS が効く）。環境変数があればそちらを使う
const PUBLISHABLE = "sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt";
const FILE_RE = /^([1-9][0-9]{0,5})\.jpg$/;
const FIREBASE_RE = /^https:\/\/firebasestorage\.googleapis\.com\//;
const SITE_IMAGE = "https://www.registro500.com/og/site-ja.png";
const OPTS = { width: 1200, height: 630, fit: "pad", background: "#e3dac4", format: "jpeg" };

async function photoOf(env, doc) {
  const key = env.SUPABASE_PUBLISHABLE_KEY || PUBLISHABLE;
  const r = await fetch(`${SB_URL}/rest/v1/cars?select=photo_main&document_id=eq.${doc}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return (rows[0] && rows[0].photo_main) || null;
}

export async function onRequestGet({ params, env }) {
  const m = FILE_RE.exec(String(params.file || ""));
  if (!m) return Response.redirect(SITE_IMAGE, 302);
  let photo = null;
  try { photo = await photoOf(env, `DOC_${m[1]}`); } catch { photo = null; }
  if (!photo || !FIREBASE_RE.test(photo)) return Response.redirect(SITE_IMAGE, 302);

  try {
    const img = await fetch(photo, { cf: { image: OPTS } });
    if (img.ok && img.headers.get("cf-resized")) {
      const res = new Response(img.body, img);
      res.headers.set("Content-Type", "image/jpeg");
      res.headers.set("Cache-Control", "public, max-age=86400");
      return res;
    }
  } catch { /* 下の 302 へ */ }
  const bg = encodeURIComponent(OPTS.background);
  return Response.redirect(
    `https://www.registro500.com/cdn-cgi/image/width=1200,height=630,fit=pad,background=${bg},format=jpeg/${photo}`, 302);
}
