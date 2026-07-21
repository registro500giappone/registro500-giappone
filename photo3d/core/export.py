"""座標変換プリセット・実寸スケール・gltf-transform simplify（プラン§3-4-4・§5 Phase2-3）.

- raw: Hunyuan3D-2mv 生成そのまま（front=+Z / right=+X / up=+Y）
- wiring-viewer: メモリ project-fiat500-wiring-viewer.md 追記16実証済みの変換
  world = [-gen_z, gen_x, gen_y] を適用し、real_height_mm があれば
  Z(上)方向の実寸に合わせて等方スケールする。

⚠ この変換行列は行列式-1（鏡映を含む改行変換）であることを本セッションで
確認した（追記16はこの点まで検証していない可能性がある）。座標・向きの
仕様としては指定どおり実装するが、鏡映のままだと面の巻き順が反転し裏面
カリングで消えるため、行列式<0のときは面のインデックス順を反転して
補正する（形状のジオメトリ自体は指定どおり・巻き順だけの技術的補正）。
最終的な形状の左右妥当性はユーザーレビュー対象（プラン§7）。

簡略化は npx @gltf-transform/cli 一択（プラン§3-4-5・trimesh系は壊れた出力
を返すことが実証済み）。weld → simplify の順で適用する。
"""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

import numpy as np
import trimesh

log = logging.getLogger("photo3d.export")

GLTF_TRANSFORM_CMD = ["npx", "--yes", "@gltf-transform/cli"]

# Hunyuan3D-2mv座標(front=+Z/right=+X/up=+Y) -> wiring-viewer座標(前方=-x/運転者左=-y/上=+z)
# new_x = -old_z, new_y = old_x, new_z = old_y
_WIRING_VIEWER_MATRIX = np.array(
    [
        [0.0, 0.0, -1.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
    ]
)


def _run_gltf_transform(args: list[str]) -> None:
    cmd = GLTF_TRANSFORM_CMD + args
    log.info("gltf-transform: %s", " ".join(cmd))
    r = subprocess.run(
        cmd, capture_output=True, text=True, shell=True, timeout=180,
        encoding="utf-8", errors="replace",
    )
    if r.returncode != 0:
        raise RuntimeError(f"gltf-transform失敗 ({' '.join(args[:1])}): {r.stderr[-2000:]}")


def export_candidate(
    src_glb: str | Path,
    out_dir: str | Path,
    cand_id: str,
    preset: str,
    real_height_mm: float | None = None,
    simplify_ratio: float = 0.05,
    simplify_error: float = 0.01,
) -> dict:
    """候補GLBを座標変換・実寸スケール・簡略化してエクスポートする.

    Returns: raw/simplify前後のファイルサイズ・行列式・bounds等のdict
    """
    src_glb = Path(src_glb)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_size = src_glb.stat().st_size

    mesh = trimesh.load(src_glb, force="mesh", process=False)
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces)

    det = 1.0
    if preset == "wiring-viewer":
        det = float(np.linalg.det(_WIRING_VIEWER_MATRIX))
        verts = verts @ _WIRING_VIEWER_MATRIX.T
        if real_height_mm:
            cur_h = float(verts[:, 2].max() - verts[:, 2].min())
            if cur_h > 1e-9:
                scale = real_height_mm / cur_h
                verts = verts * scale
        if det < 0:
            faces = faces[:, ::-1]  # 鏡映変換による巻き順反転の補正
    elif preset != "raw":
        raise ValueError(f"未知のpreset: {preset}（raw/wiring-viewerのみ）")

    transformed = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
    stage_path = out_dir / f"_stage_{cand_id}_{preset}.glb"
    woven_path = out_dir / f"_weld_{cand_id}_{preset}.glb"
    final_path = out_dir / f"{cand_id}_{preset}.glb"
    transformed.export(stage_path)
    transformed_size = stage_path.stat().st_size

    _run_gltf_transform(["weld", str(stage_path), str(woven_path)])
    _run_gltf_transform(
        [
            "simplify",
            str(woven_path),
            str(final_path),
            "--ratio",
            str(simplify_ratio),
            "--error",
            str(simplify_error),
        ]
    )
    stage_path.unlink(missing_ok=True)
    woven_path.unlink(missing_ok=True)

    final_size = final_path.stat().st_size

    # 読込確認（wiring/tools/check_model.py流儀: pygltflibで開いて範囲を見る）
    verify = _verify_glb(final_path)

    return {
        "preset": preset,
        "path": str(final_path),
        "filename": final_path.name,
        "raw_size_bytes": raw_size,
        "transformed_size_bytes": transformed_size,
        "final_size_bytes": final_size,
        "compression_ratio": round(final_size / raw_size, 4) if raw_size else None,
        "determinant": det,
        "bounds_before": mesh.bounds.tolist(),
        "bounds_after_transform": transformed.bounds.tolist(),
        "real_height_mm": real_height_mm,
        "verify": verify,
    }


def _verify_glb(path: Path) -> dict:
    """pygltflibで読み込み、サイズ・頂点範囲を確認する（合格条件の実測用）."""
    from pygltflib import GLTF2

    g = GLTF2().load(str(path))
    n_nodes = len(g.nodes or [])
    n_meshes = len(g.meshes or [])
    m = trimesh.load(path, force="mesh", process=False)
    return {
        "loadable": True,
        "n_nodes": n_nodes,
        "n_meshes": n_meshes,
        "n_vertices": int(len(m.vertices)),
        "n_faces": int(len(m.faces)),
        "bounds": m.bounds.tolist(),
    }
