"""B1: tencent/Hunyuan3D-2mv Hugging Face Space（無料・gradio_client直叩き）.

メモリ project-fiat500-wiring-viewer.md 追記16で動作実証済みのAPI仕様どおり:

  /shape_generation(caption, image, mv_image_front, mv_image_back,
                     mv_image_left, mv_image_right, steps, guidance_scale,
                     seed, octree_resolution, check_box_rembg, num_chunks,
                     randomize_seed) -> (file, html, mesh_stats, seed)

2026-07-12 本セッションで view_api() 実測して確認済み（gradio_client 2.5.0
では Client(token=...) が正しい引数名。旧 hf_token= は使えない）。

テクスチャ生成 `/generation_all` は既知バグ（PyMeshLabException）で常に失敗する
ため**絶対に叩かない**（プラン厳守事項）。形状のみ（白メッシュ）を取得する。
"""

from __future__ import annotations

import logging
import shutil
import time
from pathlib import Path

from .base import Backend

log = logging.getLogger("photo3d.space_hy2mv")

HF_TOKEN_PATH = Path(r"C:\Users\akayu\Documents\registro500-notes\hf_token.txt")
SPACE_ID = "tencent/Hunyuan3D-2mv"


class SpaceHy2mvBackend(Backend):
    """無料HF Space・形状のみ生成（7〜30秒/回・費用ゼロ・試行無制限）."""

    name = "space_hy2mv"
    kind = "generative"
    min_photos = 1
    max_photos = 4

    def requirements_check(self) -> tuple[bool, str]:
        if not HF_TOKEN_PATH.is_file():
            return False, f"HFトークンが無い: {HF_TOKEN_PATH}"
        try:
            import gradio_client  # noqa: F401
        except ImportError:
            return False, "gradio_client 未インストール"
        return True, "OK"

    def _client(self):
        from gradio_client import Client

        token = HF_TOKEN_PATH.read_text(encoding="utf-8").strip()
        return Client(SPACE_ID, token=token)

    def run(
        self,
        views: dict[str, Path | None],
        out_path: Path,
        *,
        steps: int = 5,
        guidance_scale: float = 5.0,
        seed: int = 1234,
        octree_resolution: int = 256,
        num_chunks: int = 8000,
    ) -> dict:
        from gradio_client import handle_file

        ok, why = self.requirements_check()
        if not ok:
            raise RuntimeError(why)
        front = views.get("front")
        if not front:
            raise RuntimeError("front画像は必須（mv_image_frontが空だとSpaceが拒否する）")

        def hf(p):
            return handle_file(str(p)) if p else None

        client = self._client()
        t0 = time.time()
        result = client.predict(
            caption=None,
            image=None,
            mv_image_front=hf(front),
            mv_image_back=hf(views.get("back")),
            mv_image_left=hf(views.get("left")),
            mv_image_right=hf(views.get("right")),
            steps=steps,
            guidance_scale=guidance_scale,
            seed=seed,
            octree_resolution=octree_resolution,
            check_box_rembg=True,
            num_chunks=num_chunks,
            randomize_seed=False,
            api_name="/shape_generation",
        )
        elapsed = time.time() - t0
        file_info, _html, mesh_stats, used_seed = result
        src = Path(file_info["value"] if isinstance(file_info, dict) else file_info)

        out_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, out_path)
        log.info("space_hy2mv: %.1fs -> %s (mesh_stats=%s)", elapsed, out_path, mesh_stats)
        return {
            "elapsed_sec": round(elapsed, 1),
            "mesh_stats": mesh_stats,
            "seed": used_seed,
            "used_views": {k: (str(v) if v else None) for k, v in views.items()},
        }
