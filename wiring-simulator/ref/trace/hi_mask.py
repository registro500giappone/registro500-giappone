# -*- coding: utf-8 -*-
"""新しい元図（1536x1024 PNG）の上面図から、線だけのマスクを作る。
   塗り（キャンバストップ）に負けないよう、局所コントラストで線を拾う。"""
from PIL import Image
import numpy as np, cv2
REPO = 'C:/Users/akayu/Documents/registro500-giappone/'
X0, Y0, X1, Y1 = 600, 520, 1536, 980          # 上面図を含む窓
WHEEL = (910, 830, 42)                         # 生成ミスのステアリング（中心x,中心y,半径）

a = np.array(Image.open(REPO + 'wiring-simulator/ref/blueprint_4views_hi.png').convert('L'))
sub = a[Y0:Y1, X0:X1].astype(np.float32)
bg = cv2.medianBlur(a[Y0:Y1, X0:X1], 9).astype(np.float32)
m = (sub < bg - 20).astype(np.uint8)

cw = np.zeros_like(m)
cv2.circle(cw, (WHEEL[0] - X0, WHEEL[1] - Y0), WHEEL[2], 1, -1)
removed = int((m & cw).sum())
m2 = m * (1 - cw)
np.save('hi_mask.npy', m2)

ys, xs = np.where(m2)
print('mask ink %d (ステアリング除去 %d px)  bbox x %d..%d y %d..%d'
      % (m2.sum(), removed, xs.min() + X0, xs.max() + X0, ys.min() + Y0, ys.max() + Y0))
print('車体 %d x %d px' % (xs.max() - xs.min() + 1, ys.max() - ys.min() + 1))

# 除去したあたりを拡大して確認
z = 255 - m[WHEEL[1] - Y0 - 90:WHEEL[1] - Y0 + 90, WHEEL[0] - X0 - 110:WHEEL[0] - X0 + 110] * 255
z2 = 255 - m2[WHEEL[1] - Y0 - 90:WHEEL[1] - Y0 + 90, WHEEL[0] - X0 - 110:WHEEL[0] - X0 + 110] * 255
pair = np.hstack([z, np.full((z.shape[0], 8), 128, np.uint8), z2])
Image.fromarray(cv2.resize(pair, None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST)).save('wheel_check.png')
print('saved wheel_check.png（左=除去前／右=除去後）')
