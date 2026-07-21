"""B2: Hunyuan3D-2 (hy3dgen) の hunyuan3d-dit-v2-mv 重みをローカルRTX3080で形状生成.

プラン§5 Phase3。別venv `.venv-hy21` にサブプロセスで実行させる（本体venvの
torch/依存を汚さない）。UIからはB1と同じ `Backend.run(views, out_path, **kwargs)`
で呼べる。

なぜHunyuan3D-2.1(hy3dshape)でなくHunyuan3D-2(hy3dgen)か:
tencent/Hunyuan3D-2mv の重みは hy3dgen 世代のクラスパスを前提にしており、
hy3dshape(2.1)の新アーキテクチャとは非互換と実測確認済み（詳細は
backends/hy21_cli/generate_shape.py のdocstring）。B1 Spaceと同一系統の重みを
ローカル・無制限設定（高octree・多ステップ・Space秒数上限なし）で回すことで
B1超えの精細さを狙う構成。
"""

from __future__ import annotations

import json
import logging
import subprocess
import sys
import time
from pathlib import Path

from .base import Backend

log = logging.getLogger("photo3d.local_hy21")

ROOT = Path(__file__).resolve().parents[1]
VENV_DIR = ROOT / ".venv-hy21"
VENV_PY = VENV_DIR / "Scripts" / "python.exe"
CLI_SCRIPT = Path(__file__).resolve().parent / "hy21_cli" / "generate_shape.py"


class LocalHy21Backend(Backend):
    """ローカルGPU・形状のみ生成（VRAM10GBぎりぎり・OOM時は自動フォールバック）."""

    name = "local_hy21"
    kind = "generative"
    min_photos = 1
    max_photos = 4

    def requirements_check(self) -> tuple[bool, str]:
        if not VENV_PY.is_file():
            return False, f".venv-hy21が無い（Phase3セットアップ未完了）: {VENV_PY}"
        if not CLI_SCRIPT.is_file():
            return False, f"generate_shape.pyが無い: {CLI_SCRIPT}"
        return True, "OK"

    def run(
        self,
        views: dict[str, Path | None],
        out_path: Path,
        *,
        steps: int = 30,
        guidance_scale: float = 5.0,
        octree_resolution: int = 384,
        num_chunks: int = 8000,
        seed: int = 1234,
        subfolder: str = "hunyuan3d-dit-v2-mv",
        mc_algo: str = "mc",
        timeout_sec: int = 900,
    ) -> dict:
        ok, why = self.requirements_check()
        if not ok:
            raise RuntimeError(why)
        front = views.get("front")
        if not front:
            raise RuntimeError("front画像は必須")

        out_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            str(VENV_PY), str(CLI_SCRIPT),
            "--front", str(front),
            "--out", str(out_path),
            "--subfolder", subfolder,
            "--steps", str(steps),
            "--guidance-scale", str(guidance_scale),
            "--octree-resolution", str(octree_resolution),
            "--num-chunks", str(num_chunks),
            "--seed", str(seed),
            "--mc-algo", mc_algo,
        ]
        for view in ("back", "left", "right"):
            p = views.get(view)
            if p:
                cmd += [f"--{view}", str(p)]

        log.info("local_hy21: launching subprocess: %s", " ".join(cmd))
        t0 = time.time()
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout_sec, encoding="utf-8", errors="replace"
        )
        wall_elapsed = time.time() - t0

        for line in proc.stderr.splitlines():
            log.info("  [hy21] %s", line)

        if proc.returncode != 0:
            tail = "\n".join(proc.stderr.splitlines()[-40:])
            raise RuntimeError(
                f"local_hy21 subprocess failed (code={proc.returncode}):\n{tail}\nstdout={proc.stdout[-2000:]}"
            )

        stdout_lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
        if not stdout_lines:
            raise RuntimeError("local_hy21: no stdout from subprocess")
        try:
            result = json.loads(stdout_lines[-1])
        except json.JSONDecodeError as e:
            raise RuntimeError(f"local_hy21: could not parse result JSON: {stdout_lines[-1][:500]}") from e

        if "error" in result:
            raise RuntimeError(f"local_hy21: generation error: {result['error']}")

        result["elapsed_sec"] = round(wall_elapsed, 1)
        result["used_views"] = {k: (str(v) if v else None) for k, v in views.items()}
        result["mesh_stats"] = (
            f"v={result.get('n_vertices')} f={result.get('n_faces')} "
            f"octree={result.get('octree_resolution_used')} "
            f"vram_peak={result.get('vram_peak_mb')}MB "
            f"oom_fallback={result.get('oom_fallback_count')}"
        )
        log.info("local_hy21: done in %.1fs -> %s (%s)", wall_elapsed, out_path, result["mesh_stats"])
        return result
