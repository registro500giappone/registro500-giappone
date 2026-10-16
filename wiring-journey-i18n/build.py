"""Build the English / Italian pages of the electrical-trouble series from the Japanese originals.

    python wiring-journey-i18n/build.py                 # build every part, both languages
    python wiring-journey-i18n/build.py oil key         # build only these parts
    python wiring-journey-i18n/build.py --todo oil      # list the Japanese text of a part that the dictionaries do not cover yet
    python wiring-journey-i18n/build.py --check         # open every built page, press every button, list text left in Japanese

Source of truth = the Japanese pages (wiring-journey-*.html) + src/{en,it}/{common,<slug>}.json + meta.json.
Re-run after any change to a Japanese part or to the dictionaries.

The translated pages run the same drawing scripts as the Japanese ones (wiring-sim.js, wiring-journey.js,
wiring-journey-<slug>.js, the gate); the runtime translator /engine-simulator/i18n/tr.js rewrites the text
they put on screen. The static text is translated here once, so it is already in the language in the HTML.
The head block between JOURNEY-STATE:BEGIN/END is written by wiring-simulator/publish_journey.py (state,
description, hreflang), as for the Japanese pages.
"""
import functools
import hashlib
import http.server
import json
import re
import socketserver
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / 'wiring-journey-i18n'
SRC = HERE / 'src'
LANGS = ['en', 'it']
SITE = 'https://www.registro500.com'
sys.path.insert(0, str(ROOT / 'wiring-simulator'))
import publish_journey as pj  # noqa: E402

JP = re.compile(r'[　-〿぀-ヿ㐀-䶿一-鿿！-｠]')
# pages of the site that exist in English / Italian too (other links keep pointing at the Japanese page)
SITE_I18N = ['torque', 'wiring-preview', 'engine-simulator/']
SERIES = {'en': 'Electrical Trouble Field Notes', 'it': 'Quaderno di bordo dei guasti elettrici'}


def sha8(path):
    return hashlib.sha1(Path(path).read_bytes().replace(b'\r\n', b'\n')).hexdigest()[:8]


def items():
    sch = json.loads((ROOT / 'journey-schedule.json').read_text(encoding='utf-8'))
    out = list(sch['issues'])
    for e in sch.get('extras', []):
        out.append(dict(e, n=e['of']))
    return out


def load_dict(lang, slug):
    d = {'noSvgHtml': True, 'exact': {}, 'tpl': {}, 'html': {}, 'htmlTpl': {}}
    for name in ('common', slug):
        f = SRC / lang / f'{name}.json'
        if f.exists():
            part = json.loads(f.read_text(encoding='utf-8'))
            for k in ('exact', 'tpl', 'html', 'htmlTpl'):
                d[k].update(part.get(k, {}))
    d['lang'] = lang
    return d


def rewrite_links(html, lang, slugs):
    """Links: other parts of the series stay in the language; the table of contents is the language home."""
    def link(mm):
        q, path, rest = mm.group(1), mm.group(2), mm.group(3)
        p = path[1:]
        if p in ('', 'wiring-journey', 'wiring-journey.html'):
            return f'href={q}/{lang}/{rest}'
        s = re.sub(r'\.html$', '', p)
        if s.startswith('wiring-journey-') and s[len('wiring-journey-'):] in slugs:
            return f'href={q}/{lang}/{s}{rest}'
        if s.rstrip('/') + ('/' if s.endswith('/') else '') in SITE_I18N:
            return f'href={q}/{lang}/{s}{rest}'
        return mm.group(0)
    return re.sub(r'href=(["\'])(/[\w./-]*?)((?:#[\w-]*)?\1)', link, html)


def write_dict_js(lang, slug, slugs):
    d = load_dict(lang, slug)
    # the page is baked after its links are rewritten, so the keys (and the translations) follow suit
    for k in ('html', 'htmlTpl'):
        d[k] = {rewrite_links(a, lang, slugs): rewrite_links(b, lang, slugs) for a, b in d[k].items()}
    out = HERE / lang / f'{slug}.js'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('window.I18N=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n'
                   # width of a chip label once translated: full-width characters 12px, others about 7.2px (12px bold)
                   'window.__tw=function(t){t=window.__tr?window.__tr(t):t;var w=0;for(var i=0;i<t.length;i++)'
                   'w+=/[\\u3000-\\u30ff\\u3400-\\u9fff\\uff01-\\uff60]/.test(t[i])?12:7.2;return w;};\n', encoding='utf-8')
    return out


def stage1(html, lang, it, meta, slugs):
    slug = it['slug']
    m = meta[slug][lang]
    keep = (pj.BEGIN, pj.END)
    html = re.sub(r'<!--[\s\S]*?-->\n?', lambda mm: mm.group(0) if mm.group(0).strip() in keep else '', html)
    html = html.replace('<html lang="ja">', f'<html lang="{lang}">', 1)
    html = re.sub(r'<title>[\s\S]*?</title>', f'<title>{pj.esc(m["title"])} | Registro500</title>', html, count=1)
    # the series does not ask readers abroad to register (same rule as the other English / Italian pages)
    html = re.sub(r'<div id="rg-join-cta"[^>]*></div>\n?', '', html)
    html = re.sub(r'<script src="/rg-join-cta\.js"[^>]*></script>\n?', '', html)

    html = rewrite_links(html, lang, slugs)
    # language switch: the Japanese page links to English and Italian; here, to the other two
    names = {'ja': ('', '日本語'), 'en': ('/en', 'English'), 'it': ('/it', 'Italiano')}
    nav = '<i>·</i>'.join(f'<a href="{names[lg][0]}/wiring-journey-{slug}" hreflang="{lg}" lang="{lg}">{names[lg][1]}</a>'
                          for lg in ('ja', 'en', 'it') if lg != lang)
    html = re.sub(r'(<nav class="lang-sw"[^>]*>)[\s\S]*?(</nav>)', lambda mm: mm.group(1) + nav + mm.group(2), html, count=1)
    dic = write_dict_js(lang, slug, slugs)
    tr = ROOT / 'engine-simulator' / 'i18n' / 'tr.js'
    html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n'
                        f'<script src="/wiring-journey-i18n/{lang}/{slug}.js?v={sha8(dic)}"></script>\n'
                        f'<script src="/engine-simulator/i18n/tr.js?v={sha8(tr)}"></script>', 1)
    return html


def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    h.log_message = lambda *a: None
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def block_external(pg):
    pg.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda r: r.abort())


# the static text only: drawing scripts and the gate are held back, the translator walks the page once
BAKE_BLOCK = re.compile(r'/(wiring-sim|wiring-journey(?:-[\w-]+)?)\.js(\?|$)')


def build(slugs_wanted):
    meta = json.loads((HERE / 'meta.json').read_text(encoding='utf-8'))
    all_items = items()
    slugs = {it['slug'] for it in all_items}
    sch = {it['slug']: it for it in all_items}
    today = pj.today_jst()
    gv = pj.gate_version()
    from playwright.sync_api import sync_playwright
    httpd, port = serve()
    report = {}
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel='chrome')
            for lang in LANGS:
                for slug in slugs_wanted:
                    it = sch[slug]
                    src = (ROOT / f'wiring-journey-{slug}.html').read_text(encoding='utf-8')
                    out = ROOT / lang / f'wiring-journey-{slug}.html'
                    out.parent.mkdir(parents=True, exist_ok=True)
                    out.write_text(stage1(src, lang, it, meta, slugs), encoding='utf-8')
                    pg = br.new_page()
                    block_external(pg)
                    pg.route(BAKE_BLOCK, lambda r: r.abort() if 'wiring-journey-i18n' not in r.request.url else r.continue_())
                    pg.goto(f'http://127.0.0.1:{port}/{lang}/wiring-journey-{slug}.html', wait_until='load')
                    res = pg.evaluate("() => ({ html: document.documentElement.outerHTML, missing: [...window.__i18nMissing] })")
                    pg.close()
                    html = '<!doctype html>\n' + res['html'] + '\n'
                    # a bare Japanese dash between two tags has no kana, so the dictionary never sees it
                    html = html.replace('>——<', '> — <')
                    out.write_text(html, encoding='utf-8')
                    # the head block (state, description, hreflang) the same way the daily job writes it
                    changed = []
                    pj.apply_article(str(out), it, pj.state_of(it, today), gv, False, changed, lang, meta)
                    report[f'{lang}/{slug}'] = res['missing']
            br.close()
    finally:
        httpd.shutdown()
    # the Japanese page lists the translations in its hreflang (written by the same job)
    for slug in slugs_wanted:
        it = sch[slug]
        pj.apply_article(str(ROOT / f'wiring-journey-{slug}.html'), it, pj.state_of(it, today), gv, False, [])
    return report


# ---- what is left to translate -------------------------------------------------------------------
# Units are cut exactly as tr.js cuts them: an element with inline markup and text of its own is one
# "html" entry (key = its innerHTML, whitespace collapsed); any other text node is one "exact" entry.
COLLECT_JS = r"""() => {
  const JP = /[　-〿぀-ヿ㐀-䶿一-鿿！-｠]/, norm = h => h.replace(/\s+/g, ' ').trim();
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'data-label'];
  const html = new Set(), exact = new Set();
  function mixed(el) {
    if (!el.firstElementChild || el.childElementCount > 12 || el.closest('svg')) return false;
    const k = norm(el.innerHTML);
    if (k.length > 1500 || !JP.test(k)) return false;
    for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.data.trim()) return true;
    return false;
  }
  function walk(n) {
    if (n.nodeType === 3) { const v = n.data.trim(); if (JP.test(v) && !SKIP.has(n.parentNode.nodeName)) exact.add(v); return; }
    if (n.nodeType !== 1 || SKIP.has(n.tagName) || n.getAttribute('translate') === 'no') return;
    for (const a of ATTRS) { const v = n.getAttribute(a); if (v && JP.test(v)) exact.add(v.trim()); }
    if (mixed(n)) { html.add(norm(n.innerHTML)); return; }
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  }
  walk(document.body);
  return { html: [...html], exact: [...exact], title: document.title };
}"""

PRESS_JS = r"""async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const btns = [...document.querySelectorAll('.col button, .col [role=button]')].filter(b => !b.closest('.j-gate'));
  const seen = [];
  for (const b of btns) { b.click(); await sleep(250); seen.push(b.textContent.trim()); }
  for (const d of document.querySelectorAll('details')) d.open = true;
  return seen.length;
}"""


def todo(slug):
    """Collect every unit of the Japanese page (pressing every button) and list those the dictionaries miss."""
    from playwright.sync_api import sync_playwright
    httpd, port = serve()
    units = {'html': set(), 'exact': set()}
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel='chrome')
            pg = br.new_page(viewport={'width': 390, 'height': 900})
            block_external(pg)
            pg.goto(f'http://127.0.0.1:{port}/wiring-journey-{slug}.html?preview=1', wait_until='load')
            pg.wait_for_timeout(1200)
            for rnd in range(3):
                r = pg.evaluate(COLLECT_JS)
                units['html'].update(r['html']); units['exact'].update(r['exact'])
                # press every button, collecting after each one
                n = pg.evaluate("() => [...document.querySelectorAll('.col button')].filter(b => !b.closest('.j-gate')).length")
                for i in range(n):
                    pg.evaluate(f"() => [...document.querySelectorAll('.col button')].filter(b => !b.closest('.j-gate'))[{i}].click()")
                    pg.wait_for_timeout(200)
                    r = pg.evaluate(COLLECT_JS)
                    units['html'].update(r['html']); units['exact'].update(r['exact'])
            br.close()
    finally:
        httpd.shutdown()
    out = {}
    for lang in LANGS:
        d = load_dict(lang, slug)
        out[lang] = {'html': sorted(k for k in units['html'] if k not in d['html']),
                     'exact': sorted(k for k in units['exact'] if k not in d['exact'])}
    f = HERE / 'todo' / f'{slug}.json'
    f.parent.mkdir(exist_ok=True)
    f.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    return out, f


def check(slugs_wanted):
    """Open each built page, press every button, and report what is still Japanese on screen."""
    from playwright.sync_api import sync_playwright
    httpd, port = serve()
    res = {}
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel='chrome')
            for lang in LANGS:
                for slug in slugs_wanted:
                    pg = br.new_page(viewport={'width': 390, 'height': 900})
                    block_external(pg)
                    errs = []
                    pg.on('pageerror', lambda e: errs.append(str(e)))
                    pg.goto(f'http://127.0.0.1:{port}/{lang}/wiring-journey-{slug}.html?preview=1', wait_until='load')
                    pg.wait_for_timeout(1200)
                    left = set()
                    n = pg.evaluate("() => [...document.querySelectorAll('.col button')].filter(b => !b.closest('.j-gate')).length")
                    for i in range(-1, n):
                        if i >= 0:
                            pg.evaluate(f"() => [...document.querySelectorAll('.col button')].filter(b => !b.closest('.j-gate'))[{i}].click()")
                            pg.wait_for_timeout(200)
                        left.update(pg.evaluate("""() => { const JP = /[　-〿぀-ヿ㐀-䶿一-鿿！-｠]/, o = [];
                          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                          for (let n; (n = w.nextNode());) if (JP.test(n.data) && !n.parentElement.closest('script,style,[translate=no]')) o.push(n.data.trim());
                          for (const e of document.querySelectorAll('[aria-label],[title],[alt]'))
                            for (const a of ['aria-label', 'title', 'alt']) { const v = e.getAttribute(a); if (v && JP.test(v)) o.push(v); }
                          if (JP.test(document.title)) o.push(document.title);
                          return o; }"""))
                    res[f'{lang}/{slug}'] = {'left': sorted(left), 'errors': sorted(set(errs))}
                    pg.close()
            br.close()
    finally:
        httpd.shutdown()
    return res


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    every = [it['slug'] for it in items()]
    wanted = args or every
    if '--todo' in sys.argv:
        for s in wanted:
            out, f = todo(s)
            print(s, {k: (len(v['html']), len(v['exact'])) for k, v in out.items()}, f)
    elif '--check' in sys.argv:
        res = check(wanted)
        f = HERE / 'check_result.json'
        f.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
        for k, v in res.items():
            print(f"{k}: left in Japanese {len(v['left'])} / errors {len(v['errors'])}")
        print('details:', f)
    else:
        rep = build(wanted)
        for k, v in rep.items():
            print(f'{k}: static untranslated {len(v)}')
