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


def build_rear_lamp(parts, side, sign):
    """リアテールランプ(ブレーキ/ウインカー一体・縦長2色)。
    アンカー: f.json lamp_rl/rr [2300, ±430, 480]・表皮実測 x≈2360。
    上=アンバー(ウインカー)・下=赤(テール&ブレーキ)。"""
    skin_x, cy, cz = 2355, sign * 430, 480
    # ガスケット+クローム台座(縦長楕円柱)
    # align_vectors([0,0,1],[1,0,0]) はY軸回りの90度回転で、ローカルX→ワールド-Z・
    # ローカルY→ワールドYに写る。縦長(ワールドz方向)にするにはローカルXを拡大する。
    tf = _align_transform((1, 0, 0))
    base = trimesh.creation.cylinder(radius=30, height=10, sections=18)
    base.apply_scale([1.9, 1.0, 1.0])
    base.apply_transform(tf)
    base.apply_translation((skin_x + 3, cy, cz))
    parts.append(_set_material(base, MAT_GASKET, f'rear_lamp_{side}_gasket'))

    base2 = trimesh.creation.cylinder(radius=27, height=10, sections=18)
    base2.apply_scale([1.85, 1.0, 1.0])
    base2.apply_transform(tf)
    base2.apply_translation((skin_x + 9, cy, cz))
    parts.append(_set_material(base2, MAT_CHROME, f'rear_lamp_{side}_base'))

    # 上段アンバー(ウインカー)・下段赤(ブレーキ/テール)の2ドーム
    add_dome(parts, (skin_x + 13, cy, cz + 26), (1, 0, 0), 21, MAT_LENS_AMBER,
             f'rear_lamp_{side}_turn_lens', squash=0.7)
    add_dome(parts, (skin_x + 13, cy, cz - 22), (1, 0, 0), 24, MAT_LENS_RED,
             f'rear_lamp_{side}_brake_lens', squash=0.7)


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
