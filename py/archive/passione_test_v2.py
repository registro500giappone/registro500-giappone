"""
Passione 500 クローラー テスト版 v2
変更点（元の passione_recon.py からの差分）:
  1. page_load_strategy = 'eager'  （詰まり対策）
  2. sleep 1.0～1.5秒              （高速化テスト）
  3. TEST_MODE = True / TEST_COUNT = 20
DB書き込みなし（TEST_MODEのため）
確認ポイント: Product No / Name / Price / Image URL が正常に取れているか
"""
import time
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

BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
SITE_BASE_URL = "https://passione500.it"

# ChromeDriverManagerのキャッシュ競合回避
CHROMEDRIVER_PATH = r"C:\Users\akayu\.wdm\drivers\chromedriver\win64\144.0.7559.133\chromedriver.exe"
try:
    import webdriver_manager.chrome as wdm_chrome
    wdm_chrome.ChromeDriverManager.install = lambda self: CHROMEDRIVER_PATH
except Exception as e:
    print(f"[WARN] ChromeDriverパッチ失敗: {e}")

# ★ テスト設定
TEST_MODE = True
TEST_COUNT = 20  # 20件取得して確認

def detect_target_cars(name, url):
    from urllib.parse import urlparse
    url_path = urlparse(url).path if url else ""
    clean_name = re.sub(r'\|\s*passione\s*500\s*$', '', name or '', flags=re.IGNORECASE).strip()
    text = f"{clean_name} {url_path}".lower()
    cars = []
    if re.search(r'fiat[\s\-]*500', text): cars.append("Fiat 500")
    if re.search(r'\b126\b', text): cars.append("Fiat 126")
    if re.search(r'\b600\b', text): cars.append("Fiat 600")
    return ", ".join(cars) if cars else "Fiat 500"

def check_robots_txt(base_url, path="/"):
    rp = RobotFileParser()
    rp.set_url(base_url.rstrip('/') + '/robots.txt')
    try:
        rp.read()
    except Exception as e:
        print(f"[robots.txt] 読み取りエラー（許可として続行）: {e}")
        return True
    return rp.can_fetch(BOT_USER_AGENT, path)

def setup_driver():
    """テスト版: page_load_strategy='eager' 追加"""
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-extensions')
    # ★ 変更点1: eager でDOMのみ待つ（詰まり対策）
    options.page_load_strategy = 'eager'
    prefs = {'profile.managed_default_content_settings.images': 2,
             'profile.default_content_setting_values.notifications': 2}
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
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument',
        {'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'})
    return driver

def accept_cookies(driver):
    try:
        wait = WebDriverWait(driver, 3)
        btn = wait.until(EC.element_to_be_clickable((By.ID, "wt-cli-accept-all-btn")))
        btn.click()
    except: pass

def get_name_robust(driver):
    try:
        name = driver.execute_script("return document.querySelector('meta[property=\"og:title\"]')?.content")
        if name: return name.split(" - Passione")[0].strip()
    except: pass
    try:
        return driver.find_element(By.TAG_NAME, "h1").text.strip()
    except: return "Unknown"

def get_image_robust(driver):
    try:
        img = driver.execute_script("return document.querySelector('meta[property=\"og:image\"]')?.content")
        if img and "http" in img: return img
    except: pass
    selectors = [".woocommerce-product-gallery__image a",
                 ".woocommerce-product-gallery__image img",
                 "img.wp-post-image"]
    for sel in selectors:
        try:
            elem = driver.find_element(By.CSS_SELECTOR, sel)
            url = elem.get_attribute("href") or elem.get_attribute("src")
            if url and "http" in url: return url
        except: continue
    return "nan"

def get_oem_fixed(driver):
    try:
        search_area = driver.find_element(By.CLASS_NAME, "product_meta").text
        try: search_area += driver.find_element(By.CLASS_NAME,
            "woocommerce-product-details__short-description").text
        except: pass
        m = re.search(r'(?:Original|OEM|Rif|Ref).*?[:\.]\s*([0-9\s/A-Z\-]{5,})',
                      search_area, re.IGNORECASE)
        if m: return m.group(1).strip()
    except: pass
    return "N/A"

def run_test(driver, url_list):
    print(f"\n=== テスト開始: {TEST_COUNT}件サンプリング（スリープ1.0〜1.5秒, eager）===")
    success = 0
    skip = 0
    no_price = 0

    for i, url in enumerate(url_list, 1):
        if success >= TEST_COUNT: break
        # ★ 変更点2: スリープ短縮
        time.sleep(random.uniform(1.0, 1.5))
        try:
            driver.get(url)
            accept_cookies(driver)
            # WebDriverWait で SKU を待機（eager でも最大10秒待つ）
            wait = WebDriverWait(driver, 10)
            wait.until(EC.presence_of_element_located((By.CLASS_NAME, "sku")))

            item_no = driver.find_element(By.CLASS_NAME, "sku").text.strip()
            name = get_name_robust(driver)
            image_url = get_image_robust(driver)
            oem = get_oem_fixed(driver)

            price_text = "N/A"
            try: price_text = driver.find_element(By.CSS_SELECTOR, ".amount").text.strip()
            except: pass

            stock = "In Stock" if "in-stock" in driver.page_source.lower() else "Out of Stock"

            has_price = price_text != "N/A"
            has_image = image_url != "nan"
            if not has_price: no_price += 1

            print(f"\n--- [#{success+1}] ---")
            print(f"  Product No : {item_no}")
            print(f"  Name       : {name[:50]}")
            print(f"  Price      : {price_text}  {'✅' if has_price else '❌ 価格なし'}")
            print(f"  Image      : {'✅ あり' if has_image else '❌ なし'}")
            print(f"  OEM        : {oem}")
            print(f"  Target     : {detect_target_cars(name, url)}")
            success += 1

        except Exception as e:
            skip += 1
            print(f"  [Skip #{skip}] {url[-50:]}")

    print("\n" + "=" * 50)
    print(f"結果: 成功 {success}件 / スキップ {skip}件")
    print(f"価格なし: {no_price}件 / {success}件")
    print(f"スキップ率: {skip/(success+skip)*100:.1f}%" if (success+skip) > 0 else "")
    if skip == 0 and no_price == 0:
        print("✅ 問題なし → 本番実行可")
    elif skip > 3 or no_price > 3:
        print("⚠️  スキップ/価格なし多数 → eager を normal に戻すか検討")
    else:
        print("✅ 許容範囲 → 本番実行可")

def main():
    print("=" * 60)
    print("Passione 500 テスト版 v2（eager + 1.0〜1.5秒）")
    print("=" * 60)

    check_robots_txt(SITE_BASE_URL, "/")

    print("\nサイトマップからURLを収集中...")
    index_xml = "https://passione500.it/sitemap_index.xml"
    headers = {'User-Agent': BOT_USER_AGENT}
    all_urls = set()
    try:
        res = requests.get(index_xml, timeout=30, headers=headers)
        sitemaps = re.findall(r'<loc>(.*?)</loc>', res.text)
        # product_cat（カテゴリ用）を除外、商品サイトマップのみ対象
        target_sitemaps = [u for u in sitemaps if re.search(r'/product-sitemap\d*\.xml|/prodotto-sitemap', u)]
        for sm in target_sitemaps:
            sub = requests.get(sm, timeout=30, headers=headers)
            urls = re.findall(r'<loc>(.*?)</loc>', sub.text)
            for u in urls:
                if "/en/" in u: all_urls.add(u)
    except Exception as e:
        print(f"サイトマップエラー: {e}")
        return

    urls = sorted(list(all_urls))
    print(f"-> {len(urls)} 件のURL取得完了")

    # ランダム20件をサンプリング
    sample = random.sample(urls, min(TEST_COUNT, len(urls)))

    driver = setup_driver()
    try:
        run_test(driver, sample)
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
