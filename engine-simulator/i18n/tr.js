/* Engine / gearbox simulator — runtime translator for the English and Italian pages.
   The pages run the same scripts and data as the Japanese originals; this file rewrites
   every piece of Japanese that reaches the screen (DOM text, attributes, canvas text).
   Load order (classic scripts in <head>, before the body is parsed):
     <script src="/engine-simulator/i18n/en.js"></script>   -> window.I18N = { lang, exact, tpl, html }
     <script src="/engine-simulator/i18n/tr.js"></script>
   exact: { "日本語": "English" }            whole-string match (surrounding spaces are kept)
   tpl:   { "ピーク {0} rpm": "peak {0} rpm" } {n} captures any text; captures are translated too
   html:  { "<b>CV</b> は…": "<b>CV</b> is…" } innerHTML of an element with inline markup
   Anything left untranslated is collected in window.__i18nMissing (read by the build check). */
(function () {
  'use strict';
  const D = window.I18N || { exact: {}, tpl: {}, html: {} };
  const JP = /[　-〿぀-ヿ㐀-䶿一-鿿！-｠]/;
  const FW = /[※　]/;
  const missing = window.__i18nMissing = new Set();
  const cache = new Map();

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compile(dict) {
    return Object.keys(dict || {})
      .map(k => {
        const lit = k.replace(/\{\d+\}/g, '').length;
        const re = new RegExp('^' + k.split(/(\{\d+\})/).map(p => /^\{\d+\}$/.test(p) ? '([\\s\\S]+?)' : esc(p)).join('') + '$');
        const order = [...k.matchAll(/\{(\d+)\}/g)].map(m => +m[1]);
        const parts = k.split(/(\{\d+\})/).filter(p => p !== '').map(p => /^\{\d+\}$/.test(p) ? { ph: true } : { lit: p });
        return { re, order, out: dict[k], lit, parts };
      })
      .sort((a, b) => b.lit - a.lit);
  }
  const TPL = compile(D.tpl);
  const HTPL = compile(D.htmlTpl);

  // every way the literal parts of a template can sit in s (the regex gives only the first one;
  // "{0} {1}速" on "2.1 km で 3速" needs the split after "で", not after "2.1")
  function* splits(parts, s, i, pos, acc) {
    if (i === parts.length) { if (pos === s.length) yield acc; return; }
    const p = parts[i];
    if (!p.ph) { if (s.startsWith(p.lit, pos)) yield* splits(parts, s, i + 1, pos + p.lit.length, acc); return; }
    const next = parts[i + 1];
    if (!next) { if (pos < s.length) yield acc.concat(s.slice(pos)); return; }
    if (next.ph) { for (let j = pos + 1; j < s.length; j++) yield* splits(parts, s, i + 1, j, acc.concat(s.slice(pos, j))); return; }
    for (let j = s.indexOf(next.lit, pos + 1); j >= 0; j = s.indexOf(next.lit, j + 1))
      yield* splits(parts, s, i + 1, j, acc.concat(s.slice(pos, j)));
  }
  function viaTpl(list, s, sub) {
    for (const t of list) {
      if (!t.re.test(s)) continue;
      let tries = 0;
      for (const caps of splits(t.parts, s, 0, 0, [])) {
        if (++tries > 30) break;
        const vals = {};
        let clean = true;
        // "※" sits outside the JP range but must not ride along inside a capture ("※126" -> "※The 126")
        t.order.forEach((n, i) => { if (clean) { vals[n] = sub(caps[i]); if (JP.test(vals[n]) || vals[n].includes('※')) clean = false; } });
        // a generic template ("{0}・{1}") can swallow a long compound; if its captures stay Japanese, try the next one
        if (clean) return t.out.replace(/\{(\d+)\}/g, (_, n) => vals[n] ?? '');
      }
    }
    return null;
  }

  // delimiters used to break an unknown compound string into known pieces
  const DELIM = /(（|）|\(|\)|・|／|、|。|：|「|」|『|』|＋|＝|※|→|〜|　|\n)/;
  const DMAP = D.delims || { '（': ' (', '）': ')', '・': ' · ', '／': ' / ', '、': ', ', '。': '. ', '：': ': ', '「': '“', '」': '”', '『': '“', '』': '”', '＋': ' + ', '〜': '–', '　': ' ', '＝': ' = ', '※': '* ' };

  // labels are often shown cut at their first full-width parenthesis ("名前（補足）" -> "名前"):
  // derive those short forms from the dictionary so they need no entries of their own
  const CUT = Object.create(null);
  for (const k of Object.keys(D.exact)) {
    const p = k.indexOf('（'), v = D.exact[k], q = v.indexOf('(');
    if (p > 0 && q > 0) { const ck = k.slice(0, p).trim(); if (!(ck in D.exact) && !(ck in CUT)) CUT[ck] = v.slice(0, q).trim(); }
  }

  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function core(s) {
    if (!JP.test(s)) return s;
    if (has(D.exact, s)) return D.exact[s];
    const t = viaTpl(TPL, s, v => trq(v));
    if (t !== null) return t;
    if (CUT[s]) return CUT[s];
    return byWords(s);
  }

  // last resort for part labels built from numbers ("Lavazza 分割ヘッド 34/30"): swap known words,
  // accepted only when nothing Japanese is left
  const WORDS = Object.keys(D.words || {}).sort((a, b) => b.length - a.length);
  function byWords(s) {
    if (!WORDS.length || s.length > 60) return null;
    let o = s;
    for (const w of WORDS) if (o.includes(w)) o = o.split(w).join(' ' + D.words[w] + ' ');
    o = o.replace(/\s+/g, ' ').replace(/ ([,.:;)])/g, '$1').replace(/\( /g, '(').trim();
    return JP.test(o) || FW.test(o) ? null : o;
  }

  // unknown compound: split at the delimiters and find the cover with the fewest untranslated
  // Japanese characters, trying every run of pieces (a run may hold delimiters, e.g. a template "（{0}）")
  function compound(s) {
    const tok = s.split(DELIM).filter(x => x !== '');
    const T = tok.length, MAXRUN = 64;
    const best = [{ cost: 0, n: 0, out: [], miss: [] }];
    for (let b = 1; b <= T; b++) {
      let pick = null;
      for (let a = Math.max(0, b - MAXRUN); a < b; a++) {
        const prev = best[a]; if (!prev) continue;
        const raw = tok.slice(a, b).join('');
        const pl = raw.match(/^\s*/)[0], body = raw.trim(), pt = raw.slice(pl.length + body.length);
        let out, cost = 0, miss = null;
        if (b - a === 1 && DELIM.test(raw) && raw.length === 1 && !(body && has(D.exact, body))) out = DMAP[raw] ?? raw;
        else if (!body) out = raw;
        else {
          const r = core(body);
          // a run holding "※" or a full-width space is only good when they came out translated
          if (r !== null && b - a > 1 && FW.test(r)) continue;
          if (r !== null) out = (pl + r + pt).replace(/　/g, ' ');
          else if (b - a === 1) { out = raw; cost = (body.match(new RegExp(JP.source, 'g')) || []).length; miss = body; }
          else continue;
        }
        const c = { cost: prev.cost + cost, n: prev.n + 1, out: prev.out.concat(out), miss: miss ? prev.miss.concat(miss) : prev.miss };
        if (!pick || c.cost < pick.cost || (c.cost === pick.cost && c.n < pick.n)) pick = c;
      }
      best[b] = pick;
    }
    const r = best[T];
    r.miss.forEach(m => lastMiss.push(m));
    return r.out.reduce((acc, x) => acc + (/[,.;:!?)]$/.test(acc) && /^[\p{L}\d(“"]/u.test(x) ? ' ' : '') + x, '').replace(/(\S)·(\S)/g, '$1 · $2').replace(/ {2,}/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').replace(/ ([,.:;])/g, '$1').trim();
  }

  // misses are cached with each result and reported only for top-level calls (not for trial captures)
  let quiet = 0, lastMiss = [];
  function trq(v) { quiet++; try { return tr(v); } finally { quiet--; } }
  function tr(input) {
    if (input == null) return input;
    const str = String(input);
    if (!JP.test(str)) return str;
    if (cache.has(str)) { const c = cache.get(str); if (!quiet) c.miss.forEach(m => missing.add(m)); return c.res; }
    const saved = lastMiss; lastMiss = [];
    const lead = str.match(/^\s*/)[0], trail = str.slice(lead.length).match(/\s*$/)[0];
    const s = str.slice(lead.length, str.length - trail.length);
    let out = core(s);
    if (out === null) out = compound(s);
    const res = lead.replace(/　/g, ' ') + out + trail.replace(/　/g, ' ');
    const miss = lastMiss; lastMiss = saved;
    cache.set(str, { res, miss });
    if (!quiet) miss.forEach(m => missing.add(m));
    return res;
  }
  window.__tr = tr;

  // ───── DOM ─────
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'data-label'];
  const norm = h => h.replace(/\s+/g, ' ').trim();

  function trHtml(el) {
    if (!el.firstElementChild || el.childElementCount > 12) return false;
    const key = norm(el.innerHTML);
    if (key.length > 1500 || !JP.test(key)) return false;
    let out = D.html && Object.prototype.hasOwnProperty.call(D.html, key) ? D.html[key] : null;
    if (out === null) out = viaTpl(HTPL, key, v => trq(v));
    if (out === null) return false;
    el.innerHTML = out;
    return true;
  }

  function walk(node) {
    if (node.nodeType === 3) {
      if (node.parentNode && SKIP.has(node.parentNode.nodeName)) return;
      const v = node.data;
      if (JP.test(v)) { const t = tr(v); if (t !== v) node.data = t; }
      return;
    }
    if (node.nodeType !== 1 || SKIP.has(node.tagName)) return;
    for (const a of ATTRS) {
      const v = node.getAttribute(a);
      if (v && JP.test(v)) { const t = tr(v); if (t !== v) node.setAttribute(a, t); }
    }
    if (!JP.test(node.textContent)) return;
    if (trHtml(node)) return;
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  const mo = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(n => {
        // a text node added next to inline markup may complete a sentence that is matched as html
        if (n.nodeType === 3 && r.target.nodeType === 1 && trHtml(r.target)) return;
        walk(n);
      });
      else if (r.type === 'characterData') walk(r.target);
      else if (r.type === 'attributes') {
        const v = r.target.getAttribute(r.attributeName);
        if (v && JP.test(v)) r.target.setAttribute(r.attributeName, tr(v));
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.addEventListener('DOMContentLoaded', () => walk(document.body));

  // ───── canvas ─────
  const P = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (P) for (const f of ['fillText', 'strokeText', 'measureText']) {
    const orig = P[f];
    P[f] = function (text, ...rest) { return orig.call(this, tr(text), ...rest); };
  }
})();
