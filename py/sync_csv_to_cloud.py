import pandas as pd
import re
import os
from supabase import create_client
from dotenv import load_dotenv

# --- Supabase設定 ---
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ファイルパス
DESKTOP_PATH = os.path.join(os.path.expanduser('~'), 'Desktop')
AXEL_CSV = os.path.join(DESKTOP_PATH, "axel_full_catalog.csv")
FD_CSV = os.path.join(DESKTOP_PATH, "fd_full_catalog_v2.csv")

def clean_price(price_str):
    if pd.isna(price_str) or price_str == "N/A": return 0.0
    price_val = re.sub(r'[^\d.,]', '', str(price_str))
    price_val = price_val.replace(',', '.')
    try: return float(price_val)
    except: return 0.0

def clean_stock(stock_str):
    if pd.isna(stock_str): return "不明"
    s = str(stock_str).lower()
    if "in stock" in s: return "在庫あり"
    if "out of stock" in s: return "在庫なし"
    if "soon" in s or "available" in s: return "取り寄せ可"
    return "不明"

def sync_csv(file_path, shop_name):
    if not os.path.exists(file_path):
        print(f"ファイルが見つかりません: {file_path}")
        return

    print(f"\n--- {shop_name} のデータを同期中 ---")
    df = pd.read_csv(file_path)
    total = len(df)

    for i, row in df.iterrows():
        formatted_data = {
            "shop_name": shop_name,
            "product_no": str(row['Product No']),
            "oem_no": str(row.get('OEM', "N/A")),
            "name_en": str(row['Name']),
            "price_euro": clean_price(row['Price']),
            "stock_status": clean_stock(row['Stock']),
            "image_url": str(row['Image_URL']),
            "page_url": str(row['URL']),
            "target_cars": str(row['Vehicle'])
        }
        
        try:
            # クラウドへ送信
            supabase.table("parts").upsert(formatted_data, on_conflict="product_no").execute()
            if i % 10 == 0: # 10件ごとに進捗を表示
                print(f"  [{i}/{total}] 同期中: {row['Product No']}")
        except Exception as e:
            print(f"  [Error] {row['Product No']}: {e}")

    print(f"--- {shop_name} 完了 ---")

if __name__ == "__main__":
    # FDのデータを同期
    sync_csv(FD_CSV, "FD Ricambi")
    # Axelのデータを同期
    sync_csv(AXEL_CSV, "Axel Gerstl")
    print("\nすべての同期作業が終了しました！Supabaseを確認してください。")