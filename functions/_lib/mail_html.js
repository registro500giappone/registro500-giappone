/**
 * メールの HTML 版を組み立てる（py/mail_html.py の JS 版・2026-11-10）
 *
 * Cloudflare Functions から送るメール（登録のお礼・工具の新着通知）を、
 * 朝のダイジェスト・週刊便りと同じ体裁にそろえるためのもの。
 * ⚠️ 読み取る決まりと配色は py/mail_html.py と同じにする（片方を直したらもう片方も直す）。
 *
 *   ■ 見出し                     → 見出し（次の行が「一覧：URL」なら「一覧を見る →」）
 *   ・項目名 ＋ 次の行が「　URL」 → 項目名そのものをリンクに
 *   【題名】                      → 太字の小見出し
 *   URL だけの行                  → 「ページを開く」ボタン（/unsubscribe は除く）
 *   -----（区切り線）以降          → フッター
 *
 * このファイルは onRequest を export しないのでルートにはならない（import 用）。
 */

const C_BG = "#f5f0e6";
const C_CARD = "#fffefb";
const C_BORDER = "#d6c9b0";
const C_TEXT = "#2e2a24";
const C_SUB = "#7a705f";
const C_ACCENT = "#1f5c3d";
const C_ACCENT_SOFT = "#e7efe7";

const FONT = "-apple-system,BlinkMacSystemFont,'Hiragino Sans','Hiragino Kaku Gothic ProN',"
  + "'Noto Sans JP',Meiryo,sans-serif";

const URL_RE = /https?:\/\/[^\s<>"]+/g;
const URL_ONLY_RE = /^[　 ]*(https?:\/\/[^\s<>"]+)\s*$/;
const DIVIDER_RE = /^-{10,}$/;

const SITE_URL = "https://www.registro500.com";
const LOGOS = [
  [`${SITE_URL}/mail/logo500-mail.png`, "Registro500 Giappone", `${SITE_URL}/`],
  [`${SITE_URL}/mail/logo126-mail.png`, "Registro126 Giappone", `${SITE_URL}/126/`],
];
const LOGO_W = 150;

function esc(s, quote = true) {
  let r = String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (quote) r = r.replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  return r;
}

function linkify(s) {
  let out = "", pos = 0;
  for (const m of s.matchAll(URL_RE)) {
    out += esc(s.slice(pos, m.index), false);
    const u = m[0];
    out += `<a href="${esc(u)}" style="color:${C_ACCENT};word-break:break-all;">${esc(u, false)}</a>`;
    pos = m.index + u.length;
  }
  return out + esc(s.slice(pos), false);
}

function link(url, label, style = "") {
  return `<a href="${esc(url)}" style="color:${C_ACCENT};text-decoration:none;${style}">${label}</a>`;
}

function paragraph(lines) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.8;color:${C_TEXT};">`
    + lines.map(linkify).join("<br>") + "</p>";
}

function header(logos) {
  const cells = logos.map(([src, alt, href]) =>
    `<td align="center" style="padding:0 8px;">`
    + `<a href="${esc(href)}" style="text-decoration:none;">`
    + `<img src="${esc(src)}" width="${LOGO_W}" alt="${esc(alt)}" `
    + `style="display:block;width:${LOGO_W}px;max-width:100%;height:auto;border:0;`
    + `font-size:14px;font-weight:bold;color:${C_ACCENT};"></a></td>`).join("");
  return `<tr><td align="center" style="padding:4px 4px 16px;">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`
    + `</td></tr>`;
}

export function textToHtml(text, logos = LOGOS) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const body = [], footer = [];
  let para = [], inFooter = false, i = 0;
  const flush = () => { if (para.length) { body.push(paragraph(para)); para = []; } };

  while (i < lines.length) {
    const line = lines[i].replace(/\s+$/, "");
    if (inFooter) { footer.push(line); i++; continue; }
    if (DIVIDER_RE.test(line.trim())) { flush(); inFooter = true; i++; continue; }
    if (!line.trim()) { flush(); i++; continue; }

    if (line.startsWith("■")) {
      flush();
      const h = line.slice(1).trim();
      let listUrl = null;
      if (i + 1 < lines.length && lines[i + 1].startsWith("一覧：")) {
        const m = lines[i + 1].match(/https?:\/\/[^\s<>"]+/);
        if (m) { listUrl = m[0]; i++; }
      }
      body.push(`<h2 style="margin:30px 0 12px;padding:0 0 8px;font-size:18px;line-height:1.5;`
        + `color:${C_TEXT};border-bottom:2px solid ${C_ACCENT_SOFT};font-weight:bold;">${esc(h, false)}</h2>`);
      if (listUrl) {
        body.push(`<p style="margin:-4px 0 12px;font-size:13px;text-align:right;">`
          + link(listUrl, "一覧を見る →") + "</p>");
      }
      i++; continue;
    }

    if (line.startsWith("【") && line.endsWith("】")) {
      flush();
      body.push(`<p style="margin:16px 0 6px;font-size:15px;font-weight:bold;color:${C_TEXT};">${esc(line, false)}</p>`);
      i++; continue;
    }

    if (line.startsWith("・")) {
      flush();
      const label = line.slice(1).trim();
      const subs = [];
      let url = null, j = i + 1;
      while (j < lines.length && lines[j].startsWith("　")) {
        const m = lines[j].match(URL_ONLY_RE);
        if (m && url === null) url = m[1];
        else subs.push(lines[j].trim());
        j++;
      }
      const e = esc(label, false);
      if (label.startsWith("ほか") && !url && !subs.length) {
        body.push(`<p style="margin:0 0 10px;font-size:13px;color:${C_SUB};">${e}</p>`);
        i = j; continue;
      }
      if (!url && !subs.length) {
        body.push(`<p style="margin:0 0 6px;padding-left:1em;text-indent:-1em;font-size:14px;`
          + `line-height:1.6;color:${C_TEXT};">・${e}</p>`);
        i = j; continue;
      }
      const title = url ? link(url, e + " ›", "font-weight:bold;") : e;
      const subHtml = subs.map((s) =>
        `<div style="margin-top:4px;font-size:13px;line-height:1.6;color:${C_SUB};">${linkify(s)}</div>`).join("");
      body.push(`<div style="margin:0 0 10px;padding:12px 14px;background:${C_BG};border-radius:8px;`
        + `border-left:4px solid ${C_ACCENT};">`
        + `<div style="font-size:15px;line-height:1.6;color:${C_TEXT};">${title}</div>${subHtml}</div>`);
      i = j; continue;
    }

    const m = line.match(URL_ONLY_RE);
    if (m) {
      flush();
      const u = m[1];
      if (u.includes("/unsubscribe")) { para.push(line.trim()); i++; continue; }
      body.push(`<p style="margin:4px 0 16px;">`
        + `<a href="${esc(u)}" style="display:inline-block;padding:10px 18px;`
        + `background:${C_ACCENT};color:#ffffff;text-decoration:none;border-radius:6px;`
        + `font-size:14px;font-weight:bold;">ページを開く</a></p>`);
      i++; continue;
    }

    para.push(line);
    i++;
  }
  flush();

  const foot = [...footer];
  while (foot.length && !foot[0].trim()) foot.shift();
  while (foot.length && !foot[foot.length - 1].trim()) foot.pop();
  const footHtml = foot.map(linkify).join("<br>");

  return '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
    + `</head><body style="margin:0;padding:0;background:${C_BG};">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" `
    + `style="background:${C_BG};"><tr><td align="center" style="padding:20px 10px;">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" `
    + `style="max-width:600px;font-family:${FONT};">`
    + header(logos)
    + `<tr><td style="background:${C_CARD};border:1px solid ${C_BORDER};border-radius:12px;`
    + `padding:26px 22px;">` + body.join("") + "</td></tr>"
    + (footHtml ? `<tr><td style="padding:18px 8px 8px;font-size:12px;line-height:1.7;color:${C_SUB};`
      + `text-align:center;">${footHtml}</td></tr>` : "")
    + "</table></td></tr></table></body></html>";
}
