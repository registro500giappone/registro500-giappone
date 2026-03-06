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
OUTPUT_FILE = os.path.join(DESKTOP_PATH, "axel_full_catalog_confirmed.csv")
BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
SITE_BASE_URL = "https://webshop.fiat500126.com"

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

# ★★★ 本番モード ★★★
# 毎週の更新時は False で実行します
TEST_MODE = False
TEST_SUCCESS_TARGET = 3
TEST_MAX_ATTEMPTS = 50

def clean_price(price_str):
    """65.50 -> 65.50 / 1.200,50 -> 1200.50"""
    if not price_str or price_str == "N/A": return 0.0
    s = str(price_str)
    # 数字、カンマ、ドット以外削除
    clean = re.sub(r'[^\d.,]', '', s)
    
    if ',' in clean and '.' in clean:
        clean = clean.replace('.', '').replace(',', '.')
    elif ',' in clean: 
        clean = clean.replace(',', '.')
    try: return float(clean)
    except: return 0.0

def clean_stock(stock_str):
    s = str(stock_str).lower()
    if "in stock" in s: return "在庫あり"
    if "out of stock" in s: return "在庫なし"
    if "soon" in s or "available" in s: return "取り寄せ可"
    return "不明"

def sync_to_supabase(data):
    product_no = data['Product No']
    try:
        try:
            existing = supabase.table("parts").select("name_jp, category, specs, target_cars").eq("product_no", product_no).execute()
        except: existing = None
        
        formatted_data = {
            "shop_name": data['Shop'],
            "product_no": product_no,
            "oem_no": data.get('OEM', "N/A"),
            "name_en": data['Name'],
            "price_euro": clean_price(data['Price']),
            "stock_status": clean_stock(data['Stock']),
            "image_url": data['Image_URL'],
            "page_url": data['URL']
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
            formatted_data['target_cars'] = data['Vehicle']

        supabase.table("parts").upsert(formatted_data, on_conflict="product_no").execute()
    except Exception as e:
        print(f"   [Sync Error] {e}")

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
    prefs = {
        'profile.managed_default_content_settings.images': 2,
        'profile.default_content_setting_values.notifications': 2
    }
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
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
    })
    return driver

def get_price_confirmed(driver):
    """
    【事実に基づく修正版】
    <span itemprop="price">65.50</span> をピンポイントで狙い撃ちする
    """
    try:
        # itemprop="price" を持つ要素なら何でも探す (spanでもmetaでもdivでも)
        # その中身(innerText) か 属性(content) を取得する
        js = """
            var el = document.querySelector('[itemprop="price"]');
            if (el) {
                // spanタグなら innerText (65.50)
                // metaタグなら content ("65.50")
                return el.content || el.innerText || el.textContent;
            }
            return null;
        """
        price_val = driver.execute_script(js)
        
        if price_val:
            val_str = str(price_val).strip()
            # もし数字だけならユーロ記号を足して返す
            if any(c.isdigit() for c in val_str):
                if "€" not in val_str:
                    return val_str + " €"
                return val_str
    except: pass
    
    return "N/A"

def scrape_axel_details(driver, url_list):
    print(f"\n2. スクレイピング開始 (TestMode={TEST_MODE})...")
    
    # ★毎週最新のデータを取るために、既存ファイルの読み込みを無効化（コメントアウト）しました
    # existing_urls = set()
    # if not TEST_MODE and os.path.exists(OUTPUT_FILE):
    #     try:
    #         df_old = pd.read_csv(OUTPUT_FILE)
    #         existing_urls = set(df_old['URL'].tolist())
    #     except: pass

    total = len(url_list)
    success_hits = 0 

    for i, url in enumerate(url_list, 1):
        # if not TEST_MODE and url in existing_urls: continue
        
        if TEST_MODE:
            if success_hits >= TEST_SUCCESS_TARGET:
                print(f"\n★★★ テスト成功: {TEST_SUCCESS_TARGET} 件の価格取得を確認しました ★★★")
                break
            if i > TEST_MAX_ATTEMPTS:
                print(f"\n★★★ テスト終了: データが見つかりません ★★★")
                break

        time.sleep(random.uniform(1.0, 1.5))
        
        try:
            driver.get(url)
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))

            # === 1. 商品番号 ===
            item_no = "N/A"
            try:
                # ここも同じ構造の可能性があるため微修正
                js_sku = "return document.querySelector('[itemprop=\"sku\"]')?.content || document.querySelector('.product--number')?.innerText;"
                item_no = driver.execute_script(js_sku)
            except: pass
            
            if not item_no: item_no = "N/A"
            # 商品番号なしはスキップ
            if item_no == "N/A": 
                if TEST_MODE: print(f"  [{i}] Skip (No Product No)")
                continue 

            # === 2. 価格 (事実に基づくロジック) ===
            price = get_price_confirmed(driver)

            # === 3. 画像 ===
            image_url = "nan"
            try:
                js_img = """
                    let img = Array.from(document.querySelectorAll('img')).find(i => i.src && i.src.includes('img_big/'));
                    if (img) return img.src;
                    let main = document.querySelector('.image-gallery--slide img');
                    return main ? main.src : null;
                """
                raw_url = driver.execute_script(js_img)
                if raw_url:
                    if not raw_url.startswith('http'):
                        raw_url = "https://webshop.fiat500126.com/" + raw_url.lstrip('/')
                    image_url = raw_url
            except: pass

            # === 4. OEM ===
            oem = "N/A"
            try:
                body_text = driver.find_element(By.TAG_NAME, "body").text
                match = re.search(r'(?:Original.*number|Ref\.|OEM).*?[:\.]\s*([0-9\s/A-Z]+)', body_text, re.IGNORECASE)
                if match: oem = match.group(1).strip()
            except: pass

            # === その他 ===
            try: name = driver.find_element(By.TAG_NAME, "h1").text.strip()
            except: name = "Unknown"

            stock = "Out of Stock"
            if driver.find_elements(By.CSS_SELECTOR, ".sn_addtobasket, button.btn-primary"):
                stock = "In Stock"

            vehicle = "Fiat 500"
            if "126" in name or "126" in driver.title: vehicle = "Fiat 126"
            elif "600" in name or "600" in driver.title: vehicle = "Fiat 600"

            data = {
                'Shop': 'Axel Gerstl', 'Vehicle': vehicle, 'Name': name, 
                'Product No': item_no, 'OEM': oem, 
                'Price': price, 'Stock': stock, 
                'Image_URL': image_url, 'URL': url
            }
            
            # ログ表示
            if price != "N/A" and price != "0.0 €":
                print(f"  [{i}/{total}] ★OK: {item_no}")
                print(f"     ∟ 価格: {price} | OEM: {oem}")
                print(f"     ∟ 画像: {str(image_url)[:60]}...")
                success_hits += 1
            else:
                if TEST_MODE:
                    print(f"  [{i}/{total}] ..Checking: {item_no} (Price not found)")

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
    print("Axel Gerstl クローラー 開始")
    print(f"開始時刻: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print("\n0. robots.txt 確認中...")
    if not check_robots_txt(SITE_BASE_URL, "/"):
        print("robots.txt によりクロールが禁止されています。終了します。")
        return
    print("   -> クロール許可を確認")

    print("\n1. サイトマップ解析中...")
    try:
        res = requests.get(SITE_BASE_URL + "/sitemap.xml", timeout=30)
        all_locs = re.findall(r'<loc>(.*?)</loc>', res.text)
        urls = sorted(list(set([u.strip().replace('/de/', '/en/') for u in all_locs if not any(x in u for x in ['.jpg', '.png', '.pdf', '.xml', '/account'])])))

        print(f"   抽出URL数: {len(urls)} 件")
        driver = setup_driver()
        scrape_axel_details(driver, urls)
        driver.quit()

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

    except Exception as e:
        print(f"\nシステムエラー: {e}")
        end_time = time.time()
        print(f"実行時間: {(end_time - start_time)/60:.1f}分（エラーで中断）")

if __name__ == "__main__":
    main()