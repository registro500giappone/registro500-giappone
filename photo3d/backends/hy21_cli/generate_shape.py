"""B2 CLI: Hunyuan3D-2 (hy3dgen) の hunyuan3d-dit-v2-mv 重みでローカル形状生成する.

`.venv-hy21` の python でこのスクリプト単体を subprocess 起動する前提
（photo3d/backends/local_hy21.py から呼ばれる）。photo3d本体の依存（fastapi等）
には触れない・標準出力の最後の1行にJSON結果を1つだけ書く。

なぜ hy3dshape (Hunyuan3D-2.1公式repo) でなく hy3dgen (Hunyuan3D-2) を使うか:
  tencent/Hunyuan3D-2mv の重み（config.yaml の target）は
  `hy3dgen.shapegen.models.Hunyuan3DDiT` 等、2.0世代のクラスパスを指しており、
  2.1 の hy3dshape パッケージ（新アーキテクチャ HunYuanDiTPlain 等）とは
  クラス名・モジュールパスが非互換（実測確認済み・2026-07-12）。
  2.1公式repoのgradio_app.py自体もMVモードでは実質この2.0系コードパスを
  期待しており、2.0公式repo(hy3dgen)をそのまま使うのが最も素直で確実。
  B1 Space (tencent/Hunyuan3D-2mv) もこの世代のコードで動いていると見られる
  ため、B2はB1と「同じ重み」をローカル・無制限設定（高octree・多ステップ・
  Space の秒数/解像度上限なし）で回すことでB1を上回る精細さを狙う。

VRAM 10GB ぎりぎり運用のため、CUDA OOM 時は octree_resolution / num_chunks
を段階的に下げて自動リトライする（プラン§5 Phase3-1）。
"""

from __future__ import annotations

import argparse
import gc
import json
import sys
import time
import traceback
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parents[2] / ".venv-hy21" / "hy3dgen-src"
sys.path.insert(0, str(REPO_DIR))

MODEL_PATH = "tencent/Hunyuan3D-2mv"

# OOM時のフォールバック段階（octree_resolution, num_chunks）のペアを順に試す。
# 要求値がこのラダーより高精細ならラダー先頭に要求値を挿入して使う。
FALLBACK_LADDER = [
    (512, 8000),
    (384, 8000),
    (384, 3000),
    (256, 3000),
    (256, 1500),
    (192, 1000),
]


def log(msg: str) -> None:
    print(f"[generate_shape] {msg}", file=sys.stderr, flush=True)


def is_oom(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "out of memory" in msg or "cuda oom" in msg or "cublas_status_alloc_failed" in msg


def build_ladder(req_octree: int, req_chunks: int) -> list[tuple[int, int]]:
    ladder = [(req_octree, req_chunks)]
    for oc, nc in FALLBACK_LADDER:
        if oc < req_octree:
            ladder.append((oc, min(nc, req_chunks)))
    return ladder


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--front", required=True)
    ap.add_argument("--back", default=None)
    ap.add_argument("--left", default=None)
    ap.add_argument("--right", default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--subfolder", default="hunyuan3d-dit-v2-mv",
                     choices=["hunyuan3d-dit-v2-mv", "hunyuan3d-dit-v2-mv-fast", "hunyuan3d-dit-v2-mv-turbo"])
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--guidance-scale", type=float, default=5.0)
    ap.add_argument("--octree-resolution", type=int, default=384)
    ap.add_argument("--num-chunks", type=int, default=8000)
    ap.add_argument("--seed", type=int, default=1234)
    ap.add_argument("--mc-algo", default="mc", choices=["mc", "dmc"])
    args = ap.parse_args()

    import torch
    from PIL import Image
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
    from hy3dgen.shapegen.postprocessors import FloaterRemover, DegenerateFaceRemover

    if not torch.cuda.is_available():
        print(json.dumps({"error": "CUDA not available in .venv-hy21"}))
        return 1

    torch.cuda.reset_peak_memory_stats()

    t_load0 = time.time()
    log(f"loading pipeline model_path={MODEL_PATH} subfolder={args.subfolder} ...")
    pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        MODEL_PATH,
        subfolder=args.subfolder,
        device="cuda",
        dtype=torch.float16,
        use_safetensors=True,
    )
    load_elapsed = time.time() - t_load0
    log(f"pipeline loaded in {load_elapsed:.1f}s")

    image_dict = {}
    for view in ("front", "back", "left", "right"):
        p = getattr(args, view)
        if p:
            image_dict[view] = Image.open(p).convert("RGBA")
    if "front" not in image_dict:
        print(json.dumps({"error": "front view is required"}))
        return 1
    log(f"views: {list(image_dict.keys())}")

    ladder = build_ladder(args.octree_resolution, args.num_chunks)
    last_err = None
    oom_fallback_count = 0
    mesh = None
    used_octree = used_chunks = None
    t_gen0 = time.time()

    for i, (octree_resolution, num_chunks) in enumerate(ladder):
        try:
            log(f"attempt {i + 1}/{len(ladder)}: octree_resolution={octree_resolution} "
                f"num_chunks={num_chunks} steps={args.steps}")
            generator = torch.Generator(device="cuda").manual_seed(args.seed)
            result = pipeline(
                image=image_dict,
                num_inference_steps=args.steps,
                guidance_scale=args.guidance_scale,
                octree_resolution=octree_resolution,
                num_chunks=num_chunks,
                mc_algo=args.mc_algo,
                generator=generator,
                output_type="trimesh",
            )
            mesh = result[0] if isinstance(result, list) else result
            used_octree, used_chunks = octree_resolution, num_chunks
            break
        except Exception as e:  # noqa: BLE001
            if is_oom(e) and i < len(ladder) - 1:
                oom_fallback_count += 1
                log(f"CUDA OOM at octree={octree_resolution} num_chunks={num_chunks} -> falling back. {e}")
                last_err = e
                del generator
                gc.collect()
                torch.cuda.empty_cache()
                continue
            traceback.print_exc(file=sys.stderr)
            print(json.dumps({"error": f"generation failed: {e}", "oom_fallback_count": oom_fallback_count}))
            return 1

    gen_elapsed = time.time() - t_gen0

    if mesh is None:
        print(json.dumps({"error": f"exhausted fallback ladder: {last_err}"}))
        return 1

    log("postprocessing (FloaterRemover, DegenerateFaceRemover) ...")
    try:
        mesh = FloaterRemover()(mesh)
        mesh = DegenerateFaceRemover()(mesh)
    except Exception as e:  # noqa: BLE001
        log(f"postprocess skipped (non-fatal): {e}")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    mesh.export(str(out_path))

    vram_peak_mb = torch.cuda.max_memory_allocated() / (1024 * 1024)
    n_vertices = len(mesh.vertices)
    n_faces = len(mesh.faces)

    out = {
        "backend": "local_hy21",
        "model_path": MODEL_PATH,
        "subfolder": args.subfolder,
        "steps": args.steps,
        "guidance_scale": args.guidance_scale,
        "octree_resolution_requested": args.octree_resolution,
        "octree_resolution_used": used_octree,
        "num_chunks_used": used_chunks,
        "mc_algo": args.mc_algo,
        "seed": args.seed,
        "oom_fallback_count": oom_fallback_count,
        "vram_peak_mb": round(vram_peak_mb, 1),
        "load_elapsed_sec": round(load_elapsed, 1),
        "gen_elapsed_sec": round(gen_elapsed, 1),
        "n_vertices": n_vertices,
        "n_faces": n_faces,
        "used_views": list(image_dict.keys()),
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
