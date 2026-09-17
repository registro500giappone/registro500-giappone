"""
Axel Gerstl クローラー（再構築版）
- Selenium廃止 → requests + BeautifulSoup（3〜5倍高速化）
- 推定実行時間: 120〜160分（旧版: 344.7分）
- GitHub Actions 6h制限に余裕で収まるように
"""

import sys
import time
import requests
import re
import random
from bs4 import BeautifulSoup

from crawler_common import BOT_USER_AGENT, get_supabase
import crawler_common

# --- 設定 ---
supabase = get_supabase()

SHOP_NAME = "Axel Gerstl"
SITE_BASE_URL = "https://webshop.fiat500126.com"
BATCH_SIZE = 50

TEST_MODE = False
TEST_TARGET = 10


class BotChallenge(Exception):
    """相手サイトのボット保護に阻まれた状態。待っても通らないので即座に中止する。"""


def is_bot_challenge(res):
    """Cloudflareのチャレンジ応答か判定する。

    Axel Gerstl は 2026-08-03 頃に Cloudflare のボット保護を有効化し、
    サイトマップも商品ページも 403 + インタースティシャルHTML を返すようになった。
    HTMLなので例外は出ず、<loc> が0件 → 商品URL 0件 → 正常終了に見えてしまっていた。
    """
    if res.headers.get("cf-mitigated") == "challenge":
        return True
    if res.status_code in (403, 503) and "just a moment" in res.text[:2000].lower():
        return True
    return False


def get_all_urls():
    """サイトマップから商品URLを取得（深さ3以上 = category/subcategory/product）"""
    print("1. サイトマップを読み込み中...")
    try:
        res = requests.get(f"{SITE_BASE_URL}/sitemap.xml", timeout=30,
                           headers={"User-Agent": BOT_USER_AGENT})
    except Exception as e:
        print(f"   サイトマップエラー: {e}")
        return []

    if is_bot_challenge(res):
        raise BotChallenge(
            f"サイトマップの取得がボット保護に遮断されました（HTTP {res.status_code}）"
        )
    if res.status_code != 200:
        print(f"   サイトマップエラー: HTTP {res.status_code}")
        return []

    try:
        all_locs = re.findall(r'<loc>(.*?)</loc>', res.text)

        # /de/ → /en/ に統一、画像・PDF・アカウントページを除外
        normalized = set()
        for u in all_locs:
            u = u.strip().replace('/de/', '/en/')
            if not any(x in u for x in ['.jpg', '.png', '.pdf', '.xml', '/account']):
                normalized.add(u)

        # /en/ 配下で深さ3以上（category/subcategory/product）のみ商品ページ
        product_urls = []
        for u in normalized:
            path = u.replace(SITE_BASE_URL, '').rstrip('/')
            segments = [s for s in path.split('/') if s]
            # /en/cat/subcat/product のような構造
            if len(segments) >= 3 and segments[0] == 'en':
                product_urls.append(u)

        product_urls = sorted(product_urls)
        print(f"   ★商品URL: {len(product_urls)} 件")
        return product_urls
    except Exception as e:
        print(f"   サイトマップの解析エラー: {e}")
        return []


def clean_price(price_str):
    """39.90 / 1.200,50 → float"""
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
        r = session.get(url, timeout=15)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')

        # 品番
        sku_el = soup.find(itemprop='sku')
        if not sku_el:
            return None
        item_no = sku_el.get('content') or sku_el.get_text(strip=True)
        if not item_no:
            return None

        # 価格（<span itemprop="price">39.90</span>）
        price_el = soup.find(itemprop='price')
        price_euro = clean_price(price_el.get_text(strip=True)) if price_el else 0.0

        # 在庫
        stock_status = "在庫あり" if soup.find(class_='sn_addtobasket') else "在庫なし"

        # 画像（/img_shop/ パターン）
        img_el = soup.find('img', src=lambda s: s and '/img_shop/' in s)
        if img_el:
            src = img_el['src']
            image_url = src if src.startswith('http') else f"{SITE_BASE_URL}/{src.lstrip('/')}"
        else:
            image_url = ""

        # 商品名（余分な空白・改行・タブを除去）
        h1 = soup.find('h1')
        name_en = re.sub(r'\s+', ' ', h1.get_text()).strip() if h1 else "Unknown"

        # OEM番号
        oem_no = "N/A"
        body_text = soup.get_text()
        m = re.search(r'(?:Original.*number|Ref\.|OEM).*?[:\.]\s*([0-9\s/A-Z]+)',
                      body_text, re.IGNORECASE)
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
    """バッチでSupabaseにupsert（共通モジュールへ委譲）"""
    return crawler_common.batch_upsert(supabase, batch)


def main():
    from datetime import datetime
    start_time = time.time()
    print("=" * 60)
    print(f"{SHOP_NAME} クローラー 開始（再構築版）")
    print(f"開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    try:
        urls = get_all_urls()
    except BotChallenge as e:
        print(f"[BLOCKED] {e}")
        print("ショップ側が自動アクセスを拒否しています。リトライでは解決しません。")
        print("再開するには、ショップにクロールの可否を確認し、許可が得られる場合は")
        print("Bot UA/送信元の許可リスト登録を依頼する必要があります。")
        sys.exit(1)

    if not urls:
        # 0件は「商品が無い」ではなく取得失敗。successで終わると気づけないので落とす
        print("[ERROR] URLを取得できませんでした")
        sys.exit(1)

    total = len(urls)
    print(f"\n2. 商品詳細の収集を開始します（{total} 件）...")

    session = requests.Session()
    session.headers.update({"User-Agent": BOT_USER_AGENT})

    success = 0
    skip = 0
    batch = []

    for i, url in enumerate(urls, 1):
        if TEST_MODE and success >= TEST_TARGET:
            print(f"★ テストモード完了（{TEST_TARGET}件）")
            break

        time.sleep(random.uniform(0.3, 0.6))

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

    # URLはあるのに1件も取れない＝商品ページ側が遮断されている等の異常
    if success == 0:
        print("[ERROR] 1件も取得できませんでした（商品ページ側が遮断された可能性）")
        sys.exit(1)


if __name__ == "__main__":
    main()
    crawler_common.exit_if_upsert_failed()
