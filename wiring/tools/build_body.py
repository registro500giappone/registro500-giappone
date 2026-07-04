# -*- coding: utf-8 -*-
"""
FIAT 500 車体シェル生成スクリプト（配線ビューア用）

FIAT 500 L 純正寸法図（Fiat 500 L manuale HD.pdf p61 を 2.5x でレンダリングした
L_p61_dims.png・約1.86mm/px）から輪郭を抽出し、断面ロフトで3Dシェルを生成する。
F型とL型のボディシェルは同形状（差はバンパー等の艤装のみ）。

使い方:
    python build_body.py --src <L_p61_dims.png のパス> --out ../assets/body_f.json
    python build_body.py --src ... --calib   # 正射影オーバーレイ画像で輪郭照合

車両座標系 (mm): X=前軸原点・後方が+ / Y=左が+ / Z=地面0・上が+
主要寸法: WB=1840, 全高=1325, 全幅=1320（F型全長2970・前OH495）
"""
import argparse, json, os
import numpy as np
from PIL import Image, ImageDraw

# ============ 図面アンカー（L_p61_dims.png 原寸px） ============
FRONT_AXLE_PX = 678
GROUND_PY     = 1245
MMX = 1840.0 / 988.0
MMZ = 1.8956
PLAN_CY = 1794
FRONT_CX = 2620

# 車体パネルのxレンジ（バンパー除く）とF型バンパー位置
X_NOSE, X_TAIL = -462.0, 2440.0
BUMPER_F_X, BUMPER_R_X = -495.0, 2475.0

def px2x(px):  return (px - FRONT_AXLE_PX) * MMX
def py2z(py):  return (GROUND_PY - py) * MMZ

# ============ 抽出 ============

def load_ink(src):
    a = np.array(Image.open(src).convert('L'))
    return a < 120

def first_solid(arr1d, min_run=4, min_gap=18):
    """細い孤立線分（寸法線）をスキップして最初の実線の開始indexを返す"""
    nz = np.nonzero(arr1d)[0]
    if not len(nz):
        return None
    i = 0
    while i < len(nz):
        run_start = nz[i]
        j = i
        while j + 1 < len(nz) and nz[j + 1] - nz[j] <= 2:
            j += 1
        run_len = nz[j] - run_start + 1
        gap = nz[j + 1] - nz[j] if j + 1 < len(nz) else 0
        if run_len >= min_run or (j + 1 < len(nz) and gap <= min_gap):
            return run_start
        if j + 1 >= len(nz):
            return run_start
        i = j + 1
    return nz[0]

def extract_side_top(ink):
    xs, zs = [], []
    for x in range(410, 2010):
        col = ink[505:GROUND_PY, x]
        idx = first_solid(col)
        if idx is not None:
            xs.append(px2x(x)); zs.append(py2z(505 + idx))
    return np.array(xs), np.array(zs)

def extract_plan_halfwidth(ink):
    xs, ws = [], []
    for x in range(410, 2010):
        col = ink[1412:2225, x]
        iu = first_solid(col)
        idn = first_solid(col[::-1])
        if iu is not None and idn is not None:
            up = PLAN_CY - (1412 + iu)
            dn = (1412 + (len(col) - 1 - idn)) - PLAN_CY
            xs.append(px2x(x)); ws.append(min(up, dn) * MMX)
    return np.array(xs), np.array(ws)

def extract_front_template(ink):
    zs, hs = [], []
    for y in range(560, 1160):
        row = ink[y, 2180:3070]
        il = first_solid(row)
        ir = first_solid(row[::-1])
        if il is not None and ir is not None:
            xl, xr = 2180 + il, 2180 + (len(row) - 1 - ir)
            zs.append(py2z(y)); hs.append((xr - xl) / 2.0 * MMX)
    zs, hs = np.array(zs), np.array(hs)
    from scipy.ndimage import median_filter
    med = median_filter(hs, size=31)
    keep = np.abs(hs - med) < 20
    return zs[keep], hs[keep]

def smooth_profile(x, y, s=60.0, k=3):
    from scipy.interpolate import UnivariateSpline
    idx = np.argsort(x)
    x, y = np.asarray(x, float)[idx], np.asarray(y, float)[idx]
    ux, ui = np.unique(x, return_index=True)
    return UnivariateSpline(ux, y[ui], s=s * len(ux), k=k)

# ============ ガイドカーブ（図面読取り制御点 mm） ============
GUIDE = dict(
    belt=[(-500, 830), (-300, 855), (0, 870), (200, 880), (350, 885),
          (700, 875), (1100, 865), (1500, 855), (1750, 845)],
    bottom=[(-462, 235), (-430, 200), (-300, 178), (0, 168), (400, 158),
            (900, 155), (1400, 158), (1840, 168), (2100, 195), (2350, 250), (2440, 300)],
    x_ws=340, x_rw=1660,
    roof_w=[(340, 470), (500, 525), (700, 548), (900, 556), (1100, 550),
            (1300, 532), (1500, 495), (1660, 440)],
    crown_frac=0.36,
    glass_bulge=22.0,
    # ピラー位置（Bピラー=ドア窓とクォーター窓の境）
    x_bpillar=1080.0,
    # ドアシーム（F型・前開きドアの前後縁）
    door=[300.0, 1180.0],
    # サンルーフ開口（x範囲と半幅）
    sunroof=dict(x0=560, x1=1360, hw=330, r=70),
    # ヘッドライト（前面図読取り: y=±中心, z=中心, 半径）
    headlight=dict(y=395.0, z=610.0, r=100.0),
    taillight=dict(y=430.0, z=560.0, w=90.0, h=150.0),
    wheel=dict(front_x=0.0, rear_x=1840.0, tire_r=260.0, tire_w=130.0,
               hub_z=260.0, arch_r=305.0, track_half=1128.0 / 2),
    bumper=dict(half_w=560.0, z_c=300.0, blade_h=70.0, blade_d=45.0),
)

def guide_curve(pts):
    from scipy.interpolate import PchipInterpolator
    p = np.array(pts, float)
    return PchipInterpolator(p[:, 0], p[:, 1], extrapolate=True)

# ============ 断面生成 ============

def make_template(tz, th):
    order = np.argsort(tz)
    tz, th = tz[order], th[order]
    h_max = th.max()
    z_lo, z_hi = tz.min(), 880.0
    def tmpl(z, z_bot, z_ref):
        f = (z - z_bot) / max(z_ref - z_bot, 1.0)
        zq = z_lo + f * (z_hi - z_lo)
        return float(np.interp(zq, tz, th) / h_max)
    return tmpl

def gh_blend(x):
    """グリーンハウス移行の平滑ブレンド係数 0..1"""
    G = GUIDE
    r = 90.0  # ブレンド幅mm
    if x < G['x_ws'] - r or x > G['x_rw'] + r:
        return 0.0
    if x < G['x_ws'] + r:
        t = (x - (G['x_ws'] - r)) / (2 * r)
    elif x > G['x_rw'] - r:
        t = ((G['x_rw'] + r) - x) / (2 * r)
    else:
        return 1.0
    return t * t * (3 - 2 * t)

def section_at(x, side_sp, plan_sp, tmpl, curves, n_half=40):
    belt, bottom, roofw = curves
    G = GUIDE
    z_top = float(side_sp(x))
    z_bot = float(bottom(x))
    z_belt = min(float(belt(x)), z_top - 10)
    w_body = max(float(plan_sp(x)), 4.0)
    b = gh_blend(x)

    pts = []
    n_body = int(n_half * 0.55)
    n_up = n_half - n_body
    # --- 下部ボディ（z_bot..z_belt テンプレート断面） ---
    for i in range(n_body):
        f = i / (n_body - 1)
        z = z_bot + (z_belt - z_bot) * f
        pts.append([w_body * tmpl(z, z_bot, z_belt), z])
    w_sh = pts[-1][0]

    # --- 上部: フード/リッドのクラウン と グリーンハウス をブレンド ---
    w_re_gh = max(float(roofw(x)), 8.0)
    z_re_gh = z_top - G['crown_frac'] * (z_top - z_belt)
    w_gb = w_re_gh + G['glass_bulge']
    n_glass = int(n_up * 0.6)
    n_crown = n_up - n_glass
    up_gh = []
    for i in range(n_glass):
        f = i / max(n_glass - 1, 1)
        z = z_belt + (z_re_gh - z_belt) * f
        up_gh.append([w_gb + (w_re_gh - w_gb) * f * f, z])
    for i in range(1, n_crown + 1):
        th_ = (np.pi / 2) * i / n_crown
        up_gh.append([w_re_gh * np.cos(th_), z_re_gh + (z_top - z_re_gh) * np.sin(th_)])
    up_hood = []
    for i in range(n_up):
        th_ = (np.pi / 2) * (i + 1) / n_up
        up_hood.append([w_sh * np.cos(th_), z_belt + (z_top - z_belt) * np.sin(th_)])
    for i in range(n_up):
        gy, gz = up_gh[i]; hy, hz = up_hood[i]
        pts.append([hy * (1 - b) + gy * b, hz * (1 - b) + gz * b])
    return np.array(pts)

def apply_wheel_arches(stations):
    W = GUIDE['wheel']
    for st in stations:
        x = st['x']
        for wx in (W['front_x'], W['rear_x']):
            dx = abs(x - wx)
            if dx < W['arch_r']:
                z_arch = W['hub_z'] + np.sqrt(W['arch_r'] ** 2 - dx ** 2) * 0.92
                p = st['pts']
                keep = p[:, 1] >= z_arch
                if keep.sum() >= 3:
                    lift = p[keep]
                    edge = np.array([[lift[0, 0], z_arch]])
                    st['pts'] = np.vstack([edge, lift])
    return stations

def add_end_rounding(stations):
    """ノーズ/テールに丸めステーションを追加（幅とz範囲を収束）"""
    def rounded(st_ref, x_target, k):
        p = st_ref['pts'].copy()
        zc = p[:, 1].mean() * 0.45 + p[:, 1].min() * 0.55
        p[:, 0] *= np.sqrt(max(1 - k * k, 0.02))
        p[:, 1] = zc + (p[:, 1] - zc) * (1 - 0.55 * k * k)
        return dict(x=x_target, pts=p)
    first, last = stations[0], stations[-1]
    pre, post = [], []
    for k, off in ((0.55, 18), (0.85, 32), (0.985, 42)):
        pre.append(rounded(first, first['x'] - off, k))
        post.append(rounded(last, last['x'] + off, k))
    return pre[::-1] + stations + post

def build_stations(side_sp, plan_sp, tmpl, n_st=72):
    curves = (guide_curve(GUIDE['belt']), guide_curve(GUIDE['bottom']),
              guide_curve(GUIDE['roof_w']))
    stations = []
    xs = np.linspace(X_NOSE, X_TAIL, n_st)
    for x in xs:
        stations.append(dict(x=float(x), pts=section_at(x, side_sp, plan_sp, tmpl, curves)))
    stations = apply_wheel_arches(stations)
    stations = add_end_rounding(stations)
    return stations

# ============ メッシュ化 ============

def loft_mesh(stations, n_half=40):
    resampled = []
    for st in stations:
        p = st['pts']
        d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
        u = np.linspace(0, d[-1], n_half)
        y = np.interp(u, d, p[:, 0]); z = np.interp(u, d, p[:, 1])
        resampled.append(np.stack([np.full(n_half, st['x']), y, z], axis=1))
    S = np.array(resampled)
    n_st = len(S)
    verts, faces = [], []
    def emit_half(sign):
        base = len(verts)
        for i in range(n_st):
            for j in range(n_half):
                x, y, z = S[i, j]
                verts.append((x, sign * y, z))
        for i in range(n_st - 1):
            for j in range(n_half - 1):
                a = base + i * n_half + j
                b = a + n_half
                if sign > 0:
                    faces.append((a, b, a + 1)); faces.append((a + 1, b, b + 1))
                else:
                    faces.append((a, a + 1, b)); faces.append((a + 1, b + 1, b))
    emit_half(+1); emit_half(-1)
    def cap(i_st, flip):
        base = len(verts)
        ring = [S[i_st, j] for j in range(n_half)]
        ring_full = [(x, y, z) for x, y, z in ring] + [(x, -y, z) for x, y, z in ring[::-1]]
        cx = np.mean([p[0] for p in ring_full]); cz = np.mean([p[2] for p in ring_full])
        verts.append((cx, 0.0, cz))
        for p in ring_full:
            verts.append(tuple(p))
        m = len(ring_full)
        for k in range(m - 1):
            if flip:
                faces.append((base, base + 1 + k + 1, base + 1 + k))
            else:
                faces.append((base, base + 1 + k, base + 1 + k + 1))
    cap(0, flip=False)
    cap(len(S) - 1, flip=True)
    return np.array(verts, float), np.array(faces, int), S

# ============ サーフェスサンプラ＆特徴線 ============

class Surf:
    """S(n_st,n_half,3) から表面座標を引くサンプラ"""
    def __init__(self, S):
        self.S = S
        self.xs = S[:, 0, 0]

    def sec(self, x):
        i = np.clip(np.searchsorted(self.xs, x), 1, len(self.xs) - 1)
        t = (x - self.xs[i-1]) / max(self.xs[i] - self.xs[i-1], 1e-6)
        return self.S[i-1, :, 1:] * (1 - t) + self.S[i, :, 1:] * t  # (n_half, [y,z])

    def y_at(self, x, z):
        s = self.sec(x)
        return float(np.interp(z, s[:, 1], s[:, 0]))

    def z_top_at(self, x, y):
        s = self.sec(x)
        upper = s[len(s)//2:]
        yy = upper[:, 0][::-1]; zz = upper[:, 1][::-1]
        return float(np.interp(abs(y), yy, zz))

    def x_front_at(self, y, z, x_lo, x_hi):
        """ノーズ面: |y|での表面x（前端側）を二分探索"""
        for _ in range(40):
            xm = (x_lo + x_hi) / 2
            if self.y_at(xm, z) < abs(y):
                x_lo = xm
            else:
                x_hi = xm
        return x_hi

def build_feature_lines(S, side_sp):
    G = GUIDE
    surf = Surf(S)
    belt = guide_curve(G['belt'])
    roofw = guide_curve(G['roof_w'])
    lines = []

    def mirror(pl):
        return [(x, -y, z) for x, y, z in pl]

    def on_side(x, z, out=4.0):
        return (x, surf.y_at(x, z) + out, z)

    # --- ベルトライン（ショルダー縁・左右） ---
    xs = np.linspace(G['x_ws'], G['x_rw'], 40)
    bl = [on_side(x, float(belt(x)) + 6) for x in xs]
    lines += [bl, mirror(bl)]

    # --- 雨樋（ドリップレール）＝グリーンハウス屋根縁 ---
    dr = []
    for x in xs:
        z_top = float(side_sp(x)); z_b = float(belt(x))
        z_re = z_top - G['crown_frac'] * (z_top - z_b)
        dr.append((x, float(roofw(x)) + 4, z_re))
    lines += [dr, mirror(dr)]

    # --- ピラー（A/B/C）: ガラス面上の縦フレーム ---
    for xp, lean in ((G['x_ws'] + 15, +60), (G['x_bpillar'], 0), (G['x_rw'] - 15, -60)):
        pl = []
        for f in np.linspace(0, 1, 10):
            z_b = float(belt(xp))
            z_top = float(side_sp(xp))
            z_re = z_top - G['crown_frac'] * (z_top - z_b)
            z = z_b + (z_re - z_b) * f
            x = xp + lean * f
            pl.append((x, surf.y_at(x, z) + 4, z))
        lines += [pl, mirror(pl)]

    # --- ウインドシールド/リアウインドウ 上縁（左右の雨樋を結ぶ） ---
    for xp, lean in ((G['x_ws'] + 15, +60), (G['x_rw'] - 15, -60)):
        z_b = float(belt(xp)); z_top = float(side_sp(xp + lean))
        z_re = z_top - G['crown_frac'] * (z_top - z_b)
        w = float(roofw(xp + lean))
        arc = []
        for t in np.linspace(-1, 1, 16):
            y = w * t
            z = z_re + (surf.z_top_at(xp + lean, y) - z_re) * 0.35 * (1 - t * t)
            arc.append((xp + lean, y, z + 4))
        lines.append(arc)

    # --- ウインドシールド/リアウインドウ 下縁 ---
    for xp in (G['x_ws'] + 12, G['x_rw'] - 12):
        z_b = float(belt(xp))
        w = float(roofw(xp)) + G['glass_bulge']
        arc = []
        for t in np.linspace(-1, 1, 16):
            arc.append((xp, w * t * 0.97, z_b + 8 + 14 * (1 - t * t)))
        lines.append(arc)

    # --- ドアシーム（ベルト→シル） ---
    for xd in G['door']:
        pl = []
        for f in np.linspace(0, 1, 12):
            z = float(belt(xd)) * (1 - f) + 185 * f
            x = xd + 25 * np.sin(f * np.pi * 0.5) * (1 if xd < 700 else 0.3)
            pl.append(on_side(x, z))
        lines += [pl, mirror(pl)]

    # --- ホイールアーチ リップ ---
    W = G['wheel']
    for wx in (W['front_x'], W['rear_x']):
        arc = []
        for th_ in np.linspace(0.08 * np.pi, 0.92 * np.pi, 20):
            x = wx + W['arch_r'] * np.cos(th_) * 1.02
            z = W['hub_z'] + np.sin(th_) * W['arch_r'] * 0.94
            arc.append(on_side(x, z, out=5))
        lines += [arc, mirror(arc)]

    # --- ヘッドライト（ノーズ面上の円） ---
    H = G['headlight']
    for sgn in (+1, -1):
        circ = []
        for th_ in np.linspace(0, 2 * np.pi, 22):
            y = sgn * H['y'] + H['r'] * 0.8 * np.cos(th_)
            z = H['z'] + H['r'] * np.sin(th_)
            x = surf.x_front_at(y, z, X_NOSE - 40, 300) - 3
            circ.append((x, y, z))
        lines.append(circ)

    # --- テールライト（テール面上の縦長角丸） ---
    T = G['taillight']
    for sgn in (+1, -1):
        rect = []
        for th_ in np.linspace(0, 2 * np.pi, 22):
            y = sgn * T['y'] + T['w'] / 2 * np.cos(th_)
            z = T['z'] + T['h'] / 2 * np.sin(th_)
            # テール面: x_front_atを後方向に流用（探索を反転）
            x_lo, x_hi = 1600, X_TAIL + 45
            for _ in range(40):
                xm = (x_lo + x_hi) / 2
                if surf.y_at(xm, z) > abs(y):
                    x_lo = xm
                else:
                    x_hi = xm
            rect.append((x_lo + 3, y, z))
        lines.append(rect)

    # --- サンルーフ（屋根面上の角丸矩形） ---
    SR = G['sunroof']
    rect = []
    n = 14
    corners = [(SR['x0'], -SR['hw']), (SR['x1'], -SR['hw']), (SR['x1'], SR['hw']), (SR['x0'], SR['hw'])]
    for i in range(4):
        x0, y0 = corners[i]; x1, y1 = corners[(i + 1) % 4]
        for f in np.linspace(0, 1, n, endpoint=False):
            x, y = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
            rect.append((x, y, surf.z_top_at(x, y) + 3))
    rect.append(rect[0])
    lines.append(rect)

    # --- ボンネット中央線（前トランクリッドの縁） ---
    for sgn in (+1, -1):
        pl = []
        for x in np.linspace(-380, 300, 14):
            y = sgn * 210
            pl.append((x, y, surf.z_top_at(x, y) + 3))
        lines.append(pl)

    return lines

# ============ 付帯メッシュ ============

def make_tire(cx, cy):
    """タイヤ: トーラス ＋ リムディスク（ハブキャップ風）"""
    W = GUIDE['wheel']
    R = W['tire_r'] - 52  # トーラス主半径（断面半径52）
    n_u, n_v = 26, 12
    verts, faces = [], []
    for i in range(n_u):
        a = 2 * np.pi * i / n_u
        for j in range(n_v):
            b = 2 * np.pi * j / n_v
            x = cx + (R + 52 * np.cos(b)) * np.cos(a)
            z = W['hub_z'] + (R + 52 * np.cos(b)) * np.sin(a)
            y = cy + 52 * np.sin(b) * (W['tire_w'] / 104)
            verts.append((x, y, z))
    for i in range(n_u):
        for j in range(n_v):
            a = i * n_v + j
            b = ((i + 1) % n_u) * n_v + j
            a2 = i * n_v + (j + 1) % n_v
            b2 = ((i + 1) % n_u) * n_v + (j + 1) % n_v
            faces.append((a, b, a2)); faces.append((a2, b, b2))
    return np.array(verts, float), np.array(faces, int)

def make_rim(cx, cy, sign):
    """リム: 外側に少し膨らんだディスク（中心をわずかに外へ）"""
    W = GUIDE['wheel']
    r_rim = W['tire_r'] - 95
    n = 20
    verts, faces = [], []
    y_face = cy + sign * (W['tire_w'] / 2 - 18)
    verts.append((cx, y_face + sign * 22, W['hub_z']))
    for i in range(n):
        a = 2 * np.pi * i / n
        verts.append((cx + r_rim * np.cos(a), y_face, W['hub_z'] + r_rim * np.sin(a)))
    for i in range(n):
        j = (i + 1) % n
        faces.append((0, 1 + i, 1 + j) if sign > 0 else (0, 1 + j, 1 + i))
    return np.array(verts, float), np.array(faces, int)

def make_bumper(x_face, sign):
    """バンパーブレード: 幅方向に湾曲した角丸断面の帯"""
    B = GUIDE['bumper']
    n_u, n_v = 24, 8
    verts, faces = [], []
    for i in range(n_u):
        t = -1 + 2 * i / (n_u - 1)
        y = B['half_w'] * t
        # 平面図の丸みに沿って中央から端へ後退（前バンパーは+x方向、後は-x方向）
        setback = (abs(t) ** 2.2) * 170.0
        xc = x_face - sign * setback
        for j in range(n_v):
            b = 2 * np.pi * j / n_v
            verts.append((xc + (B['blade_d'] / 2) * np.cos(b),
                          y, B['z_c'] + (B['blade_h'] / 2) * np.sin(b)))
    for i in range(n_u - 1):
        for j in range(n_v):
            a = i * n_v + j
            b_ = (i + 1) * n_v + j
            a2 = i * n_v + (j + 1) % n_v
            b2 = (i + 1) * n_v + (j + 1) % n_v
            faces.append((a, b_, a2)); faces.append((a2, b_, b2))
    return np.array(verts, float), np.array(faces, int)

# ============ 出力 ============

def quantize_mesh(verts, faces):
    vmin = verts.min(axis=0); vmax = verts.max(axis=0)
    scale = (vmax - vmin); scale[scale == 0] = 1
    q = np.round((verts - vmin) / scale * 65535).astype(int)
    return dict(qpos=q.flatten().tolist(), min=vmin.tolist(), max=vmax.tolist(),
                idx=faces.flatten().tolist())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True, help='L_p61_dims.png のパス')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'assets', 'body_f.json'))
    ap.add_argument('--calib', action='store_true')
    ap.add_argument('--calib-dir', default=None)
    args = ap.parse_args()

    ink = load_ink(args.src)
    sx, sz = extract_side_top(ink)
    px_, pw = extract_plan_halfwidth(ink)
    tz, th = extract_front_template(ink)
    side_sp = smooth_profile(sx, sz, s=40)
    plan_sp = smooth_profile(px_, pw, s=40)
    tmpl = make_template(tz, th)

    stations = build_stations(side_sp, plan_sp, tmpl)
    verts, faces, S = loft_mesh(stations)
    feats = build_feature_lines(S, side_sp)

    W = GUIDE['wheel']
    wheels, rims = [], []
    for wx in (W['front_x'], W['rear_x']):
        for sgn in (+1, -1):
            wv, wf = make_tire(wx, sgn * W['track_half'])
            wheels.append(quantize_mesh(wv, wf))
            rv, rf = make_rim(wx, sgn * W['track_half'], sgn)
            rims.append(quantize_mesh(rv, rf))
    bumpers = []
    for xf, sgn in ((BUMPER_F_X, -1), (BUMPER_R_X, +1)):
        bv, bf = make_bumper(xf, sgn)
        bumpers.append(quantize_mesh(bv, bf))

    out = dict(
        model='F', units='mm', origin='front axle / ground',
        dims=dict(wheelbase=1840, height=1325, width=1320, length=2970),
        body=quantize_mesh(verts, faces),
        wheels=wheels,
        rims=rims,
        bumpers=bumpers,
        lines=[[list(map(lambda v: round(v, 1), p)) for p in pl] for pl in feats],
    )
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    json.dump(out, open(args.out, 'w'))
    print('body verts=%d faces=%d lines=%d -> %s (%.1f KB)' % (
        len(verts), len(faces), len(feats), args.out, os.path.getsize(args.out) / 1024))

    if args.calib:
        render_calib(args.src, S, args.calib_dir or os.path.dirname(args.src))

def render_calib(src, S, outdir):
    img = Image.open(src).convert('RGB')
    d = ImageDraw.Draw(img)
    def sxp(x): return FRONT_AXLE_PX + x / MMX
    def szp(z): return GROUND_PY - z / MMZ
    def pyp(y): return PLAN_CY - y / MMX
    def fxp(y): return FRONT_CX - y / MMX
    top = [(sxp(s[0, 0]), szp(s[:, 2].max())) for s in S]
    bot = [(sxp(s[0, 0]), szp(s[:, 2].min())) for s in S]
    wid = [(sxp(s[0, 0]), pyp(s[:, 1].max())) for s in S]
    d.line(top, fill=(255, 0, 0), width=3)
    d.line(bot, fill=(255, 0, 0), width=3)
    d.line(wid, fill=(0, 100, 255), width=3)
    d.line([(p[0], 2 * PLAN_CY - p[1]) for p in wid], fill=(0, 100, 255), width=3)
    for s in S[::6]:
        d.line([(fxp(y), szp(z)) for _, y, z in s], fill=(0, 170, 0), width=2)
        d.line([(fxp(-y), szp(z)) for _, y, z in s], fill=(0, 170, 0), width=2)
    W = GUIDE['wheel']
    for wx in (W['front_x'], W['rear_x']):
        r = W['arch_r'] / MMX
        cx, cy = sxp(wx), szp(W['hub_z'])
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 150, 0), width=2)
    fn = os.path.join(outdir, 'calib_overlay.png')
    img.save(fn)
    print('calib ->', fn)

if __name__ == '__main__':
    main()
