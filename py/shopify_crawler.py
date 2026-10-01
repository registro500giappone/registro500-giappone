"""
Shopify 系ショップ共通クローラー（AutoBella Parts / Ricambio / Mr Fiat / 500Line）

Shopify の公開 JSON API（/products.json）を使う。Selenium 不要。

使い方:
    python shopify_crawler.py autobella
    python shopify_crawler.py ricambio
    python shopify_crawler.py mrfiat
    python shopify_crawler.py 500line
    python shopify_crawler.py autobella --dump out.json   # DBに書かず、upsertする内容をJSONに出す（検証用）

2026-09-30 に4本（autobella_crawler.py / ricambio_crawler.py / mrfiat_crawler.py / 500line_crawler.py）を
この1本に統合した。店ごとの違いは SHOPS の表に閉じ込め、処理の本体は共通にしてある。

統合で揃えた挙動（旧4本からの変更点）:
  - 500Line にも他3店と同じ異常終了ガードを付けた
    （1ページ目の取得失敗・対象0件・保存0件・失敗半数超で exit 1。旧 500line は常に exit 0 だった）
  - 商品APIの timeout=30 を全店に付けた（旧3本は無制限＝応答が止まると永久に待った）
  - SKU が空・'n/a'・'does not apply' のときは Shopify の商品IDを product_no にする
    （旧3本は 'n/a' を文字のまま保存し、別商品どうしが product_no='N/A' を上書きし合っていた）

⛔ 変えないもの（docs/refactor-baseline.md）:
  on_conflict="product_no"／upsert する8列／UA は短形式／ページ間 sleep 2秒／1件ずつ upsert（バッチ化しない）
"""

import json
import sys
import time
from datetime import datetime

import requests

from crawler_common import BOT_USER_AGENT_SHORT as BOT_USER_AGENT, get_supabase

# 店ごとの違いはここだけ。処理の本体には店名を書かない。
SHOPS = {
    "autobella": {
        "shop_name": "AutoBella Parts",
        "base_url": "https://autobellaparts.com",
        "currency": "GBP",           # 価格の通貨（EUR以外は open.er-api.com で EUR に換算）
        "fallback_rate": 1.17,       # 為替APIが落ちているときの換算レート
        "sku_prefix": "",            # product_no の接頭辞（他店と衝突しそうな店だけ付ける）
        "products_path": "/products/",
        "filter_product_type": False,  # FIAT 500 判定に product_type も使うか
    },
    "ricambio": {
        "shop_name": "Ricambio",
        "base_url": "https://www.ricambio.co.uk",
        "currency": "GBP",
        "fallback_rate": 1.17,
        "sku_prefix": "",
        "products_path": "/products/",
        "filter_product_type": False,
    },
    "mrfiat": {
        "shop_name": "Mr Fiat",
        "base_url": "https://mrfiat.com",
        "currency": "USD",
        "fallback_rate": 0.92,
        "sku_prefix": "",
        "products_path": "/products/",
        "filter_product_type": False,
    },
    "500line": {
        "shop_name": "500Line",
        "base_url": "https://www.500line.it",
        "currency": "EUR",
        "fallback_rate": 1.0,
        "sku_prefix": "500LINE-",    # 他ショップとの衝突を避けるため（2026-04-22 から）
        "products_path": "/en/products/",
        "filter_product_type": True,
    },
}

KEYWORDS = ['fiat', '500', 'cinquecento', 'nuova', 'abarth']
PAGE_SLEEP_SEC = 2      # ⛔ 短くしない（対サーバー礼節）
REQUEST_TIMEOUT = 30


def fetch_rate_to_eur(currency, fallback):
    """open.er-api.com から {currency}→EUR の直近レートを取得。EUR なら 1.0"""
    if currency == "EUR":
        return 1.0
    try:
        resp = requests.get(f"https://open.er-api.com/v6/latest/{currency}", timeout=10)
        resp.raise_for_status()
        rate = resp.json()["rates"]["EUR"]
        print(f"{currency}→EUR レート取得: {rate:.4f}")
        return rate
    except Exception as e:
        print(f"為替API失敗({e})。フォールバック {fallback} を使用")
        return fallback


def get_all_products(shop):
    """Shopify JSON API で全商品取得（250件ずつページング）"""
    print(f"\n{shop['shop_name']} クローラー開始")
    print("Shopify JSON API使用（高速）\n")

    all_products = []
    page = 1

    while True:
        url = f"{shop['base_url']}/products.json?limit=250&page={page}"
        try:
            response = requests.get(url, headers={"User-Agent": BOT_USER_AGENT}, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            products = response.json().get('products', [])

            if not products:
                break

            all_products.extend(products)
            print(f"ページ {page}: {len(products)}商品取得")

            page += 1
            time.sleep(PAGE_SLEEP_SEC)

        except Exception as e:
            print(f"エラー: {e}")
            # 1ページ目で落ちる＝APIに到達できていない。
            # 部分データを返して成功扱いにすると気づけないので落とす
            if page == 1:
                print("[ERROR] 商品APIにアクセスできませんでした")
                sys.exit(1)
            print(f"[WARN] ページ {page} 以降を取得できず打ち切ります（部分データ）")
            break

    print(f"\n合計 {len(all_products)}商品取得")
    return all_products


def is_fiat_500_related(product, use_product_type):
    """FIAT 500 関連商品か（title・本文・タグ、店によっては product_type も、のキーワード部分一致）"""
    title = (product.get('title') or '').lower()
    body = (product.get('body_html') or '').lower()
    tags = ' '.join(product.get('tags', [])).lower()
    text = f"{title} {body} {tags}"
    if use_product_type:
        text += " " + (product.get('product_type') or '').lower()
    return any(keyword in text for keyword in KEYWORDS)


def to_eur(price, rate):
    try:
        return float(price) * rate
    except Exception:
        return 0.0


def build_record(shop, product, rate):
    """商品1件を parts テーブルの1行（upsert する8列）にする"""
    # 最初のバリアント・最初の画像だけを使う
    variant = product['variants'][0] if product.get('variants') else {}
    image_url = product['images'][0]['src'] if product.get('images') else ""

    price_euro = to_eur(variant.get('price', '0'), rate)

    available = variant.get('available', False)
    stock_status = "在庫あり" if available else "在庫なし"

    # SKU（商品番号）。無い・意味の無い値なら Shopify の商品IDで代用する
    sku = variant.get('sku', '')
    if not sku or sku.lower() in ('n/a', 'does not apply'):
        sku = str(product['id'])
    sku = shop['sku_prefix'] + sku

    return {
        "shop_name": shop['shop_name'],
        "product_no": sku,
        "oem_no": "N/A",
        "name_en": product['title'],
        "price_euro": price_euro,
        "stock_status": stock_status,
        "image_url": image_url,
        "page_url": f"{shop['base_url']}{shop['products_path']}{product['handle']}",
    }


def save_to_supabase(supabase, record):
    try:
        supabase.table("parts").upsert(record, on_conflict="product_no").execute()
        return True
    except Exception as e:
        print(f"  [Error] {record['product_no']}: {e}")
        return False


def usage():
    print("使い方: python shopify_crawler.py <" + "|".join(SHOPS) + "> [--dump out.json]")
    sys.exit(2)


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    dump_path = None
    if "--dump" in argv:
        i = argv.index("--dump")
        try:
            dump_path = argv[i + 1]
        except IndexError:
            usage()
        del argv[i:i + 2]
    if len(argv) != 1 or argv[0] not in SHOPS:
        usage()
    shop = SHOPS[argv[0]]

    start_time = time.time()
    print("=" * 60)
    print(f"{shop['shop_name']} クローラー 開始")
    print(f"開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    rate = fetch_rate_to_eur(shop['currency'], shop['fallback_rate'])
    all_products = get_all_products(shop)
    fiat_products = [p for p in all_products if is_fiat_500_related(p, shop['filter_product_type'])]
    print(f"\nFIAT 500関連商品: {len(fiat_products)}件")

    # 0件は「商品が無い」ではなく取得か絞り込みの異常。successで終わると気づけない
    if not fiat_products:
        print("[ERROR] 対象商品が0件でした（取得または絞り込みの異常）")
        sys.exit(1)

    records = [build_record(shop, p, rate) for p in fiat_products]

    if dump_path:
        with open(dump_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=1)
        print(f"\n[DUMP] {len(records)}件を {dump_path} に書き出しました（DBには書いていません）")
        return

    print("\nSupabaseに保存中...\n")
    supabase = get_supabase()
    success_count = 0
    for i, record in enumerate(records, 1):
        if save_to_supabase(supabase, record):
            success_count += 1
        if i % 10 == 0:
            print(f"  [{i}/{len(records)}] 保存中...")

    elapsed = time.time() - start_time
    hours = int(elapsed // 3600)
    minutes = int((elapsed % 3600) // 60)
    seconds = int(elapsed % 60)

    print(f"\n完了: {success_count}/{len(records)}件保存")
    print("=" * 60)
    print("[OK] クローリング完了")
    print(f"終了時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"所要時間: {hours}時間{minutes}分{seconds}秒 ({elapsed/60:.1f}分)")
    print(f"処理件数: {len(records)} 商品")
    print(f"平均速度: {elapsed/len(records):.2f}秒/商品")
    print("=" * 60)

    # 保存が全滞り＝書込キー・RLSの問題（FD Ricambi で実際に3ヶ月気づかなかった）
    failed = len(records) - success_count
    if success_count == 0:
        print("[ERROR] 1件も保存できませんでした（書込キー・権限・RLSを確認）")
        sys.exit(1)
    if failed > len(records) // 2:
        print(f"[ERROR] 保存失敗が半数を超えました（{failed}/{len(records)}件）")
        sys.exit(1)
    if failed:
        print(f"[WARN] 保存に失敗した商品が {failed} 件あります")


if __name__ == "__main__":
    main()
