# -*- coding: utf-8 -*-
"""上面図＋部品配置の確認画像を作る。位置を直すときはこの PARTS だけ書き換える。
   lat は中心線からのm。+ が車の右＝画像の上。"""
import io, re, sys
# 較正は blueprint_4views_hi.png の上面図の実測から。前後 447px=2.970m / 左右 202.5px=1.320m
S, LAT, CY = 150.5, 153.4, 101.0
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
# 元図そのものに描かれている運転席まわりの目印（原典の実測値。部品ではないので薄く描く）
# 幌が閉じているのに透けて見えているが、位置・大きさは実車と矛盾しない。
#   (名前, 前端からのm, 中心線からのm, 前後mm, 左右mm)
LANDMARKS = [
  ('ハンドル',   1.000, -0.257, 166, 345),   # 実車の径は約400mm。図はやや小さめ
  ('メーター',   0.889, -0.264,  91, 122),   # 実車の速度計の径とほぼ一致
]

ZONES = [(0, 1.02, '前トランク'), (1.02, 2.05, '室内'), (2.05, 2.97, 'エンジンルーム')]
WIDTH = int(sys.argv[1]) if len(sys.argv) > 1 else 1320

X = lambda m: m * S
Y = lambda lat: CY - lat * LAT
SVG = io.open('wiring-img/car-top-v7s.svg', encoding='utf-8').read()
d = re.search(r'\sd="([^"]+)"', SVG).group(1)
def landmark_svg(col='#bdb5a4'):
    """ハンドルと計器。上から見ると 2本スポークは左右方向の1本の棒になる。"""
    g = []
    for nm, mm, lat, fw, lw in LANDMARKS:
        x, y = X(mm), Y(lat)
        g.append('<ellipse cx="%.1f" cy="%.1f" rx="%.2f" ry="%.2f" fill="none" stroke="%s" stroke-width=".7"/>'
                 % (x, y, fw / 2000.0 * S, lw / 2000.0 * LAT, col))
    nm, mm, lat, fw, lw = LANDMARKS[0]
    x, y, ry = X(mm), Y(lat), lw / 2000.0 * LAT
    g += ['<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width=".7"/>' % (x, y - ry, x, y + ry, col),
          '<circle cx="%.1f" cy="%.1f" r="2.2" fill="none" stroke="%s" stroke-width=".7"/>' % (x, y, col)]
    return ''.join(g)

col = {'ok': '#5a5348', 'q': '#b06a3a', 'ref': '#a9a294'}
g = []
for a, b, t in ZONES:
    g += ['<rect x="%.1f" y="-20" width="%.1f" height="243" fill="#8d8574" opacity=".045"/>' % (X(a), X(b - a)),
          '<line x1="%.1f" y1="-18" x2="%.1f" y2="224" stroke="#b3ab99" stroke-width=".7" stroke-dasharray="4 3"/>' % (X(b), X(b)),
          '<text x="%.1f" y="232" font-size="8" text-anchor="middle" fill="#a49b87">%s</text>' % (X((a + b) / 2), t)]
g.append('<line x1="0" y1="%.1f" x2="447" y2="%.1f" stroke="#c8a0a0" stroke-width=".5" stroke-dasharray="6 4"/>' % (CY, CY))
g.append(landmark_svg())
g.append('<path fill="none" stroke="#3a352c" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round" d="%s"/>' % d)
for m, lat, t, k, dx, dy, lead in PARTS:
    x, y, c = X(m), Y(lat), col[k]
    r = 6 if k != 'ref' else 4
    if lead:
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width=".5" opacity=".65"/>' % (x, y, x + dx * .78, y + dy * .68, c))
    g += ['<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#fffdf8" stroke="%s" stroke-width="1.5"/>' % (x, y, r, c),
          '<text x="%.1f" y="%.1f" font-size="8.7" text-anchor="middle" fill="%s">%s</text>' % (x + dx, y + dy, c, t)]
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-38 -32 528 278" width="%d">' % WIDTH + ''.join(g)
       + '<text x="-32" y="4" font-size="9.8" fill="#8d8574">▲ 車の右側</text>'
       + '<text x="-32" y="208" font-size="9.8" fill="#8d8574">▼ 車の左側</text>'
       + '<text x="2" y="-16" font-size="9.8" fill="#8d8574">◀ ノーズ</text>'
       + '<text x="384" y="-16" font-size="9.8" fill="#8d8574">エンジン ▶</text></svg>')
io.open('_top_review.html', 'w', encoding='utf-8').write(
    '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#faf7f0;padding:10px;'
    'font:13px system-ui;color:#5a5348}svg{display:block}</style>' + svg)
print('ok', WIDTH)
