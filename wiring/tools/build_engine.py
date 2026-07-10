# -*- coding: utf-8 -*-
"""
FIAT 110F型 空冷2気筒エンジン ユニット一式 プロシージャル生成スクリプト（配線ビューア用）

車体3Dモデル(body_f_v2.glb / body_l_v2.glb)と同じ実車mm座標系(x=前軸0・後方+ /
y=左+ / z=地面0・上+)で、trimeshのプリミティブ(box/cylinder/球/自作フラスタム)を
組み合わせてエンジンユニット一式を直接この座標系上に配置する。ビューア(index.html)
にそのままドロップインできるよう、body側のようなスケール/整列後処理は不要。

形状の主参照:
    FIAT 500 D 型 uso e manutenzione マニュアル p47「Motore con ventilatore,
    sezionati parzialmente」(遠心ファン・フィン付きシリンダー・キャブレター/
    エアクリーナー・ディストリビューター等のカットモデル)、p46「Circolazione
    aria per raffreddamento motore」(ファン～シュラウド～シリンダーの空気経路)。
    ローカル格納: C:\\Users\\akayu\\Documents\\registro500-notes\\manual_110F_L_figures\\
    (p51.png=主参照, p50.png=冷却ダクト形状, p26.png=内部断面, p13.png=エンジンルーム実写)

配置の根拠:
    wiring/data/f.json の group:"engine" ノードの pos3d をアンカーとして使用
    (cylinder_head[2050,0,650] / dynamo[1900,-100,700] / air_cleaner[1980,100,850] /
    distributor[1880,0,600] / ignition_coil[1900,150,650] 等)。f.json自体は変更しない
    (ユーザーレビュー待ちのため)。各部品メッシュの中心はこれらマーカーからおよそ
    50~100mm以内に収まるよう配置している(POSITION_GUIDE.mdの許容誤差に準拠)。

再生成手順:
    cd wiring/tools
    python build_engine.py
    # -> ../assets/engine_110f.glb を上書き生成。標準出力に面数・バウンディングボックスを表示する。

寸法根拠のメモ:
    - シリンダーボア/フィン外径: p51の実測比率からフィン外径~150mm相当(バレル本体~95mm)と
      見積り、コア半径48mm・フィン半径75mmとした(実車ボアは67.4mm/73.5mmだが、フィンを
      含めた見た目の"太さ"を優先)。
    - エンジン全体の配置バウンディングボックスはおよそ x[1750,2450] y[-350,350] z[150,900]
      (エンジンルーム床z≈420・後端テールx≈2461というbody_f_v2実測(POSITION_GUIDE §1)を
      踏まえた範囲)。
"""
import os
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'engine_110f.glb')

# ============ マテリアル ============

def mat(name, rgb_0_255, metallic=0.6, roughness=0.4, alpha=255):
    r, g, b = rgb_0_255
    return PBRMaterial(
        name=name,
        baseColorFactor=[r / 255.0, g / 255.0, b / 255.0, alpha / 255.0],
        metallicFactor=metallic, roughnessFactor=roughness,
    )

MAT_ALU_BRIGHT = mat('engine_aluminum', (0xE3, 0xE6, 0xE9), metallic=0.75, roughness=0.32)
MAT_ALU_FIN    = mat('engine_fin', (0xC9, 0xD0, 0xD5), metallic=0.7, roughness=0.4)
MAT_HOUSING    = mat('engine_housing', (0x8B, 0x93, 0x9B), metallic=0.55, roughness=0.45)
MAT_CAST_DARK  = mat('engine_cast_iron', (0x55, 0x5B, 0x61), metallic=0.35, roughness=0.6)
MAT_STEEL_EXH  = mat('engine_exhaust_steel', (0x6b, 0x70, 0x74), metallic=0.5, roughness=0.55)
MAT_BLACK      = mat('engine_black', (0x22, 0x24, 0x27), metallic=0.15, roughness=0.7)
MAT_CREAM      = mat('engine_air_cleaner', (0xD8, 0xD3, 0xBE), metallic=0.15, roughness=0.55)

# ============ ジオメトリ・ヘルパー ============

def _set_material(mesh, material, name):
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    mesh.metadata['name'] = name
    return mesh


def add_box(parts, center, size, material, name):
    m = trimesh.creation.box(extents=size)
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


def _align_transform(direction):
    """ローカルZ軸を direction(単位ベクトル不要・内部で正規化)へ向ける回転行列"""
    d = np.asarray(direction, dtype=float)
    n = np.linalg.norm(d)
    if n < 1e-9:
        return np.eye(4)
    return trimesh.geometry.align_vectors([0, 0, 1], d / n)


def add_cylinder(parts, center, direction, radius, height, material, name, sections=20):
    m = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    m.apply_transform(_align_transform(direction))
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


def add_cylinder_between(parts, p0, p1, radius, material, name, sections=20):
    p0 = np.asarray(p0, dtype=float); p1 = np.asarray(p1, dtype=float)
    v = p1 - p0
    h = float(np.linalg.norm(v))
    return add_cylinder(parts, (p0 + p1) / 2, v, radius, h, material, name, sections=sections)


def add_frustum_between(parts, p0, p1, r0, r1, material, name, sections=16):
    """p0(半径r0)からp1(半径r1)へつなぐ円錐台(シュラウドのダクト等に使用)"""
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
        faces.append([c0, j, i])          # 下キャップ
        faces.append([c1, sections + i, sections + j])  # 上キャップ
    m = trimesh.Trimesh(vertices=verts, faces=faces, process=True)
    m.apply_transform(_align_transform(v))
    m.apply_translation((p0 + p1) / 2)
    parts.append(_set_material(m, material, name))
    return m


def add_finned_cylinder(parts, p0, p1, core_r, fin_r, material_core, material_fin, name,
                         sections=18, fin_thick=5.0, fin_pitch=11.0):
    """フィン付きシリンダー: コア円柱＋薄い円盤フィンの積層"""
    add_cylinder_between(parts, p0, p1, core_r, material_core, name + '_core', sections=sections)
    p0v = np.asarray(p0, dtype=float); p1v = np.asarray(p1, dtype=float)
    v = p1v - p0v
    h = float(np.linalg.norm(v))
    n_fins = max(1, int(h // fin_pitch))
    for i in range(n_fins):
        t = (i + 0.5) / n_fins
        c = p0v + v * t
        add_cylinder(parts, c, v, fin_r, fin_thick, material_fin, f'{name}_fin{i:02d}', sections=sections)


def add_sphere(parts, center, radius, material, name, scale_z=1.0, subdiv=2):
    m = trimesh.creation.icosphere(subdivisions=subdiv, radius=radius)
    if scale_z != 1.0:
        m.apply_scale([1.0, 1.0, scale_z])
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


def add_belt(parts, p0, p1, width, thick, material, name):
    """2プーリー間を結ぶVベルト(薄い帯で近似)。p0/p1はY座標が概ね揃っている前提"""
    p0 = np.asarray(p0, dtype=float); p1 = np.asarray(p1, dtype=float)
    v = p1 - p0
    length = float(np.linalg.norm(v))
    m = trimesh.creation.box(extents=[length, width, thick])
    m.apply_transform(_align_transform_x(v))
    m.apply_translation((p0 + p1) / 2)
    parts.append(_set_material(m, material, name))
    return m


def _align_transform_x(direction):
    """ローカルX軸を direction へ向ける回転行列(帯・箱の長辺をベクトルに合わせる用)"""
    d = np.asarray(direction, dtype=float)
    n = np.linalg.norm(d)
    if n < 1e-9:
        return np.eye(4)
    return trimesh.geometry.align_vectors([1, 0, 0], d / n)


# ============ 部品配置本体 ============

def build_parts():
    parts = []

    # ---- クランクケース＋オイルパン ----
    add_box(parts, (1970, 0, 400), (200, 240, 80), MAT_CAST_DARK, 'oil_pan')
    add_box(parts, (1970, 0, 500), (230, 300, 170), MAT_ALU_BRIGHT, 'crankcase')
    # 前方(トランスミッション側)のベルハウジング・フランジ最小スタブのみ。
    # ギアボックス／ドライブシャフト本体は別GLB(drivetrain_110f.glb・別途生成)が担当するため、
    # ここでは短い先細りスタブ1個に留めて重複を避ける。
    add_frustum_between(parts, (1855, 0, 495), (1815, 0, 488), 145, 128, MAT_ALU_BRIGHT, 'bellhousing_stub', sections=16)

    # ---- フィン付きシリンダー×2(左右に傾けたV字配置) ----
    cyl_L_p0, cyl_L_p1 = (1980, 95, 585), (2055, 145, 690)
    cyl_R_p0, cyl_R_p1 = (1980, -95, 585), (2055, -145, 690)
    add_finned_cylinder(parts, cyl_L_p0, cyl_L_p1, 48, 75, MAT_ALU_BRIGHT, MAT_ALU_FIN, 'cylinder_L')
    add_finned_cylinder(parts, cyl_R_p0, cyl_R_p1, 48, 75, MAT_ALU_BRIGHT, MAT_ALU_FIN, 'cylinder_R')

    # ---- ヘッドカバー(シリンダーヘッド)×2＋ロッカーカバー ----
    add_box(parts, (2065, 150, 660), (140, 150, 110), MAT_ALU_BRIGHT, 'cylinder_head_L')
    add_box(parts, (2065, -150, 660), (140, 150, 110), MAT_ALU_BRIGHT, 'cylinder_head_R')
    add_sphere(parts, (2065, 150, 730), 50, MAT_ALU_BRIGHT, 'rocker_cover_L', scale_z=0.6, subdiv=3)
    add_sphere(parts, (2065, -150, 730), 50, MAT_ALU_BRIGHT, 'rocker_cover_R', scale_z=0.6, subdiv=3)

    # ---- 遠心ファンハウジング(ダイナモ一体)＋シュラウド ----
    fan_center = (1890, -150, 660)
    add_cylinder(parts, fan_center, (0, 1, 0), 130, 150, MAT_HOUSING, 'fan_housing', sections=28)
    add_cylinder(parts, fan_center, (0, 1, 0), 42, 160, MAT_ALU_BRIGHT, 'dynamo', sections=16)
    # ファンハウジング~シリンダー根元をつなぐ空気ダクト(シュラウド)
    cyl_base_center = (1980, 0, 585)
    add_frustum_between(parts, fan_center, cyl_base_center, 128, 88, MAT_HOUSING, 'cylinder_shroud', sections=20)

    # ---- クランクプーリー・ファン/ダイナモプーリー・Vベルト ----
    crank_pulley_c = (1790, -150, 470)
    fan_pulley_c = (1830, -150, 650)
    add_cylinder(parts, crank_pulley_c, (0, 1, 0), 55, 35, MAT_CAST_DARK, 'crank_pulley', sections=20)
    add_cylinder(parts, fan_pulley_c, (0, 1, 0), 40, 25, MAT_CAST_DARK, 'fan_pulley', sections=20)
    add_belt(parts, crank_pulley_c, fan_pulley_c, 30, 12, MAT_BLACK, 'fan_belt')

    # ---- キャブレター＋エアクリーナー ----
    add_box(parts, (2000, 100, 780), (85, 70, 85), MAT_ALU_BRIGHT, 'carburetor')
    add_cylinder(parts, (2000, 100, 823), (0, 0, 1), 25, 35, MAT_ALU_BRIGHT, 'carburetor_horn', sections=16)
    add_cylinder(parts, (1980, 100, 850), (0, 0, 1), 85, 55, MAT_CREAM, 'air_cleaner', sections=24)

    # ---- マフラー＋エキゾーストパイプ2本 ----
    add_cylinder(parts, (2320, 0, 200), (0, 1, 0), 85, 380, MAT_STEEL_EXH, 'muffler', sections=22)
    for side, sign in (('L', 1), ('R', -1)):
        port = (2010, sign * 150, 620)
        bend = (2150, sign * 90, 350)
        inlet = (2260, sign * 40, 230)
        add_cylinder_between(parts, port, bend, 17, MAT_STEEL_EXH, f'exhaust_pipe_{side}_a', sections=12)
        add_cylinder_between(parts, bend, inlet, 17, MAT_STEEL_EXH, f'exhaust_pipe_{side}_b', sections=12)
        add_sphere(parts, bend, 18, MAT_STEEL_EXH, f'exhaust_pipe_{side}_bend', subdiv=1)

    # ---- ディストリビューター・点火コイル ----
    add_cylinder(parts, (1880, 0, 600), (0, 0, 1), 38, 75, MAT_ALU_BRIGHT, 'distributor_body', sections=18)
    add_cylinder(parts, (1880, 0, 652), (0, 0, 1), 42, 30, MAT_BLACK, 'distributor_cap', sections=18)
    add_cylinder_between(parts, (1880, 0, 660), (2010, 150, 655), 6, MAT_BLACK, 'plug_wire_L', sections=8)
    add_cylinder_between(parts, (1880, 0, 660), (2010, -150, 655), 6, MAT_BLACK, 'plug_wire_R', sections=8)
    add_cylinder(parts, (1900, 150, 650), (0, 0, 1), 28, 85, MAT_BLACK, 'ignition_coil', sections=18)

    # ---- オイルフィラーキャップ ----
    add_cylinder(parts, (2080, 60, 600), (0, 0, 1), 22, 30, MAT_ALU_BRIGHT, 'oil_filler_base', sections=16)
    add_cylinder(parts, (2080, 60, 623), (0, 0, 1), 27, 14, MAT_BLACK, 'oil_filler_cap', sections=16)

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
    print(f'engine parts: {len(parts)}  faces: {n_faces}  verts: {n_verts}')
    print(f'bbox mm: x[{bmin[0]:.0f},{bmax[0]:.0f}] y[{bmin[1]:.0f},{bmax[1]:.0f}] z[{bmin[2]:.0f},{bmax[2]:.0f}]')
    print(f'-> {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
