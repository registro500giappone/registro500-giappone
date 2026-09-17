# -*- coding: utf-8 -*-
"""hi_svg.py の後段だけを差し替えた版。
   従来: RDP で間引いて Catmull-Rom で「全点を通す」  -> 芯線化のギザをそのまま拾う
   本版: Schneider の最小二乗ベジェ当てはめで「近似する」 -> 許容誤差 tol の中でノイズを吸収
   さらに線の長さで太線/細線の 2 階層に分ける。
   usage: python hi_svg2.py <min_len> <skip> <out> [tol] [smooth_w] [thick_len]
"""
import numpy as np, cv2, pickle, io, sys
REPO = 'C:/Users/akayu/Documents/registro500-giappone/'
X0L, Y0L, CYL, SC = 21, 31, 233.0, 0.5
CY = (CYL - Y0L) * SC
SNAP = 1.6
MIN_LEN = float(sys.argv[1]) if len(sys.argv) > 1 else 34.0
SKIP = set(int(v) for v in sys.argv[2].split(',')) if len(sys.argv) > 2 and sys.argv[2] else set()
OUT  = sys.argv[3] if len(sys.argv) > 3 else REPO + 'wiring-img/car-top-v8s.svg'
TOL  = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5      # 出力px。1px=6.6mm
SMW  = int(sys.argv[5])   if len(sys.argv) > 5 else 9        # 事前平滑の窓
THICK= float(sys.argv[6]) if len(sys.argv) > 6 else 90.0     # これ以上の線長は太線

P = pickle.load(open('hi_polys.pkl', 'rb'))

def resample(a, step=1.0):
    d = np.r_[0, np.cumsum(np.hypot(*(a[1:] - a[:-1]).T))]
    if d[-1] < 1e-9: return a[:1]
    n = max(2, int(d[-1] / step) + 1)
    return np.stack([np.interp(np.linspace(0, d[-1], n), d, a[:, i]) for i in (0, 1)], 1)
def smooth(a, w, closed):
    if len(a) < 3 or w < 2: return a
    k = np.ones(w) / w
    ext = np.vstack([a[-w:], a, a[:w]]) if closed else \
          np.vstack([np.repeat(a[:1], w, 0), a, np.repeat(a[-1:], w, 0)])
    s = np.stack([np.convolve(ext[:, i], k, 'same') for i in (0, 1)], 1)[w:-w]
    if not closed: s[0], s[-1] = a[0], a[-1]
    return s

# ---------------- Schneider の当てはめ ----------------
def _unit(v):
    n = float(np.hypot(*v));  return v / n if n > 1e-12 else np.array([0.0, 0.0])
def _bez(P, t):
    mt = 1 - t
    return ((mt**3)[:, None]*P[0] + 3*(mt**2*t)[:, None]*P[1]
            + 3*(mt*t*t)[:, None]*P[2] + (t**3)[:, None]*P[3])
def _param(p):
    d = np.r_[0, np.cumsum(np.hypot(*(p[1:] - p[:-1]).T))]
    return d / d[-1] if d[-1] > 1e-12 else np.linspace(0, 1, len(p))
def _gen(p, u, t1, t2):
    """端点と接線方向を固定し、ハンドル長だけを最小二乗で解く。"""
    p0, p3 = p[0], p[-1]
    A1 = (3*(1-u)**2*u)[:, None] * t1
    A2 = (3*(1-u)*u*u)[:, None] * t2
    tmp = p - _bez(np.array([p0, p0, p3, p3]), u)
    c00 = float((A1*A1).sum()); c01 = float((A1*A2).sum()); c11 = float((A2*A2).sum())
    x0  = float((A1*tmp).sum()); x1 = float((A2*tmp).sum())
    det = c00*c11 - c01*c01
    if abs(det) < 1e-12:
        L = float(np.hypot(*(p3-p0))) / 3.0
        a1 = a2 = L
    else:
        a1 = (x0*c11 - x1*c01) / det
        a2 = (c00*x1 - c01*x0) / det
        L = float(np.hypot(*(p3-p0)))
        if a1 < 1e-6 or a2 < 1e-6: a1 = a2 = L/3.0
        a1 = min(a1, L*1.5); a2 = min(a2, L*1.5)
    return np.array([p0, p0 + t1*a1, p3 + t2*a2, p3])
def _maxerr(p, B, u):
    d = _bez(B, u) - p
    e = np.hypot(*d.T)
    i = int(np.argmax(e));  return float(e[i]), i
def _reparam(p, B, u):
    """Newton 法で媒介変数を寄せ直す（当てはめ精度が上がり、分割が減る）。"""
    mt = 1 - u
    Q  = _bez(B, u)
    D1 = 3*((mt*mt)[:, None]*(B[1]-B[0]) + (2*mt*u)[:, None]*(B[2]-B[1]) + (u*u)[:, None]*(B[3]-B[2]))
    D2 = 6*(mt[:, None]*(B[2]-2*B[1]+B[0]) + u[:, None]*(B[3]-2*B[2]+B[1]))
    num = ((Q-p)*D1).sum(1)
    den = (D1*D1).sum(1) + ((Q-p)*D2).sum(1)
    un  = np.where(np.abs(den) < 1e-12, u, u - num/den)
    return np.clip(un, 0, 1)
def _tangent(p, i, side, span=6):
    """端点まわりの数点から向きを取る（1点差分だとノイズで暴れる）。"""
    if side > 0:  q = p[i:i+span+1]
    else:         q = p[max(0, i-span):i+1][::-1]
    if len(q) < 2: return np.array([1.0, 0.0])
    w = np.arange(len(q)-1, 0, -1, dtype=float)
    v = (q[1:] - q[0]) * (w/w.sum())[:, None]
    return _unit(v.sum(0))
def fit(p, t1, t2, tol, depth=0):
    if len(p) < 3:
        p0, p3 = p[0], p[-1]; L = float(np.hypot(*(p3-p0)))/3.0
        return [np.array([p0, p0+t1*L, p3+t2*L, p3])]
    u = _param(p)
    B = _gen(p, u, t1, t2)
    err, idx = _maxerr(p, B, u)
    if err < tol: return [B]
    if err < tol*4 and depth < 20:                      # 惜しい時は寄せ直して粘る
        for _ in range(4):
            u = _reparam(p, B, u); B = _gen(p, u, t1, t2)
            err, idx = _maxerr(p, B, u)
            if err < tol: return [B]
    if depth > 24 or idx <= 0 or idx >= len(p)-1: return [B]
    tc = _unit(p[min(idx+2, len(p)-1)] - p[max(idx-2, 0)])
    return (fit(p[:idx+1], t1, -tc, tol, depth+1) +
            fit(p[idx:],   tc,  t2, tol, depth+1))
def fit_path(p, closed, tol):
    if closed:
        p = np.vstack([p, p[:1]])
        t1 = _tangent(p, 0, +1); t2 = _tangent(p, len(p)-1, -1)
        t1 = _unit(t1 - t2);  t2 = -t1                  # 始点で向きを揃える
    else:
        t1 = _tangent(p, 0, +1); t2 = _tangent(p, len(p)-1, -1)
    return fit(p, t1, t2, tol)
def to_d(bez, closed):
    f = lambda t: '%.1f,%.1f' % (t[0], t[1])
    d = ['M' + f(bez[0][0])]
    for B in bez: d.append('C%s %s %s' % (f(B[1]), f(B[2]), f(B[3])))
    if closed: d.append('Z')
    return ''.join(d)
def bez_pts(bez, m=8):
    t = np.linspace(0, 1, m+1)
    return np.vstack([_bez(B, t) for B in bez])

mir = lambda a: np.stack([a[:, 0], 2*CY - a[:, 1]], 1)

thin, thick, curves, kept, nseg = [], [], [], [], 0
for i, (L, a) in enumerate(P):
    if L < MIN_LEN or i in SKIP: continue
    kept.append(i)
    was_closed = np.hypot(*(a[0] - a[-1])) < 1.2
    a = resample(a, 0.8)
    a = smooth(a, SMW, was_closed)
    on0, on1 = abs(a[0][1] - CY) < SNAP, abs(a[-1][1] - CY) < SNAP
    if on0: a[0][1] = CY
    if on1: a[-1][1] = CY
    if was_closed and not (on0 or on1):   jobs = [(a, True), (mir(a), True)]
    elif on0 and on1:                     jobs = [(np.vstack([a, mir(a)[::-1][1:-1]]), True)]
    elif on0 or on1:
        s = a if on0 else a[::-1]
        jobs = [(np.vstack([mir(s)[::-1], s[1:]]), False)]
    else:                                 jobs = [(a, False), (mir(a), False)]
    for b, cl in jobs:
        bez = fit_path(b, cl, TOL)
        nseg += len(bez)
        (thick if L >= THICK else thin).append(to_d(bez, cl))
        curves.append(bez_pts(bez))

svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 459 215">'
       '<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round">'
       '<path stroke-width="1.0" d="%s"/><path stroke-width="0.55" d="%s"/></g></svg>'
       % (''.join(thick), ''.join(thin)))
io.open(OUT, 'w', encoding='utf-8').write(svg)

m = np.load('hi_mask.npy')
dt = cv2.distanceTransform((1 - m).astype(np.uint8), cv2.DIST_L2, 5)
C = np.vstack(curves); C = C[C[:, 1] <= CY + .01]
mx = C[:, 0]/SC + X0L; my = C[:, 1]/SC + Y0L
ok = (mx > 1) & (my > 1) & (mx < dt.shape[1]-2) & (my < dt.shape[0]-2)
e = cv2.remap(dt, mx[ok].astype(np.float32).reshape(-1,1), my[ok].astype(np.float32).reshape(-1,1),
              cv2.INTER_LINEAR).ravel() * SC
PXM = 894*SC/2.970
print('tol=%.2fpx smooth=%d  lines=%d(thick %d) segs=%d  bytes=%d'
      % (TOL, SMW, len(thick)+len(thin), len(thick), nseg, len(svg)))
print('  gap to source: RMS %.2fpx=%.1fmm  max %.1fmm  p95 %.1fmm'
      % (np.sqrt((e**2).mean()), np.sqrt((e**2).mean())/PXM*1000,
         e.max()/PXM*1000, np.percentile(e, 95)/PXM*1000))
