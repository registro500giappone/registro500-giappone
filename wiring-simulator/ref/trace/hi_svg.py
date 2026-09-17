# -*- coding: utf-8 -*-
"""ポリラインを左右対称に閉じて、少ない制御点のベジェとして書き出す。
   仕上がったカーブが元図の線からどれだけ離れたかを同時に測る。"""
import numpy as np, cv2, pickle, io, sys
REPO = 'C:/Users/akayu/Documents/registro500-giappone/'
X0L, Y0L, CYL, SC = 21, 31, 233.0, 0.5
CY = (CYL - Y0L) * SC                       # 101.0
SNAP = 1.6                                  # これ以下なら端点を中心線にくっつける
MIN_LEN = float(sys.argv[1]) if len(sys.argv) > 1 else 6.0
SKIP = set(int(v) for v in sys.argv[2].split(',')) if len(sys.argv) > 2 and sys.argv[2] else set()
OUT = sys.argv[3] if len(sys.argv) > 3 else REPO + 'wiring-img/car-top-v7.svg'

P = pickle.load(open('hi_polys.pkl', 'rb'))

def plen(a): return float(np.hypot(*(a[1:] - a[:-1]).T).sum())
def resample(a, step=1.0):
    d = np.r_[0, np.cumsum(np.hypot(*(a[1:] - a[:-1]).T))]
    if d[-1] < 1e-9: return a[:1]
    n = max(2, int(d[-1] / step) + 1)
    return np.stack([np.interp(np.linspace(0, d[-1], n), d, a[:, i]) for i in (0, 1)], 1)
def smooth(a, w, closed):
    if len(a) < 3: return a
    k = np.ones(w) / w
    ext = np.vstack([a[-w:], a, a[:w]]) if closed else \
          np.vstack([np.repeat(a[:1], w, 0), a, np.repeat(a[-1:], w, 0)])
    s = np.stack([np.convolve(ext[:, i], k, 'same') for i in (0, 1)], 1)[w:-w]
    if not closed: s[0], s[-1] = a[0], a[-1]          # 端は動かさない
    return s
def rdp(a, eps):
    if len(a) < 3: return a
    st = [(0, len(a) - 1)]; keep = np.zeros(len(a), bool); keep[0] = keep[-1] = True
    while st:
        i, j = st.pop()
        if j <= i + 1: continue
        p, q = a[i], a[j]; d = q - p; L = float(np.hypot(*d)); seg = a[i+1:j] - p
        dist = np.hypot(*seg.T) if L < 1e-9 else np.abs(d[0]*seg[:,1] - d[1]*seg[:,0]) / L
        k = int(np.argmax(dist))
        if dist[k] > eps: k += i+1; keep[k] = True; st += [(i, k), (k, j)]
    return a[keep]
def cr_bez(p, closed):
    """Catmull-Rom を3次ベジェに直す（節点を必ず通る）。"""
    n = len(p)
    if n < 2: return ''
    f = lambda t: '%.1f,%.1f' % (t[0], t[1])
    d = ['M' + f(p[0])]
    for i in range(n if closed else n - 1):
        p0 = p[(i-1) % n] if closed else p[max(i-1, 0)]
        p1, p2 = p[i % n], p[(i+1) % n]
        p3 = p[(i+2) % n] if closed else p[min(i+2, n-1)]
        d.append('C%s %s %s' % (f(p1 + (p2-p0)/6.0), f(p2 - (p3-p1)/6.0), f(p2)))
    if closed: d.append('Z')
    return ''.join(d)
def cr_pts(p, closed, m=6):
    """出来上がりカーブ上の点（ズレの測定用）。"""
    n = len(p); o = []
    t = np.linspace(0, 1, m + 1)[:, None]
    for i in range(n if closed else n - 1):
        p0 = p[(i-1) % n] if closed else p[max(i-1, 0)]
        p1, p2 = p[i % n], p[(i+1) % n]
        p3 = p[(i+2) % n] if closed else p[min(i+2, n-1)]
        b0, b1 = p1, p1 + (p2-p0)/6.0
        b2, b3 = p2 - (p3-p1)/6.0, p2
        o.append(((1-t)**3)*b0 + 3*((1-t)**2)*t*b1 + 3*(1-t)*t*t*b2 + (t**3)*b3)
    return np.vstack(o)

mir = lambda a: np.stack([a[:, 0], 2*CY - a[:, 1]], 1)

paths, curves, kept = [], [], []
for i, (L, a) in enumerate(P):
    if L < MIN_LEN or i in SKIP: continue
    kept.append(i)
    was_closed = np.hypot(*(a[0] - a[-1])) < 1.2
    a = resample(a, 0.8)
    a = smooth(a, 5, was_closed)
    on0, on1 = abs(a[0][1] - CY) < SNAP, abs(a[-1][1] - CY) < SNAP
    if on0: a[0][1] = CY
    if on1: a[-1][1] = CY
    if was_closed and not (on0 or on1):
        for b in (a, mir(a)):
            b = rdp(b, 0.18); paths.append(cr_bez(b, True)); curves.append(cr_pts(b, True))
    elif on0 and on1:
        b = np.vstack([a, mir(a)[::-1][1:-1]])           # 中心線で折り返して閉じる
        b = rdp(b, 0.18); paths.append(cr_bez(b, True)); curves.append(cr_pts(b, True))
    elif on0 or on1:
        s = a if on0 else a[::-1]
        b = np.vstack([mir(s)[::-1], s[1:]])             # 中心線を通り抜けて反対側へ
        b = rdp(b, 0.18); paths.append(cr_bez(b, False)); curves.append(cr_pts(b, False))
    else:
        for b in (a, mir(a)):
            b = rdp(b, 0.18); paths.append(cr_bez(b, False)); curves.append(cr_pts(b, False))

d = ''.join(paths)
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 459 215">'
       '<path fill="none" stroke="currentColor" stroke-width="0.7" stroke-linejoin="round" '
       'stroke-linecap="round" d="%s"/></svg>' % d)
io.open(OUT, 'w', encoding='utf-8').write(svg)

# ---------- 元図とのズレ ----------
m = np.load('hi_mask.npy')
dt = cv2.distanceTransform((1 - m).astype(np.uint8), cv2.DIST_L2, 5)
C = np.vstack(curves)
C = C[C[:, 1] <= CY + .01]                                # 上半分だけで測る（下は鏡像）
mx = C[:, 0] / SC + X0L; my = C[:, 1] / SC + Y0L
ok = (mx > 1) & (my > 1) & (mx < dt.shape[1]-2) & (my < dt.shape[0]-2)
e = cv2.remap(dt, mx[ok].astype(np.float32).reshape(-1,1), my[ok].astype(np.float32).reshape(-1,1),
              cv2.INTER_LINEAR).ravel() * SC             # 出力px単位
PXM = 894 * SC / 2.970                                    # 150.5 px/m
print('線 %d本 / 節点 %d / d属性 %d文字' % (len(paths), d.count('C'), len(d)))
print('元図とのズレ  RMS %.2f px = %.1f mm   最大 %.2f px = %.1f mm   95%%点 %.1f mm'
      % (np.sqrt((e**2).mean()), np.sqrt((e**2).mean())/PXM*1000,
         e.max(), e.max()/PXM*1000, np.percentile(e, 95)/PXM*1000))
print('採用 %d本 (捨てた %d本)' % (len(kept), len(P) - len(kept)))
print('wrote', OUT, len(svg), 'bytes')
