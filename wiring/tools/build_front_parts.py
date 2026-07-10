# -*- coding: utf-8 -*-
"""
FIAT 110F型 フロント（前部トランク）パーツ一式 プロシージャル生成スクリプト
(配線/パーツビューア用): 燃料タンク＋左右ヘッドライトユニット

車体3Dモデル(body_f_v2.glb)と同じ実車mm座標系(x=前軸0・後方+ / y=左+ /
z=地面0・上+、LHD)で、trimeshのプリミティブ(box/cylinder/球/トーラス)を
組み合わせて直接この座標系上に配置する。build_engine.py と同じヘルパー関数
構成を踏襲している。

形状・配置の根拠:
    - 燃料タンク: FIAT 500系はフロントトランク床(前軸直前、ノーズ側)に横長の
      平たいタンク(実車約21L)を寝かせて搭載し、給油キャップは上面（ボンネットを
      開けて給油）。ローカル一次資料に専用図はないため、実車一般知識＋
      wiring/POSITION_GUIDE.md のランドマーク(前部トランク床 z≈420、車体X範囲
      -448〜2461、前軸x=0)から配置した「要確認」ドラフト。参照した透視図:
      manual_110F_L_figures/p22.png・p24.png（潤滑ポイント図。トランク床の
      奥行き感の参考にした程度で、タンク自体は描かれていない）。
    - ヘッドライトユニット: 当初は f.json の lamp_fl/lamp_fr ノード(pos3d=
      [-420, ±455, 430])をアンカー流用する想定だったが、実機検証(後述)で
      これは「ヘッドライト下のウインカー」位置(pos3d_source本文にも
      「ヘッドライト下」と明記)であり、本物のヘッドライトではないと判明。
      body_f_v2.glb には別途 "glass"(ヘッドライトレンズ) / "chrome"(リム)と
      命名済みの丸い凹み形状が既に存在するため、three.js Raycaster による
      実測(下記スクリプト参照)でその中心を測定し直した:
        中心 ≈ (x=-409, y=±418, z=578)、可視半径 ≈ 82mm
      (実測コード: scratchpad/preview.html + Playwright、body側 "glass" メッシュに
      ヒットする光線を格子状に飛ばして交点を平均。開口面(外側)がx≈-409、
      奥側(内側)がx≈-387で、凹みの深さはごく浅い(~20mm)ローポリ形状)。
      本スクリプトのリフレクター椀等はこの実測中心にネストするよう配置し、
      lamp_fl/fr(ウインカー)の座標は使用しない。光軸は車体前方(-x方向)。

再生成手順:
    cd wiring/tools
    python build_front_parts.py
    # -> ../assets/front_parts_110f.glb を上書き生成。標準出力に部品数・面数・
    #    バウンディングボックスを表示する。

寸法根拠のメモ:
    - タンク: 幅(y)550 / 奥行(x)300 / 高さ(z)200 目安。下段ボックス(300,550,140)
      +上段ボックス(260,480,70)の2段積みで、平たい台形断面を簡易的に表現。
      中心 x=-160(トランク床、車体ノーズ-448と前軸0の間) / y=-40(中心よりやや
      右寄り=助手席側) / z≈500-700(トランク床z≈420の直上)。
    - ヘッドライト: リフレクター椀=楕円体(半径 y/z≈82, x方向のみ40に圧縮)を
      前面が実測アンカー x=-409 に一致するよう車体側へ押し込んで配置。リム=
      トーラス(major_r=82, minor_r=7)を実測アンカー位置に、レンズ=薄い半透明
      円盤(半径78)、バルブ=小球(暖色)を椀の奥に配置。
"""
import os
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'front_parts_110f.glb')

# ============ マテリアル ============

def mat(name, rgb_0_255, metallic=0.5, roughness=0.5, alpha=255):
    r, g, b = rgb_0_255
    return PBRMaterial(
        name=name,
        baseColorFactor=[r / 255.0, g / 255.0, b / 255.0, alpha / 255.0],
        metallicFactor=metallic, roughnessFactor=roughness,
    )

MAT_TANK_BODY  = mat('fuel_tank_body', (0xC9, 0xCB, 0xC2), metallic=0.25, roughness=0.55)
MAT_TANK_CAP   = mat('fuel_tank_cap', (0xB8, 0xBC, 0xC0), metallic=0.8, roughness=0.3)
MAT_FUEL_LINE  = mat('fuel_line', (0x2A, 0x2C, 0x2E), metallic=0.2, roughness=0.65)
MAT_REFLECTOR  = mat('headlight_reflector', (0xE8, 0xEC, 0xF0), metallic=0.9, roughness=0.15)
MAT_RIM_CHROME = mat('headlight_rim', (0xD8, 0xDC, 0xE0), metallic=0.95, roughness=0.1)
MAT_LENS_GLASS = mat('headlight_lens', (0xEA, 0xF4, 0xFF), metallic=0.05, roughness=0.05, alpha=140)
MAT_BULB       = mat('headlight_bulb', (0xFF, 0xE8, 0xB0), metallic=0.1, roughness=0.3)

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


def add_cylinder_between(parts, p0, p1, radius, material, name, sections=16):
    p0 = np.asarray(p0, dtype=float); p1 = np.asarray(p1, dtype=float)
    v = p1 - p0
    h = float(np.linalg.norm(v))
    return add_cylinder(parts, (p0 + p1) / 2, v, radius, h, material, name, sections=sections)


def add_sphere(parts, center, radius, material, name, scale=(1.0, 1.0, 1.0), subdiv=2):
    """球/楕円体。scale=(sx,sy,sz) はワールド軸方向にそのまま適用(ローカル回転なし)。"""
    m = trimesh.creation.icosphere(subdivisions=subdiv, radius=radius)
    if scale != (1.0, 1.0, 1.0):
        m.apply_scale(list(scale))
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


def add_torus(parts, center, direction, major_r, minor_r, material, name,
              major_sections=24, minor_sections=10):
    """direction を軸とするトーラス(リング)。ヘッドライトのリムに使用。"""
    m = trimesh.creation.torus(major_radius=major_r, minor_radius=minor_r,
                                major_sections=major_sections, minor_sections=minor_sections)
    m.apply_transform(_align_transform(direction))
    m.apply_translation(center)
    parts.append(_set_material(m, material, name))
    return m


# ============ 部品配置本体 ============

def build_fuel_tank(parts):
    """フロントトランク内・燃料タンク一式。中心座標系はワールドmm。"""
    # 下段(大)+上段(小)の2段ボックスで平たい台形断面を簡易表現
    tank_x, tank_y = -160, -40  # やや右寄り(助手席側)
    floor_z = 430  # トランク床 (POSITION_GUIDE: 前部トランク床 z≈420 の直上)

    lower_h = 140
    upper_h = 70
    lower_center_z = floor_z + lower_h / 2
    upper_center_z = floor_z + lower_h + upper_h / 2

    add_box(parts, (tank_x, tank_y, lower_center_z), (300, 550, lower_h),
            MAT_TANK_BODY, 'fuel_tank_lower')
    add_box(parts, (tank_x, tank_y, upper_center_z), (260, 480, upper_h),
            MAT_TANK_BODY, 'fuel_tank_upper')

    top_z = floor_z + lower_h + upper_h  # =640

    # 給油キャップ(上面、やや右寄りの手前側)
    cap_center = (tank_x - 10, tank_y + 130, top_z + 22)
    add_cylinder(parts, cap_center, (0, 0, 1), 35, 40, MAT_TANK_CAP, 'fuel_filler_cap', sections=18)
    add_cylinder(parts, (cap_center[0], cap_center[1], top_z + 3), (0, 0, 1), 28, 12,
                 MAT_TANK_CAP, 'fuel_filler_neck', sections=18)

    # 燃料コック/出口配管(タンク底面から少し下へ、後方(+x)のエンジンへ向かう取り出し口の
    # 短いスタブのみ。全長の配管はスコープ外)
    petcock_top = (tank_x + 80, tank_y - 150, floor_z)
    petcock_bottom = (tank_x + 80, tank_y - 150, floor_z - 45)
    add_cylinder_between(parts, petcock_top, petcock_bottom, 14, MAT_FUEL_LINE, 'fuel_petcock', sections=12)
    line_bend = (tank_x + 160, tank_y - 150, floor_z - 55)
    add_cylinder_between(parts, petcock_bottom, line_bend, 8, MAT_FUEL_LINE, 'fuel_line_stub', sections=10)


def build_headlight(parts, side, sign):
    """側(side='L'/'R', sign=+1/-1(=y符号))のヘッドライトユニット一式。

    アンカー: body_f_v2.glb に既存の "glass"/"chrome" 命名メッシュ(ヘッドライト
    レンズ・リムの低ポリ凹み)を three.js Raycaster で実測した中心
    (x=-409, y=sign*418, z=578, 可視半径≈82mm)。f.json の lamp_fl/lamp_fr
    (pos3d=[-420,±455,430])は「ヘッドライト下のウインカー」であり別物なので
    使用しない(POSITION_GUIDE.md 上のこのノードの pos3d_source にも
    「ヘッドライト下」と明記されている)。"""
    cx, cy, cz = -409, sign * 418, 578
    radius = 82
    depth_half = 40  # リフレクター椀の前後(x)方向の圧縮半径

    # リフレクター椀: 楕円体(半径82/82、x方向のみ40に圧縮)。前面が実測アンカーx(-409)に
    # 一致するよう、椀の中心を車体側(+x方向)へ depth_half だけ押し込む。
    bowl_center = (cx + depth_half, cy, cz)
    add_sphere(parts, bowl_center, radius, MAT_REFLECTOR, f'headlight_{side}_reflector',
               scale=(depth_half / radius, 1.0, 1.0), subdiv=2)

    # リム(トーラス): アンカー位置(開口部)に、軸を車体前方(-x)へ向けて配置
    add_torus(parts, (cx, cy, cz), (1, 0, 0), radius, 7, MAT_RIM_CHROME, f'headlight_{side}_rim',
              major_sections=24, minor_sections=10)

    # レンズ(薄い半透明円盤): リムのすぐ前面
    add_cylinder(parts, (cx - 4, cy, cz), (1, 0, 0), radius - 4, 8, MAT_LENS_GLASS,
                 f'headlight_{side}_lens', sections=24)

    # バルブ(椀の奥の小球)
    bulb_center = (cx + depth_half + 12, cy, cz)
    add_sphere(parts, bulb_center, 16, MAT_BULB, f'headlight_{side}_bulb', subdiv=1)


def build_parts():
    parts = []
    build_fuel_tank(parts)
    build_headlight(parts, 'L', +1)
    build_headlight(parts, 'R', -1)
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
    print(f'front parts: {len(parts)}  faces: {n_faces}  verts: {n_verts}')
    print('names:', [m.metadata.get('name') for m in parts])
    print(f'bbox mm: x[{bmin[0]:.0f},{bmax[0]:.0f}] y[{bmin[1]:.0f},{bmax[1]:.0f}] z[{bmin[2]:.0f},{bmax[2]:.0f}]')
    print(f'-> {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
