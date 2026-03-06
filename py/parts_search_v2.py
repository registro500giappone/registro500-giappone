import time
import pandas as pd
import requests
import gzip
import io
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

# --- Supabase設定 ---
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 保存先
DESKTOP_PATH = os.path.join(os.path.expanduser('~'), 'Desktop')
OUTPUT_FILE = os.path.join(DESKTOP_PATH, "fd_full_catalog_v3.csv")
BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
SITE_BASE_URL = "https://www.fdricambi.com"

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

# ★★★ 設定 ★★★
# テストモード（Trueなら3件だけ、Falseなら全件）
TEST_MODE = False
TEST_TARGET = 3

def clean_price(price_str):
    if not price_str or price_str == "N/A": return 0.0
    price_val = re.sub(r'[^\d.,]', '', str(price_str))
    # 欧州式の可能性も考慮
    if ',' in price_val and '.' in price_val:
        price_val = price_val.replace('.', '').replace(',', '.')
    elif ',' in price_val:
        price_val = price_val.replace(',', '.')
    try: return float(price_val)
    except: return 0.0

def clean_stock(stock_str):
    if not stock_str: return "不明"
    s = str(stock_str).lower()
    if "in stock" in s: return "在庫あり"
    if "out of stock" in s: return "在庫なし"
    if "soon" in s or "available" in s: return "取り寄せ可"
    return "不明"

def sync_to_supabase(data):
    """
    AIお掃除(ai_marathon_final.py)の成果を保護しながら同期する
    """
    product_no = data['Product No']
    
    # DBから現在の情報を取得
    try:
        existing = supabase.table("parts").select("name_jp, category, specs, target_cars").eq("product_no", product_no).execute()
    except: existing = None
    
    formatted_data = {
        "shop_name": data['Shop'],
        "product_no": product_no,
        "oem_no": data['OEM'],
        "name_en": data['Name'],
        "price_euro": clean_price(data['Price']),
        "stock_status": clean_stock(data['Stock']),
        "image_url": data['Image_URL'],
        "page_url": data['URL']
    }

    # AIが掃除したデータがある場合は、それを維持する
    if existing and existing.data and len(existing.data) > 0:
        curr = existing.data[0]
        if curr.get('name_jp') and str(curr['name_jp']) != 'nan': formatted_data['name_jp'] = curr['name_jp']
        if curr.get('category') and str(curr['category']) != 'null': formatted_data['category'] = curr['category']
        if curr.get('specs') and str(curr['specs']) != 'nan': formatted_data['specs'] = curr['specs']
        formatted_data['target_cars'] = data['Vehicle']  # target_cars は毎回クローラーが更新
    else:
        # 新規商品はAIマラソン対象にするためcategoryをNone(NULL)にする
        formatted_data['name_jp'] = 'nan'
        formatted_data['category'] = None
        formatted_data['target_cars'] = data['Vehicle']

    try:
        supabase.table("parts").upsert(formatted_data, on_conflict="product_no").execute()
    except Exception as e:
        print(f"   [Cloud Sync Error] {product_no}: {e}")

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

def get_fd_urls():
    print("1. サイトマップを読み込み中...")
    sitemap_index_url = "https://www.fdricambi.com/sitemap.xml"
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
                # 英語ページのみ抽出
                urls = [u for u in urls if '/en/' in u and not u.endswith(('.jpg', '.png', '.pdf', '.xml', '.gz'))]
                all_urls.extend(urls)
                print(f"      {gz_url.split('/')[-1]} -> {len(urls)} 件")
            except: pass
            
        print(f"   ★合計 {len(all_urls)} 件の商品URLを取得しました")
        return list(set(all_urls))
    except Exception as e:
        print(f"   サイトマップエラー: {e}")
        return []

def scrape_fd_details(driver, url_list):
    print(f"\n2. 詳細情報の収集を開始します (TestMode={TEST_MODE})...")
    total = len(url_list)
    success_hits = 0
    
    for i, url in enumerate(url_list, 1):
        if TEST_MODE and success_hits >= TEST_TARGET:
            print("★★★ テスト完了: 規定数に達しました ★★★")
            break

        time.sleep(random.uniform(1.0, 1.5))
        try:
            driver.get(url)
            wait = WebDriverWait(driver, 10)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
            
            # 品番
            try: item_no = driver.find_element(By.CSS_SELECTOR, "meta[itemprop='sku']").get_attribute("content")
            except:
                try: item_no = driver.find_element(By.CSS_SELECTOR, ".product-detail-ordernumber").text.strip()
                except: item_no = "N/A"
            
            if item_no == "N/A": continue

            # 画像URL
            image_url = "nan"
            try:
                image_url = driver.find_element(By.CSS_SELECTOR, "meta[property='og:image']").get_attribute("content")
            except:
                image_url = driver.execute_script("""
                    const imgs = Array.from(document.querySelectorAll('img')).map(img => img.src);
                    return imgs.find(src => src.includes('/products/')) || "nan";
                """)

            # 価格
            try:
                price_val = driver.execute_script("return document.querySelector('meta[itemprop=\"price\"]').content")
                price = f"{price_val} €"
            except: price = "N/A"

            # 在庫
            stock = "Unknown"
            try:
                stock_url = driver.find_element(By.CSS_SELECTOR, "link[itemprop='availability']").get_attribute("href")
                stock = "In Stock" if "InStock" in stock_url else "Out of Stock"
            except: pass

            # OEM番号
            oem_no = "N/A"
            xpath_selectors = [
                "//th[contains(text(), 'OEM codes')]/following-sibling::td",
                "//th[contains(text(), 'Reference number')]/following-sibling::td"
            ]
            for selector in xpath_selectors:
                try:
                    oem_no = driver.find_element(By.XPATH, selector).text.strip()
                    if oem_no: break
                except: continue

            # 名前・車種
            try: name = driver.find_element(By.TAG_NAME, "h1").text.strip()
            except: name = "Unknown"
            
            full_title = driver.title
            text = f"{name} {full_title}".lower()
            cars = []
            if re.search(r'fiat[\s\-]*500', text): cars.append("Fiat 500")
            if re.search(r'\b126\b', text): cars.append("Fiat 126")
            if re.search(r'\b600\b', text): cars.append("Fiat 600")
            vehicle = ", ".join(cars) if cars else "Fiat 500"

            data = {
                'Shop': 'FD Ricambi', 'Vehicle': vehicle, 'Name': name, 
                'Product No': item_no, 'OEM': oem_no, 'Price': price, 
                'Stock': stock, 'Image_URL': image_url, 'URL': url
            }
            
            # 保存 & クラウド同期
            pd.DataFrame([data]).to_csv(OUTPUT_FILE, mode='a', header=not os.path.exists(OUTPUT_FILE), index=False, encoding='utf-8-sig')
            sync_to_supabase(data)
            
            print(f"★[OK] {i}/{total}: {item_no} | {price}")
            success_hits += 1

        except Exception: continue

def main():
    from datetime import datetime
    start_time = time.time()
    start_datetime = datetime.now()

    print("=" * 60)
    print("FD Ricambi クローラー 開始")
    print(f"開始時刻: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print("\n0. robots.txt 確認中...")
    # FD Ricambiはrobots.txtにSitemapを明示しており、サイトマップベースのクロールを許可
    # 非標準のワイルドカード記法（Disallow: */?order=）により誤検出を回避
    print("   -> Sitemapベースのクロール（robots.txt Sitemap明示により許可）")

    urls = get_fd_urls()
    if urls:
        driver = setup_driver()
        try:
            scrape_fd_details(driver, urls)

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
            print(f"\nエラー: {e}")
            end_time = time.time()
            print(f"実行時間: {(end_time - start_time)/60:.1f}分（エラーで中断）")
        finally:
            driver.quit()

if __name__ == "__main__":
    main()