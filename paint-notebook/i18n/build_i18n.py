"""Build the English / Italian pages of the paint notebook from the Japanese originals.

    python paint-notebook/i18n/build_i18n.py            # build all pages, all languages
    python paint-notebook/i18n/build_i18n.py --check    # build, then click through every page and list untranslated text
    CHECK_LANGS=en python ... --check                   # check one language only (lighter)

Source of truth = the Japanese pages (paint-notebook/*.html) + the dictionaries i18n/{en,it}.json + i18n/meta.json.
Re-run after any change to the Japanese pages or the dictionaries. Output: en/paint-notebook/*.html, it/paint-notebook/*.html
and i18n/{en,it}.js (the dictionaries as loaded by the pages).

Same mechanism as engine-simulator/i18n/build_i18n.py (whose helpers are reused here), and the same runtime
translator /engine-simulator/i18n/tr.js. The page scripts, models and images stay in /paint-notebook/ (one copy).
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'engine-simulator' / 'i18n'))
import build_i18n as eng  # noqa: E402

SRC = ROOT / 'paint-notebook'
I18N = SRC / 'i18n'
PAGES = ['index', '126', 'drive', 'gallery']
LANGS = ['en', 'it']
SITE = eng.SITE
HASHTAG = '#registro500giappone'


def page_url(lang, page):
    return f'{SITE}/{lang}/paint-notebook/' + ('' if page == 'index' else page)


def stage1(html, lang, page, meta):
    m = meta[page][lang]
    html = re.sub(r'<!--[\s\S]*?-->\n?', '', html)
    html = html.replace('<html lang="ja">', f'<html lang="{lang}">', 1)
    html = re.sub(r'<title>[\s\S]*?</title>', f'<title>{m["title"]}</title>', html, count=1)
    html = re.sub(r'<meta name="robots"[^>]*>\n?', '', html)
    html = re.sub(r'<link rel="alternate" hreflang="[^"]*"[^>]*>\n?', '', html)
    # none of the translated pages is opened to search (no links lead to them yet)
    html = re.sub(r'<link rel="canonical"[^>]*>',
                  f'<meta name="robots" content="noindex">\n<link rel="canonical" href="{page_url(lang, page)}">', html, count=1)

    def setmeta(h, attr, key, val):
        return re.sub(rf'<meta {attr}="{re.escape(key)}" content="[^"]*">', f'<meta {attr}="{key}" content="{val}">', h, count=1)
    html = setmeta(html, 'name', 'description', m['description'])
    html = setmeta(html, 'property', 'og:title', m['og_title'])
    html = setmeta(html, 'property', 'og:description', m['og_description'])
    html = setmeta(html, 'property', 'og:url', page_url(lang, page))
    # links between the notebook pages stay inside the language; links to the site top go to the language home
    html = html.replace('https://www.registro500.com/paint-notebook/', f'https://www.registro500.com/{lang}/paint-notebook/')
    html = re.sub(r"""(['"(])/paint-notebook/""", rf'\1/{lang}/paint-notebook/', html)
    html = html.replace('href="/"', f'href="/{lang}/"').replace('href="/126/"', f'href="/{lang}/"')
    # the page's own scripts, models and images stay in /paint-notebook/
    html = re.sub(r"""(['"])\./([\w.-]+\.js(?:\?v=\d+)?)\1""", r'\1/paint-notebook/\2\1', html)
    html = re.sub(r"""(['"])((?:fiat500|fiat126)\.glb|logo-[\w-]+\.png)\1""", r'\1/paint-notebook/\2\1', html)
    # share text: the Japanese hashtags mean nothing to the readers of these pages
    html = re.sub(r"#レジちん #お絵描き帳", HASHTAG, html)
    # injected last, so the rewrites above do not move the dictionary's path
    html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n'
                        f'<script src="/paint-notebook/i18n/{lang}.js"></script>\n'
                        '<script src="/engine-simulator/i18n/tr.js"></script>', 1)

    def scripts(mm):
        return mm.group(1) + eng.strip_js_comments(mm.group(2)) + mm.group(3)
    html = re.sub(r'(<script type="module">)([\s\S]*?)(</script>)', scripts, html)
    html = re.sub(r'(<style>)([\s\S]*?)(</style>)', lambda mm: mm.group(1) + re.sub(r'/\*[\s\S]*?\*/', '', mm.group(2)) + mm.group(3), html)
    html = html.replace('<script type="module">', '<script type="text/plain" data-i18n-module>')
    return html


def build():
    meta = json.loads((I18N / 'meta.json').read_text(encoding='utf-8'))
    for lang in LANGS:
        d = json.loads((I18N / f'{lang}.json').read_text(encoding='utf-8'))
        (I18N / f'{lang}.js').write_text('window.I18N=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    from playwright.sync_api import sync_playwright
    httpd, port = eng.serve()
    report = {}
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel="chrome")
            for lang in LANGS:
                out_dir = ROOT / lang / 'paint-notebook'
                out_dir.mkdir(parents=True, exist_ok=True)
                for page in PAGES:
                    src = (SRC / f'{page}.html').read_text(encoding='utf-8')
                    tmp = out_dir / f'{page}.html'
                    tmp.write_text(stage1(src, lang, page, meta), encoding='utf-8')
                    pg = br.new_page()
                    eng.block_external(pg)
                    pg.goto(f'http://127.0.0.1:{port}/{lang}/paint-notebook/{page}.html', wait_until='load')
                    res = pg.evaluate(eng.STATIC_JS)
                    pg.close()
                    html = '<!DOCTYPE html>\n' + res['html'].replace('<script type="text/plain" data-i18n-module="">', '<script type="module">')
                    tmp.write_text(html + '\n', encoding='utf-8')
                    report[f'{lang}/{page}'] = res['missing']
            br.close()
    finally:
        httpd.shutdown()
    return report


def check():
    from playwright.sync_api import sync_playwright
    httpd, port = eng.serve()
    result = {}
    try:
        with sync_playwright() as p:
            br = p.chromium.launch(channel="chrome")
            for lang in (os.environ.get('CHECK_LANGS') or ','.join(LANGS)).split(','):
                for page in PAGES:
                    pg = br.new_page(viewport={'width': 390, 'height': 900})
                    eng.block_external(pg)
                    errs = []
                    pg.on('pageerror', lambda e: errs.append(str(e)))
                    pg.goto(f'http://127.0.0.1:{port}/{lang}/paint-notebook/{page}.html', wait_until='load')
                    # buttons such as "Make a video" and the gallery cards leave the page; stay on it
                    pg.route('**/*', lambda r: r.abort() if r.request.is_navigation_request() else r.continue_())
                    pg.wait_for_timeout(4000)  # the 3D model loads after "load"
                    pg.evaluate("""() => { for (const id of ['drive', 'retake']) { const b = document.getElementById(id);
                        if (b) b.onclick = null; } }""")
                    try:
                        r = pg.evaluate(eng.EXPLORE_JS, 2)
                    except Exception as e:
                        r = {'screen': [], 'missing': []}
                        errs.append(f'check aborted: {e}')
                    result[f'{lang}/{page}'] = {'screen': sorted(r['screen']), 'missing': sorted(r['missing']), 'errors': sorted(set(errs))}
                    pg.close()
            br.close()
    finally:
        httpd.shutdown()
    return result


if __name__ == '__main__':
    rep = build()
    for k, v in rep.items():
        print(f'{k}: static untranslated {len(v)}')
    if '--dump' in sys.argv:
        print(json.dumps(rep, ensure_ascii=False, indent=1))
    if '--check' in sys.argv:
        res = check()
        out = I18N / 'check_result.json'
        out.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
        for k, v in res.items():
            print(f"{k}: on screen {len(v['screen'])} / missing {len(v['missing'])} / errors {len(v['errors'])}")
        print('details:', out)
