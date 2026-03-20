"""
D'Angelo Motori クローラー（再構築版）
- Selenium廃止 → requests + BeautifulSoup（3〜5倍高速化）
- URL収集: XMLサイトマップから英語商品URLを取得
- 推定実行時間: 90〜130分（旧版: 255分）
- GitHub Actions 6h制限に余裕で収まるように
"""

import sys
import time
import requests
import re
import os
import random
from bs4 import BeautifulSoup
from supabase import create_client
from dotenv import load_dotenv

# --- 設定 ---
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

SHOP_NAME = "D'Angelo Motori"
SITE_BASE_URL = "https://www.dangelomotori.it"
BOT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
BOT_HEADERS = {
    "User-Agent": BOT_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
    "Referer": "https://www.google.com/",
}
BATCH_SIZE = 50

TEST_MODE = False
TEST_TARGET = 10


def get_all_urls():
    """XMLサイトマップから英語商品URLを取得"""
    print("1. サイトマップを読み込み中...")
    all_urls = set()
    try:
        res = requests.get(f"{SITE_BASE_URL}/sitemap_index.xml", timeout=30, headers=BOT_HEADERS)
        sitemaps = re.findall(r'<loc>(.*?)</loc>', res.text)
        # product カテゴリサイトマップのみ（product_cat は商品URLを含まないため除外）
        target_sitemaps = [u for u in sitemaps
                           if ("product" in u or "prodotto" in u)
                           and "product_cat" not in u]
        print(f"   -> {len(target_sitemaps)} 個の商品サイトマップを発見")

        for sm in target_sitemaps:
            try:
                sub = requests.get(sm, timeout=30, headers=BOT_HEADERS)
                urls = [u for u in re.findall(r'<loc>(.*?)</loc>', sub.text)
                        if '/en/' in u and u != f"{SITE_BASE_URL}/en/shop/"]
                all_urls.update(urls)
                print(f"      {sm.split('/')[-1]}: {len(urls)} 件")
            except Exception as e:
                print(f"      [WARN] {sm}: {e}")

        result = sorted(list(all_urls))
        print(f"   ★合計 {len(result)} 件の商品URLを取得しました")
        return result
    except Exception as e:
        print(f"   サイトマップエラー: {e}")
        return []


def parse_price(price_el):
    """価格要素から数値を抽出（WooCommerce標準: セール価格対応）"""
    if not price_el:
        return 0.0
    # セール価格があると複数の .amount が出る → 最後（実売価格）を使用
    amounts = price_el.find_all(class_='amount') if hasattr(price_el, 'find_all') else [price_el]
    last = amounts[-1] if amounts else price_el
    text = last.get_text(strip=True)
    # €・ノーブレークスペースなどを除去
    cleaned = re.sub(r'[€\s\xa0]', '', text)
    cleaned = cleaned.replace(',', '.')
    try:
        return float(re.search(r'[\d.]+', cleaned).group())
    except:
        return 0.0


def detect_vehicle(name, url):
    text = f"{name} {url}".lower()
    cars = []
    if re.search(r'fiat[\s\-]*500|\b500\b', text):
        cars.append("Fiat 500")
    if re.search(r'\b126\b', text):
        cars.append("Fiat 126")
    if re.search(r'\b600\b', text):
        cars.append("Fiat 600")
    return ", ".join(cars) if cars else "Fiat 500"


def scrape_product(session, url):
    """1商品ページをrequestsで取得してパース"""
    try:
        r = session.get(url, timeout=20)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')

        # 品番
        sku_el = soup.find(class_='sku')
        if not sku_el:
            return None
        item_no = sku_el.get_text(strip=True)
        if not item_no:
            return None

        # 商品名（og:title → h1.product_title の順で取得）
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            name_en = og_title['content'].strip()
        else:
            h1 = soup.find('h1', class_='product_title') or soup.find('h1')
            name_en = h1.get_text(strip=True) if h1 else "Unknown"

        # 価格（WooCommerce: .price 内の最後の .amount）
        price_wrapper = soup.find(class_='price')
        price_euro = parse_price(price_wrapper)

        # 在庫
        stock_el = soup.find(class_='stock')
        if stock_el:
            stock_status = "在庫なし" if "out-of-stock" in (stock_el.get('class') or []) else "在庫あり"
        else:
            stock_status = "在庫あり" if soup.find('button', attrs={'name': 'add-to-cart'}) else "在庫なし"

        # 画像（ギャラリーの最初の画像リンク → フルサイズ）
        gallery_link = soup.select_one('.woocommerce-product-gallery__image a')
        if gallery_link and gallery_link.get('href'):
            image_url = gallery_link['href']
        else:
            og_img = soup.find('meta', property='og:image')
            image_url = og_img['content'] if og_img else ""

        # OEM番号
        oem_no = "N/A"
        body_text = soup.get_text()
        m = re.search(r'(?:Original|OEM|Rif|Ref).*?[:\.]?\s*([0-9\s/A-Z\-]{5,})',
                      body_text, re.IGNORECASE)
        if m:
            oem_no = m.group(1).strip()

        return {
            "shop_name": SHOP_NAME,
            "product_no": item_no,
            "oem_no": oem_no,
            "name_en": name_en,
            "price_euro": price_euro,
            "stock_status": stock_status,
            "image_url": image_url,
            "page_url": url,
            "target_cars": detect_vehicle(name_en, url),
            # name_jp / category は含めない → AI翻訳済みデータを保護
        }

    except Exception:
        return None


def batch_upsert(batch):
    """バッチでSupabaseにupsert"""
    try:
        supabase.table("parts").upsert(batch, on_conflict="product_no").execute()
        return True
    except Exception as e:
        print(f"   [Batch Upsert Error] {e}")
        return False


def main():
    from datetime import datetime
    start_time = time.time()
    print("=" * 60)
    print(f"{SHOP_NAME} クローラー 開始（再構築版）")
    print(f"開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    urls = get_all_urls()
    if not urls:
        print("[ERROR] URLを取得できませんでした")
        sys.exit(1)

    total = len(urls)
    print(f"\n2. 商品詳細の収集を開始します（{total} 件）...")

    session = requests.Session()
    session.headers.update(BOT_HEADERS)

    success = 0
    skip = 0
    batch = []

    for i, url in enumerate(urls, 1):
        if TEST_MODE and success >= TEST_TARGET:
            print(f"★ テストモード完了（{TEST_TARGET}件）")
            break

        time.sleep(random.uniform(0.5, 1.0))

        data = scrape_product(session, url)
        if not data:
            skip += 1
            continue

        batch.append(data)
        success += 1

        if len(batch) >= BATCH_SIZE:
            batch_upsert(batch)
            batch = []
            elapsed = (time.time() - start_time) / 60
            rate = success / elapsed if elapsed > 0 else 0
            eta = (total - i) / (rate * 60) / 60 if rate > 0 else 0
            print(f"  [{i}/{total}] 完了: {success}件保存 | 経過: {elapsed:.1f}分 | 残り推定: {eta:.1f}時間")

    if batch:
        batch_upsert(batch)

    elapsed_total = (time.time() - start_time) / 60
    print("\n" + "=" * 60)
    print(f"[OK] クローリング完了")
    print(f"終了時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"所要時間: {elapsed_total:.1f}分")
    print(f"成功: {success}件 / スキップ: {skip}件 / 合計URL: {total}件")
    print("=" * 60)


if __name__ == "__main__":
    main()
