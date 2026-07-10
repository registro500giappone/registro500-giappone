# -*- coding: utf-8 -*-
"""
FIAT 110F型 ダッシュボード(メーターパネル)一式 プロシージャル生成スクリプト
(配線/パーツビューア用): パネル本体＋丸型スピードメーター＋スイッチ類＋
インジケーターランプ

車体3Dモデル(body_f_v2.glb)と同じ実車mm座標系(x=前軸0・後方+ / y=左+ /
z=地面0・上+、LHD)で、trimeshのプリミティブを組み合わせて直接配置する。
build_engine.py / build_front_parts.py と同じヘルパー関数構成を踏襲。

形状の主参照:
    実車のFIAT 500F ダッシュボードは「鉄板一枚＋丸型Veglia速度計1個」の
    極めて簡素な構成。速度計(丸型・白文字盤ではなく黒文字盤)の盤面内に
    警告灯(発電機チャージ=赤・ライト=緑・燃料残量=アンバー)が組み込まれ、
    パネル中央にイグニッションキー・ライトスイッチ・ワイパースイッチが並ぶ。

配置の根拠:
    wiring/data/f.json の以下ノードの pos3d をアンカーに使用(f.json自体は
    変更しない):
      speedometer [460, 280, 800] (丸型メーター・運転席正面)
      indicator   [465, 270, 800] (メーター盤面内の警告灯)
      ignition_sw [470, 130, 760] (メーター右の中央寄り)
    パネル面 x≈470・z≈760〜800 は POSITION_GUIDE.md §1 のランドマーク
    「ダッシュパネル面」に一致。パネルの左右幅はボディ内壁(±658の内側)に
    収まる ±540 とした。

再生成手順:
    cd wiring/tools
    python build_dashboard.py
    # -> ../assets/dashboard_110f.glb を上書き生成。標準出力に部品数・面数・
    #    バウンディングボックスを表示する。

寸法根拠のメモ:
    - パネル本体: 幅(y)1080 x 高さ(z)170 x 厚み(x)22 の薄板、
      中心 (481, 0, 775)。下縁に幅広の棚(パーセルトレイ)は省略。
    - スピードメーター: 実車Veglia計は可視径約105mm。ここでは盤面半径60mm
      (f.json shape size[60,60,40] と整合)・奥行き45mmのポッドとして
      パネルから運転席側(+x)へ14mm突出させる。ベゼル=クロームトーラス、
      盤面=黒円盤、針=細い箱、盤面下部に警告灯3点(赤/緑/アンバー)。
      ※初版は文字盤を誤って-x(トランク側)向きに生成しPlaywright実機検証で
      発覚(パネルに全隠れ)。運転者は x>492 側なので+x向きが正。
    - スイッチ類: イグニッションキーシリンダー(y=130)を中心に、ライト
      スイッチ(y=190)・ワイパースイッチ(y=70)のトグル2個を左右に配置。
      各スイッチはベース円筒+レバー小円柱。
"""
import os
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dashboard_110f.glb')

# ============ マテリアル ============

def mat(name, rgb_0_255, metallic=0.5, roughness=0.5, alpha=255):
    r, g, b = rgb_0_255
    return PBRMaterial(
        name=name,
        baseColorFactor=[r / 255.0, g / 255.0, b / 255.0, alpha / 255.0],
        metallicFactor=metallic, roughnessFactor=roughness,
    )

MAT_PANEL      = mat('dash_panel', (0xB8, 0xB4, 0xAA), metallic=0.35, roughness=0.55)
MAT_BEZEL      = mat('dash_bezel_chrome', (0xD8, 0xDC, 0xE0), metallic=0.95, roughness=0.1)
MAT_DIAL_FACE  = mat('dash_dial_face', (0x1C, 0x1E, 0x20), metallic=0.05, roughness=0.6)
MAT_NEEDLE     = mat('dash_needle', (0xE8, 0x60, 0x20), metallic=0.2, roughness=0.4)
MAT_POD        = mat('dash_pod', (0x2E, 0x30, 0x33), metallic=0.3, roughness=0.55)
MAT_SW_BASE    = mat('dash_switch_base', (0x3A, 0x3C, 0x40), metallic=0.4, roughness=0.5)
MAT_SW_LEVER   = mat('dash_switch_lever', (0xC8, 0xCC, 0xD0), metallic=0.85, roughness=0.25)
MAT_KEY        = mat('dash_key_cylinder', (0xB8, 0xBC, 0xC0), metallic=0.8, roughness=0.3)
MAT_LAMP_RED   = mat('dash_lamp_red', (0xD0, 0x20, 0x20), metallic=0.1, roughness=0.3)
MAT_LAMP_GREEN = mat('dash_lamp_green', (0x20, 0xB0, 0x40), metallic=0.1, roughness=0.3)
MAT_LAMP_AMBER = mat('dash_lamp_amber', (0xE0, 0xA0, 0x20), metallic=0.1, roughness=0.3)

# ============ ジオメトリ・ヘルパー (build_engine.py と共通の構成) ============

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


def add_torus(parts, center, direction, major_r, minor_r, material, name,
              major_sections=24, minor_sections=10):
    m = trimesh.creation.torus(major_radius=major_r, minor_radius=minor_r,
                                major_sections=major_sections, minor_sections=minor_sections)
    m.apply_transform(_align_transform(direction))
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


# ============ 部品配置本体 ============

PANEL_FRONT_X = 470   # パネル前面(トランク側)。POSITION_GUIDE「ダッシュパネル面 x≈470」
PANEL_THICK = 22
CABIN_FACE_X = PANEL_FRONT_X + PANEL_THICK  # =492 運転席側の面。運転者は x>492 側にいる


def build_panel(parts):
    """メーターパネル本体(薄板)。運転席側の面は x=492。"""
    add_box(parts, (PANEL_FRONT_X + PANEL_THICK / 2, 0, 775), (PANEL_THICK, 1080, 170),
            MAT_PANEL, 'dash_panel')


def build_speedometer(parts):
    """丸型スピードメーター(Veglia風)。アンカー: f.json speedometer [460,280,800]。
    文字盤・針は運転席側(+x)を向く。"""
    cy, cz = 280, 800
    face_x = CABIN_FACE_X + 14  # パネル運転席側面から+xへ14mm突出(車体GLB内装スキンより手前)
    r = 60

    # ポッド(奥行き45mm・パネル側(-x)へ埋まる)
    add_cylinder(parts, (face_x - 24, cy, cz), (1, 0, 0), r - 2, 45, MAT_POD,
                 'speedo_pod', sections=24)
    # 盤面(黒)
    add_cylinder(parts, (face_x, cy, cz), (1, 0, 0), r - 6, 4, MAT_DIAL_FACE,
                 'speedo_face', sections=24)
    # ベゼル(クロームリング)
    add_torus(parts, (face_x, cy, cz), (1, 0, 0), r - 3, 5, MAT_BEZEL,
              'speedo_bezel', major_sections=24, minor_sections=10)
    # 針(中心ハブ+細長い箱・約40km/h指示の斜め姿勢)
    add_cylinder(parts, (face_x + 4, cy, cz), (1, 0, 0), 6, 6, MAT_NEEDLE,
                 'speedo_hub', sections=12)
    needle = trimesh.creation.box(extents=[3, 44, 5])
    ang = np.radians(35)  # 文字盤左上方向
    rot = trimesh.transformations.rotation_matrix(ang, [1, 0, 0])
    needle.apply_transform(rot)
    needle.apply_translation([face_x + 4, cy + 18 * np.cos(ang), cz + 18 * np.sin(ang)])
    parts.append(_set_material(needle, MAT_NEEDLE, 'speedo_needle'))

    # 盤面下部の警告灯3点(左から: 緑=ライト・赤=発電機チャージ・アンバー=燃料残量)
    # f.json indicator [465,270,800] はこのうちのメーター内警告灯を指す
    lamp_z = cz - 32
    for name, y_off, m in (('indicator_lights_green', 22, MAT_LAMP_GREEN),
                            ('indicator_charge_red', 0, MAT_LAMP_RED),
                            ('indicator_fuel_amber', -22, MAT_LAMP_AMBER)):
        add_cylinder(parts, (face_x + 3, cy + y_off, lamp_z), (1, 0, 0), 6, 5, m,
                     name, sections=12)


def build_switches(parts):
    """スイッチ類。アンカー: f.json ignition_sw [470,130,760]。
    実車はメーター右の中央寄りにキー・その両脇にライト/ワイパーのトグル。
    キー・レバーは運転席側(+x)へ突出する。"""
    sw_z = 760
    face_x = CABIN_FACE_X + 8

    # イグニッションキーシリンダー(y=130)
    add_cylinder(parts, (face_x + 4, 130, sw_z), (1, 0, 0), 14, 26, MAT_KEY,
                 'ignition_switch', sections=16)
    add_box(parts, (face_x + 20, 130, sw_z), (10, 6, 22), MAT_KEY, 'ignition_key')

    # トグルスイッチ2個(ライト y=190 / ワイパー y=70)
    for name, y in (('light_switch', 190), ('wiper_switch', 70)):
        add_cylinder(parts, (face_x + 2, y, sw_z), (1, 0, 0), 10, 8, MAT_SW_BASE,
                     f'{name}_base', sections=14)
        # レバー(運転席側へ・下向きに少し傾けた小円柱)
        lever_dir = (1, 0, -0.45)
        lever_len = 22
        v = np.asarray(lever_dir, float); v /= np.linalg.norm(v)
        lever_center = np.array([face_x + 2, y, sw_z]) + v * lever_len / 2
        add_cylinder(parts, lever_center, lever_dir, 3.5, lever_len, MAT_SW_LEVER,
                     f'{name}_lever', sections=10)


def build_parts():
    parts = []
    build_panel(parts)
    build_speedometer(parts)
    build_switches(parts)
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
    print(f'dashboard parts: {len(parts)}  faces: {n_faces}  verts: {n_verts}')
    print('names:', [m.metadata.get('name') for m in parts])
    print(f'bbox mm: x[{bmin[0]:.0f},{bmax[0]:.0f}] y[{bmin[1]:.0f},{bmax[1]:.0f}] z[{bmin[2]:.0f},{bmax[2]:.0f}]')
    print(f'-> {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
