"""
Passione 500 クローラー（WooCommerce Store API版）

変更点（旧requests+BS版からの改善）:
- HTMLページ個別スクレイピング（3000+リクエスト）→ Store API JSON（~32リクエスト）
- タイムアウト解消（推定2〜5分で完了）
- 3199件全商品取得

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
import os
from supabase import create_client
from dotenv import load_dotenv

# --- 設定 ---
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

SHOP_NAME = "Passione 500"
SITE_BASE_URL = "https://passione500.it"
STORE_API_URL = f"{SITE_BASE_URL}/wp-json/wc/store/v1/products"
BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"

BATCH_SIZE = 50
PAGE_LIMIT = 100


def detect_target_cars(name, url):
    """商品名・URLから対応車種を判定"""
    text = f"{name or ''} {url or ''}".lower()
    cars = []
    if re.search(r'fiat[\s\-]*500|500', text):
        cars.append("Fiat 500")
    if re.search(r'\b126\b', text):
        cars.append("Fiat 126")
    if re.search(r'\b600\b', text):
        cars.append("Fiat 600")
    return ", ".join(cars) if cars else "Fiat 500"


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
    }


def batch_upsert(batch):
    """バッチでSupabaseにupsert"""
    try:
        supabase.table("parts").upsert(batch, on_conflict="product_no").execute()
        return True
    except Exception as e:
        print(f"  [Batch Upsert Error] {e}")
        return False


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

    # 1ページ目で総件数を取得
    print("\n1. 商品総数を確認中...")
    first_data, first_headers = fetch_products_page(session, 1)
    if not first_data:
        print("[ERROR] APIアクセス失敗")
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
