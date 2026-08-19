# -*- coding: utf-8 -*-
"""窓の上端と下端の両方に届く列＝車体を貫く線。それだけ落とす（スポークは届かない）。"""
from PIL import Image
import numpy as np, cv2
REPO = 'C:/Users/akayu/Documents/registro500-giappone/'
S_, L_, X0F, CYF, Y0F, SC = 301.0, 306.8, 621.0, 753.0, 551.0, 0.5
WX0, WX1, WY0, WY1 = 872, 958, 742, 902

a = np.array(Image.open(REPO + 'wiring-simulator/ref/blueprint_4views_hi.png').convert('L'))
sub = a[520:980, 600:1536]
mask = (sub.astype(np.float32) < cv2.medianBlur(sub, 9).astype(np.float32) - 20).astype(np.uint8)
W = mask[WY0-520:WY1-520, WX0-600:WX1-600].copy()
top, bot = W[:7].any(0), W[-7:].any(0)
W[:, top & bot] = 0
print('落とした列（全画像x）:', [WX0+i for i in np.where(top & bot)[0]])

Wr = W.copy(); Wr[:, :898-WX0] = 0                        # 計器を切り離す
n, lab, st, _ = cv2.connectedComponentsWithStats(Wr, 8)
big = max(range(1, n), key=lambda i: st[i, 4])
pts = (np.stack(np.where(lab == big)[::-1], 1).astype(np.int32) + [WX0, WY0])
(cx, cy), (aa, bb), ang = cv2.fitEllipse(cv2.convexHull(pts.reshape(-1,1,2)))
print('リム外周  bbox x %d..%d y %d..%d  (%d x %d px)'
      % (pts[:,0].min(), pts[:,0].max(), pts[:,1].min(), pts[:,1].max(),
         np.ptp(pts[:,0])+1, np.ptp(pts[:,1])+1))
print('  中心 前端から %.3f m / 車の左へ %.3f m ／ 径 前後 %.0f mm × 左右 %.0f mm ／ 傾き %.0f°'
      % ((cx-X0F)/S_, (cy-CYF)/L_, aa/S_*1000, bb/L_*1000,
         np.degrees(np.arcsin(min(1.0,(aa/S_)/(bb/L_))))))
e2 = np.load('wheel_ell2.npy'); sx, sy, sa, sb, sang = e2[5], e2[6], e2[7], e2[8], e2[9]
np.save('wheel_final.npy', np.array([cx, cy, aa, bb, ang, sx, sy, sa, sb, sang]))

v = cv2.cvtColor(255 - mask[WY0-520:WY1-520, WX0-600:WX1-600]*255, cv2.COLOR_GRAY2BGR)
v = cv2.resize(v, None, fx=6, fy=6, interpolation=cv2.INTER_NEAREST)
cv2.ellipse(v, (int((cx-WX0)*6), int((cy-WY0)*6)), (int(aa/2*6), int(bb/2*6)), ang, 0,360, (0,0,230), 2, cv2.LINE_AA)
cv2.ellipse(v, (int((sx-WX0)*6), int((sy-WY0)*6)), (int(sa/2*6), int(sb/2*6)), sang, 0,360, (200,60,0), 2, cv2.LINE_AA)
cv2.imwrite('wheel_fit4.png', v)
print('saved wheel_fit4.png')
