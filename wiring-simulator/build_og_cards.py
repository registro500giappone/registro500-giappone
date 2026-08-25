# -*- coding: utf-8 -*-
"""
電装トラブルの旅手帳＝各回の OG 画像（SNSのカード）を作る。

各記事のアイキャッチ（`.scene` の最初の SVG）をそのまま使う＝**記事の絵と一致する**。
別に描き起こすと、記事を直したときにカードだけ古くなる。

手順（2段階。ブラウザは1回しか使わない）
  1) python wiring-simulator/build_og_cards.py --html
       → og-cards.html（10枚を縦に並べた 1200×6300 の版下）を repo 直下に作る
       → ローカルサーバで開き、fullPage で1枚だけスクリーンショットを撮る
          （python -m http.server 8765 → http://localhost:8765/og-cards.html）
  2) python wiring-simulator/build_og_cards.py --split <撮った画像>
       → 630px ごとに切り分けて og/journey-<slug>.png へ保存する

⚠️版下 og-cards.html は作業用＝撮り終わったら消す（本番に置かない）。
"""

import argparse
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULE = os.path.join(ROOT, 'journey-schedule.json')
OUT_HTML = os.path.join(ROOT, 'og-cards.html')
OG_DIR = os.path.join(ROOT, 'og')
W, H = 1200, 630


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


# ⚠️メーターがアイキャッチの回は、そのままだと7枚とも同じ絵に見える（実際そうなった）。
#   カードの中でだけ【警告灯の帯に寄せる】＝どの灯が点いているかが顔になる。
#   ⛔記事本体の絵は動かさない（viewBox を差し替えるのはこの版下の中だけ）。
#   座標の出どころ＝メーター内部は 200×200 の座標系を translate(12,12) で置いてある。
#   警告灯の穴は LUCI(48,177) GENERAT.(89,200) BENZINA(135,200) OLIO(176,177)（外側座標）。
METER_VIEWBOX = '0 0 224 232'
METER_ZOOM = '28 116 168 106'


def scene_svg(slug, zoom=True):
    """記事の最初の `.scene` の中の <svg>…</svg> を取り出す。"""
    src = read(os.path.join(ROOT, 'wiring-journey-%s.html' % slug))
    m = re.search(r'<div class="scene">\s*(<svg.*?</svg>)', src, flags=re.S)
    if not m:
        raise SystemExit('%s のアイキャッチ（.scene の svg）が見つかりません' % slug)
    svg = m.group(1)
    # 版下では枠に合わせる＝width/height 属性を外して CSS 側に任せる
    svg = re.sub(r'\s(width|height)="[^"]*"', '', svg, count=2)
    if not zoom:
        return svg
    return svg.replace('viewBox="%s"' % METER_VIEWBOX, 'viewBox="%s"' % METER_ZOOM, 1)


def items():
    sch = json.loads(read(SCHEDULE))
    out = []
    for it in sch['issues']:
        out.append({'slug': it['slug'], 'n': it['n'], 'title': it['title'], 'side': False})
    for e in sch.get('extras', []):
        out.append({'slug': e['slug'], 'n': e['of'], 'title': e['title'], 'side': True})
    # 目次（連載の扉）の分。絵は第1回のメーターを【寄せずに】全体で使う＝扉は個別の症状を指さない
    out.append({'slug': 'index', 'n': 0, 'title': sch['title'], 'side': False,
                'src': 'charge', 'zoom': False,
                'sub': '空冷フィアット500の電装を、症状ごとに1枚の絵で'})
    return out


CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#888}
.card{width:%(w)spx;height:%(h)spx;display:flex;align-items:center;gap:44px;
      padding:56px 64px;background:#e3dac4;color:#2a2620;overflow:hidden;
      font-family:"Yu Gothic","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif}
/* 左＝記事のアイキャッチを白い紙に載せる（記事の中と同じ見え方にする） */
/* ⚠️紙の高さは絵の比率に任せる（固定にすると、横長の絵のとき上下が余って小さく見える） */
.pic{width:452px;flex:none;background:#fbf8f0;border:1px solid #d8cdb2;
     border-radius:14px;display:flex;align-items:center;justify-content:center;
     box-shadow:2px 2px 0 rgba(90,78,55,.13);padding:18px}
.pic svg{width:100%%;height:auto;max-height:502px}
.txt{flex:1;min-width:0}
.brand{font-size:22px;letter-spacing:.22em;font-weight:800;color:#2f4a5c}
.rule{width:56px;height:5px;background:#2f4a5c;margin:20px 0 24px}
h1{font-size:56px;line-height:1.28;font-weight:800;letter-spacing:.01em;
   word-break:auto-phrase;overflow-wrap:anywhere}
h1.long{font-size:46px}
.kai{margin-top:26px;display:inline-block;background:#2f4a5c;color:#fbf8f0;
     font-size:21px;font-weight:700;letter-spacing:.12em;padding:7px 18px;border-radius:999px}
.sub{margin-top:24px;font-size:23px;line-height:1.6;color:#5c5445}
.foot{margin-top:22px;font-size:19px;color:#7d7362;letter-spacing:.06em}
""" % {'w': W, 'h': H}


def build_html():
    cards = []
    for it in items():
        svg = scene_svg(it.get('src', it['slug']), it.get('zoom', True))
        long = ' long' if len(it['title']) >= 15 else ''
        if it.get('sub'):
            # 扉のカード＝連載名が主役。回数バッジの代わりに一言を置く
            head = '<div class="brand">毎週金曜 更新</div><div class="rule"></div>'
            tail = '<div class="sub">%s</div>' % it['sub']
        else:
            head = '<div class="brand">電装トラブルの旅手帳</div><div class="rule"></div>'
            tail = '<div class="kai">%s</div>' % (
                '第%d回 別冊' % it['n'] if it['side'] else '第%d回' % it['n'])
        cards.append(
            '<div class="card" id="card-%s"><div class="pic">%s</div><div class="txt">'
            '%s<h1 class="%s">%s</h1>%s'
            '<div class="foot">registro500.com</div>'
            '</div></div>' % (it['slug'], svg, head, long.strip(), it['title'], tail))
    html = ('<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n'
            '<title>OGカードの版下（作業用・撮ったら消す）</title>\n'
            '<meta name="robots" content="noindex, nofollow">\n'
            '<link rel="stylesheet" href="/wiring-journey.css">\n'
            '<style>%s</style>\n</head>\n<body>\n%s\n</body>\n</html>\n'
            % (CSS, '\n'.join(cards)))
    with io.open(OUT_HTML, 'w', encoding='utf-8', newline='') as f:
        f.write(html)
    print('版下を作りました: %s（%d枚・全体 %d×%d）'
          % (os.path.relpath(OUT_HTML, ROOT), len(cards), W, H * len(cards)))
    print('→ http://localhost:8765/og-cards.html を fullPage で1枚撮ってください')


def split(shot):
    from PIL import Image
    im = Image.open(shot)
    rows = items()
    if im.width != W:
        # 端末の解像度倍率が乗っていることがあるので、幅を基準に合わせる
        scale = W / float(im.width)
        im = im.resize((W, int(round(im.height * scale))), Image.LANCZOS)
    need = H * len(rows)
    if abs(im.height - need) > 4:
        raise SystemExit('高さが合いません（%d ではなく %d）。撮り直してください' % (im.height, need))
    if not os.path.isdir(OG_DIR):
        os.makedirs(OG_DIR)
    for i, it in enumerate(rows):
        box = (0, H * i, W, H * (i + 1))
        out = os.path.join(OG_DIR, 'journey-%s.png' % it['slug'])
        im.crop(box).convert('RGB').save(out, 'PNG', optimize=True)
        print('  og/journey-%s.png' % it['slug'])
    print('%d枚を書き出しました' % len(rows))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', action='store_true', help='版下HTMLを作る')
    ap.add_argument('--split', metavar='PNG', help='撮った画像を10枚に切り分ける')
    a = ap.parse_args()
    if a.html:
        build_html()
    elif a.split:
        split(a.split)
    else:
        ap.error('--html か --split のどちらかを指定してください')


if __name__ == '__main__':
    main()
