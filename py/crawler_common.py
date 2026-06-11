"""
クローラー共通モジュール

全クローラーに重複していたボイラープレート（env読込・Supabaseクライアント生成・
batch_upsert・detect_target_cars・BOT_USER_AGENT）の共通置き場。
ショップ固有ロジック（取得方法・パース・リトライ戦略）は各クローラーに残す。

【重要・移行時の注意】
- 共通化は「同一コードの置き場所移動」であり、挙動を1つも変えないこと。
- BOT_USER_AGENT は2系統ある:
    長形式（本モジュールの BOT_USER_AGENT）: axel / parts_search_v2 / dangelo / euro / passione
    短形式（BOT_USER_AGENT_SHORT）: autobella / ricambio / mrfiat / 500line
  移行時は各クローラーが従来使っていた方を使うこと。
- detect_target_cars は dangelo_recon.py 版（`\\b500\\b` 境界あり）。
  passione_recon.py 版は `500`（境界なし）で判定が異なるため、passione移行時は
  そのまま流用せず差異を確認すること。
- partsテーブルへのupsertは on_conflict="product_no"（変更禁止・docs/refactor-baseline.md参照）。
"""

import os
import re

from dotenv import load_dotenv
from supabase import create_client

BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
BOT_USER_AGENT_SHORT = "Registro500Bot/1.0 (+https://www.registro500.com)"


def get_supabase():
    """py/.env を読み込み、Supabaseクライアントを生成して返す"""
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    return create_client(url, key)


def detect_target_cars(name, url):
    """商品名・URLから対応車種を判定"""
    text = f"{name or ''} {url or ''}".lower()
    cars = []
    if re.search(r'fiat[\s\-]*500|\b500\b', text):
        cars.append("Fiat 500")
    if re.search(r'\b126\b', text):
        cars.append("Fiat 126")
    if re.search(r'\b600\b', text):
        cars.append("Fiat 600")
    return ", ".join(cars) if cars else "Fiat 500"


def batch_upsert(supabase, batch):
    """バッチでSupabaseにupsert"""
    try:
        supabase.table("parts").upsert(batch, on_conflict="product_no").execute()
        return True
    except Exception as e:
        print(f"  [Batch Upsert Error] {e}")
        return False
