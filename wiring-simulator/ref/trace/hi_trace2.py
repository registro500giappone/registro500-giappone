# -*- coding: utf-8 -*-
"""hi_skel.npy から作り直す版。hi_trace.py との違いは後段だけ:
   (1) 交差点の残骸（極小の断片）を先に捨てる
   (2) 端点が「同じ座標」でなくても、近くて向きが揃っていれば継ぐ
   芯線化では交差部が1点にならず短い辺になるため、hi_trace.py の join_same
   （端点が完全一致する時だけ継ぐ）では窓枠のような交差の多い線が細切れのまま残る。
   usage: python hi_trace2.py [gap_out_px] [minfrag_out_px] [cos_thresh]
"""
import numpy as np, pickle, sys
K = 2
X0L, Y0L, CYL = 21, 31, 233.0
SC = 0.5
GAP  = float(sys.argv[1]) if len(sys.argv) > 1 else 1.6    # 出力px。1出力px = 4 skel px
FRAG = float(sys.argv[2]) if len(sys.argv) > 2 else 2.5    # これ未満の断片は交差の残骸として捨てる
COS  = float(sys.argv[3]) if len(sys.argv) > 3 else 0.55   # 継ぐのに要る直進度

sk = np.load('hi_skel.npy')
N8 = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
pix = set(map(tuple, np.argwhere(sk > 0)))
nb = {}
for p in pix:
    v = []
    for dy, dx in N8:
        q = (p[0]+dy, p[1]+dx)
        if q not in pix: continue
        if dy and dx and ((p[0], q[1]) in pix or (q[0], p[1]) in pix): continue
        v.append(q)
    nb[p] = v
for p in pix:
    for q in nb[p]:
        if p not in nb[q]: nb[q].append(p)
nodes = {p for p in pix if len(nb[p]) != 2}
used = set()
def walk(a, b):
    path = [a, b]; used.add(frozenset((a, b))); prev, cur = a, b
    while cur not in nodes:
        nxt = [q for q in nb[cur] if q != prev and frozenset((cur, q)) not in used]
        if not nxt: break
        n = nxt[0]; used.add(frozenset((cur, n))); path.append(n); prev, cur = cur, n
    return path
polys = []
for a in sorted(nodes):
    for b in nb[a]:
        if frozenset((a, b)) not in used: polys.append(walk(a, b))
for p in sorted(pix):
    rest = [q for q in nb[p] if frozenset((p, q)) not in used]
    if rest:
        pa = walk(p, rest[0])
        if pa[-1] != p: pa.append(p)
        polys.append(pa)
print('raw polylines', len(polys))

def tip_dir(p, head, n=30):
    k = max(3, min(n, len(p)//3))
    a = np.array(p[:k] if head else p[::-1][:k], float)
    v = a[0] - a[-1]; L = np.hypot(*v)
    return v/L if L > 1e-9 else np.zeros(2)
def plen(p):
    a = np.array(p, float)
    return float(np.hypot(*(a[1:]-a[:-1]).T).sum())

def join_exact(P):
    changed = True
    while changed:
        changed = False
        ends = {}
        for i, p in enumerate(P):
            if not p or p[0] == p[-1]: continue
            ends.setdefault(p[0], []).append((i, True))
            ends.setdefault(p[-1], []).append((i, False))
        for pt, lst in ends.items():
            live = [(i, h) for i, h in lst if P[i]]
            if len(live) < 2: continue
            best, bs = None, 0.40
            for a in range(len(live)):
                for b in range(a+1, len(live)):
                    ia, ha = live[a]; ib, hb = live[b]
                    if ia == ib: continue
                    s = float(np.dot(tip_dir(P[ia], ha), tip_dir(P[ib], hb)))
                    if s < -bs: bs, best = -s, (live[a], live[b])
            if not best: continue
            (ia, ha), (ib, hb) = best
            if not P[ia] or not P[ib]: continue
            A = P[ia][::-1] if ha else P[ia]
            B = P[ib] if hb else P[ib][::-1]
            if A[-1] != pt or B[0] != pt: continue
            P[ia] = A + B[1:]; P[ib] = []; changed = True
    return [p for p in P if p]

def join_near(P, gap_px, cos_th):
    """端点どうしが gap_px 以内で、互いにほぼ正対していれば継ぐ（隙間は直線で埋まる）。"""
    joined = 0
    while True:
        cand = []
        for i, p in enumerate(P):
            if len(p) < 2 or p[0] == p[-1]: continue
            for h in (True, False):
                cand.append((i, h, np.array(p[0] if h else p[-1], float), tip_dir(p, h)))
        best = None
        for a in range(len(cand)):
            ia, ha, pa, da = cand[a]
            for b in range(a+1, len(cand)):
                ib, hb, pb, db = cand[b]
                if ia == ib: continue
                d = pb - pa; L = float(np.hypot(*d))
                if L > gap_px or L < 1e-9: continue
                u = d / L
                # a の端は b の方を向き、b の端は a の方を向いているか（＝正対）
                s = min(float(np.dot(-da, u)), float(np.dot(-db, -u)))
                if s < cos_th: continue
                # 2本の向きが同じ直線上か
                if float(np.dot(da, db)) > -cos_th: continue
                sc = s - L/gap_px*0.25
                if best is None or sc > best[0]: best = (sc, ia, ha, ib, hb)
        if best is None: break
        _, ia, ha, ib, hb = best
        A = P[ia][::-1] if ha else P[ia]
        B = P[ib] if hb else P[ib][::-1]
        P[ia] = A + B; P[ib] = []
        P = [p for p in P if p]
        joined += 1
    print('near-joins', joined)
    return P

polys = [list(map(tuple, p)) for p in polys]
polys = join_exact(polys)
print('after exact-join', len(polys))
gap_sk  = GAP  * K / SC          # 出力px -> skel px
frag_sk = FRAG * K / SC
before = len(polys)
polys = [p for p in polys if plen(p) >= frag_sk or (p[0] == p[-1] and plen(p) >= frag_sk*2)]
print('drop tiny fragments', before - len(polys), '(< %.1f out-px)' % FRAG)
polys = join_near(polys, gap_sk, COS)
polys = join_exact(polys)
print('after near-join', len(polys))

out = []
for p in polys:
    a = np.array(p, float)
    a = np.stack([(a[:,1]/K - X0L)*SC, (a[:,0]/K - Y0L)*SC], 1)
    L = float(np.hypot(*(a[1:]-a[:-1]).T).sum())
    out.append((L, a))
out.sort(key=lambda t: -t[0])
pickle.dump(out, open('hi_polys2.pkl', 'wb'))
print('polylines', len(out))
print('long', [round(t[0],1) for t in out[:20]])
print('>=34:', sum(1 for t in out if t[0] >= 34))
