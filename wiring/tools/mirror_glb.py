"""既存GLBのY軸ミラー（左右反転）。RHD→LHD是正用の一回きり外科ツール。
- node.translation[1] を反転
- POSITION(quantized int16) の y を反転（-32768はクランプ）
- accessor min/max の y を swap-negate
- インデックスの巻き順を反転（法線向き保存。法線自体はビューアが読込時に計算）
使い方: python mirror_glb.py in.glb out.glb
"""
import sys
import numpy as np
from pygltflib import GLTF2

COMP_DTYPE = {5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}

def main(inp, outp):
    g = GLTF2().load(inp)
    blob = bytearray(g.binary_blob())

    def acc_view(acc, ncomp):
        bv = g.bufferViews[acc.bufferView]
        dt = COMP_DTYPE[acc.componentType]
        itemsize = np.dtype(dt).itemsize
        stride = bv.byteStride or itemsize * ncomp
        base = (bv.byteOffset or 0) + (acc.byteOffset or 0)
        out = np.empty((acc.count, ncomp), dtype=dt)
        for i in range(acc.count):
            off = base + i * stride
            out[i] = np.frombuffer(blob, dtype=dt, count=ncomp, offset=off)
        return out, base, stride, itemsize

    def acc_write(arr, base, stride, itemsize, ncomp):
        for i in range(arr.shape[0]):
            off = base + i * stride
            blob[off:off + itemsize * ncomp] = arr[i].tobytes()

    done_pos, done_idx = set(), set()
    for node in g.nodes:
        if node.mesh is None:
            continue
        if node.translation:
            node.translation = [node.translation[0], -node.translation[1], node.translation[2]]
        for prim in g.meshes[node.mesh].primitives:
            pi = prim.attributes.POSITION
            if pi not in done_pos:
                done_pos.add(pi)
                acc = g.accessors[pi]
                arr, base, stride, isz = acc_view(acc, 3)
                y = arr[:, 1].astype(np.int32)
                y = np.clip(-y, -32767, 32767) if arr.dtype == np.int16 else -y
                arr[:, 1] = y.astype(arr.dtype)
                acc_write(arr, base, stride, isz, 3)
                if acc.min is not None and acc.max is not None:
                    lo, hi = acc.min[1], acc.max[1]
                    acc.min[1], acc.max[1] = -hi, -lo
            ii = prim.indices
            if ii is not None and ii not in done_idx:
                done_idx.add(ii)
                acc = g.accessors[ii]
                arr, base, stride, isz = acc_view(acc, 1)
                tri = arr.reshape(-1, 3).copy()
                tri[:, [1, 2]] = tri[:, [2, 1]]
                acc_write(tri.reshape(-1, 1), base, stride, isz, 1)

    g.set_binary_blob(bytes(blob))
    g.save(outp)
    print(f'mirrored: {inp} -> {outp} (pos_acc={sorted(done_pos)}, idx_acc={sorted(done_idx)})')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
