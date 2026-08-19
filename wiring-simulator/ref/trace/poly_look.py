# -*- coding: utf-8 -*-
"""指定した範囲のポリラインを1本ずつ色分けして元図に重ねる（切れの原因を目で見る道具）。
   usage: python poly_look.py [x0 y0 x1 y1] [zoom] [pkl]
   既定はフロントガラスまわり。座標は元画像(1536x1024)のpx。上半分だけ描く。"""
import pickle, numpy as np, cv2, sys, os
REPO = 'C:/Users/akayu/Documents/registro500-giappone/'
a = sys.argv[1:]
X0, Y0, X1, Y1 = (int(v) for v in a[:4]) if len(a) >= 4 else (745, 545, 1035, 765)
Z   = int(a[4]) if len(a) > 4 else 5
PKL = a[5] if len(a) > 5 else 'hi_polys.pkl'
OUT = 'poly_look.png'

P = pickle.load(open(PKL, 'rb'))
img = cv2.imread(REPO + 'wiring-simulator/ref/blueprint_4views_hi.png')
crop = cv2.resize(img[Y0:Y1, X0:X1], None, fx=Z, fy=Z, interpolation=cv2.INTER_NEAREST)
crop = cv2.addWeighted(crop, .35, np.full_like(crop, 255), .65, 0)
COL = [(0,0,220),(200,0,0),(0,150,0),(200,0,200),(0,140,220),(120,90,0),(0,0,0),(150,0,255)]
n = 0
for i, (L, p) in enumerate(P):
    m = (p[:,0] >= (X0-621)/2) & (p[:,0] <= (X1-621)/2) & (p[:,1] <= (Y1-551)/2)
    if m.mean() < 0.5 or L < 2.0: continue
    px = (p[:,0]*2 + 621 - X0)*Z; py = (p[:,1]*2 + 551 - Y0)*Z
    c = COL[n % len(COL)]; n += 1
    cv2.polylines(crop, [np.stack([px, py], 1).astype(np.int32)], False, c, 2)
    cv2.putText(crop, '%d(%.0f)' % (i, L), (int(px[0]), int(py[0])),
                cv2.FONT_HERSHEY_SIMPLEX, .45, c, 1, cv2.LINE_AA)
cv2.imwrite(OUT, crop)
print('drawn %d polylines -> %s %s' % (n, OUT, crop.shape))
