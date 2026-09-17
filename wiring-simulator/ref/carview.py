# -*- coding: utf-8 -*-
"""実寸の車体線画（上面図・側面図）を PNG に描く共通部品。

  make_top_pptx.py（記入用パワポ）と make_layout_review.py（配置の確認画像）から使う。
  ⚠️座標は 1 SVG unit = 1mm の実寸。較正の正本は ref/calibration.json。
    上面: x = 25 + 前端からのm*1000 / y = 683.15 - 中心線からのm*1000（+が車の右＝画像の上）
    側面: x = 25 + 前端からのm*1000 / y = 1332  - 地面からのm*1000（車の左側面を見た図）
"""
import io, re, os
from PIL import Image, ImageDraw, ImageFont

# 素材はどこから実行しても引けるよう repo ルート基準で解決する
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DPI, SS = 300, 2                 # 印刷解像度／描くときの倍率（縮小してアンチエイリアス）
PAPER_W = 281.0                  # 図を紙の上で何mm幅にするか

VIEWS = {
    'top':  {'src': ROOT + '/wiring-img/car-top-v9.svg', 'x0': 25.0, 'base': 683.15},
    'side': {'src': ROOT + '/wiring-simulator/ref/svg/fiat500f_side.svg', 'x0': 25.0, 'base': 1332.0},
}
PATHS = {k: re.findall(r'<path class="(\w+)" d="([^"]+)"',
                       io.open(v['src'], encoding='utf-8').read())
         for k, v in VIEWS.items()}

# 紙の上での線の太さ(mm)。車体のmmではない＝縮尺を変えても見え方を保つ
WIDTH_MM = {'outline': .45, 'panel': .34, 'trim': .24, 'detail': .17}
COL = {'outline': (110, 110, 110), 'panel': (125, 125, 125),
       'trim': (150, 150, 150), 'detail': (183, 183, 183)}
ZONES = [(0, 1.02, '前トランク'), (1.02, 2.05, '室内'), (2.05, 2.97, 'エンジンルーム')]
FONTP = 'C:/Windows/Fonts/meiryo.ttc'


def subpaths(d):
    out = []
    for s in d.replace('Z', ' ').split('M'):
        s = s.strip()
        if s:
            out.append([[float(a) for a in q.split(',')] for q in s.split()])
    return out


def render(view, m0, m1, v0, v1, dst, overlay=None, paper_w=None):
    """view の図を PNG に描く。v0 が画像の上端、v1 が下端（top は左右m・side は高さm）。
       overlay(dr, X, Y, pw, fs, W, H) を渡すと車体の上に書き足せる。"""
    V = VIEWS[view]
    ysv = lambda v: V['base'] - v * 1000      # 縦は top/side とも「基準 − 値」で同じ形
    spanx, spany = (m1 - m0) * 1000, abs(v1 - v0) * 1000
    W = int(round((paper_w or PAPER_W) * DPI / 25.4 * SS))
    H = int(round(W * spany / spanx))
    k = W / spanx                             # 1車体mm あたりの px
    ox, oy = V['x0'] + m0 * 1000, ysv(v0)
    PXx = lambda x: (x - ox) * k
    PXy = lambda y: (y - oy) * k
    X = lambda m: PXx(V['x0'] + m * 1000)
    Y = lambda v: PXy(ysv(v))
    pw = lambda mm: max(1, int(round(mm * DPI / 25.4 * SS)))
    fs = lambda mm: max(8, int(round(mm * DPI / 25.4 * SS)))

    im = Image.new('RGB', (W, H), (255, 255, 255))
    dr = ImageDraw.Draw(im)
    f_num = ImageFont.truetype(FONTP, fs(2.4))
    f_zone = ImageFont.truetype(FONTP, fs(3.2))

    def label(x, y, t, font, col):
        """罫線や車体線に文字が潰されないよう、下に白地を敷いてから書く。"""
        b = dr.textbbox((x, y), t, font=font, anchor='mm')
        # 左右は広めに空ける＝罫線が文字に触れていると「-1.0」のように読めてしまう
        pad = fs(2.4) * .55
        dr.rectangle([b[0] - pad, b[1] - pad * .2, b[2] + pad, b[3] + pad * .2], fill=(255, 255, 255))
        dr.text((x, y), t, font=font, fill=col, anchor='mm')

    # 0.1m方眼（0.5mごとに濃く）
    i = int(round(m0 * 10))
    while i <= int(round(m1 * 10)):
        m, major = i / 10.0, (i % 5 == 0)
        dr.line([(X(m), 0), (X(m), H)], fill=(168, 168, 168) if major else (222, 222, 222),
                width=pw(.26 if major else .12))
        if major:
            for yy in (fs(2.4) * .9, H - fs(2.4) * .9):
                label(X(m), yy, '%.1f' % m, f_num, (130, 130, 130))
        i += 1
    lo, hi = min(v0, v1), max(v0, v1)
    j = int(round(lo * 10))
    while j <= int(round(hi * 10)):
        v, major = j / 10.0, (j % 5 == 0)
        dr.line([(0, Y(v)), (W, Y(v))], fill=(168, 168, 168) if major else (222, 222, 222),
                width=pw(.26 if major else .12))
        if major:
            t = ('0' if abs(v) < 1e-9 else '%+.1f' % v) if view == 'top' else '%.1f' % v
            for xx in (fs(2.4) * 1.5, W - fs(2.4) * 1.5):
                label(xx, Y(v), t, f_num, (130, 130, 130))
        j += 1

    # 区画の仕切りと名前
    for a, b, t in ZONES:
        if b < m0 or a > m1:
            continue
        if a > m0:
            for yy in range(0, H, pw(2.2)):
                dr.line([(X(a), yy), (X(a), yy + pw(1.3))], fill=(205, 185, 145), width=pw(.3))
        label(X((max(a, m0) + min(b, m1)) / 2), fs(3.2) * 2.4, t, f_zone, (188, 167, 118))

    # top＝中心線（左右の符号の基準）／side＝地面（高さ0）
    if view == 'top':
        for xx in range(0, W, pw(3.4)):
            dr.line([(xx, Y(0)), (xx + pw(2.0), Y(0))], fill=(206, 150, 150), width=pw(.35))
    else:
        dr.line([(0, Y(0)), (W, Y(0))], fill=(170, 155, 155), width=pw(.6))

    for cls, d in PATHS[view]:
        w, c = pw(WIDTH_MM[cls]), COL[cls]
        for sp in subpaths(d):
            pts = [(PXx(x), PXy(y)) for x, y in sp]
            if len(pts) > 1:
                dr.line(pts, fill=c, width=w, joint='curve')

    if overlay:
        overlay(dr, X, Y, pw, fs, W, H)

    im = im.resize((W // SS, H // SS), Image.LANCZOS)
    im.save(dst, optimize=True)
    return dst, W // SS, H // SS
