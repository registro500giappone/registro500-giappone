/**
 * CSP 違反レポートの受け口 — POST /api/csp-report
 *
 * `_headers` の Content-Security-Policy-Report-Only（report-uri）からブラウザが送ってくる。
 * ブロックはしていない（Report-Only）ので、ここは「どのページで・どのディレクティブが・
 * 何を引っかけたか」を数えて csp_reports に束ねるだけ。読むときは SQL で
 *   select page, directive, blocked, hits, last_seen from csp_reports order by hits desc;
 *
 * 落とすもの：
 *   - ブラウザ拡張が注入したもの（chrome-extension: 等）＝サイト側では何もできない
 *   - 当サイト以外のページからの報告（他人がこの URL に投げてきたもの）
 *   - 16KB を超える本文・1回に 10 件を超える分
 * 同じ（page, directive, blocked）は1行に hits を足すだけなので、荒らされても行数は増えにくい。
 * 応答はどんな入力でも 204（中身を見て挙動を変えると、外から探る材料になる）。
 *
 * 必要な環境変数（Cloudflare Pages の設定画面。inquiry.js と同じもの）:
 *   SUPABASE_URL / SUPABASE_SECRET_KEY
 */

const MAX_BODY = 16 * 1024;
const MAX_REPORTS = 10;
const OUR_HOSTS = new Set(["www.registro500.com", "registro500.com"]);
const EXTENSION = /^(chrome|moz|safari-web|ms-browser|edge)-extension:/;

const ok = () => new Response(null, { status: 204 });

function pathOnOurSite(uri) {
  try {
    const u = new URL(String(uri || ""));
    if (OUR_HOSTS.has(u.hostname) || u.hostname.endsWith(".pages.dev")) return u.pathname;
  } catch (e) { /* 相対値や空 */ }
  return null;
}

const cut = (v, n) => (v == null ? null : String(v).slice(0, n));

// report-uri 形式 {"csp-report": {"document-uri": …}} と
// Reporting API 形式 [{"type": "csp-violation", "body": {"documentURL": …}}] の両方を同じ形に直す
function normalize(payload) {
  const raw = [];
  if (Array.isArray(payload)) {
    for (const r of payload) if (r && typeof r.body === "object") raw.push(r.body);
  } else if (payload && typeof payload["csp-report"] === "object") {
    raw.push(payload["csp-report"]);
  }
  return raw.slice(0, MAX_REPORTS).map((b) => ({
    page: pathOnOurSite(b["document-uri"] || b.documentURL),
    directive: cut(b["effective-directive"] || b.effectiveDirective || b["violated-directive"] || b.violatedDirective, 60),
    blocked: cut(b["blocked-uri"] || b.blockedURL || "", 300),
    source: cut(b["source-file"] || b.sourceFile, 300),
    line: Number.isFinite(Number(b["line-number"] ?? b.lineNumber)) ? Number(b["line-number"] ?? b.lineNumber) : null,
  }));
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return ok();

  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return ok();

  let payload;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return ok();
    payload = JSON.parse(text);
  } catch (e) {
    return ok();
  }

  const ua = cut(request.headers.get("user-agent"), 200);
  const reports = normalize(payload).filter(
    (r) => r.page && r.directive && !EXTENSION.test(r.blocked) && !EXTENSION.test(r.source || ""),
  );
  if (!reports.length) return ok();

  const rpc = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/csp_report_log`;
  const headers = {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
  for (const r of reports) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_page: r.page,
          p_directive: r.directive,
          p_blocked: r.blocked,
          p_source: r.source,
          p_line: r.line,
          p_ua: ua,
        }),
      });
      if (!res.ok) console.error("csp_report_log HTTP", res.status, await res.text());
    } catch (e) {
      console.error("csp_report_log 失敗:", e);
    }
  }
  return ok();
}

export function onRequest() {
  // POST 以外は何も返さない
  return new Response(null, { status: 405 });
}
