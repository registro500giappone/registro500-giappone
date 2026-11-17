/**
 * 兄弟サイト（Registro312／Registro Scorpione）へ「この人は Registro500 のこのアカウントの本人」と伝える証明 — POST /api/sister-assert
 *
 * 2台持ち（クラシック＋3代目）のオーナーが、メールアドレスが違っても 500 と 312 のアカウントを「つなぐ」ためのもの。
 * ログイン中の本人を確かめ、署名した短い証明を返す。312 側（Edge Function）は公開鍵で確かめるだけ。
 *
 * 要求: Authorization: Bearer <500 のアクセストークン>、本文 { use, aud }
 *   use = "link"：312 につなぐ（aud＝戻り先のサイトの origin・期限30分＝312 の登録が終わるまで持つため）
 *   use = "ask" ：500 のマイガレージから 312 に「つないだ車は？」と尋ねる（aud＝"classic-cars"・期限5分）
 * 返す: { proof }  proof ＝ base64url(中身の JSON) + "." + base64url(Ed25519 の署名)
 *   中身 ＝ { iss:"registro500", sub:<500 のアカウント ID>, aud, use, iat, exp, jti, hn?, pref? }
 *   hn・pref（ハンドルネーム・都道府県）は link のときだけ＝312 の登録画面で最初から入れておくため（車両ページで公開している値）
 *
 * 守る線:
 *   - メールアドレスは証明に入れない（312 に写さない）
 *   - 秘密鍵は Pages の環境変数 SISTER_SIGN_KEY（PKCS8 の base64）だけ。312 は公開鍵しか持たない＝312 が漏れても証明は作れない
 *   - 本人の確認は 500 の公開キーで /auth/v1/user（service キーは使わない）。ハンドルネームも本人のトークンで読む（RLS の範囲）
 *   - use と aud を取り違えさせない（ask の証明ではつなげない・link の証明では尋ねられない＝312 側でも確かめる）
 *
 * 必要な環境変数: SUPABASE_URL / SISTER_SIGN_KEY
 */

// 公開キー（config.js と同じ・誰に見られてもよい種類）
const PUBLISHABLE_KEY = "sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt";
// つなぐ証明を渡してよい戻り先（312 の登録・マイガレージ）
export const LINK_AUDS = [
  "https://registro312.com",
  "https://registroscorpione.com",
  "http://localhost:8731",
  "http://localhost:8732",
];
const TTL = { link: 30 * 60, ask: 5 * 60 };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let keyCache = null;
async function signKey(b64) {
  if (keyCache && keyCache.src === b64) return keyCache.key;
  const der = Uint8Array.from(atob(b64.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
  keyCache = { src: b64, key };
  return key;
}

// 中身に署名して証明の文字列にする（テストからも使う）
export async function makeProof(claims, keyB64) {
  const body = b64url(new TextEncoder().encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, await signKey(keyB64), new TextEncoder().encode(body));
  return body + "." + b64url(new Uint8Array(sig));
}

export async function onRequestPost({ request, env }) {
  if (!env.SISTER_SIGN_KEY || !env.SUPABASE_URL) return json({ error: "not_ready" }, 503);
  let req;
  try { req = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  const use = req && req.use;
  const aud = req && req.aud;
  if (use === "link") { if (!LINK_AUDS.includes(aud)) return json({ error: "bad_aud" }, 400); }
  else if (use === "ask") { if (aud !== "classic-cars") return json({ error: "bad_aud" }, 400); }
  else return json({ error: "bad_use" }, 400);

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ error: "login" }, 401);
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const asUser = { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };

  let user;
  try {
    const res = await fetch(`${base}/auth/v1/user`, { headers: asUser });
    if (!res.ok) return json({ error: "login" }, 401);
    user = await res.json();
  } catch (e) {
    console.error("Auth 確認エラー:", e);
    return json({ error: "upstream" }, 502);
  }
  if (!user || !user.id) return json({ error: "login" }, 401);

  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: "registro500", sub: user.id, aud, use, iat: now, exp: now + TTL[use], jti: crypto.randomUUID() };
  if (use === "link") {
    // 本人の車（いちばん新しく直した1台）のハンドルネームと都道府県。読めなくても証明は出す（312 で入力すればよい）
    try {
      const r = await fetch(`${base}/rest/v1/cars?select=handle_name,prefecture&owner_user_id=eq.${user.id}&order=updated_at.desc.nullslast&limit=1`, { headers: asUser });
      const car = r.ok ? (await r.json())[0] : null;
      if (car && car.handle_name) claims.hn = String(car.handle_name).slice(0, 40);
      if (car && car.prefecture) claims.pref = String(car.prefecture).slice(0, 10);
    } catch (e) { console.error("車の読み込みエラー:", e); }
  }
  try {
    return json({ proof: await makeProof(claims, env.SISTER_SIGN_KEY), exp: claims.exp });
  } catch (e) {
    console.error("署名エラー:", e);
    return json({ error: "sign" }, 500);
  }
}
