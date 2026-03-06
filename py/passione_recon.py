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
OUTPUT_FILE = os.path.join(DESKTOP_PATH, "passione_full_catalog.csv")
BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
SITE_BASE_URL = "https://passione500.it"

def detect_target_cars(name, url):
    """商品名・URLパスから対象車種を検出（複数車種対応）

    注意: Passione 500の商品名は末尾に "| Passione 500" がつくため
    \b500\b では "Passione 500" に誤マッチする。
    "fiat 500" / "fiat-500" パターンを必須とすることで誤検出を防ぐ。
    """
    from urllib.parse import urlparse
    url_path = urlparse(url).path if url else ""
    # 末尾の "| Passione 500" を除去してから判定
    clean_name = re.sub(r'\|\s*passione\s*500\s*$', '', name or '', flags=re.IGNORECASE).strip()
    text = f"{clean_name} {url_path}".lower()
    cars = []
    if re.search(r'fiat[\s\-]*500', text): cars.append("Fiat 500")
    if re.search(r'\b126\b', text): cars.append("Fiat 126")
    if re.search(r'\b600\b', text): cars.append("Fiat 600")
    return ", ".join(cars) if cars else "Fiat 500"

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

# ★★★ テストモード（Trueで5件のみ詳細表示。Falseで全件取得保存） ★★★
TEST_MODE = False  # 全件実行
TEST_COUNT = 5

def setup_driver():
    """最適化版（2026/02/14）"""
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-extensions')
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
    driver.set_page_load_timeout(30)
    driver.implicitly_wait(5)
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'})
    return driver

def accept_cookies(driver):
    try:
        wait = WebDriverWait(driver, 3)
        btn = wait.until(EC.element_to_be_clickable((By.ID, "wt-cli-accept-all-btn")))
        btn.click()
    except: pass

def get_name_robust(driver):
    """【事実に基づく】商品名の取得"""
    try:
        name = driver.execute_script("return document.querySelector('meta[property=\"og:title\"]')?.content")
        if name: return name.split(" - Passione")[0].strip()
    except: pass
    try:
        return driver.find_element(By.TAG_NAME, "h1").text.strip()
    except: return "Unknown"

def get_image_robust(driver):
    """【スクショの事実に準拠】複数の方法で画像を抽出"""
    # 1. og:image (メタデータ)
    try:
        img = driver.execute_script("return document.querySelector('meta[property=\"og:image\"]')?.content")
        if img and "http" in img: return img
    except: pass

    # 2. スクショに写っているタグ構造 (a.href または img.src)
    selectors = [
        ".woocommerce-product-gallery__image a", # 拡大リンク
        ".woocommerce-product-gallery__image img", # メイン画像
        "img.zoomImg", # ズーム用高解像度
        "img.wp-post-image" # WooCommerce標準
    ]
    for sel in selectors:
        try:
            elem = driver.find_element(By.CSS_SELECTOR, sel)
            url = elem.get_attribute("href") or elem.get_attribute("src")
            if url and "http" in url: return url
        except: continue
    return "nan"

def get_oem_fixed(driver):
    """OEM番号の取得（ゴミ混入防止）"""
    try:
        search_area = driver.find_element(By.CLASS_NAME, "product_meta").text
        # metaエリアになければ、Additional Infoエリアを探す
        try: search_area += driver.find_element(By.CLASS_NAME, "woocommerce-product-details__short-description").text
        except: pass
        
        m = re.search(r'(?:Original|OEM|Rif|Ref).*?[:\.]\s*([0-9\s/A-Z\-]{5,})', search_area, re.IGNORECASE)
        if m: return m.group(1).strip()
    except: pass
    return "N/A"

def scrape_details(driver, url_list):
    print(f"\n=== Phase 2: 詳細データの取得を開始します (TEST_MODE: {TEST_MODE}) ===")
    total = len(url_list)
    success_hits = 0
    
    for i, url in enumerate(url_list, 1):
        if TEST_MODE and success_hits >= TEST_COUNT: break
        time.sleep(random.uniform(2.0, 3.5))
        try:
            driver.get(url)
            accept_cookies(driver)
            
            # ページ読み込み完了の目安としてSKUを待機
            wait = WebDriverWait(driver, 10)
            wait.until(EC.presence_of_element_located((By.CLASS_NAME, "sku")))
            
            item_no = driver.find_element(By.CLASS_NAME, "sku").text.strip()
            name = get_name_robust(driver)
            image_url = get_image_robust(driver)
            oem = get_oem_fixed(driver)
            
            # 価格
            price_text = "N/A"
            try: price_text = driver.find_element(By.CSS_SELECTOR, ".amount").text.strip()
            except: pass
            
            # 在庫
            stock = "In Stock" if "in-stock" in driver.page_source.lower() else "Out of Stock"

            # --- 全項目のテスト表示 ---
            if TEST_MODE:
                print(f"\n--- [Test Result {success_hits+1}] ---")
                print(f"Product No : {item_no}")
                print(f"Name       : {name}")
                print(f"OEM No     : {oem}")
                print(f"Price      : {price_text}")
                print(f"Stock      : {stock}")
                print(f"Image URL  : {image_url}")
                print(f"Page URL   : {url}")
                print(f"Target Cars: {detect_target_cars(name, url)}")  # 検証用
                print("-" * 30)
            else:
                print(f"[{i}/{total}] OK: {item_no} | {name[:30]}")

            if not TEST_MODE:
                # 本番モード：数値変換して同期
                s = price_text.replace('€', '').replace('&nbsp;', '').replace(' ', '')
                matches = re.findall(r'\d+[.,]\d+', s)
                p_val = float(matches[-1].replace(',', '.')) if matches else 0.0
                
                data = {
                    "shop_name": "Passione 500", "product_no": item_no, "oem_no": oem,
                    "name_en": name, "price_euro": p_val, "image_url": image_url,
                    "page_url": url, "stock_status": stock, "target_cars": detect_target_cars(name, url)
                }
                supabase.table("parts").upsert(data, on_conflict="product_no").execute()
            
            success_hits += 1
        except Exception as e:
            print(f"  [Skip] {url}")

def main():
    from datetime import datetime
    start_time = time.time()
    start_datetime = datetime.now()

    print("=" * 60)
    print("Passione 500 クローラー 開始")
    print(f"開始時刻: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    print("\n0. robots.txt 確認中...")
    if not check_robots_txt(SITE_BASE_URL, "/"):
        print("robots.txt によりクロールが禁止されています。終了します。")
        return
    print("   -> クロール許可を確認")

    print("\n=== Phase 1: サイトマップからURLを収集 ===")
    # 2954件取得できていた以前のロジック
    index_xml = "https://passione500.it/sitemap_index.xml"
    all_urls = set()
    try:
        res = requests.get(index_xml, timeout=30)
        sitemaps = re.findall(r'<loc>(.*?)</loc>', res.text)
        target_sitemaps = [u for u in sitemaps if "product" in u or "prodotto" in u]
        for sm in target_sitemaps:
            sub = requests.get(sm, timeout=30)
            urls = re.findall(r'<loc>(.*?)</loc>', sub.text)
            for u in urls:
                if "/en/" in u: all_urls.add(u)
    except: pass

    urls = sorted(list(all_urls))
    print(f"   -> {len(urls)} 件のURLを特定しました。")

    if urls:
        driver = setup_driver()
        try:
            # テスト時はランダムに抽出
            target_list = random.sample(urls, 15) if TEST_MODE else urls
            scrape_details(driver, target_list)

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
            print(f"処理件数: {len(target_list)} URL")
            if len(target_list) > 0:
                print(f"平均速度: {elapsed/len(target_list):.2f}秒/URL")
            print("=" * 60)

        except Exception as e:
            print(f"\nエラー: {e}")
            end_time = time.time()
            print(f"実行時間: {(end_time - start_time)/60:.1f}分（エラーで中断）")
        finally:
            driver.quit()

if __name__ == "__main__":
    main()