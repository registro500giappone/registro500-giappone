# -*- coding: utf-8 -*-
"""wiring-layout.json の部品配置を、上面図・側面図に重ねた確認画像を出す。

  使い方: python wiring-simulator/ref/make_layout_review.py
  出力  : wiring-simulator/ref/_layout_top.png / _layout_side.png（git管理外）

  ⚠️位置を直すときはこのファイルではなく wiring-layout.json を書き換える
    （座標を2箇所に持つと必ずずれる。旧 make_top_review.py で踏んだ落とし穴）。
"""
import os, sys, json, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import ImageFont
from carview import render, ROOT, FONTP

LAY = json.load(io.open(ROOT + '/wiring-layout.json', encoding='utf-8'))
P = LAY['parts']
DOT = (47, 93, 80)          # 深緑＝配置点
LEAD = (150, 170, 162)

# ラベルの引き出し方向。(dx_mm, dy_mm) は紙の上での逃がし量
OFF = {
    'top': {
        'battery': (-2, -16), 'f1': (-4, 15), 'quadro': (-18, 15), 'ign_sw': (2, -15),
        'starter_sw': (0, 14), 'starter': (-22, 15), 'regulator': (-18, 17),
        'oil_sender': (-13, -15), 'dynamo': (8, 19), 'body': (2, -18),
    },
    'side': {
        'battery': (-6, -15), 'f1': (3, -15), 'quadro': (-34, -6), 'ign_sw': (16, -22),
        'starter_sw': (-3, 14), 'starter': (-13, 15), 'regulator': (-3, -15),
        'oil_sender': (-24, -7), 'dynamo': (17, 10), 'body': (-6, 21),
    },
}
# 確認画像は紙より大きく描く＝文字の物理サイズは同じまま図が広がり、ラベルが逃げやすくなる
REVIEW_W = 430.0


def mk(view, key, m0, m1, v0, v1, dst):
    def overlay(dr, X, Y, pw, fs, W, H):
        f = ImageFont.truetype(FONTP, fs(3.4))
        for pid, p in P.items():
            if key not in p:
                continue
            x, y = X(p['m']), Y(p[key])
            dx, dy = OFF[view].get(pid, (0, -13))
            lx, ly = x + pw(dx), y + pw(dy)
            dr.line([(x, y), (lx, ly)], fill=LEAD, width=pw(.35))
            r = pw(1.5)
            dr.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255), outline=DOT, width=pw(.55))
            t = p['label']
            b = dr.textbbox((lx, ly), t, font=f, anchor='mm')
            pad = pw(.9)
            dr.rectangle([b[0] - pad, b[1] - pad * .3, b[2] + pad, b[3] + pad * .3], fill=(255, 255, 255))
            dr.text((lx, ly), t, font=f, fill=DOT, anchor='mm')
            # 数値は名前の下に小さく
            f2 = ImageFont.truetype(FONTP, fs(2.5))
            v = '%.2f / %+.2f' % (p['m'], p[key]) if view == 'top' else '%.2f / %.2f' % (p['m'], p[key])
            b2 = dr.textbbox((lx, ly + fs(3.4) * .95), v, font=f2, anchor='mm')
            dr.rectangle([b2[0] - pad, b2[1], b2[2] + pad, b2[3]], fill=(255, 255, 255))
            dr.text((lx, ly + fs(3.4) * .95), v, font=f2, fill=(140, 150, 145), anchor='mm')
        # バッテリーの向き＝＋端子の側に矢印を出す（上面図だけ）
        if view == 'top':
            b = P['battery']
            x, y = X(b['m']), Y(b['lat'])
            dr.line([(x, y), (x, y - pw(9))], fill=(180, 70, 60), width=pw(.7))
            dr.polygon([(x, y - pw(12)), (x - pw(1.8), y - pw(8.4)), (x + pw(1.8), y - pw(8.4))],
                       fill=(180, 70, 60))
            dr.text((x + pw(3.2), y - pw(11)), '＋（右ヘッドライト側）',
                    font=ImageFont.truetype(FONTP, fs(2.8)), fill=(180, 70, 60), anchor='lm')
    return render(view, m0, m1, v0, v1, dst, overlay=overlay, paper_w=REVIEW_W)


d = ROOT + '/wiring-simulator/ref'
print(mk('top', 'lat', -0.05, 3.05, 0.80, -0.80, d + '/_layout_top.png')[0])
print(mk('side', 'h', -0.05, 3.05, 1.50, -0.10, d + '/_layout_side.png')[0])
