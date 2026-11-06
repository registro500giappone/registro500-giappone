/**
 * おすすめ工具の購入リンクを、管理人メールの候補から選んで掲載する — /api/tool-pick
 *
 *   GET  ?id=<tool_id>&t=<token>&i=<候補の番号>  … 確認画面（ここでは何も書き換えない）
 *   POST 同じ値をフォームで                      … owner_tools.amazon_url に入れて公開
 *
 * GET で書き換えないのは、メールのリンクを先読みするセキュリティ機能に押されないため。
 * token は owner_tool_amazon_picks にだけある合言葉（anon からは読めない）＝知っているのはメールの宛先だけ。
 * 候補を書くのは管理人のローカルPC（py/tool_pick.py --local）。
 *
 * 必要な環境変数: SUPABASE_URL / SUPABASE_SECRET_KEY
 */

const SITE = "https://www.registro500.com";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function page(title, inner, status = 200) {
  return new Response(`<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>body{font-family:sans-serif;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.7;color:#222;background:#faf7f0}
.box{background:#fff;border:1px solid #ddd;border-radius:12px;padding:20px}
button{background:#1f5a3a;color:#fff;border:0;border-radius:10px;padding:14px 20px;font-size:16px;width:100%;cursor:pointer}
a{color:#1f5a3a}.muted{color:#777;font-size:14px}</style></head>
<body><div class="box">${inner}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

async function load(env, id, t, i) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{20,}$/.test(t) || !/^\d$/.test(i)) return { err: "リンクの形が正しくありません。" };
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const svc = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` };
  const res = await fetch(`${base}/rest/v1/owner_tool_amazon_picks?select=token,candidates,picked_at&tool_id=eq.${id}&limit=1`, { headers: svc });
  if (!res.ok) throw new Error(`picks HTTP ${res.status}`);
  const row = (await res.json())[0];
  if (!row || row.token !== t) return { err: "このリンクは使えません。" };
  const cand = (row.candidates || [])[Number(i)];
  if (!cand || !/^https:\/\/www\.amazon\.co\.jp\/dp\/[A-Z0-9]{10}\?tag=registro500tl-22$/.test(cand.url)) return { err: "候補が見つかりません。" };
  const tRes = await fetch(`${base}/rest/v1/owner_tools?select=name,amazon_url&id=eq.${id}&limit=1`, { headers: svc });
  if (!tRes.ok) throw new Error(`owner_tools HTTP ${tRes.status}`);
  const tool = (await tRes.json())[0];
  if (!tool) return { err: "投稿が見つかりません（消された可能性があります）。" };
  return { base, svc, row, cand, tool };
}

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const id = q.get("id") || "", t = q.get("t") || "", i = q.get("i") || "";
  try {
    const r = await load(env, id, t, i);
    if (r.err) return page("使えないリンク", `<p>${esc(r.err)}</p>`, 400);
    const now = r.tool.amazon_url
      ? `<p class="muted">いま付いているリンク：<a href="${esc(r.tool.amazon_url)}" target="_blank" rel="noopener">${esc(r.tool.amazon_url)}</a><br>掲載すると置き換わります。</p>` : "";
    return page("購入リンクを掲載", `<h2>${esc(r.tool.name)}</h2>
<p>この商品の購入リンクを掲載します。</p>
<p><strong>${esc(r.cand.title)}</strong><br><a href="${esc(r.cand.url)}" target="_blank" rel="noopener">Amazonで確かめる ›</a></p>
${now}
<form method="post"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="t" value="${esc(t)}"><input type="hidden" name="i" value="${esc(i)}">
<button type="submit">この商品で掲載する</button></form>`);
  } catch (e) {
    console.error("tool-pick GET エラー:", e);
    return page("エラー", "<p>読み込みに失敗しました。少し待ってからもう一度開いてください。</p>", 502);
  }
}

export async function onRequestPost({ request, env }) {
  let f;
  try { f = await request.formData(); } catch { return page("エラー", "<p>送信の形が正しくありません。</p>", 400); }
  const id = String(f.get("id") || ""), t = String(f.get("t") || ""), i = String(f.get("i") || "");
  try {
    const r = await load(env, id, t, i);
    if (r.err) return page("使えないリンク", `<p>${esc(r.err)}</p>`, 400);
    const put = await fetch(`${r.base}/rest/v1/owner_tools?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...r.svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ amazon_url: r.cand.url }),
    });
    if (!put.ok) throw new Error(`owner_tools PATCH HTTP ${put.status}`);
    await fetch(`${r.base}/rest/v1/owner_tool_amazon_picks?tool_id=eq.${id}`, {
      method: "PATCH",
      headers: { ...r.svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ picked_index: Number(i), picked_at: new Date().toISOString() }),
    });
    return page("掲載しました", `<h2>掲載しました</h2><p>${esc(r.tool.name)} に<br><strong>${esc(r.cand.title)}</strong><br>の購入リンクを付けました。</p>
<p><a href="${SITE}/tools">おすすめ工具・パーツの一覧で見る ›</a></p>`);
  } catch (e) {
    console.error("tool-pick POST エラー:", e);
    return page("エラー", "<p>掲載に失敗しました。少し待ってからもう一度押してください。</p>", 502);
  }
}
