"""List the Japanese strings of the simulators that the dictionaries do not cover yet.

    python engine-simulator/i18n/extract_i18n.py [lang]      # default lang = en; writes i18n/todo_<lang>.json

Sources: string literals in the page scripts and in the modules they import, and the static text of the pages.
Template literals become templates: `ピーク ${x} rpm` -> "ピーク {0} rpm".
Literals that contain markup are listed twice: as html (for elements whose whole innerHTML they are) and as text pieces.
Output entries: {"key": ..., "kind": "exact|tpl|html|htmlTpl", "where": ["file:line", ...]} — translate "key" into the
dictionary section named by "kind". Keys already in the dictionary are left out.
"""
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'engine-simulator'
I18N = SRC / 'i18n'
PAGES = ['index', 'drive', 'gearbox', 'drive-guide']
MODULES = ['sim.js', 'presets.js', 'story.js', 'presets_vehicle.js', 'vehicle.js', 'scenes.js', 'gauge_a0.js', 'presets_drive_packs.js']
JP = re.compile(r'[　-〿぀-ヿ㐀-䶿一-鿿！-｠]')
TAG = re.compile(r'<[^>]+>')
INLINE = {'b', 'i', 'em', 'strong', 'small', 'span', 'a', 'br', 'sup', 'sub', 'code', 'u', 'mark', 'kbd', 'abbr'}


def js_strings(code):
    """Yield (text, is_template, offset) for string literals; template ${...} parts become {n}."""
    i, n = 0, len(code)
    while i < n:
        c = code[i]
        if code.startswith('//', i):
            j = code.find('\n', i); i = n if j < 0 else j; continue
        if code.startswith('/*', i):
            j = code.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c in '\'"':
            j, buf = i + 1, []
            while j < n and code[j] != c:
                if code[j] == '\\': buf.append(code[j + 1]); j += 2; continue
                if code[j] == '\n': break
                buf.append(code[j]); j += 1
            yield ''.join(buf), False, i
            i = j + 1; continue
        if c == '`':
            j, buf, k = i + 1, [], 0
            while j < n and code[j] != '`':
                if code[j] == '\\': buf.append(code[j + 1]); j += 2; continue
                if code.startswith('${', j):
                    depth, m = 1, j + 2
                    while m < n and depth:
                        if code[m] == '{': depth += 1
                        elif code[m] == '}': depth -= 1
                        elif code[m] == '`':  # nested template: skip it
                            m += 1
                            while m < n and code[m] != '`': m += 1
                        m += 1
                    inner = code[j + 2:m - 1]
                    for s, t, off in js_strings(inner):
                        yield s, t, i
                    buf.append('{%d}' % k); k += 1; j = m; continue
                buf.append(code[j]); j += 1
            yield ''.join(buf), True, i
            i = j + 1; continue
        i += 1


def line_of(text, off):
    return text.count('\n', 0, off) + 1


def pieces_of_markup(s):
    return [p for p in (x.strip() for x in TAG.split(s)) if JP.search(p)]


def norm(h):
    h = re.sub(r'<(br|img|input|hr|meta|link)([^>]*?)\s*/>', r'<\1\2>', h)
    return re.sub(r'\s+', ' ', h).strip()


def collect():
    found = {}

    def add(key, kind, where):
        key = key.strip()
        if not key or not JP.search(key):
            return
        e = found.setdefault((kind, key), set())
        e.add(where)

    def from_code(code, fname, base_line=0):
        for s, is_tpl, off in js_strings(code):
            if not JP.search(s):
                continue
            where = f'{fname}:{base_line + line_of(code, off)}'
            has_ph = bool(re.search(r'\{\d+\}', s))
            if TAG.search(s):
                add(s, 'htmlTpl' if has_ph else 'html', where)
                for p in pieces_of_markup(s):
                    add(p, 'tpl' if re.search(r'\{\d+\}', p) else 'exact', where)
            else:
                add(s, 'tpl' if has_ph else 'exact', where)

    for mod in MODULES:
        from_code((SRC / mod).read_text(encoding='utf-8'), mod)
    for page in PAGES:
        html = (SRC / f'{page}.html').read_text(encoding='utf-8')
        for m in re.finditer(r'<script type="module">([\s\S]*?)</script>', html):
            from_code(m.group(1), f'{page}.html', line_of(html, m.start(1)) - 1)
        for m in re.finditer(r'content:\s*"([^"]*)"', html):
            add(m.group(1), 'exact', f'{page}.html:{line_of(html, m.start())}')
        soup = BeautifulSoup(html, 'html.parser')
        for t in soup(['script', 'style']):
            t.decompose()
        for c in soup.find_all(string=lambda s: isinstance(s, Comment)):
            c.extract()
        body = soup.body
        for el in body.find_all(True):
            for a in ('title', 'aria-label', 'placeholder', 'alt'):
                if el.get(a):
                    add(el[a], 'exact', f'{page}.html')
            kids = [k for k in el.children if getattr(k, 'name', None)]
            if kids and all(k.name in INLINE for k in kids) and JP.search(el.get_text()):
                direct_jp = any(isinstance(k, NavigableString) and JP.search(k) for k in el.children)
                if direct_jp:
                    add(norm(el.decode_contents()), 'html', f'{page}.html')
        for s in body.find_all(string=True):
            if JP.search(s):
                add(re.sub(r'\s+', ' ', s).strip(), 'exact', f'{page}.html')
    return found


def main():
    lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
    path = I18N / f'{lang}.json'
    d = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    have = {k: set(d.get(k, {})) for k in ('exact', 'tpl', 'html', 'htmlTpl')}
    todo = [{'key': k, 'kind': kind, 'where': sorted(w)} for (kind, k), w in collect().items() if k not in have[kind]]
    todo.sort(key=lambda e: (e['where'][0], e['kind'], e['key']))
    out = I18N / f'todo_{lang}.json'
    out.write_text(json.dumps(todo, ensure_ascii=False, indent=1), encoding='utf-8')
    by = {}
    for e in todo:
        by[e['kind']] = by.get(e['kind'], 0) + 1
    print(f'{len(todo)} to translate {by} -> {out}')


if __name__ == '__main__':
    main()
