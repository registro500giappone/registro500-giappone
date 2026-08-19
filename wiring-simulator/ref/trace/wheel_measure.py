# -*- coding: utf-8 -*-
"""ハンドルまわりの塊を1つずつ測る。実車と突き合わせて使えるか判断するため。"""
from PIL import Image
import numpy as np, cv2
REPO = 'C:/Users/akayu/Documents/registro500-giappone/'
S, LATP = 301.0, 306.8            # 元画像での px/m（前後・左右）
X0F, Y0F, CYF = 621.0, 551.0, 753.0

a = np.array(Image.open(REPO + 'wiring-simulator/ref/blueprint_4views_hi.png').convert('L'))
sub = a[520:980, 600:1536]
m = (sub.astype(np.float32) < cv2.medianBlur(sub, 9).astype(np.float32) - 20).astype(np.uint8)

win = m[760-520:900-520, 850-600:990-600]            # 全画像 x850..990 y760..900
n, lab, st, cen = cv2.connectedComponentsWithStats(win, 8)
print('塊 %d 個（面積の大きい順）' % (n - 1))
for i in sorted(range(1, n), key=lambda i: -st[i, 4])[:8]:
    x, y, w, h, ar = st[i]
    fx, fy = x + 850, y + 760
    print('  面積%5d  全画像 x %d..%d y %d..%d  (%dx%d px = 前後%.0fmm × 左右%.0fmm)'
          % (ar, fx, fx + w - 1, fy, fy + h - 1, w, h, w / S * 1000, h / LATP * 1000))
    print('        中心: 前端から %.3f m / 中心線から車の左へ %.3f m'
          % ((fx + w / 2 - X0F) / S, (fy + h / 2 - CYF) / LATP))

z = 255 - win * 255
z = cv2.cvtColor(cv2.resize(z, None, fx=5, fy=5, interpolation=cv2.INTER_NEAREST), cv2.COLOR_GRAY2BGR)
for gx in range(0, 141, 20):                          # 20px ごとの目盛り
    cv2.line(z, (gx*5, 0), (gx*5, z.shape[0]), (200, 200, 255), 1)
    cv2.putText(z, str(850+gx), (gx*5+3, 16), cv2.FONT_HERSHEY_SIMPLEX, .4, (150,150,255), 1)
for gy in range(0, 141, 20):
    cv2.line(z, (0, gy*5), (z.shape[1], gy*5), (200, 200, 255), 1)
    cv2.putText(z, str(760+gy), (3, gy*5+16), cv2.FONT_HERSHEY_SIMPLEX, .4, (150,150,255), 1)
cv2.imwrite('wheel_zoom.png', z)
print('saved wheel_zoom.png')
