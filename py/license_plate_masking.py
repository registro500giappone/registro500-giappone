"""
license_plate_masking.py
ナンバープレート自動マスク（ローカル確認専用）
2026/02

使い方:
  python license_plate_masking.py             # 全車両を処理
  python license_plate_masking.py --dry-run   # 検出のみ（ぼかし保存しない）
  python license_plate_masking.py --doc DOC_001  # 特定の車両のみ

出力:
  masking_output/{document_id}/original_{field}.jpg  ← 元画像
  masking_output/{document_id}/masked_{field}.jpg    ← ぼかし処理済み
  masking_output/masking_report.csv                  ← 結果一覧

注意:
  Firebase Storage への書き込みは一切しない。ローカル確認専用。
  既存オーナーへの適用は Phase 3（detail.html）でオーナーが自分で行う。
"""
import os
import sys
import csv
import time
import argparse
import requests
import base64
import json
from io import BytesIO
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

try:
    from PIL import Image, ImageFilter, ImageDraw
except ImportError:
    print("[ERROR] Pillowが必要です: pip install Pillow")
    sys.exit(1)

try:
    from supabase import create_client
except ImportError:
    print("[ERROR] supabase-pyが必要です: pip install supabase")
    sys.exit(1)

# ── 設定 ──────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
VISION_API_KEY = os.environ.get("GOOGLE_VISION_API_KEY")

BLUR_RADIUS = 30          # ガウスぼかし強度（文字が読めなくなる）

OUTPUT_DIR = Path(__file__).parent / "masking_output"
OUTPUT_DIR.mkdir(exist_ok=True)

# 対象フィールドと Firebase Storage 内のキー名
PHOTO_FIELDS = [
    ("photo_main",  "PhotoMain"),
    ("photo_front", "PhotoFront"),
    ("photo_side",  "PhotoSide"),
    ("photo_rear",  "PhotoRear"),
]

VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"

# ──────────────────────────────────────────────────


def _convex_hull(points: list[tuple]) -> list[tuple]:
    """
    Gift wrapping algorithm でconvex hull（最小包囲多角形）を計算する。
    scipy不使用、標準ライブラリのみで動作。
    """
    points = list(set(points))
    if len(points) <= 3:
        return points
    # 最も左上の点から開始
    start = min(points, key=lambda p: (p[0], p[1]))
    hull = []
    current = start
    while True:
        hull.append(current)
        next_pt = points[0] if points[0] != current else points[1]
        for pt in points:
            if pt == current:
                continue
            cross = (
                (next_pt[0] - current[0]) * (pt[1] - current[1]) -
                (next_pt[1] - current[1]) * (pt[0] - current[0])
            )
            if cross > 0:
                next_pt = pt
        if next_pt == start:
            break
        current = next_pt
        if len(hull) > len(points):  # 無限ループ防止
            break
    return hull


def detect_license_plates_rest(image_bytes: bytes) -> list[dict]:
    """
    Google Cloud Vision API でナンバープレートを検出する。
    OBJECT_LOCALIZATION でプレート位置（AABB）を特定し、
    TEXT_DETECTION の精確な斜め頂点でconvex hullを作ってマスク形状を返す。
    戻り値: [{"pixel_polygon": [(x,y), ...], "score": float, "name": str}, ...]
    """
    if not VISION_API_KEY:
        raise RuntimeError("GOOGLE_VISION_API_KEY が .env に設定されていません")

    # 画像サイズを取得（正規化座標→ピクセル変換に使用）
    img = Image.open(BytesIO(image_bytes))
    img_w, img_h = img.size

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "requests": [{
            "image": {"content": b64},
            "features": [
                {"type": "OBJECT_LOCALIZATION", "maxResults": 10},
                {"type": "TEXT_DETECTION", "maxResults": 50},
            ]
        }]
    }
    resp = requests.post(
        f"{VISION_API_URL}?key={VISION_API_KEY}",
        json=payload,
        timeout=30
    )
    resp.raise_for_status()
    annotations = resp.json().get("responses", [{}])[0]

    objects = annotations.get("localizedObjectAnnotations", [])
    text_annotations = annotations.get("textAnnotations", [])

    # ── Step1: OBJECT_LOCALIZATIONでプレートのAABBを取得（ピクセル座標）
    plate_boxes = []
    for obj in objects:
        name = obj.get("name", "").lower()
        if not ("plate" in name or "registration" in name or "number" in name):
            continue
        score = obj.get("score", 0)
        if score < 0.2:
            continue
        verts = obj["boundingPoly"]["normalizedVertices"]
        xs = [v.get("x", 0) * img_w for v in verts]
        ys = [v.get("y", 0) * img_h for v in verts]
        plate_boxes.append({
            "x1": int(min(xs)), "y1": int(min(ys)),
            "x2": int(max(xs)), "y2": int(max(ys)),
            "score": score,
        })

    plates = []
    MARGIN = 20  # ピクセル：AABBを少し広げてテキストを拾いやすくする

    for box in plate_boxes:
        # ── Step2: そのAABB内にあるTEXT_DETECTIONの頂点を収集
        all_points = []
        for ta in text_annotations[1:]:  # [0]は全テキスト結合なのでスキップ
            verts = ta.get("boundingPoly", {}).get("vertices", [])
            if not verts:
                continue
            pts = [(v.get("x", 0), v.get("y", 0)) for v in verts]
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            if (box["x1"] - MARGIN <= cx <= box["x2"] + MARGIN and
                    box["y1"] - MARGIN <= cy <= box["y2"] + MARGIN):
                all_points.extend(pts)

        if len(all_points) >= 3:
            # ── Step3: 収集した頂点のconvex hull → 斜めに沿った多角形マスク
            polygon = _convex_hull(all_points)
        else:
            # テキストが見つからない場合はAABBをそのまま使用
            polygon = [
                (box["x1"], box["y1"]), (box["x2"], box["y1"]),
                (box["x2"], box["y2"]), (box["x1"], box["y2"]),
            ]

        plates.append({
            "pixel_polygon": polygon,
            "score": box["score"],
            "name": "License plate (text-refined)",
        })

    # ── フォールバック: OBJECT_LOCALIZATIONで検出できなかった場合
    if not plates:
        for ta in text_annotations[1:]:
            desc = ta.get("description", "")
            digits = sum(c.isdigit() for c in desc)
            if digits >= 2 and len(desc) <= 10:
                verts = ta.get("boundingPoly", {}).get("vertices", [])
                if len(verts) < 3:
                    continue
                plates.append({
                    "pixel_polygon": [(v.get("x", 0), v.get("y", 0)) for v in verts],
                    "score": 0.5,
                    "name": f"text_fallback:{desc}",
                })

    return plates


def apply_blur(img: Image.Image, plates: list[dict]) -> tuple[Image.Image, int]:
    """
    ナンバープレート領域に多角形マスクでガウスぼかしをかける。
    斜め撮影のナンバーにも形状が沿うよう、4頂点多角形を使用。
    戻り値: (ぼかし後Image, 適用した枚数)
    """
    from PIL import ImageDraw
    img = img.copy()
    w, h = img.size
    applied = 0

    # 全体ぼかし画像を一度だけ生成（繰り返し生成を避ける）
    blurred_full = img.filter(ImageFilter.GaussianBlur(radius=BLUR_RADIUS))

    for plate in plates:
        # 多角形の頂点リストを取得
        if "pixel_polygon" in plate:
            # テキスト検出フォールバック：すでにピクセル座標の多角形
            polygon = [(int(x), int(y)) for x, y in plate["pixel_polygon"]]
        elif "verts_norm" in plate:
            # OBJECT_LOCALIZATION：正規化座標の4頂点 → ピクセル変換
            polygon = [
                (int(v.get("x", 0) * w), int(v.get("y", 0) * h))
                for v in plate["verts_norm"]
            ]
        else:
            continue

        if len(polygon) < 3:
            continue

        # 多角形マスクを作成して合成（多角形の形状でのみぼかしを適用）
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).polygon(polygon, fill=255)
        img.paste(blurred_full, mask=mask)
        applied += 1

    return img, applied


def download_image(url: str) -> bytes | None:
    """Firebase StorageのURLから画像をダウンロード"""
    try:
        resp = requests.get(url, timeout=20, headers={
            "User-Agent": "Registro500Bot/1.0"
        })
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        print(f"  [WARN] ダウンロード失敗: {e}")
        return None


def process_car(car: dict, dry_run: bool) -> list[dict]:
    """1台の車両の全写真を処理して結果リストを返す"""
    doc_id = car["document_id"]
    car_dir = OUTPUT_DIR / doc_id
    car_dir.mkdir(exist_ok=True)

    results = []

    for db_field, firebase_field in PHOTO_FIELDS:
        url = car.get(db_field)
        row = {
            "document_id": doc_id,
            "photo_field": db_field,
            "status": "",
            "plates_found": 0,
            "original_path": "-",
            "masked_path": "-",
        }

        if not url:
            row["status"] = "skipped_no_url"
            results.append(row)
            continue

        print(f"  処理中: {db_field}")

        # 元画像ダウンロード
        img_bytes = download_image(url)
        if not img_bytes:
            row["status"] = "download_failed"
            results.append(row)
            continue

        # 元画像を保存
        orig_path = car_dir / f"original_{firebase_field}.jpg"
        with open(orig_path, "wb") as f:
            f.write(img_bytes)
        row["original_path"] = str(orig_path.relative_to(Path(__file__).parent))

        # Vision API でナンバープレート検出
        try:
            plates = detect_license_plates_rest(img_bytes)
        except Exception as e:
            print(f"  [WARN] Vision API エラー: {e}")
            row["status"] = "api_error"
            results.append(row)
            time.sleep(1)
            continue

        row["plates_found"] = len(plates)

        if not plates:
            row["status"] = "no_plate_detected"
            results.append(row)
            time.sleep(0.5)
            continue

        # dry-run の場合はぼかし保存しない
        if dry_run:
            row["status"] = f"detected_{len(plates)}_plates (dry-run)"
            results.append(row)
            time.sleep(0.5)
            continue

        # ぼかし適用
        try:
            img = Image.open(BytesIO(img_bytes)).convert("RGB")
            masked_img, applied = apply_blur(img, plates)
            masked_path = car_dir / f"masked_{firebase_field}.jpg"
            masked_img.save(masked_path, "JPEG", quality=85)
            row["masked_path"] = str(masked_path.relative_to(Path(__file__).parent))
            row["status"] = "success"
        except Exception as e:
            print(f"  [WARN] ぼかし処理エラー: {e}")
            row["status"] = "blur_error"

        results.append(row)
        time.sleep(0.5)  # API レート制限

    return results


def main():
    parser = argparse.ArgumentParser(description="ナンバープレート自動マスク（ローカル確認専用）")
    parser.add_argument("--dry-run", action="store_true", help="検出のみ。ぼかし画像を保存しない")
    parser.add_argument("--doc", help="特定の document_id のみ処理（例: DOC_001）")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] SUPABASE_URL / SUPABASE_KEY が .env に設定されていません")
        sys.exit(1)
    if not VISION_API_KEY:
        print("[ERROR] GOOGLE_VISION_API_KEY が .env に設定されていません")
        sys.exit(1)

    print("=" * 60)
    print("ナンバープレート自動マスク（ローカル確認専用）")
    print(f"  モード: {'dry-run（検出のみ）' if args.dry_run else '通常（ぼかし保存あり）'}")
    print(f"  出力先: {OUTPUT_DIR}")
    print("=" * 60)

    # Supabase から車両データ取得
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    query = sb.from_("cars").select(
        "document_id, photo_main, photo_front, photo_side, photo_rear"
    )
    if args.doc:
        query = query.eq("document_id", args.doc)

    resp = query.execute()
    cars = resp.data or []
    print(f"\n対象車両: {len(cars)} 台\n")

    all_results = []
    for i, car in enumerate(cars, 1):
        doc_id = car["document_id"]
        print(f"[{i}/{len(cars)}] {doc_id}")
        results = process_car(car, args.dry_run)
        all_results.extend(results)

        # 途中経過表示
        detected = sum(1 for r in results if r["plates_found"] > 0)
        print(f"  → 検出あり: {detected} / {len(results)} 枚")

    # CSVレポート出力
    report_path = OUTPUT_DIR / "masking_report.csv"
    with open(report_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "document_id", "photo_field", "status",
            "plates_found", "original_path", "masked_path"
        ])
        writer.writeheader()
        writer.writerows(all_results)

    # サマリー
    total = len(all_results)
    success = sum(1 for r in all_results if r["status"] == "success")
    detected = sum(1 for r in all_results if r["plates_found"] > 0)
    no_plate = sum(1 for r in all_results if r["status"] == "no_plate_detected")
    skipped = sum(1 for r in all_results if r["status"] == "skipped_no_url")
    errors = sum(1 for r in all_results if "error" in r["status"] or "failed" in r["status"])

    print("\n" + "=" * 60)
    print("完了サマリー")
    print(f"  総処理数:       {total} 枚")
    print(f"  ぼかし成功:     {success} 枚")
    print(f"  検出あり:       {detected} 枚")
    print(f"  プレートなし:   {no_plate} 枚")
    print(f"  URL未設定スキップ: {skipped} 枚")
    print(f"  エラー:         {errors} 枚")
    print(f"\nレポート保存先: {report_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
