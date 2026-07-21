"""前処理の合格条件チェック（Phase 1）.

指定画像群を preprocess_group にかけ、出力の対象縦寸を独立に実測し
視点間の最大差%が±2%以内かを判定する。

使い方:
  .venv\\Scripts\\python tools\\check_prep.py <入力画像...> [--out DIR]
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.preprocess import measure_obj_height, preprocess_group  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--out", default=None, help="出力先（既定: <一時>/prep_check）")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    out = Path(args.out) if args.out else Path(__file__).parent / "_prep_check"

    result = preprocess_group(args.images, out)

    print("\n=== Phase 1 合格条件チェック（対象縦寸 ±2%） ===")
    print(f"canvas: {result.canvas}px / target_h: {result.target_h}px")
    heights = []
    for it in result.items:
        # 保存ファイルから独立に再実測（preprocess内の値に頼らない）
        h = measure_obj_height(it.out)
        heights.append(h)
        print(f"  {Path(it.src).name:24s} -> {Path(it.out).name:28s} 縦寸実測 {h:4d}px")
    diff_pct = (max(heights) - min(heights)) / max(heights) * 100
    ok = diff_pct <= 2.0
    print(f"縦寸最大差: {diff_pct:.3f}%  ->  {'PASS' if ok else 'FAIL'}（合格条件 ±2%）")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
