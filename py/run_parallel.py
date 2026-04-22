"""
run_parallel.py
URLリストを分割してマルチプロセスで並列クロールする汎用ランナー（2026/02/21）

使い方:
  python run_parallel.py passione   # Passione 500を4並列でクロール
  python run_parallel.py fd         # FD Ricambiを3並列でクロール
  python run_parallel.py euro       # EuroItalia500を3並列でクロール
  python run_parallel.py dangelo    # D'Angelo Motoriを2並列でクロール
  python run_parallel.py axel       # Axel Gerstlを2並列でクロール

設計:
  1. URLリスト収集（Phase 1）は1プロセスで実行
  2. 収集したURLをN分割
  3. N個のワーカープロセスで同時に Phase 2（詳細取得）を実行
"""
import sys
import os
import time
import multiprocessing
import requests
import re
import random
from datetime import datetime

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

# ChromeDriverパッチを事前適用
from crawler_utils import BOT_USER_AGENT

# ---- ショップ別設定 ----
SHOP_CONFIG = {
    "passione": {
        "name": "Passione 500",
        "workers": 4,
        "url_collector": "collect_passione_urls",
        "worker_module": "passione_recon_v2",
    },
    "fd": {
        "name": "FD Ricambi",
        "workers": 3,
        "url_collector": "collect_fd_urls",
        "worker_module": "parts_search_v2",
    },
    "euro": {
        "name": "EuroItalia500",
        "workers": 3,
        "url_collector": "collect_euro_urls",
        "worker_module": "euro_search",
    },
    "dangelo": {
        "name": "D'Angelo Motori",
        "workers": 2,
        "url_collector": "collect_dangelo_urls",
        "worker_module": "dangelo_recon",
    },
    "axel": {
        "name": "Axel Gerstl",
        "workers": 2,
        "url_collector": "collect_axel_urls",
        "worker_module": "axel_full_search",
    },
}

# =========================================================
# URL収集関数（Phase 1）
# =========================================================

def collect_passione_urls():
    """Passione 500: XMLサイトマップから収集（product_cat除外）"""
    print("[Phase1] Passione 500 URLを収集中...")
    headers = {'User-Agent': BOT_USER_AGENT}
    all_urls = set()
    try:
        res = requests.get("https://passione500.it/sitemap_index.xml",
                           timeout=30, headers=headers)
        sitemaps = re.findall(r'<loc>(.*?)</loc>', res.text)
        targets = [u for u in sitemaps
                   if re.search(r'/product-sitemap\d*\.xml|/prodotto-sitemap', u)]
        for sm in targets:
            sub = requests.get(sm, timeout=30, headers=headers)
            for u in re.findall(r'<loc>(.*?)</loc>', sub.text):
                if "/en/" in u:
                    all_urls.add(u)
    except Exception as e:
        print(f"[Phase1] エラー: {e}")
    urls = sorted(list(all_urls))
    print(f"[Phase1] Passione 500: {len(urls)} 件")
    return urls


def collect_fd_urls():
    """FD Ricambi: gzip XMLサイトマップから収集"""
    import gzip, io
    print("[Phase1] FD Ricambi URLを収集中...")
    headers = {'User-Agent': BOT_USER_AGENT}
    all_urls = []
    try:
        res = requests.get("https://www.fdricambi.com/sitemap.xml",
                           timeout=30, headers=headers)
        gz_urls = re.findall(r'(https://.*?product-sitemap.*?\.xml\.gz)', res.text)
        print(f"[Phase1] gzサイトマップ: {len(gz_urls)}個")
        for gz_url in gz_urls:
            try:
                r = requests.get(gz_url, timeout=30, headers=headers)
                with gzip.GzipFile(fileobj=io.BytesIO(r.content)) as f:
                    xml = f.read().decode('utf-8')
                urls = [u for u in re.findall(r'<loc>(https://.*?)</loc>', xml)
                        if '/en/' in u and not u.endswith(('.jpg', '.png', '.pdf', '.xml', '.gz'))]
                all_urls.extend(urls)
            except Exception as e:
                print(f"[Phase1] gz取得エラー: {e}")
    except Exception as e:
        print(f"[Phase1] エラー: {e}")
    urls = list(set(all_urls))
    print(f"[Phase1] FD Ricambi: {len(urls)} 件")
    return urls


def collect_euro_urls():
    """EuroItalia500: URLリストファイルがあれば再利用、なければSeleniumで収集"""
    import pandas as pd
    url_file = os.path.join(os.path.expanduser('~'), 'Desktop', 'euro_url_list.csv')
    if os.path.exists(url_file):
        urls = pd.read_csv(url_file)['URL'].tolist()
        print(f"[Phase1] EuroItalia500: 既存ファイルから {len(urls)} 件")
        return urls
    # SeleniumでURL収集が必要（1ドライバーで実行）
    print("[Phase1] EuroItalia500: Seleniumでカテゴリ巡回中...")
    from crawler_utils import setup_driver
    from selenium.webdriver.common.by import By
    driver = setup_driver()
    try:
        from euro_search import collect_all_urls
        urls = collect_all_urls(driver)
    finally:
        driver.quit()
    print(f"[Phase1] EuroItalia500: {len(urls)} 件")
    return urls


def collect_dangelo_urls():
    """D'Angelo Motori: URLリストファイルがあれば再利用、なければSeleniumで収集"""
    import pandas as pd
    url_file = os.path.join(os.path.expanduser('~'), 'Desktop', 'dangelo_url_list.csv')
    if os.path.exists(url_file):
        urls = pd.read_csv(url_file)['URL'].tolist()
        print(f"[Phase1] D'Angelo: 既存ファイルから {len(urls)} 件")
        return urls
    print("[Phase1] D'Angelo: Seleniumでカテゴリ巡回中...")
    from crawler_utils import setup_driver
    driver = setup_driver()
    try:
        from dangelo_recon import collect_all_urls
        urls = collect_all_urls(driver)
    finally:
        driver.quit()
    print(f"[Phase1] D'Angelo: {len(urls)} 件")
    return urls


def collect_axel_urls():
    """Axel Gerstl: XMLサイトマップから収集（requests のみ）"""
    print("[Phase1] Axel Gerstl URLを収集中...")
    headers = {'User-Agent': BOT_USER_AGENT}
    try:
        res = requests.get("https://webshop.fiat500126.com/sitemap.xml",
                           timeout=30, headers=headers)
        all_locs = re.findall(r'<loc>(.*?)</loc>', res.text)
        urls = sorted(list(set([
            u.strip().replace('/de/', '/en/')
            for u in all_locs
            if not any(x in u for x in ['.jpg', '.png', '.pdf', '.xml', '/account'])
        ])))
        print(f"[Phase1] Axel Gerstl: {len(urls)} 件")
        return urls
    except Exception as e:
        print(f"[Phase1] エラー: {e}")
        return []


# =========================================================
# ワーカー関数（各プロセスで実行）
# =========================================================

def worker_passione(args):
    worker_id, url_chunk = args
    import passione_recon_v2
    passione_recon_v2.WORKER_ID = worker_id
    passione_recon_v2.main(url_chunk=url_chunk)


def worker_fd(args):
    worker_id, url_chunk = args
    from crawler_utils import setup_driver
    import parts_search_v2 as fd
    driver = setup_driver()
    try:
        fd.scrape_fd_details(driver, url_chunk)
    finally:
        driver.quit()


def worker_euro(args):
    worker_id, url_chunk = args
    from crawler_utils import setup_driver
    import euro_search as eu
    driver = setup_driver()
    try:
        eu.scrape_details(driver, url_chunk)
    finally:
        driver.quit()


def worker_dangelo(args):
    worker_id, url_chunk = args
    from crawler_utils import setup_driver
    import dangelo_recon as da
    driver = setup_driver()
    try:
        da.scrape_details(driver, url_chunk)
    finally:
        driver.quit()


def worker_axel(args):
    worker_id, url_chunk = args
    from crawler_utils import setup_driver
    import axel_full_search as ax
    driver = setup_driver()
    try:
        ax.scrape_axel_details(driver, url_chunk)
    finally:
        driver.quit()


WORKER_FUNCS = {
    "passione": worker_passione,
    "fd":       worker_fd,
    "euro":     worker_euro,
    "dangelo":  worker_dangelo,
    "axel":     worker_axel,
}

URL_COLLECTORS = {
    "passione": collect_passione_urls,
    "fd":       collect_fd_urls,
    "euro":     collect_euro_urls,
    "dangelo":  collect_dangelo_urls,
    "axel":     collect_axel_urls,
}


# =========================================================
# メイン実行
# =========================================================

def split_urls(urls, n):
    """URLリストをn分割（ラウンドロビン方式でバランスよく分割）"""
    return [urls[i::n] for i in range(n)]


def run_parallel(shop_key):
    config = SHOP_CONFIG[shop_key]
    n_workers = config["workers"]
    shop_name = config["name"]

    print(f"\n{'='*60}")
    print(f"{shop_name} 並列クロール開始")
    print(f"ワーカー数: {n_workers}")
    print(f"開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    # Phase 1: URL収集（1プロセス）
    print("--- Phase 1: URL収集 ---")
    start = time.time()
    urls = URL_COLLECTORS[shop_key]()
    phase1_elapsed = time.time() - start

    if not urls:
        print(f"URLが取得できませんでした。終了します。")
        return

    print(f"URL収集完了: {len(urls)} 件（{phase1_elapsed:.1f}秒）\n")

    # URLを分割
    chunks = split_urls(urls, n_workers)
    for i, chunk in enumerate(chunks):
        print(f"  Worker {i}: {len(chunk)} 件担当")

    # Phase 2: 並列クロール
    print(f"\n--- Phase 2: {n_workers}並列でクロール開始 ---")
    phase2_start = time.time()

    worker_func = WORKER_FUNCS[shop_key]
    args_list = [(i, chunk) for i, chunk in enumerate(chunks)]

    with multiprocessing.Pool(processes=n_workers) as pool:
        pool.map(worker_func, args_list)

    phase2_elapsed = time.time() - phase2_start
    total_elapsed = time.time() - start

    print(f"\n{'='*60}")
    print(f"{shop_name} 完了")
    print(f"Phase 1（URL収集）: {phase1_elapsed:.1f}秒")
    print(f"Phase 2（クロール）: {phase2_elapsed/60:.1f}分")
    print(f"合計: {total_elapsed/60:.1f}分")
    print(f"処理速度: {len(urls)/total_elapsed:.1f} URL/秒")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使い方: python run_parallel.py <shop>")
        print("shop: passione / fd / euro / dangelo / axel")
        sys.exit(1)

    shop = sys.argv[1].lower()
    if shop not in SHOP_CONFIG:
        print(f"未対応のショップ: {shop}")
        print(f"対応ショップ: {list(SHOP_CONFIG.keys())}")
        sys.exit(1)

    run_parallel(shop)
