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
URL_LIST_FILE = os.path.join(DESKTOP_PATH, "dangelo_url_list.csv")
OUTPUT_FILE = os.path.join(DESKTOP_PATH, "dangelo_full_catalog.csv")
BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
SITE_BASE_URL = "https://www.dangelomotori.it"

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
# True: URL収集を少しだけで止め、詳細取得も3件で止める（動作確認用）
# False: 本番用（全件取得）
TEST_MODE = False

def setup_driver():
    """最適化版（2026/02/21: eager + スリープ短縮対応）"""
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
    options.add_argument('--lang=en')
    options.add_argument(f'--user-agent={BOT_USER_AGENT}')
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_page_load_timeout(20)
    driver.implicitly_wait(3)
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'})
    return driver

# --- クッキー対策 ---
def accept_cookies(driver):
    try:
        # よくあるクッキーボタン
        buttons = driver.find_elements(By.CSS_SELECTOR, 
            "#cookie_action_close_header, .cli_settings_button, button.wt-cli-accept-all-btn, .cc-btn.cc-accept-all")
        for btn in buttons:
            if btn.is_displayed():
                btn.click()
                time.sleep(0.5)
                return
    except: pass

# ==========================================
# Phase 1: カテゴリ巡回でURL収集
# ==========================================
def collect_all_urls(driver):
    print("\n=== Phase 1: 商品URLを収集中 ===")
    
    # 既存リストがあれば再利用（再開用）
    if not TEST_MODE and os.path.exists(URL_LIST_FILE):
        print(f"   既存のURLリストを読み込みます: {URL_LIST_FILE}")
        return pd.read_csv(URL_LIST_FILE)['URL'].tolist()

    all_product_urls = set()

    # 1. カテゴリ一覧を取得
    print("1. カテゴリを探しています...")
    # トップページまたはショップページからカテゴリリンクを抽出
    driver.get("https://www.dangelomotori.it/en/")
    time.sleep(3)
    accept_cookies(driver)

    category_urls = []
    try:
        # メニューやサイドバーから product-category を含むリンクを探す
        links = driver.find_elements(By.CSS_SELECTOR, "a")
        for l in links:
            href = l.get_attribute("href")
            if href and "/product-category/" in href:
                category_urls.append(href)
    except: pass
    
    # 重複削除
    category_urls = sorted(list(set(category_urls)))
    print(f"   -> {len(category_urls)} 個のカテゴリを発見。巡回を開始します。")

    # 2. 各カテゴリを巡回
    for i, cat_url in enumerate(category_urls, 1):
        if TEST_MODE and i > 2: break # テスト時は2カテゴリで終了

        print(f"   [{i}/{len(category_urls)}] 巡回中: {cat_url}")
        driver.get(cat_url)
        accept_cookies(driver)
        
        page_count = 1
        while True:
            # 商品リンクを取得 (WooCommerce標準)
            products = driver.find_elements(By.CSS_SELECTOR, "a.woocommerce-LoopProduct-link")
            
            count_before = len(all_product_urls)
            for p in products:
                u = p.get_attribute("href")
                if u: all_product_urls.add(u)
            
            added = len(all_product_urls) - count_before
            print(f"      pg.{page_count}: {added}件追加 (累計: {len(all_product_urls)}件)")

            if TEST_MODE: break # テスト時は1ページで終了

            # 次へボタン (WooCommerce標準: a.next)
            try:
                next_btn = driver.find_element(By.CSS_SELECTOR, "a.next.page-numbers")
                driver.get(next_btn.get_attribute("href"))
                page_count += 1
                time.sleep(2)
            except:
                break # 次へがなければ終了

    # 保存
    url_list = sorted(list(all_product_urls))
    pd.DataFrame(url_list, columns=['URL']).to_csv(URL_LIST_FILE, index=False)
    print(f"   ★URL収集完了: 合計 {len(url_list)} 件を保存しました。\n")
    return url_list

# ==========================================
# Phase 2: 詳細取得
# ==========================================
def clean_price(price_str):
    if not price_str or price_str == "N/A": return 0.0
    s = str(price_str).replace('€', '').strip()
    # 540,98 -> 540.98
    matches = re.findall(r'\d+[.,]\d+', s)
    if matches:
        target = matches[-1]
        # カンマ小数点の処理
        if ',' in target and '.' not in target:
             clean = target.replace(',', '.')
        else:
             clean = target.replace('.', '').replace(',', '.')
        try: return float(clean)
        except: pass
    return 0.0

def sync_to_supabase(data):
    product_no = data['Product No']
    try:
        existing = supabase.table("parts").select("*").eq("product_no", product_no).execute()
    except: existing = None

    formatted_data = {
        "shop_name": "D'Angelo Motori",
        "product_no": product_no,
        "oem_no": data['OEM'],
        "name_en": data['Name'],
        "price_euro": clean_price(data['Price']),
        "image_url": data['Image_URL'],
        "page_url": data['URL'],
        "stock_status": data['Stock']
    }
    
    # 既存データ保護
    if existing and existing.data:
        curr = existing.data[0]
        if curr.get('name_jp') and str(curr['name_jp']) != 'nan': formatted_data['name_jp'] = curr['name_jp']
        if curr.get('category') and str(curr['category']) != 'null': formatted_data['category'] = curr['category']
    else:
        formatted_data['name_jp'] = 'nan'
        formatted_data['category'] = None
        formatted_data['target_cars'] = 'Fiat 500' # 仮

    try:
        supabase.table("parts").upsert(formatted_data, on_conflict="product_no").execute()
    except Exception as e:
        print(f"   [Sync Error] {e}")

def scrape_details(driver, url_list):
    print("\n=== Phase 2: 詳細データの取得を開始します ===")
    
    total = len(url_list)
    success_hits = 0
    
    for i, url in enumerate(url_list, 1):
        if TEST_MODE and success_hits >= 3: 
            print("★★★ テスト完了: 3件成功しました ★★★")
            break
            
        time.sleep(random.uniform(1.0, 1.5))
        try:
            driver.get(url)
            accept_cookies(driver)
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            
            # 品番
            item_no = "N/A"
            try: item_no = driver.find_element(By.CLASS_NAME, "sku").text.strip()
            except: pass
            if item_no == "N/A": continue 

            # 価格
            price = "N/A"
            try:
                # <p class="price"> の中身を取得
                # セール価格(ins)があればそれを、なければ全体を取得
                price_container = driver.find_element(By.CSS_SELECTOR, "p.price")
                
                # insタグ（セール価格）があるか？
                ins = price_container.find_elements(By.TAG_NAME, "ins")
                if ins:
                    price = ins[0].text.strip()
                else:
                    price = price_container.text.strip()
            except: pass

            # OEM
            oem = "N/A"
            try:
                body_text = driver.find_element(By.TAG_NAME, "body").text
                m = re.search(r'(?:Original|OEM|Rif).*?[:\.]\s*([0-9\s/A-Z]+)', body_text, re.IGNORECASE)
                if m: oem = m.group(1).strip()
            except: pass

            # 画像
            image_url = "nan"
            try:
                # ログで確認済み: .woocommerce-product-gallery__image a
                img_elem = driver.find_element(By.CSS_SELECTOR, ".woocommerce-product-gallery__image a")
                image_url = img_elem.get_attribute("href")
            except: pass

            # 商品名
            try: name = driver.find_element(By.CSS_SELECTOR, "h1.product_title").text.strip()
            except: name = "Unknown"

            # 在庫
            stock = "Unknown"
            try:
                stock_elem = driver.find_element(By.CLASS_NAME, "stock")
                if "out-of-stock" in stock_elem.get_attribute("class"): stock = "Out of Stock"
                else: stock = "In Stock"
            except:
                if driver.find_elements(By.NAME, "add-to-cart"): stock = "In Stock"

            if price != "N/A":
                print(f"  [{i}/{total}] ★OK: {item_no}")
                print(f"     ∟ 価格: {price} | 画像: {str(image_url)[:40]}...")
                success_hits += 1
            else:
                if TEST_MODE: print(f"  [{i}/{total}] ..Skip (No Price): {item_no}")

            data = {
                'Shop': "D'Angelo Motori", 'Name': name, 
                'Product No': item_no, 'OEM': oem, 
                'Price': price, 'Stock': stock, 
                'Image_URL': image_url, 'URL': url
            }
            
            pd.DataFrame([data]).to_csv(OUTPUT_FILE, mode='a', header=not os.path.exists(OUTPUT_FILE), index=False, encoding='utf-8-sig')
            sync_to_supabase(data)

        except Exception as e:
            if TEST_MODE: print(f"  [Skip] Error: {e}")
            continue

def main():
    from datetime import datetime
    start_time = time.time()
    start_datetime = datetime.now()

    print("=" * 60)
    print("D'Angelo Motori クローラー 開始")
    print(f"開始時刻: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print("\n0. robots.txt 確認中...")
    if not check_robots_txt(SITE_BASE_URL, "/"):
        print("robots.txt によりクロールが禁止されています。終了します。")
        return
    print("   -> クロール許可を確認")

    driver = setup_driver()
    try:
        urls = collect_all_urls(driver)
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
            print("URLが見つかりませんでした。")
    except Exception as e:
        print(f"\nエラー: {e}")
        end_time = time.time()
        print(f"実行時間: {(end_time - start_time)/60:.1f}分（エラーで中断）")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()