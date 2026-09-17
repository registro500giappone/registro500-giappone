# -*- coding: utf-8 -*-
"""新しい元図（高解像度）の上面図を芯線化してポリラインにする。
   上半分（車の右側）だけを正とし、中心線で折り返して左右対称に閉じる。"""
import numpy as np, cv2, pickle
K = 2                                   # 芯線化の前に何倍に拡大するか
X0L, Y0L, CYL = 21, 31, 233.0           # hi_mask.npy 内での車体左上と対称軸
SC = 0.5                                # 出力の縮尺（1px = 元図2px）

def zhang_suen(I):
    I = I.astype(np.uint8).copy()
    while True:
        hit = False
        for step in (0, 1):
            P = np.pad(I, 1)
            p2, p3, p4 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:]
            p5, p6, p7 = P[2:, 2:], P[2:, 1:-1], P[2:, :-2]
            p8, p9 = P[1:-1, :-2], P[:-2, :-2]
            B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
            s = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            A = sum(((s[i] == 0) & (s[i + 1] == 1)).astype(np.uint8) for i in range(8))
            base = (I == 1) & (B >= 2) & (B <= 6) & (A == 1)
            c = base & (((p2 * p4 * p6) == 0) & ((p4 * p6 * p8) == 0)) if step == 0 else \
                base & (((p2 * p4 * p8) == 0) & ((p2 * p6 * p8) == 0))
            if c.any(): I[c] = 0; hit = True
        if not hit: return I

m = np.load('hi_mask.npy')
big = cv2.resize(m * 255, None, fx=K, fy=K, interpolation=cv2.INTER_LINEAR)
big = cv2.GaussianBlur(big, (0, 0), 0.8)
big = (big > 90).astype(np.uint8)
sk = zhang_suen(big)
sk[int(round(CYL * K)) + 1:, :] = 0            # 中心線より下（車の左）は捨てる
np.save('hi_skel.npy', sk)
print('skeleton px', int(sk.sum()))

# ---------- スケルトン → ポリライン ----------
N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
pix = set(map(tuple, np.argwhere(sk > 0)))
nb = {}
for p in pix:
    v = []
    for dy, dx in N8:
        q = (p[0] + dy, p[1] + dx)
        if q not in pix: continue
        if dy and dx and ((p[0], q[1]) in pix or (q[0], p[1]) in pix): continue   # 冗長な斜め
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

def tip_dir(p, head, n=30):
    k = max(3, min(n, len(p) // 3))
    a = np.array(p[:k] if head else p[::-1][:k], float)
    v = a[0] - a[-1]; L = np.hypot(*v)
    return v / L if L > 1e-9 else np.zeros(2)

def join_same(P):
    """分岐点で「まっすぐ通り抜ける」2本を1本に戻す。"""
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
                for b in range(a + 1, len(live)):
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

polys = join_same([list(map(tuple, p)) for p in polys])
out = []
for p in polys:
    a = np.array(p, float)
    a = np.stack([(a[:, 1] / K - X0L) * SC, (a[:, 0] / K - Y0L) * SC], 1)   # (x, y) 出力座標
    L = float(np.hypot(*(a[1:] - a[:-1]).T).sum())
    out.append((L, a))
out.sort(key=lambda t: -t[0])
pickle.dump(out, open('hi_polys.pkl', 'wb'))
print('polylines', len(out), '  CY_out=%.1f  車体 %.1f x %.1f' % ((CYL - Y0L) * SC, 894 * SC, 405 * SC))
print('長い順', [round(t[0], 1) for t in out[:24]])
print('20px超', sum(1 for t in out if t[0] > 20), '/ 8px超', sum(1 for t in out if t[0] > 8))
