"""
FD Ricambi クローラー（カテゴリ別分割版）

変更点:
- サイトマップ全量取得 → モデル別カテゴリページ巡回に変更
- --model 引数で fiat-500 / fiat-126 を指定
- crawl-fd.yml の並列ジョブから個別に呼び出される

使用方法:
  python parts_search_v2.py --model fiat-500
  python parts_search_v2.py --model fiat-126
"""

import argparse
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

SHOP_NAME = "FD Ricambi"
SITE_BASE_URL = "https://www.fdricambi.com"
BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
BATCH_SIZE = 50

# テストモード（Trueなら10件で停止）
TEST_MODE = False
TEST_TARGET = 10


def get_top_level_categories(session, model):
    """モデルトップページから直下サブカテゴリURLを収集"""
    url = f"{SITE_BASE_URL}/en/{model}/"
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        cats = set()
        # /en/fiat-500/XXX/ 形式（直下1階層のみ）
        pattern = re.compile(
            r'^' + re.escape(SITE_BASE_URL) + r'/en/' + re.escape(model) + r'/[^/]+/$'
        )
        for a in soup.find_all('a', href=True):
            href = a['href'].split('?')[0]
            if not href.startswith('http'):
                href = SITE_BASE_URL + href
            if pattern.match(href):
                cats.add(href)
        result = sorted(cats)
        print(f"  -> サブカテゴリ {len(result)} 件発見")
        return result
    except Exception as e:
        print(f"  [ERROR] カテゴリ取得失敗: {e}")
        return []


def get_product_urls_from_category(session, cat_url):
    """カテゴリページを全ページ巡回して商品URLを収集"""
    product_urls = []
    page = 1
    while True:
        url = f"{cat_url}?p={page}"
        try:
            resp = session.get(url, timeout=30)
            if resp.status_code != 200:
                break
            soup = BeautifulSoup(resp.text, 'html.parser')

            found = []
            for el in soup.find_all(class_='product-name'):
                a = el if el.name == 'a' else el.find('a')
                if not a:
                    continue
                href = a.get('href', '').split('?')[0]
                if not href.startswith('http'):
                    href = SITE_BASE_URL + href
                # /en/product-slug/ 形式（深さ2）のみ対象
                parts = href.rstrip('/').split('/')
                if len(parts) == 5 and parts[3] == 'en':
                    found.append(href)

            if not found:
                break

            product_urls.extend(found)
            page += 1
            time.sleep(random.uniform(0.5, 1.0))

        except Exception as e:
            print(f"  [WARN] {url}: {e}")
            break

    return product_urls


def get_model_urls(model):
    """指定モデルの全商品URLを収集（カテゴリ巡回方式）"""
    session = requests.Session()
    session.headers.update({"User-Agent": BOT_USER_AGENT})

    print(f"\n1. {model} カテゴリから商品URL収集中...")
    cats = get_top_level_categories(session, model)
    if not cats:
        print("[ERROR] カテゴリを取得できませんでした")
        return [], session

    all_urls = set()
    for i, cat in enumerate(cats, 1):
        cat_name = cat.rstrip('/').split('/')[-1]
        print(f"  [{i}/{len(cats)}] {cat_name} ...")
        urls = get_product_urls_from_category(session, cat)
        new_count = len(set(urls) - all_urls)
        all_urls.update(urls)
        print(f"      -> {len(urls)}件取得（新規 {new_count}件、累計 {len(all_urls)}件）")
        time.sleep(1)

    result = list(all_urls)
    print(f"\n★ 合計 {len(result)} 件の商品URLを収集")
    return result, session


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
    except Exception:
        return 0.0


def scrape_product(session, url):
    """1商品ページを取得してパース。取得できなければNoneを返す。"""
    try:
        r = session.get(url, timeout=15)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')

        # 品番
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

        # 対応車種
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
        }

    except Exception:
        return None


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

    parser = argparse.ArgumentParser(description='FD Ricambi クローラー')
    parser.add_argument('--model', default='fiat-500',
                        choices=['fiat-500', 'fiat-126'],
                        help='対象モデル (fiat-500 or fiat-126)')
    args = parser.parse_args()
    model = args.model

    start_time = time.time()
    print("=" * 60)
    print(f"{SHOP_NAME} クローラー 開始（{model}）")
    print(f"開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 商品URL収集
    urls, session = get_model_urls(model)
    if not urls:
        print("[ERROR] URLを取得できませんでした")
        return

    total = len(urls)
    print(f"\n2. 商品詳細の収集を開始します（{total} 件）...")

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
                elapsed = (time.time() - start_time) / 60
                print(f"  [{i}/{total}] スキップ多数 ({skip}件) | 経過: {elapsed:.1f}分")
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
    print(f"[OK] クローリング完了（{model}）")
    print(f"終了時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"所要時間: {elapsed_total:.1f}分")
    print(f"成功: {success}件 / スキップ: {skip}件 / 合計URL: {total}件")
    print("=" * 60)


if __name__ == "__main__":
    main()
