# -*- coding: utf-8 -*-
"""上半分（車の右側）だけを取り出して見る。対称軸も測り直す。"""
from PIL import Image
import numpy as np, cv2
REPO = 'C:/Users/akayu/Documents/registro500-giappone/'
X0, Y0 = 600, 520
m = np.load('hi_mask.npy')                      # ステアリング除去済み
a = np.array(Image.open(REPO + 'wiring-simulator/ref/blueprint_4views_hi.png').convert('L'))
raw = ((a[Y0:Y0+460, X0:X0+936].astype(np.float32)) <
       cv2.medianBlur(a[Y0:Y0+460, X0:X0+936], 9).astype(np.float32) - 20).astype(np.uint8)

# --- 対称軸：胴の中央部だけで上下端の中点を測る（前後の端は丸まっていて効かない） ---
mid = []
for x in range(200, 800):                        # ローカル座標。車体は x 21..915
    ys = np.where(raw[:, x])[0]
    if len(ys) < 2: continue
    mid.append((ys.min() + ys.max()) / 2)
mid = np.array(mid)
CYl = float(np.median(mid))
print('対称軸 y(local)=%.2f  y(full)=%.2f  sd=%.2f px' % (CYl, CYl + Y0, mid.std()))

ys, xs = np.where(raw)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
print('bbox local x %d..%d y %d..%d  (%d x %d)' % (x0, x1, y0, y1, x1-x0+1, y1-y0+1))
print('上端から軸 %.1f / 軸から下端 %.1f' % (CYl - y0, y1 - CYl))

up = raw.copy(); up[int(round(CYl))+1:, :] = 0
lo = raw.copy(); lo[:int(round(CYl)), :] = 0
print('上半分 ink %d / 下半分 ink %d' % (up.sum(), lo.sum()))

img = 255 - up[y0-3:int(CYl)+6, x0-3:x1+4] * 255
Image.fromarray(cv2.resize(img, None, fx=1.45, fy=1.45, interpolation=cv2.INTER_AREA)).save('half_up.png')
img2 = 255 - lo[int(CYl)-3:y1+4, x0-3:x1+4] * 255
Image.fromarray(cv2.resize(img2, None, fx=1.45, fy=1.45, interpolation=cv2.INTER_AREA)).save('half_lo.png')
print('saved half_up.png / half_lo.png')
