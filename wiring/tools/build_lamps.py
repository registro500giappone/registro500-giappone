# -*- coding: utf-8 -*-
"""
FIAT 110F型 ウインカー/ブレーキランプ一式 プロシージャル生成スクリプト
(配線/パーツビューア用): フロントウインカー×2＋フロントサイドウインカー×2＋
リアテール(ブレーキ/ウインカー一体)ランプ×2

車体3Dモデル(body_f_v2.glb)と同じ実車mm座標系(x=前軸0・後方+ / y=左+ /
z=地面0・上+、LHD)で trimesh プリミティブを直接配置する。
build_engine.py / build_front_parts.py / build_dashboard.py と同じ
ヘルパー関数構成を踏襲。

配置の根拠(いずれも f.json アンカー＋GLB表皮実測の組み合わせ):
    - フロントウインカー: f.json lamp_fl/lamp_fr [-420, ±455, 430]
      (「ノーズ左右隅・ヘッドライト下。座標はモデルのランプ形状実測に一致」)。
      車体表皮の同領域最前面は x≈-399 (pygltflib実測)なので、ベースを表皮上
      (-399)に置きレンズドームを前方(-x)へ突出させる。
    - フロントサイドウインカー: 前輪アーチ後方のフェンダー側面。f.json に
      ノードは無いため、GLB表皮実測(x200〜310・z≈575 で y_max≈617〜623)から
      (300, ±620, 590) を採用し、レンズは外向き(±y)。実車の涙滴型リピーターの
      定位置(前輪後方・肩の下)に合致。
    - リアテールランプ(ブレーキ/ウインカー一体): f.json lamp_rl/lamp_rr
      [2300, ±430, 480](「リアクォーターのテールランプ一体・バンパー上。
      モデルのランプ形状実測に一致」)。同領域の表皮後端は x≈2360 (実測)なので
      ベースを表皮上(2355)に置き後方(+x)へ突出。実車F型の縦長2色レンズ
      (上=アンバー・ウインカー / 下=赤・テール&ブレーキ)を上下2分割の
      カプセルで表現。

再生成手順:
    cd wiring/tools
    python build_lamps.py
    # -> ../assets/lamps_110f.glb を上書き生成。標準出力に部品数・面数・
    #    バウンディングボックスを表示する。

寸法根拠のメモ:
    - フロントウインカー: ベース円筒r22(f.json shape size[40,40,30]の
      直径40mmと整合)＋クリアレンズ半球r18。
    - サイドリピーター: クローム台座(楕円体・長軸を車軸方向に)＋
      アンバーレンズ半球r14。実車は全長約80mmの涙滴型。
    - リアランプ: クローム台座プレート(80x45楕円柱)＋上下レンズ各半球
      (縦長全高≈110mm)。バンパー上・ナンバー灯とは別体。
"""
import os
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'lamps_110f.glb')

# ============ マテリアル ============

def mat(name, rgb_0_255, metallic=0.5, roughness=0.5, alpha=255):
    r, g, b = rgb_0_255
    return PBRMaterial(
        name=name,
        baseColorFactor=[r / 255.0, g / 255.0, b / 255.0, alpha / 255.0],
        metallicFactor=metallic, roughnessFactor=roughness,
    )

MAT_CHROME     = mat('lamp_chrome', (0xD8, 0xDC, 0xE0), metallic=0.95, roughness=0.12)
MAT_LENS_CLEAR = mat('lamp_lens_clear', (0xE8, 0xF0, 0xF6), metallic=0.05, roughness=0.15, alpha=200)
MAT_LENS_AMBER = mat('lamp_lens_amber', (0xE8, 0x96, 0x18), metallic=0.05, roughness=0.2, alpha=230)
MAT_LENS_RED   = mat('lamp_lens_red', (0xC4, 0x1E, 0x1E), metallic=0.05, roughness=0.2, alpha=230)
MAT_GASKET     = mat('lamp_gasket', (0x26, 0x28, 0x2A), metallic=0.1, roughness=0.7)

# ============ ジオメトリ・ヘルパー (build_engine.py と共通の構成) ============

def _set_material(mesh, material, name):
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    mesh.metadata['name'] = name
    return mesh


def _align_transform(direction):
    d = np.asarray(direction, dtype=float)
    n = np.linalg.norm(d)
    if n < 1e-9:
        return np.eye(4)
    return trimesh.geometry.align_vectors([0, 0, 1], d / n)


def add_cylinder(parts, center, direction, radius, height, material, name, sections=18):
    m = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    m.apply_transform(_align_transform(direction))
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


def add_dome(parts, center, direction, radius, material, name, squash=0.65, subdiv=2):
    """direction 方向へ膨らむレンズドーム(楕円半球で近似: 球をローカルZ方向に
    squash 倍へ潰してから向きを合わせる。半球でなく全楕円体だが、後半分は
    台座/表皮に埋まるので見た目は半球)。"""
    m = trimesh.creation.icosphere(subdivisions=subdiv, radius=radius)
    m.apply_scale([1.0, 1.0, squash])
    m.apply_transform(_align_transform(direction))
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


def add_ellipsoid(parts, center, radii, material, name, subdiv=2):
    """ワールド軸に沿った楕円体(サイドリピーターの涙滴台座など)。"""
    m = trimesh.creation.icosphere(subdivisions=subdiv, radius=1.0)
    m.apply_scale(list(radii))
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


# ============ 部品配置本体 ============

def build_front_winker(parts, side, sign):
    """フロントウインカー(ノーズ隅・ヘッドライト下)。クリアレンズ。
    アンカー: f.json lamp_fl/fr [-420, ±455, 430]・表皮実測 x≈-399。"""
    skin_x, cy, cz = -399, sign * 455, 430
    # ガスケット+クロームベース(表皮に少し埋め込み)
    add_cylinder(parts, (skin_x - 2, cy, cz), (1, 0, 0), 24, 8, MAT_GASKET,
                 f'front_winker_{side}_gasket', sections=18)
    add_cylinder(parts, (skin_x - 8, cy, cz), (1, 0, 0), 22, 10, MAT_CHROME,
                 f'front_winker_{side}_base', sections=18)
    # クリアレンズドーム(前方-xへ)
    add_dome(parts, (skin_x - 13, cy, cz), (-1, 0, 0), 18, MAT_LENS_CLEAR,
             f'front_winker_{side}_lens', squash=0.7)


def build_side_repeater(parts, side, sign):
    """フロントサイドウインカー(前輪アーチ後方のフェンダー側面・涙滴型)。
    根拠: GLB表皮実測 (x200〜310, z≈575, y_max≈617〜623) → (300, ±620, 590)。"""
    cx, cy, cz = 300, sign * 620, 590
    # クローム涙滴台座(車軸方向に長い楕円体・半分表皮に埋める)
    add_ellipsoid(parts, (cx, cy - sign * 4, cz), (40, 10, 16), MAT_CHROME,
                  f'side_repeater_{side}_base')
    # アンバーレンズ(外向き±y)
    add_dome(parts, (cx - 8, cy + sign * 4, cz), (0, sign, 0), 14, MAT_LENS_AMBER,
             f'side_repeater_{side}_lens', squash=0.75)


# ---- リアテールランプ: 角のある台形輪郭レンズカバーのロフト生成 ----

def _fillet_polygon(corners, radius, seg=5):
    """CCW凸多角形の各角を radius でフィレットした輪郭点列を返す。"""
    P = [np.asarray(c, dtype=float) for c in corners]
    n = len(P)
    pts = []
    for i in range(n):
        p0, p1, p2 = P[i - 1], P[i], P[(i + 1) % n]
        v1, v2 = p1 - p0, p2 - p1
        l1, l2 = np.linalg.norm(v1), np.linalg.norm(v2)
        d1, d2 = v1 / l1, v2 / l2
        ang = np.arccos(np.clip(np.dot(d1, d2), -1.0, 1.0))  # 外角
        if ang < 1e-6:
            pts.append(p1)
            continue
        t = min(radius * np.tan(ang / 2), l1 * 0.45, l2 * 0.45)
        rr = t / np.tan(ang / 2)
        start, end = p1 - d1 * t, p1 + d2 * t
        n1 = np.array([-d1[1], d1[0]])  # CCWなら内側法線
        c = start + n1 * rr
        a0 = np.arctan2(start[1] - c[1], start[0] - c[0])
        a1 = np.arctan2(end[1] - c[1], end[0] - c[0])
        sweep = a1 - a0
        while sweep > np.pi:
            sweep -= 2 * np.pi
        while sweep < -np.pi:
            sweep += 2 * np.pi
        for k in range(seg + 1):
            a = a0 + sweep * k / seg
            pts.append(c + rr * np.array([np.cos(a), np.sin(a)]))
    return np.array(pts)


def _loft_shell(profile, rim_x, cy, cz, rings, apex_bulge=None, flip=False):
    """輪郭 profile を輪郭重心まわりに (scale, bulge) リングで積層した
    シェルの (vertices, faces) を返す。apex_bulge を与えると重心位置の
    頂点でキャップする。faceted な面取り形状を作れるようリングは明示指定。"""
    n = len(profile)
    cen = profile.mean(axis=0)
    verts = []
    for s, bulge in rings:
        for (u, v) in profile:
            uu = cen[0] + (u - cen[0]) * s
            vv = cen[1] + (v - cen[1]) * s
            verts.append((rim_x + bulge, cy + uu, cz + vv))
    faces = []
    for r in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            a, b = r * n + i, r * n + j
            c, d = (r + 1) * n + i, (r + 1) * n + j
            faces.append([a, b, d]); faces.append([a, d, c])
    if apex_bulge is not None:
        verts.append((rim_x + apex_bulge, cy + cen[0], cz + cen[1]))
        apex = len(verts) - 1
        last = (len(rings) - 1) * n
        for i in range(n):
            j = (i + 1) % n
            faces.append([last + i, last + j, apex])
    verts = np.array(verts, dtype=float)
    faces = np.array(faces, dtype=int)
    if flip:
        faces = faces[:, ::-1]
    return verts, faces


def _shell_mesh(verts, faces, material, name, face_mask=None):
    f = faces if face_mask is None else faces[face_mask]
    m = trimesh.Trimesh(vertices=verts, faces=f, process=True)
    return _set_material(m, material, name)


def _split_mesh_at_z(verts, faces, z):
    """三角形メッシュを水平面 z で正確に2分割し (上側Trimesh, 下側Trimesh) を
    返す。跨ぐ三角形は交線で細分割する(trimesh.slice_plane は shapely 依存の
    ため自前実装)。"""
    verts = [np.asarray(v, dtype=float) for v in verts]
    above_faces, below_faces = [], []

    def interp(p0, p1):
        t = (z - p0[2]) / (p1[2] - p0[2])
        verts.append(p0 + (p1 - p0) * t)
        return len(verts) - 1

    for tri in faces:
        idx = list(tri)
        d = [verts[i][2] - z for i in idx]
        if all(di >= 0 for di in d):
            above_faces.append(idx)
            continue
        if all(di <= 0 for di in d):
            below_faces.append(idx)
            continue
        # 「単独側」の頂点が先頭になるよう巡回シフト(巻き方向は保存される)
        pos = [di > 0 for di in d]
        lone_above = pos.count(True) == 1
        for _ in range(3):
            if (d[0] > 0) == lone_above and (d[1] > 0) != lone_above:
                break
            idx = idx[1:] + idx[:1]
            d = d[1:] + d[:1]
        a, b, c = idx
        i_ab = interp(verts[a], verts[b])
        i_ca = interp(verts[c], verts[a])
        lone_part = [[a, i_ab, i_ca]]
        pair_part = [[i_ab, b, c], [i_ab, c, i_ca]]
        if lone_above:
            above_faces += lone_part
            below_faces += pair_part
        else:
            below_faces += lone_part
            above_faces += pair_part

    va = np.array(verts)
    up = trimesh.Trimesh(vertices=va, faces=np.array(above_faces), process=True)
    dn = trimesh.Trimesh(vertices=va, faces=np.array(below_faces), process=True)
    return up, dn


def _rear_lamp_profile(sign):
    """角のある縦長台形輪郭(外側縁=フェンダーラインに沿って上すぼまりに傾斜・
    内側縁=ほぼ垂直・上下縁=水平)。u正=車体外側。CCW・フィレットr=9。
    sign=-1(右側)ではu反転し、CCWを保つため点列も反転する。"""
    corners = [(34, -52), (18, 56), (-22, 56), (-28, -52)]  # CCW (u,v)
    prof = _fillet_polygon(corners, radius=9, seg=4)
    if sign < 0:
        prof = prof * np.array([-1.0, 1.0])
        prof = prof[::-1]
    return prof


def build_rear_lamp(parts, side, sign):
    """リアテールランプ(ブレーキ/ウインカー一体)。
    アンカー: f.json lamp_rl/rr [2300, ±430, 480]・表皮実測 x≈2360。

    実車F型のレンズカバーは「角のある」縦長台形(下辺が広く、外側縁が
    フェンダーラインに沿って傾斜)の一体成形樹脂で、前面はほぼ平らな
    面取りプリズム状。上側約1/3=アンバー(ウインカー)・下側=赤(テール&
    ブレーキ)。周囲にクロームベゼル・車体側にガスケット。
    ※初版「楕円柱＋半球2個」→第2版「ティアドロップドーム」はいずれも
      ユーザーレビューで却下(「角のある形状なので間違えないで」2026-07-10)。
      フィレット付き角形輪郭＋面取りロフトで再現する。"""
    skin_x, cy, cz = 2355, sign * 430, 480
    prof = _rear_lamp_profile(sign)

    # ガスケット台座(ほぼ平板・輪郭を1.16倍)
    gv, gf = _loft_shell(prof * 1.16, skin_x - 3, cy, cz,
                         rings=[(1.0, 0.0), (0.5, 3.0)], apex_bulge=3.5)
    parts.append(_shell_mesh(gv, gf, MAT_GASKET, f'rear_lamp_{side}_gasket'))

    # クロームベゼル(輪郭1.10倍の低い外周帯・キャップなし)
    bv, bf = _loft_shell(prof * 1.10, skin_x - 1, cy, cz,
                         rings=[(1.0, 0.0), (0.90, 7.0)], apex_bulge=None)
    parts.append(_shell_mesh(bv, bf, MAT_CHROME, f'rear_lamp_{side}_bezel'))

    # レンズカバー本体: 側壁→面取り→ほぼ平らな前面、の面取りプリズム。
    # 上下2色の分割は水平面での正確なスライス(初版の面重心判定はV字の
    # ギザギザ縫い目になったため却下)
    lens_rings = [(1.00, 0.0), (0.94, 10.0), (0.78, 19.0), (0.50, 23.0)]
    lv, lf = _loft_shell(prof, skin_x + 1, cy, cz, rings=lens_rings, apex_bulge=24.5)
    split_z = cz + 15.0  # 上側約1/3をアンバーに
    amber, red = _split_mesh_at_z(lv, lf, split_z)
    parts.append(_set_material(amber, MAT_LENS_AMBER, f'rear_lamp_{side}_turn_lens'))
    parts.append(_set_material(red, MAT_LENS_RED, f'rear_lamp_{side}_brake_lens'))


def build_parts():
    parts = []
    for side, sign in (('L', +1), ('R', -1)):
        build_front_winker(parts, side, sign)
        build_side_repeater(parts, side, sign)
        build_rear_lamp(parts, side, sign)
    return parts


def main():
    parts = build_parts()
    scene = trimesh.Scene()
    for m in parts:
        name = m.metadata.get('name', 'part')
        scene.add_geometry(m, geom_name=name, node_name=name)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    scene.export(OUT_PATH)

    n_faces = sum(len(m.faces) for m in parts)
    n_verts = sum(len(m.vertices) for m in parts)
    bmin = np.min([m.vertices.min(axis=0) for m in parts], axis=0)
    bmax = np.max([m.vertices.max(axis=0) for m in parts], axis=0)
    print(f'lamp parts: {len(parts)}  faces: {n_faces}  verts: {n_verts}')
    print('names:', [m.metadata.get('name') for m in parts])
    print(f'bbox mm: x[{bmin[0]:.0f},{bmax[0]:.0f}] y[{bmin[1]:.0f},{bmax[1]:.0f}] z[{bmin[2]:.0f},{bmax[2]:.0f}]')
    print(f'-> {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
