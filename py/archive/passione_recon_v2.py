"""
passione_recon_v2.py
Passione 500 クローラー 本番版 v2（2026/02/21）

変更点（v1からの差分）:
  1. page_load_strategy='eager'       （詰まり対策）
  2. スリープ 1.0〜1.5秒              （2.0〜3.5秒から短縮）
  3. product_cat-sitemap を除外       （タイムアウト原因だったカテゴリページを除外）
  4. サイトマップ取得時に User-Agent  （ブロック回避）
  5. WORKER_ID 引数対応               （並列実行時のログ識別用）
  6. crawler_utils.py の共通関数を使用
"""
import time
import requests
import re
import os
import random
import sys
from urllib.robotparser import RobotFileParser
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# 共通ユーティリティ（ChromeDriverパッチ + setup_driver）
from crawler_utils import BOT_USER_AGENT, get_supabase, setup_driver

SITE_BASE_URL = "https://passione500.it"
TEST_MODE = False
TEST_COUNT = 5

# 並列実行時のワーカーID（run_parallel.py から渡される）
try:
    WORKER_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 0
except (ValueError, IndexError):
    WORKER_ID = 0


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


def get_all_urls():
    """サイトマップから全商品URLを収集（product_cat除外）"""
    print(f"[W{WORKER_ID}] サイトマップからURLを収集中...")
    headers = {'User-Agent': BOT_USER_AGENT}
    index_xml = "https://passione500.it/sitemap_index.xml"
    all_urls = set()
    try:
        res = requests.get(index_xml, timeout=30, headers=headers)
        sitemaps = re.findall(r'<loc>(.*?)</loc>', res.text)
        # product_cat（カテゴリページ）を除外、商品サイトマップのみ
        target_sitemaps = [u for u in sitemaps
                           if re.search(r'/product-sitemap\d*\.xml|/prodotto-sitemap', u)]
        print(f"[W{WORKER_ID}] 対象サイトマップ: {len(target_sitemaps)}個")
        for sm in target_sitemaps:
            sub = requests.get(sm, timeout=30, headers=headers)
            urls = re.findall(r'<loc>(.*?)</loc>', sub.text)
            for u in urls:
                if "/en/" in u:
                    all_urls.add(u)
    except Exception as e:
        print(f"[W{WORKER_ID}] サイトマップエラー: {e}")
    urls = sorted(list(all_urls))
    print(f"[W{WORKER_ID}] -> {len(urls)} 件のURLを取得")
    return urls


def accept_cookies(driver):
    try:
        wait = WebDriverWait(driver, 3)
        btn = wait.until(EC.element_to_be_clickable((By.ID, "wt-cli-accept-all-btn")))
        btn.click()
    except:
        pass


def get_name_robust(driver):
    try:
        name = driver.execute_script(
            "return document.querySelector('meta[property=\"og:title\"]')?.content")
        if name:
            return name.split(" - Passione")[0].strip()
    except:
        pass
    try:
        return driver.find_element(By.TAG_NAME, "h1").text.strip()
    except:
        return "Unknown"


def get_image_robust(driver):
    try:
        img = driver.execute_script(
            "return document.querySelector('meta[property=\"og:image\"]')?.content")
        if img and "http" in img:
            return img
    except:
        pass
    for sel in [".woocommerce-product-gallery__image a",
                ".woocommerce-product-gallery__image img",
                "img.wp-post-image"]:
        try:
            elem = driver.find_element(By.CSS_SELECTOR, sel)
            url = elem.get_attribute("href") or elem.get_attribute("src")
            if url and "http" in url:
                return url
        except:
            continue
    return "nan"


def get_oem_fixed(driver):
    try:
        search_area = driver.find_element(By.CLASS_NAME, "product_meta").text
        try:
            search_area += driver.find_element(By.CLASS_NAME,
                "woocommerce-product-details__short-description").text
        except:
            pass
        m = re.search(r'(?:Original|OEM|Rif|Ref).*?[:\.]\s*([0-9\s/A-Z\-]{5,})',
                      search_area, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    except:
        pass
    return "N/A"


def scrape_details(driver, url_list):
    supabase = get_supabase()
    total = len(url_list)
    success = 0
    skip = 0
    print(f"[W{WORKER_ID}] === Phase 2: {total} 件の詳細取得開始 ===")

    for i, url in enumerate(url_list, 1):
        if TEST_MODE and success >= TEST_COUNT:
            break
        # ★ スリープ短縮（1.0〜1.5秒）
        time.sleep(random.uniform(1.0, 1.5))
        try:
            driver.get(url)
            accept_cookies(driver)
            # SKU を待機（eager でも最大10秒待つ）
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "sku")))

            item_no = driver.find_element(By.CLASS_NAME, "sku").text.strip()
            name = get_name_robust(driver)
            image_url = get_image_robust(driver)
            oem = get_oem_fixed(driver)

            price_text = "N/A"
            try:
                price_text = driver.find_element(By.CSS_SELECTOR, ".amount").text.strip()
            except:
                pass

            stock = "In Stock" if "in-stock" in driver.page_source.lower() else "Out of Stock"

            if TEST_MODE:
                print(f"[W{WORKER_ID}] [{i}/{total}] {item_no} | {name[:40]} | {price_text}")
            else:
                print(f"[W{WORKER_ID}] [{i}/{total}] OK: {item_no} | {name[:30]}", flush=True)

            if not TEST_MODE:
                s = price_text.replace('€', '').replace('&nbsp;', '').replace(' ', '')
                matches = re.findall(r'\d+[.,]\d+', s)
                p_val = float(matches[-1].replace(',', '.')) if matches else 0.0
                data = {
                    "shop_name": "Passione 500",
                    "product_no": item_no,
                    "oem_no": oem,
                    "name_en": name,
                    "price_euro": p_val,
                    "image_url": image_url,
                    "page_url": url,
                    "stock_status": stock,
                    "target_cars": detect_target_cars(name, url)
                }
                supabase.table("parts").upsert(data, on_conflict="product_no").execute()

            success += 1

        except Exception as e:
            skip += 1
            print(f"[W{WORKER_ID}] [Skip] {url[-60:]}", flush=True)

    print(f"[W{WORKER_ID}] 完了: 成功 {success}件 / スキップ {skip}件", flush=True)


def main(url_chunk=None):
    """
    url_chunk: Noneなら全URL収集→処理、リストなら渡されたURLのみ処理（並列用）
    """
    from datetime import datetime
    start = time.time()
    print(f"[W{WORKER_ID}] {'='*50}")
    print(f"[W{WORKER_ID}] Passione 500 v2 開始: {datetime.now().strftime('%H:%M:%S')}")
    print(f"[W{WORKER_ID}] {'='*50}", flush=True)

    if not check_robots_txt(SITE_BASE_URL, "/"):
        print(f"[W{WORKER_ID}] robots.txtによりクロール禁止")
        return

    # URLリストが渡されていなければ自分で収集
    if url_chunk is None:
        urls = get_all_urls()
        target = random.sample(urls, min(TEST_COUNT * 3, len(urls))) if TEST_MODE else urls
    else:
        target = url_chunk
        print(f"[W{WORKER_ID}] 担当URL: {len(target)} 件")

    if not target:
        print(f"[W{WORKER_ID}] URLなし、終了")
        return

    driver = setup_driver()
    try:
        scrape_details(driver, target)
    finally:
        driver.quit()

    elapsed = time.time() - start
    h, m, s = int(elapsed // 3600), int((elapsed % 3600) // 60), int(elapsed % 60)
    print(f"[W{WORKER_ID}] 所要時間: {h}時間{m}分{s}秒", flush=True)


if __name__ == "__main__":
    main()
