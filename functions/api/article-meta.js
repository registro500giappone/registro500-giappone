/**
 * オーナーの記事（ブログなど）の題名・サイト名・日付を読む — POST /api/article-meta
 *
 * 「オーナーの記事」の載せる画面（/my-articles）から { url } を1本ずつ送ってくる。
 * 返すのは <head> の中にある3つだけ:
 *   題名     og:title → twitter:title → <title>
 *   サイト名 og:site_name → ドメイン（www. を外す）
 *   日付     article:published_time 等の meta → JSON-LD の datePublished（日本時間の日付にする）
 *
 * 守る線（正本 owner-articles/HANDOFF.md §1-7）:
 *   - ログイン中で、車を登録しているオーナーからの要求だけ受ける（/api/minkara-title と同じ確かめ方）
 *   - https の記事URLだけ。IPアドレス直書き・localhost・内部向けの名前・既定以外のポートは断る。
 *     リダイレクトは自分で1段ずつ追い、行き先も同じ検査にかける（最大3段）
 *   - <head> が閉じた所（または上限）で読むのをやめる＝本文・写真は取らない・保存しない
 *   - 読めなければ title なしで返す（画面は手入力に落とす）
 *   みんカラ整備手帳の記事URL（…/note.aspx）は画面側で /api/minkara-title へ振り分ける。
 *
 * 必要な環境変数: SUPABASE_URL / SUPABASE_SECRET_KEY（/api/tool-notify と同じ）
 */

const FETCH_TIMEOUT_MS = 8000;
const HEAD_LIMIT = 256 * 1024;
const MAX_REDIRECTS = 3;
const TITLE_MAX = 120;
const SITE_MAX = 60;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// 外へ読みに行ってよいURLか（https・名前で指定・既定のポート・内部向けの名前でない）
export function isSafeTarget(u) {
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const h = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!h || !h.includes(".")) return false;
  if (h.startsWith("[") || /^[\d.]+$/.test(h) || /^0x/i.test(h)) return false; // IP直書き
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|arpa|test|invalid)$/.test(h)) return false;
  return true;
}

// 貼られたURLをそろえる（# と広告計測の utm_* などを落とす・それ以外のクエリは残す＝?p=123 型のブログがある）
export function normalizeArticleUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (/^http:\/\//i.test(s)) s = "https://" + s.slice(7);
  try {
    const u = new URL(s);
    if (!isSafeTarget(u)) return null;
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|igshid$|ref_src$)/i.test(k)) u.searchParams.delete(k);
    }
    const out = u.toString();
    return out.length <= 1000 ? out : null;
  } catch (e) {
    return null;
  }
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function clean(s, max) {
  const t = decodeEntities(String(s || "")).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

// <meta property|name="key" content="…"> を拾う（属性の順番は問わない）
function metaContent(head, keys) {
  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  for (const key of keys) {
    const re = new RegExp(`(?:property|name|itemprop)\\s*=\\s*["']${key.replace(/[.:]/g, "\\$&")}["']`, "i");
    for (const m of metas) {
      if (!re.test(m)) continue;
      const c = m.match(/content\s*=\s*"([^"]*)"/i) || m.match(/content\s*=\s*'([^']*)'/i);
      if (c && c[1].trim()) return c[1];
    }
  }
  return null;
}

export function titleFromHead(head) {
  const t = metaContent(head, ["og:title", "twitter:title"]);
  if (t) return clean(t, TITLE_MAX);
  const m = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? clean(m[1], TITLE_MAX) : null;
}

export function siteFromHead(head, finalUrl) {
  const s = metaContent(head, ["og:site_name", "application-name"]);
  if (s && clean(s, SITE_MAX)) return clean(s, SITE_MAX);
  try { return new URL(finalUrl).hostname.replace(/^www\./, "").slice(0, SITE_MAX); } catch (e) { return null; }
}

// 日付の文字列を日本時間の YYYY-MM-DD に（時刻つきは日本時間へ寄せる・ありえない日付は捨てる）
export function toJstDate(raw) {
  const s = String(raw || "").trim();
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let y, mo, da;
  if (d) {
    y = Number(d[1]); mo = Number(d[2]); da = Number(d[3]);
  } else {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    const j = new Date(t + 9 * 3600 * 1000);
    y = j.getUTCFullYear(); mo = j.getUTCMonth() + 1; da = j.getUTCDate();
  }
  const dt = new Date(Date.UTC(y, mo - 1, da));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== da) return null;
  if (y < 1995 || dt.getTime() > Date.now() + 2 * 86400 * 1000) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
}

export function dateFromHead(head) {
  const m = metaContent(head, [
    "article:published_time", "og:published_time", "og:article:published_time",
    "datePublished", "date", "pubdate", "dc.date", "dcterms.created",
  ]);
  if (m && toJstDate(m)) return toJstDate(m);
  const j = head.match(/"datePublished"\s*:\s*"([^"]+)"/);
  return j ? toJstDate(j[1]) : null;
}

// バイト列を ASCII の範囲だけ文字にする（タグ名・charset の検出用。TextDecoder の対応表に頼らない）
function asciiOf(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i] < 128 ? String.fromCharCode(bytes[i]) : "?";
  return s;
}

// 文字コードを決める（ヘッダー → 先頭の <meta charset>・既定は utf-8）
function charsetOf(res, bytes) {
  const ct = res.headers.get("content-type") || "";
  const h = ct.match(/charset\s*=\s*["']?([\w-]+)/i);
  if (h) return h[1];
  const ascii = asciiOf(bytes.subarray(0, 4096));
  const m = ascii.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
  return m ? m[1] : "utf-8";
}

function decodeBytes(bytes, label) {
  try { return new TextDecoder(label).decode(bytes); }
  catch (e) { return new TextDecoder("utf-8").decode(bytes); }
}

// </head> が来た所（または上限）で読むのをやめる＝本文までは読まない。
// ただし <head> に日付が無いときだけ、JSON-LD の "datePublished" を探して少し先まで読む
// （note など <head> の直後に置くサイトがある）。見つかった所・上限でやめ、それ以外は拾わない
const LD_DATE_RE = /"datePublished"\s*:\s*"([^"]{8,40})"/;
export async function readHead(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0, tail = "", head = null, ldDate = null;
  try {
    while (total < HEAD_LIMIT) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      // タグ名・日付は ASCII の範囲で足りる（区切れ目をまたいでも拾えるよう前の末尾を足す）
      const a = tail + asciiOf(value);
      if (head == null) {
        chunks.push(value);
        if (!/<\/head>/i.test(a)) { tail = a.slice(-6); continue; }
        head = decodeHead(res, chunks, total);
        if (dateFromHead(head)) break;
        const after = a.slice(a.search(/<\/head>/i));
        const m = after.match(LD_DATE_RE);
        if (m) { ldDate = toJstDate(m[1]); break; }
        tail = after.slice(-60);
        continue;
      }
      const m = a.match(LD_DATE_RE);
      if (m) { ldDate = toJstDate(m[1]); break; }
      tail = a.slice(-60);
    }
  } finally {
    try { await reader.cancel(); } catch (e) {}
  }
  if (head == null) head = decodeHead(res, chunks, total);
  return { head, ldDate };
}

function decodeHead(res, chunks, total) {
  const bytes = new Uint8Array(Math.min(total, HEAD_LIMIT));
  let off = 0;
  for (const c of chunks) {
    if (off >= bytes.length) break;
    bytes.set(c.subarray(0, bytes.length - off), off);
    off += c.length;
  }
  const text = decodeBytes(bytes, charsetOf(res, bytes));
  const i = text.search(/<\/head>/i);
  return i === -1 ? text : text.slice(0, i);
}

// リダイレクトを1段ずつ追い、行き先ごとに isSafeTarget を確かめる
async function fetchArticle(url) {
  let cur = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(cur, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Registro500LinkCard/1.0; +https://www.registro500.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ja",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      try { await res.body?.cancel(); } catch (e) {}
      if (!loc) return { res: null, reason: "bad_redirect" };
      let next;
      try { next = new URL(loc, cur); } catch (e) { return { res: null, reason: "bad_redirect" }; }
      if (next.protocol === "http:") next.protocol = "https:";
      if (!isSafeTarget(next)) return { res: null, reason: "unsafe_redirect" };
      cur = next.toString();
      continue;
    }
    return { res, finalUrl: cur };
  }
  return { res: null, reason: "too_many_redirects" };
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    console.error("環境変数が未設定です");
    return json({ success: false }, 500);
  }

  let url;
  try {
    url = normalizeArticleUrl((await request.json()).url);
  } catch (e) {
    return json({ success: false }, 400);
  }
  if (!url) return json({ success: false, reason: "bad_url" }, 400);

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

  const empty = { success: true, url, title: null, site_name: null, published_on: null };
  try {
    const { res, finalUrl, reason } = await fetchArticle(url);
    if (!res) return json({ ...empty, reason });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !res.body || (ct && !/text\/html|application\/xhtml/i.test(ct))) {
      try { await res.body?.cancel(); } catch (e) {}
      return json({ ...empty, site_name: siteFromHead("", finalUrl), reason: res.ok ? "not_html" : `http_${res.status}` });
    }
    const { head, ldDate } = await readHead(res);
    return json({
      success: true,
      url,
      title: titleFromHead(head),
      site_name: siteFromHead(head, finalUrl),
      published_on: dateFromHead(head) || ldDate,
    });
  } catch (e) {
    console.error("記事の読み取りエラー:", e);
    return json({ ...empty, reason: "fetch_failed" });
  }
}
