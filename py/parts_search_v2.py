"""
FD Ricambi クローラー（再構築版）
- Selenium廃止 → requests + BeautifulSoup（5〜7倍高速化）
- SELECT廃止 → upsertのみ（AI翻訳済みデータは対象外カラムのため保護される）
- バッチupsert（50件まとめてDB送信）
- 推定実行時間: 1.5〜3時間（旧版: 17時間）
"""

import time
import requests
import gzip
import io
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

SHOP_NAME = "FD Ricambi"
SITE_BASE_URL = "https://www.fdricambi.com"
BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
BATCH_SIZE = 50  # まとめてupsertする件数

# テストモード（Trueなら10件で停止）
TEST_MODE = False
TEST_TARGET = 10


def get_fd_urls():
    """サイトマップから全商品URLを取得"""
    print("1. サイトマップを読み込み中...")
    sitemap_index_url = f"{SITE_BASE_URL}/sitemap.xml"
    try:
        response = requests.get(sitemap_index_url, timeout=30)
        product_sitemaps = re.findall(r'(https://.*?product-sitemap.*?\.xml\.gz)', response.text)
        all_urls = []

        print(f"   -> {len(product_sitemaps)} 個の圧縮サイトマップを発見")
        for gz_url in product_sitemaps:
            try:
                res = requests.get(gz_url, timeout=30)
                with gzip.GzipFile(fileobj=io.BytesIO(res.content)) as f:
                    xml_content = f.read().decode('utf-8')
                urls = re.findall(r'<loc>(https://.*?)</loc>', xml_content)
                urls = [u for u in urls if '/en/' in u and not u.endswith(('.jpg', '.png', '.pdf', '.xml', '.gz'))]
                all_urls.extend(urls)
                print(f"      {gz_url.split('/')[-1]} -> {len(urls)} 件")
            except Exception as e:
                print(f"      [WARN] {gz_url}: {e}")

        all_urls = list(set(all_urls))
        print(f"   ★合計 {len(all_urls)} 件の商品URLを取得しました")
        return all_urls
    except Exception as e:
        print(f"   サイトマップエラー: {e}")
        return []


def clean_price(price_str):
    if not price_str:
        return 0.0
    price_val = re.sub(r'[^\d.,]', '', str(price_str))
    if ',' in price_val and '.' in price_val:
        price_val = price_val.replace('.', '').replace(',', '.')
    elif ',' in price_val:
        price_val = price_val.replace(',', '.')
    try:
        return float(price_val)
    except:
        return 0.0


def scrape_product(session, url):
    """
    1商品ページをrequestsで取得してパース。
    取得できなければNoneを返す。
    """
    try:
        r = session.get(url, timeout=15)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')

        # 品番（最初のproduct-detail-ordernumberを使用）
        sku_el = soup.find(class_='product-detail-ordernumber')
        if not sku_el:
            return None
        item_no = sku_el.text.strip()
        if not item_no:
            return None

        # 価格
        price_meta = soup.find('meta', itemprop='price')
        price_euro = clean_price(price_meta['content']) if price_meta else 0.0

        # 在庫
        stock_el = soup.find(class_='product-stock')
        if stock_el:
            stock_text = stock_el.text.strip().lower()
            stock_status = "在庫あり" if "in stock" in stock_text else "在庫なし"
        else:
            stock_status = "不明"

        # 商品名
        h1 = soup.find('h1')
        name_en = h1.text.strip() if h1 else "Unknown"

        # 画像
        og_img = soup.find('meta', property='og:image')
        image_url = og_img['content'] if og_img else ""

        # OEM番号
        oem_no = "N/A"
        for th in soup.find_all('th'):
            if any(k in th.text for k in ['OEM codes', 'Reference number']):
                td = th.find_next_sibling('td')
                if td and td.text.strip():
                    oem_no = td.text.strip()
                    break

        # 対応車種（商品名とタイトルから判定）
        full_title = soup.title.text if soup.title else ""
        text = f"{name_en} {full_title}".lower()
        cars = []
        if re.search(r'fiat[\s\-]*500', text):
            cars.append("Fiat 500")
        if re.search(r'\b126\b', text):
            cars.append("Fiat 126")
        if re.search(r'\b600\b', text):
            cars.append("Fiat 600")
        target_cars = ", ".join(cars) if cars else "Fiat 500"

        return {
            "shop_name": SHOP_NAME,
            "product_no": item_no,
            "oem_no": oem_no,
            "name_en": name_en,
            "price_euro": price_euro,
            "stock_status": stock_status,
            "image_url": image_url,
            "page_url": url,
            "target_cars": target_cars,
            # name_jp / category は含めない → upsert時に既存データを上書きしない（AI翻訳保護）
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

    urls = get_fd_urls()
    if not urls:
        print("[ERROR] URLを取得できませんでした")
        return

    total = len(urls)
    print(f"\n2. 商品詳細の収集を開始します（{total} 件）...")

    session = requests.Session()
    session.headers.update({"User-Agent": BOT_USER_AGENT})

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
            if i % 100 == 0:
                print(f"  [{i}/{total}] スキップ: {url}")
            continue

        batch.append(data)
        success += 1

        # バッチがたまったらupsert
        if len(batch) >= BATCH_SIZE:
            batch_upsert(batch)
            batch = []
            elapsed = (time.time() - start_time) / 60
            rate = success / elapsed if elapsed > 0 else 0
            eta = (total - i) / (rate * 60) / 60 if rate > 0 else 0
            print(f"  [{i}/{total}] 完了: {success}件保存 | 経過: {elapsed:.1f}分 | 残り推定: {eta:.1f}時間")

    # 残りをupsert
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
