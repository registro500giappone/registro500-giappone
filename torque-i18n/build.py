#!/usr/bin/env python3
"""締め付けトルク早見帳の英語版・イタリア語版を、日本語版から生成する。

    python torque-i18n/build.py            # en/torque.html と it/torque.html を書き出す
    python torque-i18n/build.py --check    # 書き出さずに検品（生成物が手で直されていないか・辞書の版・残る日本語）
    python torque-i18n/build.py --extract en   # 初回だけ：現在の en/torque.html との diff から辞書を起こす

正本＝ torque.html（日本語）＋ torque-i18n/{en,it}.json（画面の文言の置換表）。
en/torque.html・it/torque.html は生成物なので手で直さない。日本語版を直したらこれを回す。

置換表の各行は [日本語の断片, 訳の断片]。日本語の断片は torque.html に必ず現れなければならず、
現れなければビルドは失敗する＝日本語版の文を変えたら訳も直す、を機械が強制する。
データ側の文言（部位名・注記・出典）はここではなく en/torque-data-en.json 等の辞書で、
ページ内の applyI18n() が実行時に被せる（数値は torque-data.json 1本のまま）。

生成の順番:
  1. 機械変換 …… <html lang> / canonical / og:url / og:image / 相対パスを / 付きに / トップへのリンクを /<lang>/ に /
                  日本語専用の登録案内（rg-join-cta）を外す / 辞書の名前と版（辞書ファイルの内容ハッシュ）を埋める
  2. 置換表で文言を訳す
  3. 日本語だけのコメント（HTML / CSS / JS）を落とす
"""
import difflib
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / 'torque-i18n'
SRC = ROOT / 'torque.html'
LANGS = ['en', 'it']
SITE = 'https://www.registro500.com'
JP = re.compile(r'[　-〿぀-ヿ㐀-䶿一-鿿！-｠]')


def read(p):
    return p.read_text(encoding='utf-8')


def write(p, text):
    p.write_text(text, encoding='utf-8', newline='\n')


def must_replace(html, old, new, where):
    n = html.count(old)
    if n != 1:
        raise SystemExit(f'[build] {where}: 置換元が {n} 回見つかった（1回のはず）: {old[:80]!r}')
    return html.replace(old, new, 1)


def dict_version(lang):
    """辞書ファイルの内容ハッシュ。辞書を直せば勝手に変わる＝版を手で上げなくてよい。"""
    return hashlib.md5((ROOT / lang / f'torque-data-{lang}.json').read_bytes()).hexdigest()[:8]


def mechanical(html, lang):
    h = html
    h = must_replace(h, '<html lang="ja">', f'<html lang="{lang}">', 'lang')
    h = must_replace(h, f'<link rel="canonical" href="{SITE}/torque">',
                     f'<link rel="canonical" href="{SITE}/{lang}/torque">', 'canonical')
    h = must_replace(h, f'<meta property="og:url" content="{SITE}/torque">',
                     f'<meta property="og:url" content="{SITE}/{lang}/torque">', 'og:url')
    h = must_replace(h, '/og/torque-ja.png', f'/og/torque-{lang}.png', 'og:image')
    # 相対の資産参照（style.css / config.js / icon / ロゴ）はサイト直下を指すように
    h = re.sub(r'((?:href|src)=")(?!/|https?:|#|data:|mailto:|tel:)', r'\1/', h)
    # トップへ戻るリンクは言語別トップへ
    h = h.replace('href="/"', f'href="/{lang}/"')
    # 登録への一言カードは日本語専用（rg-join-cta.js が日本語しか持たない）
    h, n = re.subn(r'\n[ \t]*<div id="rg-join-cta"[^\n]*\n[ \t]*<script src="/rg-join-cta\.js"[^\n]*', '', h)
    if n != 1:
        raise SystemExit(f'[build] rg-join-cta のブロックが {n} 個（1個のはず）')
    h = must_replace(h, "fetch('torque-data.json?v='", "fetch('/torque-data.json?v='", 'data fetch')
    h = must_replace(h, 'var I18N_DICT = null;', f"var I18N_DICT = 'torque-data-{lang}.json';", 'I18N_DICT')
    h = must_replace(h, 'var I18N_VERSION = null;', f"var I18N_VERSION = '{dict_version(lang)}';", 'I18N_VERSION')
    return h


def translate(html, table, lang):
    missing = []
    # 長い断片から先に置く（短い断片が長い断片の一部だったときに壊さない）
    for ja, tr in sorted(table, key=lambda p: -len(p[0])):
        if ja not in html:
            missing.append(ja)
            continue
        html = html.replace(ja, tr)
    if missing:
        print(f'[build] {lang}: 置換元が torque.html に見つからない断片が {len(missing)} 件。'
              f'日本語版の文が変わったので torque-i18n/{lang}.json の該当行を直すこと:', file=sys.stderr)
        for m in missing:
            print('   - ' + m.strip().replace('\n', '⏎ ')[:120], file=sys.stderr)
        raise SystemExit(1)
    return html


def strip_jp_comments(html):
    """日本語だけのコメントを落とす（外国語ページに開発時の日本語を残さない）。中身が日本語を含むものだけ。"""
    html = re.sub(r'<!--[\s\S]*?-->', lambda m: '' if JP.search(m.group(0)) else m.group(0), html)
    html = re.sub(r'/\*[\s\S]*?\*/', lambda m: '' if JP.search(m.group(0)) else m.group(0), html)
    out = []
    for line in html.split('\n'):
        s = line.strip()
        if s.startswith('//') and JP.search(s):
            continue
        m = re.search(r'(?<=[\s;,{}()\]])//', line)
        if m:
            head, tail = line[:m.start()], line[m.start():]
            if JP.search(tail) and all(head.count(q) % 2 == 0 for q in ('`', "'", '"')):
                line = head.rstrip()
        out.append(line)
    return '\n'.join(out)


def residual_jp(html, allow):
    pats = [re.compile(a) for a in allow]
    hits = []
    for i, line in enumerate(html.split('\n'), 1):
        if JP.search(line) and not any(p.search(line) for p in pats):
            hits.append((i, line.strip()[:100]))
    return hits


def build(lang, keep_comments=False):
    table = json.loads(read(HERE / f'{lang}.json'))
    html = mechanical(read(SRC), lang)
    html = translate(html, table['replace'], lang)
    if not keep_comments:
        html = strip_jp_comments(html)
    return html, table


def check_versions():
    m = re.search(r"var DATA_VERSION = '([^']+)'", read(SRC))
    data_ver = json.loads(read(ROOT / 'torque-data.json')).get('version')
    ok = True
    for lang in LANGS:
        d = json.loads(read(ROOT / lang / f'torque-data-{lang}.json'))
        if d.get('for_version') != data_ver:
            print(f'[check] {lang}: torque-data-{lang}.json の for_version={d.get("for_version")} が '
                  f'torque-data.json の version={data_ver} と違う（データを変えたら辞書も追随させる）', file=sys.stderr)
            ok = False
    if not m:
        print('[check] torque.html に DATA_VERSION が無い', file=sys.stderr)
        ok = False
    return ok


def extract(lang):
    """初回用：機械変換した日本語版と現在の訳版の diff から置換表を起こす。日本語を含まない差（構造・コメント）は捨てる。"""
    out = HERE / f'{lang}.json'
    if out.exists() and '--force' not in sys.argv:
        raise SystemExit(f'{out} は既にある（上書きするなら --force）')
    ja = mechanical(read(SRC), lang).split('\n')
    tr = read(ROOT / lang / 'torque.html').split('\n')
    sm = difflib.SequenceMatcher(None, ja, tr, autojunk=False)
    pairs, seen = [], set()
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        if tag == 'insert':
            a = '\n'.join(ja[i1 - 1:i2])
            b = '\n'.join([ja[i1 - 1]] + tr[j1:j2])
        else:
            a = '\n'.join(ja[i1:i2])
            b = '\n'.join(tr[j1:j2])
        if not JP.search(a):
            continue
        lines = [l.strip() for l in a.split('\n') if l.strip()]
        if lines and all(l.startswith(('//', '/*', '*')) for l in lines):
            continue
        if a in seen:
            continue
        seen.add(a)
        pairs.append([a, b])
    write(out, json.dumps({'_readme': [
        'torque.html（日本語）の断片 → 訳の断片。torque-i18n/build.py が en/・it/ を生成するときに使う。',
        '日本語側の断片は torque.html に必ず現れること（無ければビルドが止まる）。',
        'allow_jp は生成物に残ってよい日本語行のパターン（かな表・言語切替の表示名など）。',
    ], 'allow_jp': [], 'replace': pairs}, ensure_ascii=False, indent=1))
    print(f'{out}: {len(pairs)} 件')


def main():
    args = sys.argv[1:]
    if args[:1] == ['--extract']:
        extract(args[1])
        return
    keep = '--keep-comments' in args
    ok = check_versions()
    for lang in LANGS:
        html, table = build(lang, keep_comments=keep)
        target = ROOT / lang / 'torque.html'
        hits = residual_jp(html, table.get('allow_jp', []))
        if hits:
            ok = False
            print(f'[check] {lang}: 訳されていない日本語が {len(hits)} 行（辞書に足すか allow_jp に入れる）:', file=sys.stderr)
            for n, t in hits[:40]:
                print(f'   {n}: {t}', file=sys.stderr)
        if '--check' in args:
            if not target.exists() or read(target) != html:
                ok = False
                print(f'[check] {lang}: {target.relative_to(ROOT)} が生成結果と違う（手で直された？ build.py を回して上書きする）', file=sys.stderr)
        else:
            write(target, html)
            print(f'OK {target.relative_to(ROOT)} ({len(html):,} chars, {len(table["replace"])} 断片)')
    if not ok:
        raise SystemExit(1)
    if '--check' in args:
        print('OK torque-i18n --check')


if __name__ == '__main__':
    main()
