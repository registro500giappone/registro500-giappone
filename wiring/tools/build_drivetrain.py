# -*- coding: utf-8 -*-
"""
FIAT 110F型 ギアボックス＋デフ＋ドライブシャフト一式 プロシージャル生成スクリプト（配線ビューア用）

車体3Dモデル(body_f_v2.glb)・エンジンモデル(engine_110f.glb)と同じ実車mm座標系
(x=前軸0・後方+ / y=左+ / z=地面0・上+)で、trimeshのプリミティブ(角丸箱/円柱/
球/自作フラスタム)を直接この座標系上に組み合わせて駆動系ユニット一式を配置する。
ビューア(index.html)にそのままドロップインできるよう、body側のようなスケール/
整列後処理は不要。

FIAT 500 の機構: リアエンジン縦置き＋ユニット構成のギアボックス。エンジン前端
(クランクケース)にクラッチベルハウジングが接続し、その先にギアボックス本体
(入力軸～変速機～デフ一体ケース)があり、デフから左右へドライブシャフト(車軸)が
真横に伸びて後輪ハブを直接駆動する(スイングアクスル式のためプロペラシャフトは
存在しない)。入力軸の軸線はクランク軸線とほぼ同じ高さ(z≈480〜500)にあるが、
デフ(最終減速の出力軸線)はホイールセンター高(z≈247)に合わせるため入力軸より
低い位置にある。よってギアボックスケースは背が高い箱とし、ベルハウジングは
上方後寄り(エンジン側)から下方前寄り(ケース側)へ斜めに絞るフラスタムとした。

エンジン側との接続:
    build_engine.py はエンジン前端に短いスタブ 'bellhousing_stub' を
    (1855,0,495)r145 → (1815,0,488)r128 で既に配置し、「ギアボックス／
    ドライブシャフト本体は別GLBが担当する」とコメントしている。本スクリプトの
    クラッチベルハウジングはこの終端 (1815,0,488) r128 を始点にして受け継ぎ、
    重複を避けつつ視覚的に連続させる。

配置の根拠:
    wiring/data/f.json の group:"drivetrain" ノード(clutch[1780,0,350] /
    transmission[1650,0,350] / drive_shaft_l・r[1833,±350,250]、いずれも
    要確認プレースホルダ)をアンカーとして参照。f.json 自体は変更しない
    (ユーザーレビュー待ちのため)。デフ・ドライブシャフトの中心x=1833は
    body_f_v2実測の後軸位置(POSITION_GUIDE.md §1)と一致させている。
    参照図版: FIAT 110/110F uso e manutenzione p45「Gruppo motore-cambio」
    (エンジン＋ギアボックス一体ユニットの実写・ギアボックスケースの外観と
    シフトロッド/ドライブシャフトスタブの突き出し方を確認)、p22/p24の
    シャシー上面透視図(デフ/ギアボックスがリアアクスルライン直上に位置し
    そこから左右のスイングアクスルアームが後輪ハブへ伸びる配置を確認)。
    ローカル格納: C:\\Users\\akayu\\Documents\\registro500-notes\\manual_110_figures\\p45.png
                  C:\\Users\\akayu\\Documents\\registro500-notes\\manual_110F_L_figures\\p22.png, p24.png

寸法根拠のメモ:
    - クラッチベルハウジング: エンジン側スタブ終端(1815,0,488)r128から、
      ギアボックスケース上部前寄り(1750,0,340)r95へ斜めに絞るフラスタム。
      入力軸線(クランク高さ)からデフ高さへの段差を1部品で表現。
    - ギアボックス本体: 角丸箱、中心(1650,0,320)・長さ220(x:1540-1760)・
      幅190(y:±95)・高さ170(z:235-405)。POSITION_GUIDE「ギアボックスは
      前方x≈1500-1900」「z≈250-350」の指示範囲に収まる高さ寄せ。
    - デフ膨らみ: 楕円体、中心(1833,0,300)・半径(x70,y130,z100)。
      x中心をbody_f_v2実測の後軸(x=1833)に一致させ、ここから左右の
      ドライブシャフトが真横(y方向)に伸びる基準点とした。
    - ドライブシャフト: x=1833・z=280(デフ中心z300とホイールセンター
      z247の中間・「水平に伸ばす」指示に従い左右とも同一z)で、
      y=150→560(内側ジョイントブーツ→シャフト本体→外側ジョイントブーツ)。
      ブーツは蛇腹の近似としてシャフトより太いフラスタムで表現。

再生成手順:
    cd wiring/tools
    python build_drivetrain.py
    # -> ../assets/drivetrain_110f.glb を上書き生成。標準出力に面数・バウンディングボックスを表示する。
"""
import os
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'drivetrain_110f.glb')

# ============ マテリアル ============

def mat(name, rgb_0_255, metallic=0.6, roughness=0.4, alpha=255):
    r, g, b = rgb_0_255
    return PBRMaterial(
        name=name,
        baseColorFactor=[r / 255.0, g / 255.0, b / 255.0, alpha / 255.0],
        metallicFactor=metallic, roughnessFactor=roughness,
    )

MAT_ALU_CAST = mat('drivetrain_aluminum_cast', (0xC9, 0xCE, 0xD2), metallic=0.65, roughness=0.42)
MAT_STEEL    = mat('drivetrain_steel', (0x8A, 0x8F, 0x94), metallic=0.6, roughness=0.35)
MAT_BOOT     = mat('drivetrain_cv_boot', (0x1F, 0x20, 0x22), metallic=0.05, roughness=0.85)
MAT_MOUNT    = mat('drivetrain_mount', (0x33, 0x35, 0x38), metallic=0.3, roughness=0.6)

# ============ ジオメトリ・ヘルパー ============

def _set_material(mesh, material, name):
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    mesh.metadata['name'] = name
    return mesh


def _align_transform(direction):
    """ローカルZ軸を direction(単位ベクトル不要・内部で正規化)へ向ける回転行列"""
    d = np.asarray(direction, dtype=float)
    n = np.linalg.norm(d)
    if n < 1e-9:
        return np.eye(4)
    return trimesh.geometry.align_vectors([0, 0, 1], d / n)


def add_box(parts, center, size, material, name):
    m = trimesh.creation.box(extents=size)
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


def add_cylinder_between(parts, p0, p1, radius, material, name, sections=20):
    p0 = np.asarray(p0, dtype=float); p1 = np.asarray(p1, dtype=float)
    v = p1 - p0
    h = float(np.linalg.norm(v))
    m = trimesh.creation.cylinder(radius=radius, height=h, sections=sections)
    m.apply_transform(_align_transform(v))
    m.apply_translation((p0 + p1) / 2)
    parts.append(_set_material(m, material, name))
    return m


def add_frustum_between(parts, p0, p1, r0, r1, material, name, sections=16):
    """p0(半径r0)からp1(半径r1)へつなぐ円錐台(ベルハウジング・ジョイントブーツ等に使用)"""
    p0 = np.asarray(p0, dtype=float); p1 = np.asarray(p1, dtype=float)
    v = p1 - p0
    h = float(np.linalg.norm(v))
    ring0 = np.array([[r0 * np.cos(a), r0 * np.sin(a), -h / 2] for a in
                       np.linspace(0, 2 * np.pi, sections, endpoint=False)])
    ring1 = np.array([[r1 * np.cos(a), r1 * np.sin(a), h / 2] for a in
                       np.linspace(0, 2 * np.pi, sections, endpoint=False)])
    verts = np.vstack([ring0, ring1, [[0, 0, -h / 2]], [[0, 0, h / 2]]])
    c0, c1 = sections * 2, sections * 2 + 1
    faces = []
    for i in range(sections):
        j = (i + 1) % sections
        faces.append([i, sections + i, sections + j])
        faces.append([i, sections + j, j])
        faces.append([c0, j, i])                         # 下キャップ(r0側)
        faces.append([c1, sections + i, sections + j])    # 上キャップ(r1側)
    m = trimesh.Trimesh(vertices=verts, faces=faces, process=True)
    m.apply_transform(_align_transform(v))
    m.apply_translation((p0 + p1) / 2)
    parts.append(_set_material(m, material, name))
    return m


def add_ellipsoid(parts, center, radii, material, name, subdiv=3):
    rx, ry, rz = radii
    m = trimesh.creation.icosphere(subdivisions=subdiv, radius=1.0)
    m.apply_scale([rx, ry, rz])
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


def add_chamfered_box(parts, center, length, width, height, chamfer, material, name):
    """長さ(x)×幅(y)×高さ(z)の角丸(面取り)箱。center はローカル原点(=箱中心)への平行移動先。"""
    hl, hw, hh = length / 2, width / 2, height / 2
    c = min(chamfer, hw * 0.9, hh * 0.9)
    # y,z平面上の八角形断面(角を面取り)
    ring_yz = np.array([
        [hw - c, -hh], [hw, -hh + c],
        [hw, hh - c],  [hw - c, hh],
        [-hw + c, hh], [-hw, hh - c],
        [-hw, -hh + c], [-hw + c, -hh],
    ])
    n = len(ring_yz)
    front = np.column_stack([np.full(n, -hl), ring_yz])   # x = -hl
    back = np.column_stack([np.full(n, hl), ring_yz])     # x = +hl
    verts = np.vstack([front, back, [[-hl, 0, 0]], [[hl, 0, 0]]])
    c_front, c_back = 2 * n, 2 * n + 1
    faces = []
    for i in range(n):
        j = (i + 1) % n
        # 側面(front[i]-front[j]-back[j]-back[i])
        faces.append([i, n + j, n + i])
        faces.append([i, j, n + j])
        # 端面キャップ(法線が外向きになる順)
        faces.append([c_front, j, i])
        faces.append([c_back, n + i, n + j])
    m = trimesh.Trimesh(vertices=verts, faces=faces, process=True)
    m.fix_normals()  # 面取り断面の巻き順を機械的に生成しているため、法線の向きを念のため統一・外向き化
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


def add_drive_shaft(parts, side, sign, x, y_inner, y_outer, z, material_steel, material_boot):
    """デフ側(y_inner)～ホイールハブ側(y_outer)へ y方向に伸びるドライブシャフト。
    内外ジョイントブーツ(蛇腹の近似=先細りフラスタム)+シャフト本体(円柱)で構成。"""
    boot_len = 40.0
    r_shaft, r_boot = 25.0, 45.0
    p_inner = (x, sign * y_inner, z)
    p_inner_out = (x, sign * (y_inner + boot_len), z)
    p_outer_in = (x, sign * (y_outer - boot_len), z)
    p_outer = (x, sign * y_outer, z)
    add_frustum_between(parts, p_inner, p_inner_out, r_boot, r_shaft,
                         material_boot, f'drive_shaft_{side}_boot_inner', sections=16)
    add_cylinder_between(parts, p_inner_out, p_outer_in, r_shaft,
                          material_steel, f'drive_shaft_{side}_shaft', sections=16)
    add_frustum_between(parts, p_outer_in, p_outer, r_shaft, r_boot,
                         material_boot, f'drive_shaft_{side}_boot_outer', sections=16)


# ============ 部品配置本体 ============

def build_parts():
    parts = []

    # ---- クラッチベルハウジング(エンジン側スタブ終端(1815,0,488)r128を受け継ぎ、
    #      ギアボックスケース上部前寄り(1750,0,340)r95へ斜めに絞る) ----
    add_frustum_between(parts, (1815, 0, 488), (1750, 0, 340), 128, 95,
                         MAT_ALU_CAST, 'clutch_bellhousing', sections=20)

    # ---- ギアボックス本体(角丸箱。入力軸高さ~デフ高さをまたぐ背の高い箱) ----
    add_chamfered_box(parts, (1650, 0, 320), 220, 190, 170, 20,
                       MAT_ALU_CAST, 'gearbox_case')

    # ---- デフ膨らみ(楕円体。中心xを後軸実測x=1833に一致させ、ここから
    #      左右ドライブシャフトが真横に伸びる基準点とする) ----
    add_ellipsoid(parts, (1833, 0, 300), (70, 130, 100), MAT_ALU_CAST, 'differential_housing')

    # ---- 左右ドライブシャフト(x=1833・z=280・y=150→560で水平に後輪ハブへ) ----
    add_drive_shaft(parts, 'L', +1, 1833, 150, 560, 280, MAT_STEEL, MAT_BOOT)
    add_drive_shaft(parts, 'R', -1, 1833, 150, 560, 280, MAT_STEEL, MAT_BOOT)

    # ---- マウント類(簡略。ギアボックス上部の車体側マウント＋デフ下部のサブフレーム受け) ----
    add_box(parts, (1650, 0, 410), (40, 60, 30), MAT_MOUNT, 'gearbox_mount_top')
    add_box(parts, (1833, 0, 195), (50, 70, 25), MAT_MOUNT, 'differential_mount_bottom')

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
    print(f'drivetrain parts: {len(parts)}  faces: {n_faces}  verts: {n_verts}')
    print(f'bbox mm: x[{bmin[0]:.0f},{bmax[0]:.0f}] y[{bmin[1]:.0f},{bmax[1]:.0f}] z[{bmin[2]:.0f},{bmax[2]:.0f}]')
    print(f'-> {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
