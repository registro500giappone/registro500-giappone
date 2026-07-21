# -*- coding: utf-8 -*-
"""
make_template.py
=================
配線ビューア「エンジン手動トレース」用のInkscape作業テンプレート生成スクリプト。

任意の参照写真（白背景のエンジン写真等）から、Inkscapeでそのまま開ける
3層構成のSVGテンプレートを1枚生成する。

  レイヤー1 reference  : 元写真をそのまま埋め込み（不透明度 --opacity-ref）。ロック。
  レイヤー2 edge_hint  : 自作Cannyライク処理によるエッジ抽出の下書き線（不透明度 --opacity-edge）。ロック。
  レイヤー3 trace      : 空。ユーザーがペンツールで手動トレースする最上層（アクティブレイヤー）。

使い方:
    python make_template.py <入力画像> <出力.svg> [--opacity-ref 0.4] [--opacity-edge 0.3]

出力:
    <出力.svg>                      … Inkscape用テンプレート本体
    <出力ファイル名>_edge_check.png … エッジ抽出結果の確認用PNG（レビュー用・埋め込みと同一内容）

依存ライブラリ:
    Pillow, numpy, scipy (opencv-pythonはこの環境に未インストールのため使用しない。
    scipy.ndimage でSobel勾配・ガウシアンぼかし・連結成分ラベリングを行い、
    Cannyエッジ検出のアルゴリズム（ぼかし→勾配→非極大抑制→ヒステリシスしきい値）を
    自前実装している）。

しきい値の自動決定について:
    古典的な「auto Canny」手法（Adrian Rosebrock氏が広めたmedianベースのsigma法）を
    勾配強度（gradient magnitude）に適用する形で採用した。
        median = 勾配強度画像の中央値
        low  = max(0, (1 - sigma) * median)
        high = min(max勾配強度, (1 + sigma) * median)
    sigma のデフォルトは 0.33（auto Cannyの定番値）。画像ごとに自動でしきい値が
    決まるため、写真の明暗差に応じたパラメータ手動調整が不要になる。
"""

import argparse
import base64
import os
import sys
from io import BytesIO

import numpy as np
from PIL import Image
from scipy import ndimage


# ----------------------------------------------------------------------
# Cannyライク・エッジ抽出（cv2非依存・自前実装）
# ----------------------------------------------------------------------

def _sobel_gradients(gray):
    """Sobelフィルタでx/y方向の勾配とその強度・角度を求める。"""
    gx = ndimage.sobel(gray, axis=1, mode="reflect")
    gy = ndimage.sobel(gray, axis=0, mode="reflect")
    magnitude = np.hypot(gx, gy)
    direction = np.degrees(np.arctan2(gy, gx)) % 180.0  # 0〜180度に正規化
    return magnitude, direction


def _non_max_suppression(magnitude, direction):
    """
    勾配方向に沿った非極大抑制（NMS）。
    方向を0/45/90/135度の4ビンに丸め、勾配方向の両隣の画素と比較して
    自分が極大でなければ0にする。ループを使わずnp.rollでベクトル化。
    """
    up = np.roll(magnitude, 1, axis=0)
    down = np.roll(magnitude, -1, axis=0)
    left = np.roll(magnitude, 1, axis=1)
    right = np.roll(magnitude, -1, axis=1)
    up_left = np.roll(np.roll(magnitude, 1, axis=0), 1, axis=1)
    up_right = np.roll(np.roll(magnitude, 1, axis=0), -1, axis=1)
    down_left = np.roll(np.roll(magnitude, -1, axis=0), 1, axis=1)
    down_right = np.roll(np.roll(magnitude, -1, axis=0), -1, axis=1)

    bin0 = (direction < 22.5) | (direction >= 157.5)          # 水平エッジ→左右と比較
    bin45 = (direction >= 22.5) & (direction < 67.5)           # 斜め45度
    bin90 = (direction >= 67.5) & (direction < 112.5)          # 垂直エッジ→上下と比較
    bin135 = (direction >= 112.5) & (direction < 157.5)        # 斜め135度

    keep = (
        (bin0 & (magnitude >= left) & (magnitude >= right))
        | (bin90 & (magnitude >= up) & (magnitude >= down))
        | (bin45 & (magnitude >= up_right) & (magnitude >= down_left))
        | (bin135 & (magnitude >= up_left) & (magnitude >= down_right))
    )

    suppressed = np.where(keep, magnitude, 0.0)
    # np.roll は端で反対側の値と比較してしまう（wraparound）ため、外周1pxは無効化
    suppressed[0, :] = 0
    suppressed[-1, :] = 0
    suppressed[:, 0] = 0
    suppressed[:, -1] = 0
    return suppressed


def _hysteresis(nms_magnitude, low, high):
    """
    ヒステリシスしきい値処理。
    strong（high以上）を核として、weak（low〜high）が8近傍で連結していれば
    まとめて採用する。scipy.ndimage.label で連結成分をとり、strongを含む
    成分だけを残す。
    """
    strong = nms_magnitude >= high
    weak = (nms_magnitude >= low) & (nms_magnitude < high)
    candidate = strong | weak

    structure = np.ones((3, 3), dtype=bool)  # 8近傍
    labeled, _ = ndimage.label(candidate, structure=structure)

    strong_labels = set(np.unique(labeled[strong]).tolist())
    strong_labels.discard(0)
    if not strong_labels:
        return np.zeros_like(nms_magnitude, dtype=bool)

    mask = np.isin(labeled, list(strong_labels))
    return mask


def auto_canny_edges(gray_float, blur_sigma=1.4, canny_sigma=0.33):
    """
    Cannyライク処理の一括実行。
    1) 軽くガウシアンぼかし
    2) Sobelで勾配強度・方向を計算
    3) 非極大抑制
    4) medianベースのsigma法でしきい値を自動決定し、ヒステリシス処理
    5) 1px膨張

    戻り値: bool配列（True=エッジ）と、採用したしきい値(low, high)
    """
    blurred = ndimage.gaussian_filter(gray_float, sigma=blur_sigma)
    magnitude, direction = _sobel_gradients(blurred)
    nms = _non_max_suppression(magnitude, direction)

    median = float(np.median(nms[nms > 0])) if np.any(nms > 0) else float(np.median(nms))
    low = max(0.0, (1.0 - canny_sigma) * median)
    high = min(float(nms.max()) if nms.max() > 0 else 1.0, (1.0 + canny_sigma) * median)
    if high <= low:
        high = low + 1e-6

    edges = _hysteresis(nms, low, high)

    # エッジ膨張1px（8近傍構造要素・1回）
    structure = np.ones((3, 3), dtype=bool)
    edges = ndimage.binary_dilation(edges, structure=structure, iterations=1)

    return edges, (low, high)


def edges_to_rgba_png_bytes(edges, gray_color=(0x88, 0x88, 0x88)):
    """
    エッジのbool配列を「透明背景＋グレー線」のRGBA PNGバイト列に変換する。
    """
    h, w = edges.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = gray_color[0]
    rgba[..., 1] = gray_color[1]
    rgba[..., 2] = gray_color[2]
    rgba[..., 3] = np.where(edges, 255, 0).astype(np.uint8)

    img = Image.fromarray(rgba, mode="RGBA")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue(), img


# ----------------------------------------------------------------------
# SVGテンプレート組み立て
# ----------------------------------------------------------------------

SVG_TEMPLATE = """<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   xmlns="http://www.w3.org/2000/svg"
   xmlns:xlink="http://www.w3.org/1999/xlink"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd"
   version="1.1"
   id="svg_root"
   width="{width}"
   height="{height}"
   viewBox="0 0 {width} {height}">
  <!-- FIAT 500配線ビューア: エンジン手動トレース用テンプレート（自動生成） -->
  <sodipodi:namedview
     id="namedview_root"
     inkscape:current-layer="trace"
     inkscape:document-units="px" />
  <g
     inkscape:groupmode="layer"
     inkscape:label="reference"
     id="reference"
     sodipodi:insensitive="true"
     style="opacity:{opacity_ref}">
    <image
       id="reference_image"
       x="0"
       y="0"
       width="{width}"
       height="{height}"
       preserveAspectRatio="none"
       xlink:href="data:image/jpeg;base64,{ref_b64}" />
  </g>
  <g
     inkscape:groupmode="layer"
     inkscape:label="edge_hint"
     id="edge_hint"
     sodipodi:insensitive="true"
     style="opacity:{opacity_edge}">
    <image
       id="edge_hint_image"
       x="0"
       y="0"
       width="{width}"
       height="{height}"
       preserveAspectRatio="none"
       xlink:href="data:image/png;base64,{edge_b64}" />
  </g>
  <g
     inkscape:groupmode="layer"
     inkscape:label="trace"
     id="trace">
    <!-- ここにペンツール(B)で手動トレースしたパスが入る。初期状態は空。 -->
  </g>
</svg>
"""


def build_svg(width, height, ref_bytes, edge_png_bytes, opacity_ref, opacity_edge):
    ref_b64 = base64.b64encode(ref_bytes).decode("ascii")
    edge_b64 = base64.b64encode(edge_png_bytes).decode("ascii")
    return SVG_TEMPLATE.format(
        width=width,
        height=height,
        opacity_ref=opacity_ref,
        opacity_edge=opacity_edge,
        ref_b64=ref_b64,
        edge_b64=edge_b64,
    )


# ----------------------------------------------------------------------
# 自己検証
# ----------------------------------------------------------------------

def self_check(svg_path):
    """
    生成したSVGの構造を簡易検証する。
    - inkscape:groupmode="layer" のグループが3つあるか
    - reference/edge_hintがsodipodi:insensitive="true"（ロック）か
    - 各画像のdata URIが存在するか
    - viewBoxが存在するか
    戻り値: (bool 全体成否, dict 詳細)
    """
    with open(svg_path, "r", encoding="utf-8") as f:
        text = f.read()

    layer_count = text.count('inkscape:groupmode="layer"')
    lock_count = text.count('sodipodi:insensitive="true"')
    has_ref_datauri = "data:image/jpeg;base64," in text
    has_edge_datauri = "data:image/png;base64," in text
    has_viewbox = "viewBox=" in text
    has_current_layer = 'inkscape:current-layer="trace"' in text
    has_trace_layer = 'inkscape:label="trace"' in text

    ok = (
        layer_count == 3
        and lock_count == 2
        and has_ref_datauri
        and has_edge_datauri
        and has_viewbox
        and has_current_layer
        and has_trace_layer
    )

    detail = {
        "layer_count": layer_count,
        "lock_count": lock_count,
        "has_ref_datauri": has_ref_datauri,
        "has_edge_datauri": has_edge_datauri,
        "has_viewbox": has_viewbox,
        "has_current_layer_trace": has_current_layer,
        "has_trace_layer": has_trace_layer,
        "file_size_bytes": os.path.getsize(svg_path),
    }
    return ok, detail


# ----------------------------------------------------------------------
# メイン処理
# ----------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="エンジン手動トレース用のInkscapeテンプレート(SVG)を生成する"
    )
    parser.add_argument("input_image", help="入力画像（写真）のパス")
    parser.add_argument("output_svg", help="出力SVGのパス")
    parser.add_argument("--opacity-ref", type=float, default=0.4, help="referenceレイヤーの不透明度(既定0.4)")
    parser.add_argument("--opacity-edge", type=float, default=0.3, help="edge_hintレイヤーの不透明度(既定0.3)")
    parser.add_argument("--blur-sigma", type=float, default=1.4, help="Canny前のガウシアンぼかしのsigma(既定1.4)")
    parser.add_argument("--canny-sigma", type=float, default=0.33, help="medianベース自動しきい値のsigma(既定0.33)")
    args = parser.parse_args()

    if not os.path.exists(args.input_image):
        print(f"エラー: 入力画像が見つかりません: {args.input_image}", file=sys.stderr)
        sys.exit(1)

    # 元画像を読み込み（そのままバイト列をdata URIに使う。再エンコードによる劣化を避ける）
    with open(args.input_image, "rb") as f:
        ref_bytes = f.read()

    im = Image.open(args.input_image)
    width, height = im.size

    # エッジ抽出はグレースケール・float配列で行う
    gray = np.asarray(im.convert("L"), dtype=np.float64)
    edges, thresholds = auto_canny_edges(gray, blur_sigma=args.blur_sigma, canny_sigma=args.canny_sigma)
    edge_png_bytes, edge_img = edges_to_rgba_png_bytes(edges)

    # レビュー用のedge_checkを保存
    out_dir = os.path.dirname(os.path.abspath(args.output_svg))
    out_base = os.path.splitext(os.path.basename(args.output_svg))[0]
    edge_check_path = os.path.join(out_dir, f"{out_base}_edge_check.png")
    os.makedirs(out_dir, exist_ok=True)
    edge_img.save(edge_check_path, format="PNG")

    svg_text = build_svg(
        width, height, ref_bytes, edge_png_bytes,
        args.opacity_ref, args.opacity_edge,
    )
    with open(args.output_svg, "w", encoding="utf-8") as f:
        f.write(svg_text)

    ok, detail = self_check(args.output_svg)

    print(f"[make_template] 入力: {args.input_image} ({width}x{height})")
    print(f"[make_template] 出力SVG: {args.output_svg}")
    print(f"[make_template] edge_check PNG: {edge_check_path}")
    print(f"[make_template] Cannyしきい値(自動決定): low={thresholds[0]:.3f} high={thresholds[1]:.3f} "
          f"(blur_sigma={args.blur_sigma}, canny_sigma={args.canny_sigma})")
    print(f"[make_template] 自己検証: {'OK' if ok else 'NG'} 詳細={detail}")

    if not ok:
        sys.exit(2)


if __name__ == "__main__":
    main()
