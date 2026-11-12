# -*- coding: utf-8 -*-
"""トップの車一覧（500・126）に出す小さな写真を焼く。

なぜ：一覧のカードは幅160px前後なのに、Firebase の元の写真（1枚130〜400KB・取得1秒超）を
そのまま読んでいて、灰色のカードが数秒並んでいた（2026-11-12 実測）。
横480px前後の WebP（数十KB）を自ドメインから配れば、同じ見た目で桁違いに軽い。

出力（Cloudflare Pages が自ドメインで配信する）：
  card-thumbs/<写真URLの sha1 先頭16桁>.webp
  card-thumbs/map.json   { 写真URL: ファイル名 }

⭐ ファイル名は写真URLから決める＝オーナーが写真を差し替えると URL が変わり、新しい1枚が焼かれる。
   同じ名前を上書きしないので、配信は長期キャッシュ（_headers の immutable）にできる。
⭐ ページ側は map.json に載っていない写真（焼く前の新しい登録など）を元のURLで出す＝焼けていなくても壊れない。
⚠️ 公開キーで読む＝RLS が効いて匿名の訪問者に見える車だけが対象（非公開の車の写真を自ドメインに置かない）。

使い方:
  python build_card_thumbs.py     # 足りない分だけ焼き、使われなくなった分を消す
"""
import os, sys, json, hashlib
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor

import requests
from PIL import Image, ImageOps

from common import require, sb_select, supa_key

require("SUPABASE_URL", "SUPABASE_KEY")
PUBLIC_KEY = supa_key(service=False)

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT = os.path.join(ROOT, "card-thumbs")
MAP = os.path.join(OUT, "map.json")

# カードは最大でも幅170px前後×端末の画素密度3倍＝480px あれば足りる。
# 縦長の写真はカードの枠で上下が切れるので、短い辺も 360px は残す。
WIDTH, MIN_SIDE, QUALITY = 480, 360, 72


def name_of(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16] + ".webp"


def bake(url):
    path = os.path.join(OUT, name_of(url))
    if os.path.exists(path) and os.path.getsize(path) > 500:
        return url, True
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        im = ImageOps.exif_transpose(Image.open(BytesIO(r.content)))
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        w, h = im.size
        k = min(1.0, max(WIDTH / w, MIN_SIDE / h))
        if k < 1.0:
            im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
        im.save(path, "WEBP", quality=QUALITY, method=6)
        return url, True
    except Exception as e:
        print(f"  NG {url[:90]}: {e}", file=sys.stderr)
        return url, False


def main():
    os.makedirs(OUT, exist_ok=True)
    rows = sb_select("cars", "photo_main", filters={"photo_main": "not.is.null"}, key=PUBLIC_KEY)
    urls = sorted({x["photo_main"] for x in rows if (x.get("photo_main") or "").startswith("https://")})
    with ThreadPoolExecutor(max_workers=6) as ex:
        results = list(ex.map(bake, urls))
    ok = {u: name_of(u) for u, good in results if good}

    keep = set(ok.values()) | {"map.json"}
    removed = 0
    for f in os.listdir(OUT):
        if f not in keep:
            os.remove(os.path.join(OUT, f))
            removed += 1

    with open(MAP, "w", encoding="utf-8", newline="\n") as f:
        json.dump(ok, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        f.write("\n")

    total = sum(os.path.getsize(os.path.join(OUT, n)) for n in ok.values())
    print(f"写真 {len(urls)} 枚 → 焼けた {len(ok)} 枚（失敗 {len(urls) - len(ok)}・消した {removed}）合計 {total // 1024} KB")


if __name__ == "__main__":
    main()
