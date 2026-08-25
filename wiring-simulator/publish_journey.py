# -*- coding: utf-8 -*-
"""
電装トラブルの旅手帳＝週刊連載の公開処理。

journey-schedule.json（正本）を読んで、各回の記事HTMLに「いまどの状態か」を書き込む。
毎日1回 GitHub Actions から流す（.github/workflows/journey-publish.yml）。

⚠️毎週金曜だけ流さない理由＝その週のジョブが落ちると、1回分が丸ごと出ないまま
  次の金曜まで気づけない。毎日流して冪等にしておけば、翌日に自然と復旧する。

やること（すべて冪等）
  1) 各記事HTMLの JOURNEY-STATE ブロックを書き換える
       state='pre'   … early 前   → noindex・門番が伏せる
       state='early' … 先行期間中 → noindex・門番が登録オーナーだけに見せる
       state='open'  … public 以降 → noindex を外す・門番は素通り
  2) 目次ページ wiring-journey.html の noindex を、最初の公開日以降に外す
  3) 公開ずみの回だけを sitemap-journey.xml に並べ、robots.txt に Sitemap 行を足す
     （1本も公開していないうちは sitemap を作らない＝空の sitemap は出さない）

⛔このスクリプトはトップページ等への導線を一切触らない。導線はユーザーが手で付ける
  （CLAUDE.md「公開導線を勝手に作らない」）。

使い方
  python wiring-simulator/publish_journey.py                 # 今日として実行
  python wiring-simulator/publish_journey.py --date 2026-09-11 --dry-run
"""

import argparse
import hashlib
import io
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

# Windows のコンソールは既定が cp932＝日本語も⚠️も出せずに落ちる。出力側を UTF-8 に寄せる。
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULE = os.path.join(ROOT, 'journey-schedule.json')
INDEX_HTML = os.path.join(ROOT, 'wiring-journey.html')
SITEMAP = os.path.join(ROOT, 'sitemap-journey.xml')
ROBOTS = os.path.join(ROOT, 'robots.txt')
BASE = 'https://www.registro500.com'

GATE_JS = 'wiring-journey-gate.js'
BEGIN = '<!-- JOURNEY-STATE:BEGIN ⛔ここから END までは publish_journey.py が書き換える＝手で編集しない -->'
END = '<!-- JOURNEY-STATE:END -->'
SITEMAP_LINE = 'Sitemap: %s/sitemap-journey.xml' % BASE
# OG画像は回ごと＝og/journey-<slug>.png（作るのは build_og_cards.py）。
# ⚠️無ければ og:image を出さない（在りもしない画像を指すと、SNSのカードが壊れて配られる）。
OG_FMT = 'og/journey-%s.png'


def today_jst():
    return (datetime.now(timezone.utc) + timedelta(hours=9)).strftime('%Y-%m-%d')


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text, dry, changed):
    """内容が変わったときだけ書く。改行は LF 固定（Actions とローカルで差分を出さない）。"""
    old = read(path) if os.path.exists(path) else None
    if old == text:
        return False
    changed.append(os.path.relpath(path, ROOT).replace(os.sep, '/'))
    if not dry:
        with io.open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(text)
    return True


def gate_version():
    """門番 JS の内容ハッシュ。参照URLに付けて世代を変える。

    ⚠️これが要る理由＝sw.js は CSS/JS を StaleWhileRevalidate で返す＝古い版が1回返る。
      門番だけは古い版が返ると「先行中の回が読めてしまう」ので、URL を変えて取り直させる。
    """
    with io.open(os.path.join(ROOT, GATE_JS), 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def gate_ref(text, gv):
    """HTML 内の門番の参照を、いまの世代に貼り替える。"""
    return re.sub(r'src="/' + re.escape(GATE_JS) + r'(\?v=[0-9a-f]+)?"',
                  'src="/%s?v=%s"' % (GATE_JS, gv), text)


def state_of(item, today):
    if today >= item['public']:
        return 'open'
    if today >= item['early']:
        return 'early'
    return 'pre'


def esc(t):
    return (t.replace('&', '&amp;').replace('"', '&quot;')
             .replace('<', '&lt;').replace('>', '&gt;'))


def page_title(src):
    """HTML に書いてある <title> をそのまま使う＝題名の正本は記事側に置く。"""
    m = re.search(r'<title>(.*?)</title>', src, flags=re.S)
    return m.group(1).strip() if m else ''


def block(item, state, gv, title):
    """記事HTMLの head に入れる管理ブロック。門番（gate.js）はこの値だけを見る。

    ⚠️description・canonical・OGP もここが持つ＝日付と同じで正本は journey-schedule.json。
      HTML 側に散らすと、回が増えるたびに書き漏らす。
    """
    data = {'slug': item['slug'], 'n': item['n'], 'state': state, 'pub': item['public']}
    url = '%s/wiring-journey-%s' % (BASE, item['slug'])
    # og:title は <title> からサイト名を落としたもの（SNS のカードで二重に出さない）
    ogt = title.split('｜')[0].strip()
    og = OG_FMT % item['slug']
    has_og = os.path.exists(os.path.join(ROOT, og))
    lines = [BEGIN]
    if state != 'open':
        # 先行中・公開前は検索に載せない。公開日にこの行が消える＝それが「公開」。
        lines.append('<meta name="robots" content="noindex, nofollow">')
    lines.append('<meta name="description" content="%s">' % esc(item['desc']))
    lines.append('<link rel="canonical" href="%s">' % url)
    lines.append('<meta property="og:type" content="article">')
    lines.append('<meta property="og:title" content="%s">' % esc(ogt))
    lines.append('<meta property="og:description" content="%s">' % esc(item['desc']))
    lines.append('<meta property="og:url" content="%s">' % url)
    if has_og:
        lines.append('<meta property="og:image" content="%s/%s">' % (BASE, og))
    lines.append('<meta property="og:site_name" content="Registro500 Giappone">')
    lines.append('<meta name="twitter:card" content="%s">'
                 % ('summary_large_image' if has_og else 'summary'))
    lines.append('<script>window.JOURNEY=%s;</script>'
                 % json.dumps(data, ensure_ascii=False, sort_keys=True))
    lines.append('<script src="/%s?v=%s"></script>' % (GATE_JS, gv))
    lines.append(END)
    return '\n'.join(lines)


def apply_article(path, item, state, gv, dry, changed):
    src = read(path)
    new = block(item, state, gv, page_title(src))
    if BEGIN in src:
        out = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END), lambda m: new, src, flags=re.S)
    else:
        # 初回だけ＝既存の noindex 行をブロックに置き換えて、以後はブロックを持ち回る
        m = re.search(r'^[ \t]*<meta name="robots"[^>]*>[ \t]*\n', src, flags=re.M)
        if not m:
            raise SystemExit('%s に robots メタも JOURNEY-STATE ブロックも見つかりません' % path)
        out = src[:m.start()] + new + '\n' + src[m.end():]
    return write(path, out, dry, changed)


def apply_index(first_public, today, dry, changed):
    """目次ページ＝最初の回が一般公開される日に、検索へ載せる。"""
    src = read(INDEX_HTML)
    open_now = bool(first_public) and today >= first_public
    has = re.search(r'^[ \t]*<meta name="robots"[^>]*>[ \t]*\n', src, flags=re.M)
    if open_now and has:
        out = src[:has.start()] + src[has.end():]
    elif not open_now and not has:
        # 何かの拍子に消えていたら戻す（連載開始前に検索へ出さない）
        out = src.replace('<meta charset="utf-8">',
                          '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">', 1)
    else:
        return False
    return write(INDEX_HTML, out, dry, changed)


def apply_sitemap(published, today, dry, changed):
    """公開ずみの回だけを並べる。1本も無ければ sitemap を作らない。"""
    if not published:
        return False
    urls = [('%s/wiring-journey' % BASE, today, '0.7')]
    for it, state in published:
        urls.append(('%s/wiring-journey-%s' % (BASE, it['slug']), it['public'], '0.6'))
    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<!-- 電装トラブルの旅手帳＝publish_journey.py が生成。公開ずみの回だけを載せる -->',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, mod, pri in urls:
        body += ['  <url>',
                 '    <loc>%s</loc>' % loc,
                 '    <lastmod>%s</lastmod>' % mod,
                 '    <changefreq>monthly</changefreq>',
                 '    <priority>%s</priority>' % pri,
                 '  </url>']
    body.append('</urlset>')
    body.append('')
    wrote = write(SITEMAP, '\n'.join(body), dry, changed)

    # robots.txt には Sitemap 行を1度だけ足す（末尾に追記・既にあれば何もしない）
    rb = read(ROBOTS)
    if SITEMAP_LINE not in rb:
        rb2 = rb.rstrip('\n') + '\n' + SITEMAP_LINE + '\n'
        wrote = write(ROBOTS, rb2, dry, changed) or wrote
    return wrote


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--date', default=None, help='この日として処理する（確認用）')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    today = args.date or today_jst()
    sch = json.loads(read(SCHEDULE))

    items = []
    for it in sch['issues']:
        items.append(it)
    for e in sch.get('extras', []):
        # 別冊は親の回の番号を名乗る（読者向けの見え方＝「第1回 別冊」）
        items.append(dict(e, n=e['of']))

    gv = gate_version()
    changed = []
    published = []
    rows = []
    for it in items:
        st = state_of(it, today)
        path = os.path.join(ROOT, 'wiring-journey-%s.html' % it['slug'])
        if not os.path.exists(path):
            raise SystemExit('記事が見つかりません: %s' % path)
        apply_article(path, it, st, gv, args.dry_run, changed)
        if st == 'open':
            published.append((it, st))
        rows.append((it['slug'], st))

    first_public = min(it['public'] for it in sch['issues'])
    apply_index(first_public, today, args.dry_run, changed)
    # 目次の門番も記事と同じ世代に揃える（目次にも「先行分を出すか」の判断が乗っている）
    write(INDEX_HTML, gate_ref(read(INDEX_HTML), gv), args.dry_run, changed)
    apply_sitemap(published, today, args.dry_run, changed)

    print('基準日 %s（JST）' % today)
    for slug, st in rows:
        print('  %-12s %s' % (slug, {'pre': 'まだ', 'early': '登録オーナー先行', 'open': '公開中'}[st]))
    missing = [sl for sl, _ in rows if not os.path.exists(os.path.join(ROOT, OG_FMT % sl))]
    if missing:
        print('⚠️ OG画像が無い回: %s → build_og_cards.py で作ってください' % ' '.join(missing))
    if changed:
        print('変更したファイル: %s' % ' '.join(sorted(set(changed))))
    else:
        print('変更なし')
    if args.dry_run:
        print('（--dry-run のため書き込んでいません）')


if __name__ == '__main__':
    main()
