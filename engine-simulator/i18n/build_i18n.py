"""Build the English / Italian pages of the engine & gearbox simulators from the Japanese originals.

    python engine-simulator/i18n/build_i18n.py            # build all pages, all languages
    python engine-simulator/i18n/build_i18n.py --check    # build, then click through every page and list untranslated text
    CHECK_LANGS=en python ... --check                    # check one language only (lighter)

Source of truth = the Japanese pages (engine-simulator/*.html) + the dictionaries i18n/{en,it}.json + i18n/meta.json.
Re-run after any change to the Japanese pages or the dictionaries. Output: en/engine-simulator/*.html, it/engine-simulator/*.html
and i18n/{en,it}.js (the dictionaries as loaded by the pages).

How a page is made:
  1. the Japanese HTML is copied with head meta replaced (meta.json), noindex added, script/asset paths pointed back to
     /engine-simulator/, links to "/" pointed to the language home, and developer comments removed;
  2. it is opened in a headless browser with the page's own module scripts switched off, so only the static markup is
     translated by tr.js; that DOM is saved (so the HTML itself is in English/Italian, not only after JS runs);
  3. the module scripts are switched back on. Dynamic text (results, charts, chips) is translated at runtime by tr.js.
"""
import http.server
import os
import json
import re
import socketserver
import sys
import threading
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'engine-simulator'
I18N = SRC / 'i18n'
PAGES = ['index', 'drive', 'gearbox', 'drive-guide']
LANGS = ['en', 'it']
JP = re.compile(r'[　-〿぀-ヿ㐀-䶿一-鿿！-｠]')
SITE = 'https://www.registro500.com'


def page_url(lang, page):
    return f'{SITE}/{lang}/engine-simulator/' + ('' if page == 'index' else page)


def strip_js_comments(code):
    code = re.sub(r'/\*[\s\S]*?\*/', lambda m: '' if JP.search(m.group(0)) else m.group(0), code)
    out = []
    for line in code.split('\n'):
        s = line.strip()
        if s.startswith('//'):
            continue
        m = re.search(r'(?<=[\s;,{}()\]])//', line)
        if m:
            head, tail = line[:m.start()], line[m.start():]
            if JP.search(tail) and head.count('`') % 2 == 0 and head.count("'") % 2 == 0 and head.count('"') % 2 == 0:
                line = head.rstrip()
        out.append(line)
    return '\n'.join(out)


def stage1(html, lang, page, meta):
    m = meta[page][lang]
    html = re.sub(r'<!--[\s\S]*?-->\n?', '', html)
    html = html.replace('<html lang="ja">', f'<html lang="{lang}">', 1)
    html = re.sub(r'<title>[\s\S]*?</title>', f'<title>{m["title"]}</title>', html, count=1)
    html = re.sub(r'<meta name="robots"[^>]*>\n?', '', html)
    html = re.sub(r'<link rel="canonical"[^>]*>', f'<meta name="robots" content="noindex">\n<link rel="canonical" href="{page_url(lang, page)}">', html, count=1)

    def setmeta(h, attr, key, val):
        return re.sub(rf'<meta {attr}="{re.escape(key)}" content="[^"]*">', f'<meta {attr}="{key}" content="{val}">', h, count=1)
    html = setmeta(html, 'name', 'description', m['description'])
    html = setmeta(html, 'property', 'og:title', m['og_title'])
    html = setmeta(html, 'property', 'og:description', m['og_description'])
    html = setmeta(html, 'property', 'og:image', f'{SITE}/og/{m.get("og_image") or meta["_og_image"][lang]}')
    html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n'
                        f'<script src="/engine-simulator/i18n/{lang}.js"></script>\n'
                        '<script src="/engine-simulator/i18n/tr.js"></script>', 1)
    # the page's own scripts and images stay in /engine-simulator/ (one copy of the numbers)
    html = re.sub(r"""from '\./([\w.-]+\.js)'""", r"from '/engine-simulator/\1'", html)
    html = re.sub(r"""(['"])img/""", r"\1/engine-simulator/img/", html)
    html = html.replace('href="/"', f'href="/{lang}/"')

    def scripts(mm):
        return mm.group(1) + strip_js_comments(mm.group(2)) + mm.group(3)
    html = re.sub(r'(<script type="module">)([\s\S]*?)(</script>)', scripts, html)
    html = re.sub(r'(<style>)([\s\S]*?)(</style>)', lambda mm: mm.group(1) + re.sub(r'/\*[\s\S]*?\*/', '', mm.group(2)) + mm.group(3), html)
    # step 2 runs without the page's own scripts
    html = html.replace('<script type="module">', '<script type="text/plain" data-i18n-module>')
    return html


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def block_external(page):
    page.route(re.compile(r'https://(www\.googletagmanager\.com|www\.google-analytics\.com)/.*'), lambda r: r.abort())


STATIC_JS = r"""() => {
  for (const st of document.querySelectorAll('style'))
    st.textContent = st.textContent.replace(/content:\s*"([^"]*)"/g, (m, s) => 'content:"' + window.__tr(s) + '"');
  return { html: document.documentElement.outerHTML, missing: [...window.__i18nMissing] };
}"""


def build():
    meta = json.loads((I18N / 'meta.json').read_text(encoding='utf-8'))
    for lang in LANGS:
        d = json.loads((I18N / f'{lang}.json').read_text(encoding='utf-8'))
        (I18N / f'{lang}.js').write_text('window.I18N=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    from playwright.sync_api import sync_playwright
    httpd, port = serve()
    report = {}
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel="chrome")
            for lang in LANGS:
                out_dir = ROOT / lang / 'engine-simulator'
                out_dir.mkdir(parents=True, exist_ok=True)
                for page in PAGES:
                    src = (SRC / f'{page}.html').read_text(encoding='utf-8')
                    tmp = out_dir / f'{page}.html'
                    tmp.write_text(stage1(src, lang, page, meta), encoding='utf-8')
                    pg = br.new_page()
                    block_external(pg)
                    pg.goto(f'http://127.0.0.1:{port}/{lang}/engine-simulator/{page}.html', wait_until='load')
                    res = pg.evaluate(STATIC_JS)
                    pg.close()
                    html = '<!DOCTYPE html>\n' + res['html'].replace('<script type="text/plain" data-i18n-module="">', '<script type="module">')
                    tmp.write_text(html + '\n', encoding='utf-8')
                    report[f'{lang}/{page}'] = res['missing']
            br.close()
    finally:
        httpd.shutdown()
    return report


# ───── check: click through the pages and collect whatever Japanese is still on screen ─────
EXPLORE_JS = r"""async (rounds) => {
  const JP = /[　-〿぀-ヿ㐀-䶿一-鿿！-｠]/;
  const seen = new Set();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const grab = () => {
    for (const d of document.querySelectorAll('details')) d.open = true;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const p = n.parentElement; if (!p || /SCRIPT|STYLE/.test(p.tagName)) continue;
      if (JP.test(n.data)) seen.add(n.data.trim());
    }
    for (const el of document.querySelectorAll('[title],[aria-label],[placeholder],[alt]'))
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && JP.test(v)) seen.add(v); }
  };
  await sleep(600); grab();
  for (let r = 0; r < rounds; r++) {
    const clickables = [...document.querySelectorAll('button, .chip, summary, [role=button], input[type=radio], input[type=checkbox], .pack, .card')]
      .filter(e => !e.closest('[hidden]') && !e.disabled);
    for (const el of clickables) {
      if (!el.isConnected) continue;
      try { el.click(); } catch (e) {}
      await sleep(40); grab();
    }
    for (const s of document.querySelectorAll('select')) for (const o of s.options) {
      s.value = o.value; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(40); grab();
    }
    for (const inp of document.querySelectorAll('input[type=range]')) for (const f of [0, .5, 1]) {
      inp.value = +inp.min + f * (inp.max - inp.min); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(40); grab();
    }
  }
  return { screen: [...seen], missing: [...window.__i18nMissing] };
}"""


def check(hashes):
    from playwright.sync_api import sync_playwright
    httpd, port = serve()
    result = {}
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel="chrome")
            for lang in (os.environ.get('CHECK_LANGS') or ','.join(LANGS)).split(','):
                for page in PAGES:
                    for h in [''] + hashes.get(page, []):
                        pg = br.new_page(viewport={'width': 390, 'height': 900})
                        block_external(pg)
                        errs = []
                        pg.on('pageerror', lambda e: errs.append(str(e)))
                        pg.goto(f'http://127.0.0.1:{port}/{lang}/engine-simulator/{page}.html{h}', wait_until='load')
                        r = pg.evaluate(EXPLORE_JS, 2 if not h else 1)
                        key = f'{lang}/{page}'
                        acc = result.setdefault(key, {'screen': set(), 'missing': set(), 'errors': set()})
                        acc['screen'].update(r['screen']); acc['missing'].update(r['missing']); acc['errors'].update(errs)
                        pg.close()
            br.close()
    finally:
        httpd.shutdown()
    return {k: {kk: sorted(vv) for kk, vv in v.items()} for k, v in result.items()}


if __name__ == '__main__':
    rep = build()
    for k, v in rep.items():
        print(f'{k}: static untranslated {len(v)}')
    if '--check' in sys.argv:
        hashes = json.loads((I18N / 'check_hashes.json').read_text(encoding='utf-8')) if (I18N / 'check_hashes.json').exists() else {}
        res = check(hashes)
        out = I18N / 'check_result.json'
        out.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
        for k, v in res.items():
            print(f"{k}: on screen {len(v['screen'])} / missing {len(v['missing'])} / errors {len(v['errors'])}")
        print('details:', out)
