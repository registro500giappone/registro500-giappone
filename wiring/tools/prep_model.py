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


def cluster_wheels(tire_positions_mm):
    """タイヤ(viewer mm座標)を前後(X)・左右(Y)の中央値で4象限に分け、各ホイールの中心とタイヤ半径を推定する。
    厚みゼロの平板メッシュしか無い元モデルに対し、index.html側で本物の3Dトーラスタイヤを
    生成し直すためのメタデータ。"""
    pts = tire_positions_mm
    # 'tire'分類に紛れ込んだ地上高の高い誤検出(幌など)を除外。実車のタイヤは接地面〜700mm程度に収まる
    pts = pts[pts[:, 2] < 700]
    x_med = np.median(pts[:, 0])
    y_med = np.median(pts[:, 1])
    wheels = []
    for x_is_front in (True, False):
        for y_is_left in (True, False):
            mask = ((pts[:, 0] < x_med) == x_is_front) & ((pts[:, 1] < y_med) == y_is_left)
            if mask.sum() < 20:
                continue
            sub = pts[mask]
            center = sub.mean(axis=0)
            radius = float((sub[:, 2].max() - sub[:, 2].min()) / 2)
            hub_z = float(sub[:, 2].min() + radius)  # 接地面(z最小)から半径分上=ハブ中心の高さ
            wheels.append({
                'center': [float(center[0]), float(center[1]), hub_z],
                'radius': radius,
            })
    return wheels


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
    args = ap.parse_args()

    prims = collect_world_primitives(args.input_gltf)
    transform, scale, info = compute_transform(prims, args.real_length_mm, args.front_overhang_mm)
    print('scale(model->mm) =', scale)
    print('info:', info)

    cats = {}
    for p in prims:
        cats[p['category']] = cats.get(p['category'], 0) + 1
    print('category primitive counts:', cats)

    merged = merge_by_category(prims, transform)
    for cat, m in merged.items():
        print(f"  {cat}: {m['positions'].shape[0]} verts, {m['indices'].shape[0]//3} tris")

    if 'tire' in merged:
        wheels = cluster_wheels(merged['tire']['positions'])
        chrome_pos = merged['chrome']['positions'] if 'chrome' in merged else None
        wheels = estimate_chrome_rim_radius(chrome_pos, wheels)
        print('wheels (center=[X,Y,hub_z], radius, chrome_radius):')
        for w in wheels:
            print('  ', w)
        # 実車のタイヤ半径として妥当な範囲(150-400mm)を外れる場合は分類ミス(他パーツ混入)とみなし出力しない
        radii = [w['radius'] for w in wheels]
        median_r = sorted(radii)[len(radii)//2] if radii else 0
        if len(wheels) == 4 and 150 <= median_r <= 400:
            import json
            wheels_path = args.output_glb.rsplit('.', 1)[0] + '_wheels.json'
            with open(wheels_path, 'w', encoding='utf-8') as f:
                json.dump(wheels, f)
            print('wrote', wheels_path)
        else:
            print(f'!! wheels怪しい(median_r={median_r:.0f}mm) のためwheels.jsonは出力しない(平板タイヤのままにフォールバック)')

    write_glb(merged, args.output_glb)
    print('wrote', args.output_glb)


if __name__ == '__main__':
    main()
