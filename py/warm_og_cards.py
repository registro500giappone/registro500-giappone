"""SNS カードの写真 /og-car/<番号>.jpg を全車ぶん先に作っておく（2026-11-19）

なぜ要るか: カードの写真は Cloudflare の画像変換で作る（functions/og-car/[file].js）。
  初めての写真は変換に約3秒かかり、X のクローラーはそれを待たずに「写真なし」のカードにする
  （一度変換した写真は約0.07秒で返る＝実測）。そこで毎晩、全車の写真を一度ずつ取っておく。
費用: 画像変換の無料枠は「月5,000種類」＝同じ写真・同じ設定は月に何度取っても1種類。超えても課金はなく変換が失敗するだけ。
ここが失敗してもサイトは壊れない（カードの写真が遅いだけ）＝ワークフローでは continue-on-error。
"""
import sys
from concurrent.futures import ThreadPoolExecutor

import requests

from common import require, sb_select, supa_key

require("SUPABASE_URL", "SUPABASE_KEY")
PUBLIC_KEY = supa_key(service=False)
BASE = "https://www.registro500.com/og-car/"


def warm(no):
    try:
        r = requests.get(f"{BASE}{no}.jpg", timeout=30, allow_redirects=False)
        return no, r.status_code, r.headers.get("content-type", "")
    except requests.RequestException as e:
        return no, 0, str(e)[:80]


def main():
    rows = sb_select("cars", "document_id,photo_main", filters={"photo_main": "not.is.null"}, key=PUBLIC_KEY)
    nos = sorted(
        int(x["document_id"][4:]) for x in rows
        if (x.get("document_id") or "").startswith("DOC_") and x["document_id"][4:].isdigit()
        and (x.get("photo_main") or "").startswith("https://firebasestorage.googleapis.com/")
    )
    with ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(warm, nos))
    bad = [r for r in results if r[1] != 200 or not r[2].startswith("image/jpeg")]
    print(f"カードの写真: {len(nos)}台中 {len(nos) - len(bad)}台 OK")
    for no, code, info in bad:
        print(f"  ⚠️ DOC_{no}: {code} {info}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
