"""前処理: rembg背景除去 → スケール正規化 → 同一正方形キャンバス配置.

追記16の教訓の仕組み化（プラン§3-4-1）:
  各視点画像を個別トリムせず、背景除去後に全視点で対象の縦寸を揃えて
  同一サイズの正方形キャンバスに配置する（前回は視点間で1.38倍のスケール
  ズレが出て多視点融合が破綻した）。

出力: RGBA PNG（背景透明・全視点同一キャンバスサイズ・対象縦寸一致・余白10%）
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field, asdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

log = logging.getLogger("photo3d.preprocess")

# アルファ値がこの閾値を超える画素を「対象」とみなす（rembg出力の半透明フチ対策）
ALPHA_THRESHOLD = 16
# キャンバスに対する対象の最大占有率（=余白10%を上下左右に確保）
FILL_RATIO = 0.8
# キャンバスの最大辺（無駄に巨大な出力を防ぐ）
MAX_CANVAS = 1536
# キャンバスの最小辺（小さすぎる入力でも生成AIに渡せるサイズを確保）
MIN_CANVAS = 512

# rembgモデル: u2netは「黒背景に合成済みの画像」で背景の黒矩形ごと前景扱いする
# 事故を実測（ヤフオク素材yj_*で確認）。isnet-general-use は同素材で正しく
# 対象のみ抽出できたため既定にする。
REMBG_MODEL = "isnet-general-use"

_session = None  # rembgセッションは重いので使い回す


def _get_session():
    global _session
    if _session is None:
        from rembg import new_session

        log.info("rembg session loading (%s)...", REMBG_MODEL)
        _session = new_session(REMBG_MODEL)
    return _session


@dataclass
class PrepItem:
    """1枚分の前処理結果."""

    src: str
    out: str
    bbox: tuple[int, int, int, int]  # 背景除去後の対象bbox (x0, y0, x1, y1) 元画像座標
    obj_h_px: int  # 出力キャンバス上での対象縦寸（ピクセル実測）
    obj_w_px: int
    scale: float  # 元画像→キャンバスへの拡縮率


@dataclass
class PrepResult:
    canvas: int
    target_h: int
    items: list[PrepItem] = field(default_factory=list)
    max_h_diff_pct: float = 0.0  # 全視点間の縦寸最大差（%・合格条件 ±2%）

    def to_dict(self):
        return asdict(self)


def remove_background(img: Image.Image) -> Image.Image:
    """rembgで背景除去したRGBA画像を返す."""
    from rembg import remove

    return remove(img.convert("RGB"), session=_get_session()).convert("RGBA")


def alpha_bbox(img: Image.Image, threshold: int = ALPHA_THRESHOLD):
    """アルファ閾値ベースの対象bboxを返す。対象が無ければNone."""
    a = np.asarray(img.getchannel("A"))
    ys, xs = np.where(a > threshold)
    if len(xs) == 0:
        return None
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def measure_obj_height(path: str | Path, threshold: int = ALPHA_THRESHOLD):
    """処理済みPNGの対象縦寸(px)を実測する（検証用・前処理とは独立に測る）."""
    with Image.open(path) as im:
        bbox = alpha_bbox(im.convert("RGBA"), threshold)
    if bbox is None:
        return 0
    return bbox[3] - bbox[1]


def _place_on_canvas(
    cut_list: list[tuple[Path, Image.Image, tuple[int, int, int, int]]],
    out_dir: Path,
) -> PrepResult:
    """(元パス, 対象bboxでクロップ済みRGBA, bbox) のリストから、
    縦寸を揃えた同一正方形キャンバスへの配置を行い prep/ に保存する.

    出力ファイル名は常に `<idステム>_prep.png`（元が `p01.png` でも
    再正規化時の入力が `p01_prep.png` でも同じ名前に収束する＝
    手動消しゴム後の再実行で同じファイルを上書きできる）。
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # --- スケール正規化: 縦寸最大の視点を基準に全視点を揃える ---
    max_h = max(c.height for _, c, _ in cut_list)
    # キャンバス: 縦をtarget_hに揃えたときの各視点の横幅も収まるサイズ
    widths_scaled = [c.width * (max_h / c.height) for _, c, _ in cut_list]
    need = max(max_h, max(widths_scaled))
    canvas = int(np.clip(np.ceil(need / FILL_RATIO), MIN_CANVAS, MAX_CANVAS))
    target_h = int(round(canvas * FILL_RATIO * max_h / need))

    result = PrepResult(canvas=canvas, target_h=target_h)
    for p, cut, bbox in cut_list:
        scale = target_h / cut.height
        new_w = max(1, int(round(cut.width * scale)))
        resized = cut.resize((new_w, target_h), Image.LANCZOS)
        board = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
        board.paste(resized, ((canvas - new_w) // 2, (canvas - target_h) // 2))
        stem = p.stem[:-5] if p.stem.endswith("_prep") else p.stem
        out_path = out_dir / f"{stem}_prep.png"
        board.save(out_path)

        # 実測（保存ファイルから測り直す＝検証の独立性）
        h_meas = measure_obj_height(out_path)
        result.items.append(
            PrepItem(
                src=str(p),
                out=str(out_path),
                bbox=bbox,
                obj_h_px=h_meas,
                obj_w_px=new_w,
                scale=round(scale, 4),
            )
        )
        log.info(
            "prep: %s -> %s obj_h=%dpx (target %d) scale=%.3f",
            p.name, out_path.name, h_meas, target_h, scale,
        )

    hs = [it.obj_h_px for it in result.items]
    result.max_h_diff_pct = round((max(hs) - min(hs)) / max(hs) * 100, 3)
    log.info(
        "group done: canvas=%d target_h=%d heights=%s max_diff=%.3f%%",
        canvas, target_h, hs, result.max_h_diff_pct,
    )
    return result


def preprocess_group(
    src_paths: list[str | Path],
    out_dir: str | Path,
) -> PrepResult:
    """視点グループ一括前処理.

    1. 各画像を背景除去し対象bboxを実測
    2. 対象縦寸が最大の視点を基準に、全視点の縦寸を同一target_hへ拡縮
    3. 全視点共通の正方形キャンバス（対象が収まり余白10%）へ中央配置
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    cut_list: list[tuple[Path, Image.Image, tuple[int, int, int, int]]] = []
    for p in src_paths:
        p = Path(p)
        with Image.open(p) as im:
            rgba = remove_background(im)
        bbox = alpha_bbox(rgba)
        if bbox is None:
            raise ValueError(f"背景除去後に対象が見つからない: {p.name}")
        cut_list.append((p, rgba.crop(bbox), bbox))
        log.info("bg removed: %s bbox=%s", p.name, bbox)

    return _place_on_canvas(cut_list, out_dir)


def erase_stroke_path(
    img: Image.Image,
    path: list[tuple[float, float]],
    radius: int,
) -> Image.Image:
    """1本のブラシストローク（キャンバス画素座標の(x,y)点列）に沿ってアルファを
    0にする（＝手動消しゴム）。線分＋各点の円で塗りムラなく塗る。
    """
    img = img.convert("RGBA")
    r, g, b, a = img.split()
    draw = ImageDraw.Draw(a)
    d = max(1, int(radius))
    pts = [(float(x), float(y)) for x, y in path]
    if not pts:
        return img
    if len(pts) == 1:
        x, y = pts[0]
        draw.ellipse([x - d, y - d, x + d, y + d], fill=0)
    else:
        draw.line(pts, fill=0, width=d * 2, joint="curve")
        for x, y in pts:
            draw.ellipse([x - d, y - d, x + d, y + d], fill=0)
    img.putalpha(a)
    return img


def erase_flood(
    img: Image.Image,
    x: float,
    y: float,
    tolerance: int,
) -> Image.Image:
    """クリック点(x,y)と色が近い「連結領域」のみアルファを0にする（同色領域消去）。

    パーツの隙間から覗く背景ポケットのような「周囲を囲まれた領域」を1クリックで
    消すためのモード。既に透明な画素（alpha=0）は常に通過可＝細い隙間をまたいで
    領域がつながる（先に手ブラシで開けた隙間を通って奥の背景ポケットへ届く用途）。
    通過はするが、既に透明な画素自体はもとよりアルファ0なので変化しない＝
    「クリックした色に近い、実際にまだ不透明な画素」だけが新たに消去される。
    """
    from scipy import ndimage

    img = img.convert("RGBA")
    arr = np.asarray(img)
    h, w = arr.shape[0], arr.shape[1]
    xi, yi = int(round(x)), int(round(y))
    if not (0 <= xi < w and 0 <= yi < h):
        return img

    alpha = arr[:, :, 3]
    if alpha[yi, xi] <= 0:
        return img  # クリック点が既に透明＝対象なし

    tol = max(0, min(255, int(tolerance)))
    rgb = arr[:, :, :3].astype(np.int16)
    seed_rgb = rgb[yi, xi]
    diff = np.abs(rgb - seed_rgb).max(axis=2)
    match = (diff <= tol) | (alpha <= 0)

    structure = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])  # 4連結
    labels, _ = ndimage.label(match, structure=structure)
    target = labels[yi, xi]
    erase_mask = (labels == target) & (alpha > 0)

    out = arr.copy()
    out[erase_mask, 3] = 0
    return Image.fromarray(out, mode="RGBA")


def apply_erase_ops(img: Image.Image, ops: list[dict]) -> Image.Image:
    """消しゴム操作列（ブラシ・同色領域消去）を記録順に適用する.

    ops の各要素は {"type": "stroke", "path": [[x,y],...], "radius": int}
    または {"type": "fill", "x": float, "y": float, "tol": int}。
    """
    img = img.convert("RGBA")
    for op in ops:
        kind = op.get("type")
        if kind == "stroke":
            path = [(pt[0], pt[1]) for pt in op.get("path", [])]
            img = erase_stroke_path(img, path, op.get("radius", 24))
        elif kind == "fill":
            img = erase_flood(img, op["x"], op["y"], op.get("tol", 24))
    return img


def renormalize_group(prep_dir: str | Path, photos: list[dict]) -> PrepResult:
    """既存のprep画像（手動消しゴム反映後など）を対象に、bboxクロップ→
    グループ内スケール正規化→同一キャンバス配置をやり直す（プラン外要件・
    レビュー指摘の「消去後はグループ全体のスケール正規化を再実行」に対応）。

    rembgは再実行しない（既に背景除去済みのprep画像をそのまま入力に使う）。
    """
    prep_dir = Path(prep_dir)
    cut_list: list[tuple[Path, Image.Image, tuple[int, int, int, int]]] = []
    for ph in photos:
        if not ph.get("prep"):
            continue
        p = prep_dir / ph["prep"]
        with Image.open(p) as im:
            rgba = im.convert("RGBA")
        bbox = alpha_bbox(rgba)
        if bbox is None:
            raise ValueError(f"消去後に対象が消えてしまった: {ph.get('id', p.name)}")
        cut_list.append((p, rgba.crop(bbox), bbox))
    if not cut_list:
        raise ValueError("前処理済みの写真が無い")
    return _place_on_canvas(cut_list, prep_dir)
