# -*- coding: utf-8 -*-
"""
壁紙ジェネレータ 段1: タイル用スプライトシート生成（試作）
- Supabase REST（公開キー）から対象車両を取得（sns_share_optout を除外）
- Firebase Storage の photo_main を並列DL（ローカルキャッシュ）
- 256px角にセンタークロップして 13x13 に敷き詰め
- 代表色（中央部の平均色）を抽出して manifest に格納
"""
import os, json, io, sys, colorsys
from concurrent.futures import ThreadPoolExecutor
import requests
from PIL import Image, ImageOps

SUPABASE_URL = "https://ttlttclfovuzafvghvaq.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt"

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(BASE, "cache")
OUT = os.path.join(BASE, "out")
os.makedirs(CACHE, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

TILE = 256
COLS = 13

# 縦位置で撮られたのに EXIF が剥がれて横倒しのまま保存された写真の手当て。
# 値は「時計回りに何度回すか」の逆符号（Pillow の rotate は反時計回りが正）。
# ⚠️ 元データ側が傾いたままなので、サイト本体でも同じ写真は横倒しに見えている。
ROT_FIX = json.load(open(os.path.join(BASE, "rotate-fix.json"), encoding="utf-8"))


def fetch_cars():
    url = f"{SUPABASE_URL}/rest/v1/cars"
    params = {
        "select": "document_id,photo_main,year,model_display_a,body_color",
        "photo_main": "not.is.null",
        "or": "(sns_share_optout.is.null,sns_share_optout.is.false)",
        "limit": "1000",
    }
    h = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}"}
    r = requests.get(url, params=params, headers=h, timeout=30)
    r.raise_for_status()
    rows = [x for x in r.json() if x.get("photo_main")]
    # 登録順の安定化: document_id の数値部分で並べる
    def keyf(x):
        d = str(x.get("document_id") or "")
        num = "".join(ch for ch in d if ch.isdigit())
        return (int(num) if num else 10**9, d)
    rows.sort(key=keyf)
    return rows


def download(row):
    did = row["document_id"]
    path = os.path.join(CACHE, f"{did}.jpg")
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return path
    try:
        r = requests.get(row["photo_main"], timeout=60)
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
        return path
    except Exception as e:
        print(f"  NG {did}: {e}", file=sys.stderr)
        return None


def rep_color(im):
    """中央60%の平均色 → 車体色に寄せる"""
    w, h = im.size
    box = (int(w * .2), int(h * .2), int(w * .8), int(h * .8))
    c = im.crop(box).convert("RGB").resize((1, 1), Image.LANCZOS)
    return c.getpixel((0, 0))


def main():
    rows = fetch_cars()
    print(f"対象: {len(rows)} 台")

    with ThreadPoolExecutor(max_workers=8) as ex:
        paths = list(ex.map(download, rows))

    items, tiles = [], []
    for row, p in zip(rows, paths):
        if not p:
            continue
        try:
            im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        except Exception as e:
            print(f"  破損 {row['document_id']}: {e}", file=sys.stderr)
            continue
        deg = ROT_FIX.get(row["document_id"])
        if deg:
            im = im.rotate(deg, expand=True)
        tile = ImageOps.fit(im, (TILE, TILE), Image.LANCZOS, centering=(0.5, 0.5))
        r, g, b = rep_color(tile)
        hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        tiles.append(tile)
        items.append({
            "i": len(tiles) - 1,
            "id": row["document_id"],
            "year": (row.get("year") or "").strip(),
            "model": (row.get("model_display_a") or "").strip(),
            "rgb": [r, g, b],
            "hsv": [round(hh, 4), round(ss, 4), round(vv, 4)],
        })

    n = len(tiles)
    rowsn = (n + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * TILE, rowsn * TILE), (255, 255, 255))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % COLS) * TILE, (i // COLS) * TILE))

    wp = os.path.join(OUT, "sprite-v1.webp")
    sheet.save(wp, "WEBP", quality=82, method=6)
    sheet.save(os.path.join(OUT, "sprite-v1.jpg"), "JPEG", quality=86, optimize=True)

    manifest = {"tile": TILE, "cols": COLS, "rows": rowsn, "count": n, "items": items}
    with open(os.path.join(OUT, "manifest-v1.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))

    print(f"生成: {n} タイル / シート {sheet.size[0]}x{sheet.size[1]} = {sheet.size[0]*sheet.size[1]/1e6:.1f} Mpx")
    print(f"WebP: {os.path.getsize(wp)/1024/1024:.2f} MB")
    print(f"JPEG: {os.path.getsize(os.path.join(OUT,'sprite-v1.jpg'))/1024/1024:.2f} MB")
    print(f"manifest: {os.path.getsize(os.path.join(OUT,'manifest-v1.json'))/1024:.1f} KB")


if __name__ == "__main__":
    main()
