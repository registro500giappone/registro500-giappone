"""
prep_model.py が生成した body_{tag}_v2.glb と wheels JSON の数値検証（回帰チェック）。

2026-07-08のタイヤ位置バグ（マテリアル誤分類→偽ホイール中心）の再発を検知する。
D/R型など新モデル追加時にも同じチェックを使う。

使い方:
  python check_model.py ../assets/body_f_v2.glb --wheelbase-mm 1840
（wheels JSONは <glb名から.glbを除いた名前>_wheels.json を自動で読む）
"""
import argparse
import json
import sys
import numpy as np
from pygltflib import GLTF2

COMPONENT_DTYPE = {5120: np.int8, 5121: np.uint8, 5122: np.int16,
                   5123: np.uint16, 5125: np.uint32, 5126: np.float32}
INT_NORM_DIVISOR = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}


def node_positions_mm(g, blob, node):
    """量子化(KHR_mesh_quantization: 正規化int16 + node scale/translation)にも
    素のfloat32にも対応して、ノードの頂点を実mm座標で返す。"""
    prim = g.meshes[node.mesh].primitives[0]
    a = g.accessors[prim.attributes.POSITION]
    bv = g.bufferViews[a.bufferView]
    off = (bv.byteOffset or 0) + (a.byteOffset or 0)
    dt = COMPONENT_DTYPE[a.componentType]
    comp_bytes = np.dtype(dt).itemsize
    stride = bv.byteStride or comp_bytes * 3
    n_comp = stride // comp_bytes  # パディング込みの1頂点あたり要素数
    raw = np.frombuffer(blob, dtype=dt, count=a.count * n_comp, offset=off)
    pos = raw.reshape(a.count, n_comp)[:, :3].astype(np.float64)
    if a.normalized:
        pos = pos / INT_NORM_DIVISOR[a.componentType]
    if node.scale:
        pos = pos * np.array(node.scale)
    if node.translation:
        pos = pos + np.array(node.translation)
    return pos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('glb')
    ap.add_argument('--wheelbase-mm', type=float, required=True)
    args = ap.parse_args()

    g = GLTF2().load(args.glb)
    blob = g.binary_blob()
    axles = [0.0, args.wheelbase_mm]
    failures = []

    def check(cond, msg):
        print(('  OK ' if cond else '  NG ') + msg)
        if not cond:
            failures.append(msg)

    # --- 1. wheels JSON: 4輪が実車軸位置・実車寸法か ---
    wheels_path = args.glb.rsplit('.', 1)[0] + '_wheels.json'
    with open(wheels_path, encoding='utf-8') as f:
        wheels = json.load(f)
    print(f'[wheels] {wheels_path}')
    check(len(wheels) == 4, f'4輪検出 (実際: {len(wheels)})')
    for w in wheels:
        cx, cy, cz = w['center']
        r = w['radius']
        near_axle = min(abs(cx - ax) for ax in axles)
        check(near_axle < 40, f'中心X={cx:.0f} が軸位置から±40mm以内 (ずれ{near_axle:.0f}mm)')
        check(500 <= abs(cy) <= 660, f'中心|Y|={abs(cy):.0f} が500〜660mm (トレッド実車相当)')
        check(200 <= cz <= 300, f'中心Z={cz:.0f} が200〜300mm (ハブ高さ)')
        check(200 <= r <= 300, f'半径={r:.0f} が200〜300mm')
    for base, name in ((0, '前軸'), (2, '後軸')):
        y_l, y_r = wheels[base]['center'][1], wheels[base + 1]['center'][1]
        check(abs(y_l + y_r) < 60, f'{name}の左右対称性 (YL={y_l:.0f}, YR={y_r:.0f})')

    # --- 2. カテゴリごとのbboxが実車寸法内か ---
    for node in g.nodes:
        if node.mesh is None:
            continue
        pos = node_positions_mm(g, blob, node)
        mn, mx = pos.min(axis=0), pos.max(axis=0)
        print(f'[{node.name}] X[{mn[0]:.0f},{mx[0]:.0f}] Y[{mn[1]:.0f},{mx[1]:.0f}] Z[{mn[2]:.0f},{mx[2]:.0f}]')
        check(mn[0] > -550 and mx[0] < 2500, f'{node.name}: X範囲が実車全長内')
        # tireノードは操舵角付き前輪(L型)が外側へ張り出すぶん許容を広げる(非表示ノード)
        y_lim = 760 if node.name == 'tire' else 700
        check(abs(mn[1]) < y_lim and abs(mx[1]) < y_lim, f'{node.name}: |Y|<{y_lim}mm (実車全幅内)')
        check(mn[2] > -30 and mx[2] < 1400, f'{node.name}: Z範囲が実車全高内')
        # tireノードはビューアが丸ごと非表示にするため、ゴム/幌類の誤混入は無害
        # (bodyへ戻すと車体外皮とZファイティングを起こすので、あえて放置する設計)。
        # ここでは情報表示のみ行う。
        if node.name == 'tire' and len(pos):
            in_zone = np.zeros(len(pos), dtype=bool)
            for ax in axles:
                in_zone |= ((np.abs(pos[:, 0] - ax) < 420)
                            & (np.abs(pos[:, 1]) > 330) & (pos[:, 2] < 700))
            print(f'  情報: tire頂点(非表示ノード)のうち車輪領域内 {in_zone.mean():.1%}・総数 {len(pos)}')

    print()
    if failures:
        print(f'!! 検証失敗 {len(failures)}件')
        sys.exit(1)
    print('全チェック通過')


if __name__ == '__main__':
    main()
