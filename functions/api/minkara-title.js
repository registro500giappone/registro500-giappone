/**
 * みんカラの整備手帳記事の題名を読む — POST /api/minkara-title
 *
 * マイ整備手帳の「みんカラの記事を載せる」から { url } を1本ずつ送ってくる。
 * 返すのは記事の og:title（リンクカード用の題名）から先頭の [車名] を落としたものだけ。
 *
 * 守る線:
 *   - ログイン中で、車を登録しているオーナーからの要求だけ受ける（/auth/v1/user と cars で確かめる）
 *   - 対象は minkara.carview.co.jp の整備手帳記事URL（/userid/数字/car/数字/数字/note.aspx）だけ
 *   - 1回の要求で1本。読むのは <head> の中だけで、本文・写真・作業日は取らない・保存しない
 *   - 読めなければ title なしで返す（画面は手入力に落とす）
 *   同じURLを二度読まない・間隔を空けて順に送るのは画面側（読んだ題名は記録として保存される）。
 *
 * 必要な環境変数: SUPABASE_URL / SUPABASE_SECRET_KEY（/api/tool-notify と同じ）
 */

const NOTE_RE = /^https:\/\/minkara\.carview\.co\.jp\/userid\/\d+\/car\/\d+\/\d+\/note\.aspx$/;
const FETCH_TIMEOUT_MS = 8000;
const HEAD_LIMIT = 200 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// 貼られたURLを正規の形にそろえる（http→https・スマホ版の /smart/ を外す・? と # を落とす）
export function normalizeNoteUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.hostname !== "minkara.carview.co.jp") return null;
    const path = u.pathname.replace(/^\/smart\//, "/");
    const out = `https://minkara.carview.co.jp${path}`;
    return NOTE_RE.test(out) ? out : null;
  } catch (e) {
    return null;
  }
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// <head> の文字列から og:title を取り、先頭の [車名] を落とす
export function titleFromHead(head) {
  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  for (const m of metas) {
    if (!/property\s*=\s*["']og:title["']/i.test(m)) continue;
    const c = m.match(/content\s*=\s*"([^"]*)"/i) || m.match(/content\s*=\s*'([^']*)'/i);
    if (!c) continue;
    const t = decodeEntities(c[1]).replace(/^\s*\[[^\]]*\]\s*/, "").replace(/\s+/g, " ").trim();
    return t ? t.slice(0, 80) : null;
  }
  return null;
}

// 本文まで読まないよう、</head> が来たら（または上限で）読むのをやめる
async function readHead(res) {
  const reader = res.body.getReader();
  const dec = new TextDecoder("utf-8");
  let text = "";
  try {
    while (text.length < HEAD_LIMIT) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      const i = text.search(/<\/head>/i);
      if (i !== -1) { text = text.slice(0, i); break; }
    }
  } finally {
    try { await reader.cancel(); } catch (e) {}
  }
  return text;
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    console.error("環境変数が未設定です");
    return json({ success: false }, 500);
  }

  let url;
  try {
    url = normalizeNoteUrl((await request.json()).url);
  } catch (e) {
    return json({ success: false }, 400);
  }
  if (!url) return json({ success: false, reason: "not_note_url" }, 400);

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const svc = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` };

  // 本人の確認（ログイン中で、車を登録しているオーナー）
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ success: false }, 401);
  let user;
  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return json({ success: false }, 401);
    user = await res.json();
  } catch (e) {
    console.error("Auth 確認エラー:", e);
    return json({ success: false }, 502);
  }
  if (!user || !user.id) return json({ success: false }, 401);
  try {
    const email = String(user.email || "").toLowerCase();
    const filter = email
      ? `or=(owner_user_id.eq.${user.id},owner_email.ilike.${encodeURIComponent(email)})`
      : `owner_user_id=eq.${user.id}`;
    const cRes = await fetch(`${base}/rest/v1/cars?select=document_id&${filter}&limit=1`, { headers: svc });
    if (!cRes.ok) throw new Error(`cars HTTP ${cRes.status}`);
    if (!(await cRes.json()).length) return json({ success: false }, 403);
  } catch (e) {
    console.error("車の確認エラー:", e);
    return json({ success: false }, 502);
  }

  // 題名を読む
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Registro500LinkCard/1.0; +https://www.registro500.com)",
        Accept: "text/html",
        "Accept-Language": "ja",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok || !res.body) return json({ success: true, url, title: null, reason: `http_${res.status}` });
    const title = titleFromHead(await readHead(res));
    return json({ success: true, url, title });
  } catch (e) {
    console.error("みんカラの読み取りエラー:", e);
    return json({ success: true, url, title: null, reason: "fetch_failed" });
  }
}
