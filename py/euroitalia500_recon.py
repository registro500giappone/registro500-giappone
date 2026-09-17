"""
EuroItalia500 クローラー（WooCommerce Store API版）

背景:
- 運営 Julcar 500 S.r.l. が EC を PrestaShop → WooCommerce に移行。
- 旧サイト https://euroitalia500-commerce.it は閉鎖。新サイト https://shop.euroitalia500.it へ。
- 旧 euro_search.py（PrestaShopセレクタ依存）は廃止し、本ファイルへ全面移行。

WooCommerce Store API:
- エンドポイント: /wp-json/wc/store/v1/products
- 認証不要（公開API）
- ページネーション: per_page=100&page=1,2,3...
- 総件数: X-WP-Total レスポンスヘッダー
"""

import sys
import time
import requests
import re

from crawler_common import BOT_USER_AGENT, get_supabase, detect_target_cars
import crawler_common

# --- 設定 ---
supabase = get_supabase()

SHOP_NAME = "EuroItalia500"
SITE_BASE_URL = "https://shop.euroitalia500.it"
STORE_API_URL = f"{SITE_BASE_URL}/wp-json/wc/store/v1/products"

BATCH_SIZE = 50
PAGE_LIMIT = 100


def fetch_products_page(session, page, max_retries=5):
    """Store APIで1ページ分の商品を取得（202/5xxの一時エラーはリトライ）"""
    for attempt in range(1, max_retries + 1):
        try:
            resp = session.get(
                STORE_API_URL,
                params={"per_page": PAGE_LIMIT, "page": page},
                timeout=30
            )
            print(f"  [DEBUG] ページ {page} HTTPステータス: {resp.status_code} (試行 {attempt}/{max_retries})")

            # 202 Accepted = WordPressキャッシュのwarm-up中など。待機してリトライ
            if resp.status_code == 202 or resp.status_code >= 500:
                wait = min(2 ** attempt, 30)
                print(f"  [RETRY] {resp.status_code} を受信。{wait}秒待機してリトライ")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            return resp.json(), resp.headers
        except Exception as e:
            print(f"  [ERROR] ページ {page} 取得失敗 (試行 {attempt}/{max_retries}): {e}")
            if attempt < max_retries:
                wait = min(2 ** attempt, 30)
                time.sleep(wait)
    return None, {}


def build_product_data(p):
    """APIレスポンスの1商品をSupabase保存用dictに変換"""
    sku = p.get("sku") or ""
    if not sku:
        return None

    # HTMLエンティティを除去
    name_en = re.sub(r'&#\d+;|&\w+;', ' ', p.get("name") or "").strip()
    name_en = re.sub(r'\s+', ' ', name_en)

    # 価格（cents → EUR: currency_minor_unit=2）
    prices = p.get("prices") or {}
    price_raw = prices.get("price") or "0"
    try:
        price_euro = float(price_raw) / 100.0
    except (ValueError, TypeError):
        price_euro = 0.0

    # 在庫
    is_in_stock = p.get("is_in_stock", False)
    stock_status = "在庫あり" if is_in_stock else "在庫なし"

    # 画像URL
    images = p.get("images") or []
    image_url = images[0].get("src", "") if images else ""

    # ページURL
    page_url = p.get("permalink") or ""

    return {
        "shop_name": SHOP_NAME,
        "product_no": sku,
        "oem_no": "N/A",
        "name_en": name_en,
        "price_euro": price_euro,
        "stock_status": stock_status,
        "image_url": image_url,
        "page_url": page_url,
        "target_cars": detect_target_cars(name_en, page_url),
        # name_jp / category は含めない → AI翻訳済みデータを保護
    }


def batch_upsert(batch):
    """バッチでSupabaseにupsert（共通モジュールへ委譲）"""
    return crawler_common.batch_upsert(supabase, batch)


def main():
    from datetime import datetime
    start_time = time.time()

    print("=" * 60)
    print(f"{SHOP_NAME} クローラー 開始（Store API版）")
    print(f"開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    session = requests.Session()
    session.headers.update({
        "User-Agent": BOT_USER_AGENT,
        "Accept": "application/json"
    })

    # 1ページ目で総件数を取得（サイト一時不安定に備えた外部リトライ付き）
    # WordPress Store API のキャッシュwarm-upが10分以上続くケースに対応
    # 待機時間: 3,5,5,10分（合計23分の猶予）
    print("\n1. 商品総数を確認中...")
    first_data, first_headers = None, {}
    RETRY_WAITS_MIN = [3, 5, 5, 10]
    TOTAL_ATTEMPTS = len(RETRY_WAITS_MIN) + 1  # = 5
    for attempt in range(1, TOTAL_ATTEMPTS + 1):
        first_data, first_headers = fetch_products_page(session, 1)
        if first_data:
            break
        if attempt < TOTAL_ATTEMPTS:
            wait_min = RETRY_WAITS_MIN[attempt - 1]
            print(f"[RETRY] APIアクセス失敗。{wait_min}分後に再試行 ({attempt}/{TOTAL_ATTEMPTS})...")
            time.sleep(wait_min * 60)
    if not first_data:
        print(f"[ERROR] APIアクセス失敗（{TOTAL_ATTEMPTS}回試行）")
        sys.exit(1)

    total = int(first_headers.get("X-WP-Total", 0))
    total_pages = (total + PAGE_LIMIT - 1) // PAGE_LIMIT
    print(f"  -> 総商品数: {total} 件 / {total_pages} ページ")

    # 全ページ処理
    print(f"\n2. 全商品取得・保存中...")
    success = 0
    skip = 0
    batch = []

    for page in range(1, total_pages + 1):
        if page == 1:
            elements = first_data
        else:
            time.sleep(1)
            elements, _ = fetch_products_page(session, page)
            if not elements:
                print(f"  [WARN] ページ {page} スキップ")
                continue

        for p in elements:
            record = build_product_data(p)
            if not record:
                skip += 1
                continue

            batch.append(record)
            success += 1

            if len(batch) >= BATCH_SIZE:
                batch_upsert(batch)
                batch = []

        elapsed = (time.time() - start_time) / 60
        print(f"  [{page}/{total_pages}] 保存: {success}件 / スキップ: {skip}件 | 経過: {elapsed:.1f}分")

    if batch:
        batch_upsert(batch)

    elapsed_total = (time.time() - start_time) / 60
    print("\n" + "=" * 60)
    print(f"[OK] クローリング完了")
    print(f"終了時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"所要時間: {elapsed_total:.1f}分")
    print(f"保存: {success}件 / スキップ: {skip}件 / 総件数: {total}件")
    print("=" * 60)


if __name__ == "__main__":
    main()
    crawler_common.exit_if_upsert_failed()
