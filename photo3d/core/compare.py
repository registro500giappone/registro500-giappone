"""4視点+上面オフスクリーンレンダ（プラン§3-4-3・§5 Phase2-2）.

前回の検証不備（AI画像→3D生成の轍・ズーム1点のみで全体確認せず「姿が落第点」
と判明するまでに至った）の再発防止として、候補メッシュを**必ず** front /
back / left / right / top の5視点でレンダし、比較ボードに並べる。

カメラは Hunyuan3D-2mv 生成メッシュのネイティブ座標系（front=+Z / right=+X /
up=+Y）で定義する。座標変換（wiring-viewer プリセット）は export.py 側の責務。

レンダリング手段: open3d の OffscreenRenderer は本機（Windows/EGL非対応）で
使用不可と実測済みのため、trimesh + pyglet<2（windowed backend, 実際には
非表示ウィンドウでハードウェアレンダ）を採用。1.3M面級のメッシュでも数秒で
描画できることを実測確認済み（純matplotlibのPoly3DCollectionでは処理不可能
な面数）。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import trimesh

log = logging.getLogger("photo3d.compare")

RENDER_SIZE = 420

# Hunyuan3D-2mv ネイティブ座標系: front=+Z, right=+X, up=+Y
# eye/target/up は正規化前の相対値（distanceはメッシュのbounding radiusから決定）
VIEW_DEFS = {
    "front": dict(dir=(0.0, 0.0, 1.0), up=(0.0, 1.0, 0.0)),
    "back": dict(dir=(0.0, 0.0, -1.0), up=(0.0, 1.0, 0.0)),
    "left": dict(dir=(-1.0, 0.0, 0.0), up=(0.0, 1.0, 0.0)),
    "right": dict(dir=(1.0, 0.0, 0.0), up=(0.0, 1.0, 0.0)),
    "top": dict(dir=(0.0, 1.0, 0.0), up=(0.0, 0.0, 1.0)),
}


@dataclass
class CompareResult:
    cand_id: str
    renders: dict = field(default_factory=dict)  # view -> filename (out_dir内)
    n_vertices: int = 0
    n_faces: int = 0
    bounds: list = field(default_factory=list)


def _look_at(eye: np.ndarray, target: np.ndarray, up: np.ndarray) -> np.ndarray:
    """camera-to-world 4x4（OpenGL規約: ローカル-Zが視線方向）."""
    f = target - eye
    f = f / np.linalg.norm(f)
    s = np.cross(f, up)
    s = s / np.linalg.norm(s)
    u = np.cross(s, f)
    m = np.eye(4)
    m[:3, 0] = s
    m[:3, 1] = u
    m[:3, 2] = -f
    m[:3, 3] = eye
    return m


def render_candidate(glb_path: str | Path, out_dir: str | Path, cand_id: str) -> CompareResult:
    glb_path = Path(glb_path)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    mesh = trimesh.load(glb_path, force="mesh", process=False)
    result = CompareResult(
        cand_id=cand_id,
        n_vertices=len(mesh.vertices),
        n_faces=len(mesh.faces),
        bounds=mesh.bounds.tolist(),
    )

    center = mesh.bounds.mean(axis=0)
    radius = float(np.linalg.norm(mesh.bounds[1] - mesh.bounds[0])) / 2.0
    radius = max(radius, 1e-6)
    distance = radius * 2.6

    scene = mesh.scene()
    scene.camera.resolution = (RENDER_SIZE, RENDER_SIZE)
    scene.camera.fov = (50.0, 50.0)

    for view, spec in VIEW_DEFS.items():
        eye = center + np.array(spec["dir"]) * distance
        transform = _look_at(eye, center, np.array(spec["up"]))
        scene.camera_transform = transform
        # 実測(2026-07-12): save_image(visible=False) は例外を出さず「真っ白」の
        # 空レンダを返す罠がある（pygletウィンドウ非表示だと描画されない）。
        # visible指定はせず既定（一瞬ウィンドウが出るが確実に描画される）に頼る。
        png = scene.save_image(resolution=(RENDER_SIZE, RENDER_SIZE))
        fname = f"{cand_id}_{view}.png"
        (out_dir / fname).write_bytes(png)
        result.renders[view] = fname
        log.info("render %s/%s: %d bytes", cand_id, view, len(png))

    return result
