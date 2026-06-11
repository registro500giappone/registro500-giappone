"""
FD Ricambi クローラー（Shopware Store API版）

変更点（旧スクレイピング版からの改善）:
- HTMLページ個別スクレイピング（4,000+リクエスト）→ Store API JSON（45リクエスト）
- 403ブロック回避（GitHub Actions IPからでもAPIは通る）
- 推定実行時間: 2〜5分（旧版: 4時間以上でタイムアウト）

Shopware Store API:
- エンドポイント: /store-api/product
- 認証: sw-access-key ヘッダー（公開キー、フロントエンドに埋め込み済み）
- ページネーション: limit=100, p=1,2,3...
"""

import sys
import time
import requests
import re

from crawler_common import BOT_USER_AGENT, get_supabase
import crawler_common

# --- 設定 ---
supabase = get_supabase()

SHOP_NAME = "FD Ricambi"
SITE_BASE_URL = "https://www.fdricambi.com"
STORE_API_URL = f"{SITE_BASE_URL}/store-api/product"
SW_ACCESS_KEY = "SWSCY3ROUGRQDZCXVGLKT0G3NG"  # 公開キー（フロントエンドに埋め込まれている）

BATCH_SIZE = 50   # Supabase upsertのバッチサイズ
PAGE_LIMIT = 100  # Store APIの1ページあたり取得件数


def is_fiat_relevant(name):
    """Fiat 500/126/600 関連商品かどうか判定"""
    if not name:
        return False
    text = name.lower()
    return any(kw in text for kw in ['fiat', '500', '126', '600', 'cinquecento', 'abarth'])


def fetch_products_page(session, page):
    """Store APIで1ページ分の商品を取得"""
    payload = {
        "limit": PAGE_LIMIT,
        "p": page,
        "total-count-mode": 1,
        "associations": {
            "seoUrls": {},
            "cover": {
                "associations": {"media": {}}
            }
        },
        "includes": {
            "product": [
                "id", "productNumber", "name",
                "calculatedPrice", "cover", "availableStock", "seoUrls"
            ],
            "calculated_price": ["unitPrice"],
            "product_media": ["media"],
            "media": ["url"],
            "seo_url": ["seoPathInfo"]
        }
    }
    try:
        resp = session.post(STORE_API_URL, json=payload, timeout=30)
        print(f"  [DEBUG] ページ {page} HTTPステータス: {resp.status_code}")
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  [ERROR] ページ {page} 取得失敗: {e}")
        return None


def build_product_data(p):
    """APIレスポンスの1商品をSupabase保存用dictに変換"""
    product_no = p.get("productNumber") or ""
    if not product_no:
        return None

    name_en = p.get("name") or ""

    # 価格
    calc_price = p.get("calculatedPrice") or {}
    price_euro = float(calc_price.get("unitPrice") or 0)

    # 在庫
    avail = p.get("availableStock") or 0
    stock_status = "在庫あり" if avail > 0 else "在庫なし"

    # 画像URL
    cover = p.get("cover") or {}
    media = cover.get("media") or {}
    image_url = media.get("url") or ""

    # SEO URL → ページURL
    seo_urls = p.get("seoUrls") or []
    if seo_urls:
        seo_path = seo_urls[0].get("seoPathInfo") or ""
        page_url = f"{SITE_BASE_URL}/en/{seo_path}" if seo_path else ""
    else:
        page_url = ""

    # 対応車種（商品名から判定）
    text = name_en.lower()
    cars = []
    if re.search(r'fiat[\s\-]*500|500\s', text) or '500' in text:
        cars.append("Fiat 500")
    if re.search(r'\b126\b', text):
        cars.append("Fiat 126")
    if re.search(r'\b600\b', text):
        cars.append("Fiat 600")
    target_cars = ", ".join(cars) if cars else "Fiat 500"

    return {
        "shop_name": SHOP_NAME,
        "product_no": product_no,
        "oem_no": "N/A",
        "name_en": name_en,
        "price_euro": price_euro,
        "stock_status": stock_status,
        "image_url": image_url,
        "page_url": page_url,
        "target_cars": target_cars,
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
        "sw-access-key": SW_ACCESS_KEY,
        "Content-Type": "application/json",
        "User-Agent": BOT_USER_AGENT,
        "Accept": "application/json"
    })

    # 1ページ目で総件数を取得
    print("\n1. 商品総数を確認中...")
    first_page = fetch_products_page(session, 1)
    if not first_page:
        print("[ERROR] APIアクセス失敗 - Store APIが応答しませんでした")
        sys.exit(1)

    total = first_page.get("total") or 0
    total_pages = (total + PAGE_LIMIT - 1) // PAGE_LIMIT
    print(f"  -> 総商品数: {total} 件 / {total_pages} ページ")

    # 全ページ処理
    print(f"\n2. 全商品取得・保存中...")
    success = 0
    skip = 0
    batch = []
    elements = first_page.get("elements") or []

    for page in range(1, total_pages + 1):
        if page == 1:
            elements = first_page.get("elements") or []
        else:
            time.sleep(1)
            data = fetch_products_page(session, page)
            if not data:
                print(f"  [WARN] ページ {page} スキップ")
                continue
            elements = data.get("elements") or []

        for p in elements:
            name = p.get("name") or ""
            if not is_fiat_relevant(name):
                skip += 1
                continue

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

    # 残りをupsert
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
