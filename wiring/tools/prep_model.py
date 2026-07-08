"""
Sketchfab CC-BY 既製モデル(gltf)を実車座標(mm, X=前軸0/後方+, Y=左+, Z=上)に整列し、
パーツ分類（body/glass/tire/rim/chrome/interior）ごとにマージした軽量glbへ変換する。

入力: scene.gltf + scene.bin (Sketchfabダウンロードそのまま。テクスチャは読み捨てる)
出力: wiring/assets/body_{tag}_v2.glb (ノード名 = カテゴリ名、マテリアル無し・ジオメトリのみ)

使い方:
  python prep_model.py <input_scene.gltf> <output.glb> --real-length-mm 2970 --wheelbase-mm 1840 --front-overhang-mm 509
"""
import argparse
import struct
import numpy as np
from pygltflib import (
    GLTF2, Scene, Node, Mesh, Primitive, Accessor, BufferView, Buffer,
    ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, FLOAT, UNSIGNED_INT, UNSIGNED_SHORT,
)

CATEGORY_KEYWORDS = {
    'glass':    ['scheibe', 'glass', 'fenster', 'windschutz'],
    'tire':     ['reifen', 'tire', 'profil', 'tyre'],
    'chrome':   ['chrome', 'silver', 'stossstange', 'bumper', 'leiste'],
    'rim':      ['felge', 'rim'],
    'interior': ['innenraum', 'sitz', 'interior', 'armaturen', 'dach'],
}
CATEGORY_ORDER = ['body', 'glass', 'tire', 'rim', 'chrome', 'interior']


def load_gltf_utf8(path):
    with open(path, 'r', encoding='utf-8') as f:
        return GLTF2.gltf_from_json(f.read())


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2*(y*y+z*z), 2*(x*y-z*w),     2*(x*z+y*w)],
        [2*(x*y+z*w),     1 - 2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w),     2*(y*z+x*w),     1 - 2*(x*x+y*y)],
    ])


def node_local_matrix(n):
    if n.matrix is not None:
        return np.array(n.matrix, dtype=np.float64).reshape(4, 4).T
    T = np.eye(4)
    if n.translation:
        T[0:3, 3] = n.translation
    R = np.eye(4)
    if n.rotation:
        R[0:3, 0:3] = quat_to_mat(n.rotation)
    S = np.eye(4)
    if n.scale:
        S[0, 0], S[1, 1], S[2, 2] = n.scale
    return T @ R @ S


def accessor_data(g, blob, acc_idx):
    comp_type_map = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
    comp_size_map = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    type_count_map = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
    acc = g.accessors[acc_idx]
    bv = g.bufferViews[acc.bufferView]
    ncomp = type_count_map[acc.type]
    fmt = comp_type_map[acc.componentType]
    csize = comp_size_map[acc.componentType]
    offset = (bv.byteOffset or 0) + (acc.byteOffset or 0)
    stride = bv.byteStride or (csize * ncomp)
    out = np.zeros((acc.count, ncomp), dtype=np.float64)
    for i in range(acc.count):
        base = offset + i * stride
        out[i] = struct.unpack_from('<' + fmt * ncomp, blob, base)
    return out


def classify_material(mat):
    name = (mat.name or '').lower() if mat is not None else ''
    for cat, kws in CATEGORY_KEYWORDS.items():
        if any(kw in name for kw in kws):
            return cat
    if mat is None:
        return 'body'
    pbr = mat.pbrMetallicRoughness
    bc = (pbr.baseColorFactor if pbr and pbr.baseColorFactor else [1, 1, 1, 1])
    metal = pbr.metallicFactor if (pbr and pbr.metallicFactor is not None) else 1.0
    rough = pbr.roughnessFactor if (pbr and pbr.roughnessFactor is not None) else 1.0
    alpha = bc[3]
    lum = sum(bc[:3]) / 3
    if mat.alphaMode == 'BLEND' or alpha < 0.9:
        return 'glass'
    if lum < 0.15 and rough > 0.7:
        return 'tire'
    if metal > 0.6 and rough < 0.25 and lum > 0.5:
        return 'chrome'
    return 'body'


def collect_world_primitives(path):
    g = load_gltf_utf8(path)
    blob = g.binary_blob()
    if blob is None:
        import os
        with open(os.path.join(os.path.dirname(path), g.buffers[0].uri), 'rb') as f:
            blob = f.read()

    scene = g.scenes[g.scene or 0]
    out = []  # list of dict(category=, positions=(N,3), indices=(M,))

    def walk(node_idx, parent_mat):
        n = g.nodes[node_idx]
        mat = parent_mat @ node_local_matrix(n)
        if n.mesh is not None:
            mesh = g.meshes[n.mesh]
            for prim in mesh.primitives:
                if prim.attributes.POSITION is None:
                    continue
                pos = accessor_data(g, blob, prim.attributes.POSITION)
                pos_h = np.hstack([pos, np.ones((pos.shape[0], 1))])
                world = (mat @ pos_h.T).T[:, :3]
                if prim.indices is not None:
                    idx = accessor_data(g, blob, prim.indices).flatten().astype(np.uint32)
                else:
                    idx = np.arange(world.shape[0], dtype=np.uint32)
                gmat = g.materials[prim.material] if prim.material is not None else None
                cat = classify_material(gmat)
                out.append({'category': cat, 'positions': world, 'indices': idx})
        for c in (n.children or []):
            walk(c, mat)

    for root_idx in scene.nodes:
        walk(root_idx, np.eye(4))
    return out


def compute_transform(prims, real_length_mm, front_overhang_mm):
    all_pos = np.vstack([p['positions'] for p in prims])
    mn = all_pos.min(axis=0)
    mx = all_pos.max(axis=0)
    length_model = mx[2] - mn[2]  # Z = 前後
    scale = real_length_mm / length_model
    ground_y = mn[1]              # Y = 上下、最下点を地面(Z_viewer=0)とする
    front_z = mx[2]               # +Z = 前方（確認済み）
    front_axle_z = front_z - front_overhang_mm / scale

    def transform(pos):
        x, y, z = pos[:, 0], pos[:, 1], pos[:, 2]
        vx = (front_axle_z - z) * scale   # 前軸0・後方+
        vy = -x * scale                   # 左右。実機確認でハンドル/マフラーが左右逆と判明したため反転（2026-07-07）
        vz = (y - ground_y) * scale       # 地面0・上+
        return np.stack([vx, vy, vz], axis=1)

    return transform, scale, dict(length_model=length_model, ground_y=ground_y,
                                   front_z=front_z, front_axle_z=front_axle_z)


def _connected_components(n_verts, indices):
    """三角形の頂点共有関係で連結成分(Union-Find)に分解する。"""
    parent = list(range(n_verts))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    idx = indices.reshape(-1, 3)
    for tri in idx:
        union(int(tri[0]), int(tri[1]))
        union(int(tri[1]), int(tri[2]))
    groups = {}
    for v in range(n_verts):
        groups.setdefault(find(v), []).append(v)
    return list(groups.values())


# 車輪捕捉領域: 実車の既知寸法から決める(前軸X=0/後軸X=wheelbase)。
# マテリアルのPBRヒューリスティックは車輪の特定には使わない
# (freeReefモデルは全マテリアルが無名acmat_Nで、暗くザラついたルーフ・ドアが
#  tireに誤分類され、そこから推定したホイール中心が完全に壊れていた実績がある)。
WHEEL_ZONE = dict(dx=350, y_min=380, y_max=700, z_max=620)


def detect_wheels(prims, transform, wheelbase_mm):
    """連結成分の重心が車輪捕捉領域(前後軸まわりの円筒)に入るかどうかで車輪を特定する。

    - ホイール中心・半径は、捕捉成分のうち「側面視で丸く・Yに薄く・接地している(zmin<60)」
      成分＝タイヤリングのみから実測する。フェンダー外皮の断片も同じ領域に浮いて
      入り込むが、接地条件で確実に除外できる。
    - **ジオメトリの再分類は一切行わない(計測のみ)**。tireに誤分類されたゴム/幌類
      (ドアシール・サンルーフ等)をbodyへ戻すと、車体外皮と同一面で重なって
      Zファイティング(点滅)を起こすことが実機で判明した(2026-07-08)。tireノードは
      ビューアが丸ごと非表示にするので、誤分類は放置が正解。

    戻り値: wheels[4]。4輪が揃わない・寸法が不自然なら例外で中断する。
    """
    axles = [0.0, float(wheelbase_mm)]
    disc_pts = {}   # (axle_idx, side_idx) -> [接地円盤成分の頂点(mm)]

    def capture(centroid):
        for ai, ax in enumerate(axles):
            if (abs(centroid[0] - ax) < WHEEL_ZONE['dx']
                    and WHEEL_ZONE['y_min'] < abs(centroid[1]) < WHEEL_ZONE['y_max']
                    and centroid[2] < WHEEL_ZONE['z_max']):
                return (ai, 0 if centroid[1] > 0 else 1)
        return None

    for p in prims:
        if p['category'] not in ('body', 'tire', 'chrome'):
            continue
        pos_mm = transform(p['positions'])
        for comp in _connected_components(p['positions'].shape[0], p['indices']):
            sub = pos_mm[comp]
            key = capture(sub.mean(axis=0))
            if key is None:
                continue
            mn, mx = sub.min(axis=0), sub.max(axis=0)
            ext = mx - mn
            tire_ring = (mn[2] < 60 and ext[1] < 160
                         and 300 < ext[0] < 560 and 300 < ext[2] < 560
                         and 0.8 < (ext[0] + 1e-9) / (ext[2] + 1e-9) < 1.25)
            if tire_ring:
                disc_pts.setdefault(key, []).append(sub)

    # 4輪のホイール中心・半径を円盤状成分の実測bboxから決定
    wheels = []
    problems = []
    for ai, ax in enumerate(axles):
        for si, side in ((0, '左'), (1, '右')):
            key = (ai, si)
            label = f"{'前' if ai == 0 else '後'}{side}"
            if key not in disc_pts:
                problems.append(f'{label}輪: 円盤状成分が見つからない')
                continue
            pts = np.vstack(disc_pts[key])
            if pts.shape[0] < 100:
                problems.append(f'{label}輪: 頂点数不足({pts.shape[0]})')
                continue
            mn, mx = pts.min(axis=0), pts.max(axis=0)
            radius = float((mx[2] - mn[2]) / 2)
            center = [float((mn[0] + mx[0]) / 2), float((mn[1] + mx[1]) / 2),
                      float(mn[2] + radius)]
            if not (150 <= radius <= 400):
                problems.append(f'{label}輪: 半径{radius:.0f}mmが実車として不自然')
            if abs(center[0] - ax) > 80:
                problems.append(f'{label}輪: 中心X={center[0]:.0f}が軸位置{ax:.0f}から乖離')
            wheels.append({'center': center, 'radius': radius})
    if len(wheels) == 4:
        for ai, base in ((0, 0), (1, 2)):
            y_l, y_r = wheels[base]['center'][1], wheels[base + 1]['center'][1]
            if abs(y_l + y_r) > 60:
                problems.append(f"{'前' if ai == 0 else '後'}軸: 左右非対称(YL={y_l:.0f}, YR={y_r:.0f})")
    if problems or len(wheels) != 4:
        for w in wheels:
            print('  wheel:', w)
        raise SystemExit('!! 車輪検出失敗(壊れたwheels.jsonを出力しないため中断):\n  ' + '\n  '.join(problems))
    return wheels


def merge_by_category(prims, transform):
    grouped = {}
    for p in prims:
        cat = p['category']
        pos_v = transform(p['positions']).astype(np.float32)
        idx = p['indices']
        g = grouped.setdefault(cat, {'positions': [], 'indices': [], 'offset': 0})
        g['indices'].append(idx + g['offset'])
        g['positions'].append(pos_v)
        g['offset'] += pos_v.shape[0]
    merged = {}
    for cat, g in grouped.items():
        merged[cat] = {
            'positions': np.vstack(g['positions']),
            'indices': np.concatenate(g['indices']).astype(np.uint32),
        }
    return merged


def write_glb(merged, out_path):
    g = GLTF2()
    g.scene = 0
    g.scenes = [Scene(nodes=[])]
    g.buffers = [Buffer()]
    g.bufferViews = []
    g.accessors = []
    g.meshes = []
    g.nodes = []

    blob = bytearray()

    def pad4(b):
        while len(b) % 4 != 0:
            b.append(0)

    for cat in CATEGORY_ORDER:
        if cat not in merged:
            continue
        pos = merged[cat]['positions']
        idx = merged[cat]['indices']

        pos_bytes = pos.astype('<f4').tobytes()
        pos_offset = len(blob)
        blob.extend(pos_bytes)
        pad4(blob)
        g.bufferViews.append(BufferView(buffer=0, byteOffset=pos_offset, byteLength=len(pos_bytes), target=ARRAY_BUFFER))
        pos_bv_idx = len(g.bufferViews) - 1
        g.accessors.append(Accessor(
            bufferView=pos_bv_idx, componentType=FLOAT, count=pos.shape[0], type='VEC3',
            min=pos.min(axis=0).tolist(), max=pos.max(axis=0).tolist(),
        ))
        pos_acc_idx = len(g.accessors) - 1

        use_uint = pos.shape[0] > 65535
        idx_dtype = '<u4' if use_uint else '<u2'
        idx_arr = idx.astype(idx_dtype)
        idx_bytes = idx_arr.tobytes()
        idx_offset = len(blob)
        blob.extend(idx_bytes)
        pad4(blob)
        g.bufferViews.append(BufferView(buffer=0, byteOffset=idx_offset, byteLength=len(idx_bytes), target=ELEMENT_ARRAY_BUFFER))
        idx_bv_idx = len(g.bufferViews) - 1
        g.accessors.append(Accessor(
            bufferView=idx_bv_idx,
            componentType=(UNSIGNED_INT if use_uint else UNSIGNED_SHORT),
            count=idx_arr.shape[0], type='SCALAR',
        ))
        idx_acc_idx = len(g.accessors) - 1

        prim = Primitive(attributes={'POSITION': pos_acc_idx}, indices=idx_acc_idx)
        g.meshes.append(Mesh(primitives=[prim], name=cat))
        mesh_idx = len(g.meshes) - 1
        g.nodes.append(Node(mesh=mesh_idx, name=cat))
        node_idx = len(g.nodes) - 1
        g.scenes[0].nodes.append(node_idx)

    g.buffers[0].byteLength = len(blob)
    g.set_binary_blob(bytes(blob))
    g.save_binary(out_path)


def estimate_chrome_rim_radius(chrome_positions_mm, wheels, xy_tol=320):
    """'rim'分類が存在しないモデル(ホイールディスクがchromeに混入)向けに、
    各ホイール中心付近のchrome頂点から局所的な円盤半径を推定する。
    タイヤ(トーラス)がこの円盤を必ず覆うようサイズを合わせるために使う。"""
    if chrome_positions_mm is None or len(chrome_positions_mm) == 0:
        return wheels
    pts = chrome_positions_mm
    for w in wheels:
        cx, cy, cz = w['center']
        dx = pts[:, 0] - cx
        dy = pts[:, 1] - cy
        dist_xy = np.sqrt(dx ** 2 + dy ** 2)
        mask = dist_xy < xy_tol
        sub = pts[mask]
        if sub.shape[0] < 10:
            w['chrome_radius'] = None
            continue
        r = float((sub[:, 2].max() - sub[:, 2].min()) / 2)
        w['chrome_radius'] = r
    return wheels


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input_gltf')
    ap.add_argument('output_glb')
    ap.add_argument('--real-length-mm', type=float, required=True)
    ap.add_argument('--front-overhang-mm', type=float, required=True)
    ap.add_argument('--wheelbase-mm', type=float, required=True)
    args = ap.parse_args()

    prims = collect_world_primitives(args.input_gltf)
    transform, scale, info = compute_transform(prims, args.real_length_mm, args.front_overhang_mm)
    print('scale(model->mm) =', scale)
    print('info:', info)

    cats = {}
    for p in prims:
        cats[p['category']] = cats.get(p['category'], 0) + 1
    print('category primitive counts:', cats)

    wheels = detect_wheels(prims, transform, args.wheelbase_mm)

    merged = merge_by_category(prims, transform)
    for cat, m in merged.items():
        print(f"  {cat}: {m['positions'].shape[0]} verts, {m['indices'].shape[0]//3} tris")

    chrome_pos = merged['chrome']['positions'] if 'chrome' in merged else None
    wheels = estimate_chrome_rim_radius(chrome_pos, wheels)
    print('wheels (center=[X,Y,hub_z], radius, chrome_radius):')
    for w in wheels:
        print('  ', w)
    import json
    wheels_path = args.output_glb.rsplit('.', 1)[0] + '_wheels.json'
    with open(wheels_path, 'w', encoding='utf-8') as f:
        json.dump(wheels, f)
    print('wrote', wheels_path)

    write_glb(merged, args.output_glb)
    print('wrote', args.output_glb)


if __name__ == '__main__':
    main()
