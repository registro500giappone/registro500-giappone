import time
import pandas as pd
import requests
import re
import os
import random
from urllib.robotparser import RobotFileParser
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from supabase import create_client
from dotenv import load_dotenv

# --- 設定 ---
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

DESKTOP_PATH = os.path.join(os.path.expanduser('~'), 'Desktop')
URL_LIST_FILE = os.path.join(DESKTOP_PATH, "euro_url_list.csv")
OUTPUT_FILE = os.path.join(DESKTOP_PATH, "euro_full_catalog.csv")
BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
SITE_BASE_URL = "https://euroitalia500-commerce.it"

def check_robots_txt(base_url, path="/"):
    """robots.txt を確認し、クロールが許可されているか判定"""
    rp = RobotFileParser()
    rp.set_url(base_url.rstrip('/') + '/robots.txt')
    try:
        rp.read()
    except Exception as e:
        print(f"[robots.txt] 読み取りエラー（許可として続行）: {e}")
        return True
    allowed = rp.can_fetch(BOT_USER_AGENT, path)
    if not allowed:
        print(f"[robots.txt] {base_url}{path} はクロール禁止です。スキップします。")
    return allowed

# ★★★ テストモード ★★★
# Trueの場合: 動作確認用（各カテゴリ1ページ目、詳細取得5件のみ）
# 本番は False にしてください。
TEST_MODE = False

def setup_driver():
    """最適化版（2026/02/21: eager + スリープ短縮対応）"""
    # crawler_utils が使えれば共通版を使う
    try:
        from crawler_utils import setup_driver as _setup
        return _setup()
    except ImportError:
        pass
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-extensions')
    options.page_load_strategy = 'eager'
    prefs = {'profile.managed_default_content_settings.images': 2, 'profile.default_content_setting_values.notifications': 2}
    options.add_experimental_option('prefs', prefs)
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument('--window-size=1280,1024')
    options.add_argument("--log-level=3")
    options.add_argument('--lang=en-US')
    options.add_argument('--accept-language=en-US,en;q=0.9')
    options.add_argument(f'--user-agent={BOT_USER_AGENT}')
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_page_load_timeout(20)
    driver.implicitly_wait(3)
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'})
    return driver

def add_lang_param(url):
    """Phase 2用: URLに言語パラメータを追加"""
    if '?' in url:
        return url + '&id_lang=1'
    else:
        return url + '?id_lang=1'

# ==========================================
# Phase 1: 商品URLを根こそぎ集める (Crawl)
# Source: euro_search20260208.py (ロジック完全維持)
# ==========================================
def collect_all_urls(driver):
    print("\n=== Phase 1: 商品URLの収集を開始します (Logic: 20260208) ===")
    
    # 既存リストの読み込みロジック（必要に応じてコメントアウト解除）
    # if os.path.exists(URL_LIST_FILE):
    #     print(f"   既存のURLリストが見つかりました: {URL_LIST_FILE}")
    #     df = pd.read_csv(URL_LIST_FILE)
    #     urls = df['URL'].tolist()
    #     print(f"   -> {len(urls)} 件のURLをロードしました。")
    #     if not TEST_MODE:
    #         return urls

    all_product_urls = set()
    
    # 1. HTMLサイトマップからカテゴリ取得
    print("1. カテゴリ一覧を取得中...")
    # 元ファイル通り、パラメータなしのURLにアクセス
    driver.get("https://euroitalia500-commerce.it/mappa-del-sito")
    time.sleep(3)
    
    # カテゴリリンクを抽出
    cat_links = driver.find_elements(By.CSS_SELECTOR, "#sitemap_content a")
    category_urls = []
    for l in cat_links:
        href = l.get_attribute("href")
        if href and "euroitalia500-commerce.it" in href:
            if not any(x in href for x in ["login", "cart", "contact", "order", "address"]):
                category_urls.append(href)
    
    category_urls = sorted(list(set(category_urls)))
    print(f"   -> {len(category_urls)} 個のカテゴリ候補を発見。巡回を開始します。")

    # 2. 各カテゴリを巡回
    for i, cat_url in enumerate(category_urls, 1):
        if TEST_MODE and i > 2: break

        print(f"   [{i}/{len(category_urls)}] カテゴリ巡回: {cat_url}")
        driver.get(cat_url) # ここもパラメータ付与せず、元のまま
        
        page_count = 1
        while True:
            time.sleep(2)
            
            # 商品リンクを取得
            products = driver.find_elements(By.CSS_SELECTOR, "a.product_img_link")
            if not products:
                break
                
            for p in products:
                u = p.get_attribute("href")
                if u: all_product_urls.add(u)
            
            print(f"      pg.{page_count}: {len(products)}件発見 (累計: {len(all_product_urls)}件)")

            if TEST_MODE: break

            # 「次へ」ボタンを探す (PrestaShop標準)
            try:
                next_btn = driver.find_element(By.CSS_SELECTOR, "#pagination_next_bottom a, li.pagination_next a")
                driver.get(next_btn.get_attribute("href")) # ここも元のまま
                page_count += 1
            except:
                break

    # 保存
    url_list = sorted(list(all_product_urls))
    pd.DataFrame(url_list, columns=['URL']).to_csv(URL_LIST_FILE, index=False)
    print(f"   ★URL収集完了: 合計 {len(url_list)} 件を保存しました。\n")
    return url_list

# ==========================================
# Phase 2: 詳細データを抜き出す (Scrape)
# Source: euro_full_search_v3_final.py (ロジック完全維持)
# ==========================================
def clean_price(price_str):
    if not price_str: return 0.0
    s = str(price_str).replace('€', '').strip()
    clean = re.sub(r'[^\d.,]', '', s)
    if ',' in clean and '.' in clean:
        clean = clean.replace('.', '').replace(',', '.')
    elif ',' in clean: 
        clean = clean.replace(',', '.')
    try: return float(clean)
    except: return 0.0

def sync_to_supabase(data):
    product_no = data['Product No']
    
    try:
        existing = supabase.table("parts").select("*").eq("product_no", product_no).execute()
    except: existing = None

    formatted_data = {
        "shop_name": "EuroItalia500",
        "product_no": product_no,
        "oem_no": data['OEM'],
        "name_en": data['Name'],
        "price_euro": clean_price(data['Price']),
        "image_url": data['Image_URL'],
        "page_url": data['URL'],
        "stock_status": data['Stock']
    }
    
    if existing and existing.data:
        curr = existing.data[0]
        if curr.get('name_jp') and str(curr['name_jp']) != 'nan': formatted_data['name_jp'] = curr['name_jp']
        if curr.get('category') and str(curr['category']) != 'null': formatted_data['category'] = curr['category']
        if curr.get('specs') and str(curr['specs']) != 'nan': formatted_data['specs'] = curr['specs']
        if curr.get('target_cars') and str(curr['target_cars']) != 'nan': formatted_data['target_cars'] = curr['target_cars']
    else:
        formatted_data['name_jp'] = 'nan'
        formatted_data['category'] = None
        formatted_data['target_cars'] = 'Fiat 500'

    try:
        supabase.table("parts").upsert(formatted_data, on_conflict="product_no").execute()
    except Exception as e:
        print(f"   [Sync Error] {e}")

def scrape_details(driver, url_list):
    print("=== Phase 2: 詳細データの取得を開始します (Logic: v3_final) ===")
    
    total = len(url_list)
    success_count = 0
    
    for i, url in enumerate(url_list, 1):
        if TEST_MODE and success_count >= 5: 
            print("★★★ テスト完了: 5件取得しました ★★★")
            break
            
        time.sleep(random.uniform(1.0, 1.5))
        try:
            # ★ここで初めて add_lang_param を使用して英語ページへアクセス
            driver.get(add_lang_param(url))
            
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            
            # 1. 商品番号
            item_no = "N/A"
            try:
                item_no = driver.find_element(By.ID, "product_reference").text.strip()
            except:
                try:
                    body = driver.find_element(By.TAG_NAME, "body").text
                    m = re.search(r'Reference\s*[:\.]?\s*([A-Za-z0-9\-/]+)', body)
                    if m: item_no = m.group(1)
                except: pass
            
            if item_no == "N/A": 
                continue

            # 2. 価格
            price = "N/A"
            try:
                price = driver.find_element(By.ID, "our_price_display").text.strip()
            except: pass

            # 3. OEM番号
            oem = "N/A"
            try:
                desc = driver.find_element(By.ID, "short_description_content").text
                m = re.search(r'(?:Original|OEM|Rif).*?[:\.]\s*([0-9\s/]+)', desc, re.IGNORECASE)
                if m: oem = m.group(1).strip()
            except: pass

            # 4. 画像
            image_url = "nan"
            try:
                img_elem = driver.find_element(By.ID, "bigpic")
                image_url = img_elem.get_attribute("src")
            except:
                try:
                    image_url = driver.find_element(By.CSS_SELECTOR, ".product-image-container img").get_attribute("src")
                except: pass

            # 5. 商品名
            try: name = driver.find_element(By.TAG_NAME, "h1").text.strip()
            except: name = "Unknown"

            # 6. 在庫
            stock = "Unknown"
            try:
                stock_text = driver.find_element(By.ID, "availability_statut").text.lower()
                if "stock" in stock_text: stock = "In Stock"
                else: stock = "Out of Stock"
            except: 
                if driver.find_elements(By.ID, "add_to_cart"): stock = "In Stock"

            print(f"  [{i}/{total}] {item_no}")
            print(f"     ∟ 商品名: {name}")
            print(f"     ∟ 価格: {price} | OEM: {oem}")

            data = {
                'Shop': 'EuroItalia500', 'Name': name, 
                'Product No': item_no, 'OEM': oem, 
                'Price': price, 'Stock': stock, 
                'Image_URL': image_url, 'URL': url
            }
            
            pd.DataFrame([data]).to_csv(OUTPUT_FILE, mode='a', header=not os.path.exists(OUTPUT_FILE), index=False, encoding='utf-8-sig')
            sync_to_supabase(data)
            success_count += 1

        except Exception as e:
            print(f"  [Skip] {e}")
            continue

def main():
    from datetime import datetime
    start_time = time.time()
    start_datetime = datetime.now()

    print("=" * 60)
    print("EuroItalia500 クローラー 開始")
    print(f"開始時刻: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print("\n0. robots.txt 確認中...")
    if not check_robots_txt(SITE_BASE_URL, "/"):
        print("robots.txt によりクロールが禁止されています。終了します。")
        return
    print("   -> クロール許可を確認")

    driver = setup_driver()
    try:
        # Phase 1: URL収集 (20260208ロジック: add_lang_paramなし)
        urls = collect_all_urls(driver)

        # Phase 2: 詳細取得 (v3ロジック: add_lang_paramあり)
        if len(urls) > 0:
            scrape_details(driver, urls)

            # 実行時間表示
            end_time = time.time()
            end_datetime = datetime.now()
            elapsed = end_time - start_time
            hours = int(elapsed // 3600)
            minutes = int((elapsed % 3600) // 60)
            seconds = int(elapsed % 60)

            print("\n" + "=" * 60)
            print("[OK] クローリング完了")
            print(f"終了時刻: {end_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"所要時間: {hours}時間{minutes}分{seconds}秒 ({elapsed/60:.1f}分)")
            print(f"処理件数: {len(urls)} URL")
            if len(urls) > 0:
                print(f"平均速度: {elapsed/len(urls):.2f}秒/URL")
            print("=" * 60)
        else:
            print("商品URLが見つかりませんでした。")
    except Exception as e:
        print(f"\nエラー: {e}")
        end_time = time.time()
        print(f"実行時間: {(end_time - start_time)/60:.1f}分（エラーで中断）")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()