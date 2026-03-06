"""
EuroItalia500 クローラー（再構築版）
- Selenium廃止 → requests + BeautifulSoup（5〜7倍高速化）
- URL収集: DBの既存page_urlからカテゴリスラグを抽出し、各カテゴリをページネーション巡回
- 推定実行時間: 60〜90分（旧版: 137分）
- GitHub Actions 6h制限に余裕で収まるように
"""

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

SHOP_NAME = "EuroItalia500"
SITE_BASE_URL = "https://euroitalia500-commerce.it"
BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
BATCH_SIZE = 50

TEST_MODE = False
TEST_TARGET = 10


def add_lang_param(url):
    """英語ページ（id_lang=1）に切り替え"""
    if '?' in url:
        return url + '&id_lang=1'
    return url + '?id_lang=1'


def get_category_slugs():
    """DBの既存page_urlからカテゴリスラグ一覧を抽出"""
    print("1. カテゴリスラグをDBから取得中...")
    try:
        # RPC or 全件取得（件数が多いのでページング）
        all_urls = []
        offset = 0
        limit = 1000
        while True:
            res = (supabase.table("parts")
                   .select("page_url")
                   .eq("shop_name", SHOP_NAME)
                   .range(offset, offset + limit - 1)
                   .execute())
            if not res.data:
                break
            all_urls.extend(res.data)
            if len(res.data) < limit:
                break
            offset += limit

        slugs = set()
        for row in all_urls:
            url = row.get("page_url", "")
            if not url:
                continue
            path = url.replace(SITE_BASE_URL, "").lstrip("/")
            parts = [p for p in path.split("/") if p]
            if len(parts) >= 2:
                slugs.add(parts[0])

        result = sorted(slugs)
        print(f"   -> {len(result)} 個のカテゴリスラグをDBから抽出")
        return result
    except Exception as e:
        print(f"   [WARN] DBからのスラグ取得失敗: {e}")
        return []


def collect_urls_from_category(session, slug):
    """1カテゴリ内の全商品URLをページネーションで収集"""
    product_urls = set()
    page = 1
    while True:
        url = f"{SITE_BASE_URL}/{slug}?p={page}"
        try:
            r = session.get(url, timeout=20)
            if r.status_code != 200:
                break
            soup = BeautifulSoup(r.text, 'html.parser')
            links = soup.select("a.product_img_link")
            if not links:
                break
            for a in links:
                href = a.get("href", "")
                if href:
                    product_urls.add(href)
            # 次ページ確認
            next_btn = soup.select_one("#pagination_next_bottom a, li.pagination_next a")
            if not next_btn:
                break
            page += 1
            time.sleep(random.uniform(0.3, 0.6))
        except Exception as e:
            print(f"      [WARN] {url}: {e}")
            break
    return product_urls


def get_all_urls(session):
    """全カテゴリを走査して全商品URLを収集"""
    slugs = get_category_slugs()
    if not slugs:
        print("   [ERROR] カテゴリスラグが取得できません")
        return []

    all_urls = set()
    for i, slug in enumerate(slugs, 1):
        urls = collect_urls_from_category(session, slug)
        all_urls.update(urls)
        print(f"   [{i}/{len(slugs)}] {slug}: {len(urls)}件 (累計: {len(all_urls)}件)")
        time.sleep(random.uniform(0.5, 1.0))

    result = sorted(all_urls)
    print(f"   ★合計 {len(result)} 件の商品URLを取得しました")
    return result


def clean_price(price_str):
    """€22.00 / 1.200,50 → float"""
    if not price_str:
        return 0.0
    clean = re.sub(r'[^\d.,]', '', str(price_str))
    if ',' in clean and '.' in clean:
        clean = clean.replace('.', '').replace(',', '.')
    elif ',' in clean:
        clean = clean.replace(',', '.')
    try:
        return float(clean)
    except:
        return 0.0


def detect_vehicle(name, url):
    text = f"{name} {url}".lower()
    cars = []
    if re.search(r'fiat[\s\-]*500|\b500\b', text):
        cars.append("Fiat 500")
    if re.search(r'\b126\b', text):
        cars.append("Fiat 126")
    if re.search(r'\b600\b', text):
        cars.append("Fiat 600")
    return ", ".join(cars) if cars else "Fiat 500"


def scrape_product(session, url):
    """1商品ページをrequestsで取得してパース"""
    try:
        r = session.get(add_lang_param(url), timeout=20)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')

        # 品番（#product_reference: "Reference: ABC123" → "ABC123"）
        ref_el = soup.find(id='product_reference')
        if not ref_el:
            return None
        ref_text = ref_el.get_text(strip=True)
        # "Reference:" や "Riferimento:" などのラベルを除去
        item_no = re.sub(r'^.*?[:\.]', '', ref_text).strip()
        if not item_no:
            item_no = ref_text
        if not item_no:
            return None

        # 商品名
        h1 = soup.find('h1')
        name_en = re.sub(r'\s+', ' ', h1.get_text()).strip() if h1 else "Unknown"

        # 価格
        price_el = soup.find(id='our_price_display')
        price_euro = clean_price(price_el.get_text(strip=True)) if price_el else 0.0

        # 在庫
        avail_el = soup.find(id='availability_statut')
        if avail_el:
            stock_status = "在庫あり" if "stock" in avail_el.get_text().lower() else "在庫なし"
        else:
            stock_status = "在庫あり" if soup.find(id='add_to_cart') else "在庫なし"

        # 画像
        img_el = soup.find(id='bigpic')
        if img_el:
            image_url = img_el.get('src', '')
        else:
            og_img = soup.find('meta', property='og:image')
            image_url = og_img['content'] if og_img else ""

        # OEM番号
        oem_no = "N/A"
        desc_el = soup.find(id='short_description_content')
        if desc_el:
            m = re.search(r'(?:Original|OEM|Rif|Ref).*?[:\.]?\s*([0-9\s/A-Z\-]{4,})',
                          desc_el.get_text(), re.IGNORECASE)
            if m:
                oem_no = m.group(1).strip()

        return {
            "shop_name": SHOP_NAME,
            "product_no": item_no,
            "oem_no": oem_no,
            "name_en": name_en,
            "price_euro": price_euro,
            "stock_status": stock_status,
            "image_url": image_url,
            "page_url": url,
            "target_cars": detect_vehicle(name_en, url),
            # name_jp / category は含めない → AI翻訳済みデータを保護
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

    session = requests.Session()
    session.headers.update({
        "User-Agent": BOT_USER_AGENT,
        "Accept-Language": "en-US,en;q=0.5",
    })

    urls = get_all_urls(session)
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
    print(f"[OK] クローリング完了")
    print(f"終了時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"所要時間: {elapsed_total:.1f}分")
    print(f"成功: {success}件 / スキップ: {skip}件 / 合計URL: {total}件")
    print("=" * 60)


if __name__ == "__main__":
    main()
