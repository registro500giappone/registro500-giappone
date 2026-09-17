"""
Ricambio.co.uk クローラー

Shopify JSON APIを使用（Selenium不要、高速）
通貨: GBP → EUR換算
"""

import sys
import requests
import time

from crawler_common import BOT_USER_AGENT_SHORT as BOT_USER_AGENT, get_supabase

# 設定
supabase = get_supabase()

SHOP_NAME = "Ricambio"
BASE_URL = "https://www.ricambio.co.uk"

GBP_TO_EUR_FALLBACK = 1.17

def fetch_gbp_to_eur():
    """open.er-api.com から GBP→EUR の直近レートを取得"""
    try:
        resp = requests.get("https://open.er-api.com/v6/latest/GBP", timeout=10)
        resp.raise_for_status()
        rate = resp.json()["rates"]["EUR"]
        print(f"GBP→EUR レート取得: {rate:.4f}")
        return rate
    except Exception as e:
        print(f"為替API失敗({e})。フォールバック {GBP_TO_EUR_FALLBACK} を使用")
        return GBP_TO_EUR_FALLBACK

def get_all_products():
    """Shopify JSON APIで全商品取得"""
    print(f"\n{SHOP_NAME} クローラー開始")
    print("Shopify JSON API使用（高速）\n")

    all_products = []
    page = 1

    while True:
        url = f"{BASE_URL}/products.json?limit=250&page={page}"

        try:
            response = requests.get(url, headers={"User-Agent": BOT_USER_AGENT})
            response.raise_for_status()
            data = response.json()

            products = data.get('products', [])

            if not products:
                break

            all_products.extend(products)
            print(f"ページ {page}: {len(products)}商品取得")

            page += 1
            time.sleep(2)

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

def is_fiat_500_related(product):
    """FIAT 500関連商品か判定"""
    title = (product.get('title') or '').lower()
    body = (product.get('body_html') or '').lower()
    tags = ' '.join(product.get('tags', [])).lower()

    keywords = ['fiat', '500', 'cinquecento', 'nuova', 'abarth']

    text = f"{title} {body} {tags}"
    return any(keyword in text for keyword in keywords)

def convert_gbp_to_eur(price_gbp, rate):
    """GBP → EUR換算"""
    try:
        return float(price_gbp) * rate
    except:
        return 0.0

def save_to_supabase(product, rate):
    """Supabaseに保存"""
    variant = product['variants'][0] if product.get('variants') else {}
    image_url = product['images'][0]['src'] if product.get('images') else ""

    price_gbp = variant.get('price', '0')
    price_euro = convert_gbp_to_eur(price_gbp, rate)

    available = variant.get('available', False)
    stock_status = "在庫あり" if available else "在庫なし"

    sku = variant.get('sku', 'N/A')
    if not sku or sku.lower() == 'does not apply':
        sku = str(product['id'])

    data = {
        "shop_name": SHOP_NAME,
        "product_no": sku,
        "oem_no": "N/A",
        "name_en": product['title'],
        "price_euro": price_euro,
        "stock_status": stock_status,
        "image_url": image_url,
        "page_url": f"{BASE_URL}/products/{product['handle']}"
    }

    try:
        supabase.table("parts").upsert(data, on_conflict="product_no").execute()
        return True
    except Exception as e:
        print(f"  [Error] {sku}: {e}")
        return False

def main():
    from datetime import datetime
    start_time = time.time()
    start_datetime = datetime.now()

    print("=" * 60)
    print(f"{SHOP_NAME} クローラー 開始")
    print(f"開始時刻: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 為替レート取得
    gbp_to_eur = fetch_gbp_to_eur()

    all_products = get_all_products()
    fiat_products = [p for p in all_products if is_fiat_500_related(p)]

    print(f"\nFIAT 500関連商品: {len(fiat_products)}件")

    # 0件は「商品が無い」ではなく取得か絞り込みの異常。successで終わると気づけない
    if not fiat_products:
        print("[ERROR] 対象商品が0件でした（取得または絞り込みの異常）")
        sys.exit(1)

    print("\nSupabaseに保存中...\n")

    success_count = 0
    for i, product in enumerate(fiat_products, 1):
        if save_to_supabase(product, gbp_to_eur):
            success_count += 1

        if i % 10 == 0:
            print(f"  [{i}/{len(fiat_products)}] 保存中...")

    # 実行時間表示
    end_time = time.time()
    end_datetime = datetime.now()
    elapsed = end_time - start_time
    hours = int(elapsed // 3600)
    minutes = int((elapsed % 3600) // 60)
    seconds = int(elapsed % 60)

    print(f"\n完了: {success_count}/{len(fiat_products)}件保存")
    print("=" * 60)
    print("[OK] クローリング完了")
    print(f"終了時刻: {end_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"所要時間: {hours}時間{minutes}分{seconds}秒 ({elapsed/60:.1f}分)")
    print(f"処理件数: {len(fiat_products)} 商品")
    if len(fiat_products) > 0:
        print(f"平均速度: {elapsed/len(fiat_products):.2f}秒/商品")
    print("=" * 60)

    # 保存が全滞り＝書込キー・RLSの問題（FD Ricambi で実際に3ヶ月気づかなかった）
    failed = len(fiat_products) - success_count
    if success_count == 0:
        print("[ERROR] 1件も保存できませんでした（書込キー・権限・RLSを確認）")
        sys.exit(1)
    if failed > len(fiat_products) // 2:
        print(f"[ERROR] 保存失敗が半数を超えました（{failed}/{len(fiat_products)}件）")
        sys.exit(1)
    if failed:
        print(f"[WARN] 保存に失敗した商品が {failed} 件あります")

if __name__ == "__main__":
    main()
