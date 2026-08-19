# -*- coding: utf-8 -*-
"""上面図＋部品配置の確認画像を作る。位置を直すときはこの PARTS だけ書き換える。
   lat は中心線からのm。+ が車の右＝画像の上。

【2026-08-20 素材差し替え】下敷きを `ref/svg/fiat500f_top.svg`（3Dモデルの正射投影・
1 SVG unit = 1mm の実寸）に変更。較正は実測bboxから自明に決まる＝もう測らなくてよい：
  前端 x=25 / 後端 x=2995（全長2970mm）／中心線 y=683.15（全幅1316.3mm）
旧素材（blueprint 由来 car-top-v7s.svg・S,LAT,CY = 150.5,153.4,101.0）は使わない。
PARTS / LANDMARKS の値は旧版から一切変えていない（単位は m のままなので移行不要）。
"""
import io, re, sys

X0, CY = 25.0, 683.15          # 前端の x、中心線の y（単位 mm）
M = 1000.0                     # 1m = 1000 units
LINES = ('outline', 'panel', 'trim', 'detail')   # 下敷きに使う線の種類

# (前端からのm, 中心線からのm, 名前, 確度 ok/q/ref, ラベルdx, ラベルdy, 引出線)
PARTS = [
  (0.22,  0.28, 'バッテリー',      'ok',   0, -14, 0),
  (1.15, -0.30, 'メーター',        'ok',   0,  18, 0),
  (1.15,  0.00, 'キー',            'ok',  26,   4, 1),
  (1.55, -0.05, '始動レバー',      'ok', -30,  18, 1),
  (1.55,  0.05, 'チョーク（参考）','ref',  36, -14, 1),
  (2.45,  0.00, 'スターター',      'ok',   0, -14, 0),
  (2.60, -0.26, 'ダイナモ',        'ok',  30,  16, 1),
  (2.45, -0.30, 'レギュレータ',    'ok', -34,  16, 1),
]
# 運転席まわりの目印（旧素材の元図に描かれていた物の実測値）。新素材の上面図は幌が閉じて
# いてハンドルも計器も描かれていないので、これは「実車ではこの辺」を示す参考線として残す。
#   (名前, 前端からのm, 中心線からのm, 前後mm, 左右mm)
LANDMARKS = [
  ('ハンドル',   1.000, -0.257, 166, 345),   # 実車の径は約400mm。図はやや小さめ
  ('メーター',   0.889, -0.264,  91, 122),   # 実車の速度計の径とほぼ一致
]

# 旧素材(car-top-v7s)から測った値。新素材の車体とは合わないので既定では描かない
SHOW_LANDMARKS = False

ZONES = [(0, 1.02, '前トランク'), (1.02, 2.05, '室内'), (2.05, 2.97, 'エンジンルーム')]
WIDTH = int(sys.argv[1]) if len(sys.argv) > 1 else 1320

X = lambda m: X0 + m * M
Y = lambda lat: CY - lat * M
K = 6.64                       # 旧版(447幅)の見た目の大きさを新座標(2970幅)へ合わせる係数

SRC = io.open('wiring-simulator/ref/svg/fiat500f_top.svg', encoding='utf-8').read()
WID = {'outline': 2.2, 'panel': 1.8, 'trim': 1.1, 'detail': 0.8}
PATHS = {m.group(1): m.group(2) for m in re.finditer(r'<path class="(\w+)" d="([^"]+)"', SRC)}


def car_svg(col='#3a352c', scale=1.0):
    return ''.join(
        '<path d="%s" fill="none" stroke="%s" stroke-width="%.2f" stroke-linecap="round" '
        'stroke-linejoin="round"/>' % (PATHS[k], col, WID[k] * scale)
        for k in LINES if k in PATHS)


def landmark_svg(col='#bdb5a4'):
    """ハンドルと計器。上から見ると 2本スポークは左右方向の1本の棒になる。"""
    g = []
    for nm, mm, lat, fw, lw in LANDMARKS:
        g.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="none" stroke="%s" '
                 'stroke-width="%.1f"/>' % (X(mm), Y(lat), fw / 2.0, lw / 2.0, col, .7 * K))
    nm, mm, lat, fw, lw = LANDMARKS[0]
    x, y, ry = X(mm), Y(lat), lw / 2.0
    g += ['<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"/>'
          % (x, y - ry, x, y + ry, col, .7 * K),
          '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="%s" stroke-width="%.1f"/>'
          % (x, y, 2.2 * K, col, .7 * K)]
    return ''.join(g)


col = {'ok': '#5a5348', 'q': '#b06a3a', 'ref': '#a9a294'}
TOP, BOT = -140.0, 1500.0      # ゾーン帯の上下（車体は y=25..1341）
g = []
for a, b, t in ZONES:
    g += ['<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#8d8574" opacity=".045"/>'
          % (X(a), TOP, (b - a) * M, BOT - TOP),
          '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#b3ab99" stroke-width="%.1f" '
          'stroke-dasharray="%.0f %.0f"/>' % (X(b), TOP, X(b), BOT - 60, .7 * K, 4 * K, 3 * K),
          '<text x="%.1f" y="%.1f" font-size="%.0f" text-anchor="middle" fill="#a49b87">%s</text>'
          % (X((a + b) / 2), BOT, 8 * K, t)]
g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#c8a0a0" stroke-width="%.1f" '
         'stroke-dasharray="%.0f %.0f"/>' % (X0, CY, X(2.97), CY, .5 * K, 6 * K, 4 * K))
if SHOW_LANDMARKS:
    g.append(landmark_svg())
g.append(car_svg())
for m, lat, t, k, dx, dy, lead in PARTS:
    x, y, c = X(m), Y(lat), col[k]
    r = (6 if k != 'ref' else 4) * K
    if lead:
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f" '
                 'opacity=".65"/>' % (x, y, x + dx * .78 * K, y + dy * .68 * K, c, .5 * K))
    g += ['<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#fffdf8" stroke="%s" stroke-width="%.1f"/>'
          % (x, y, r, c, 1.5 * K),
          '<text x="%.1f" y="%.1f" font-size="%.0f" text-anchor="middle" fill="%s">%s</text>'
          % (x + dx * K, y + dy * K, 8.7 * K, c, t)]

svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-250 -210 3520 1850" width="%d">' % WIDTH
       + ''.join(g)
       + '<text x="-210" y="%.0f" font-size="%.0f" fill="#8d8574">▲ 車の右側</text>' % (30, 9.8 * K)
       + '<text x="-210" y="%.0f" font-size="%.0f" fill="#8d8574">▼ 車の左側</text>' % (1370, 9.8 * K)
       + '<text x="%.0f" y="%.0f" font-size="%.0f" fill="#8d8574">◀ ノーズ</text>' % (X0, -110, 9.8 * K)
       + '<text x="%.0f" y="%.0f" font-size="%.0f" text-anchor="end" fill="#8d8574">エンジン ▶</text>'
       % (X(2.97), -110, 9.8 * K) + '</svg>')
io.open('_top_review.html', 'w', encoding='utf-8').write(
    '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#faf7f0;padding:10px;'
    'font:13px system-ui;color:#5a5348}svg{display:block}</style>' + svg)
print('ok', WIDTH)
