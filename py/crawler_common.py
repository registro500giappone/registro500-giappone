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
import sys

from dotenv import load_dotenv
from supabase import create_client

BOT_USER_AGENT = "Registro500Bot/1.0 (+https://www.registro500.com; parts price comparison)"
BOT_USER_AGENT_SHORT = "Registro500Bot/1.0 (+https://www.registro500.com)"


def get_supabase():
    """py/.env を読み込み、Supabaseクライアントを生成して返す

    書込用キーは SUPABASE_SERVICE_KEY を優先し、無ければ SUPABASE_KEY を使う。
    GitHub Actions の secrets.SUPABASE_KEY は書込権限のあるキーだが、
    ローカルの py/.env では SUPABASE_KEY が公開キー（sb_publishable_）で
    書き込めないため、両方の環境で動くようフォールバックにしている。
    """
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
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


# upsert に失敗したバッチ数。exit_if_upsert_failed() で参照する
_upsert_failed_batches = 0


def batch_upsert(supabase, batch):
    """バッチでSupabaseにupsert"""
    global _upsert_failed_batches
    try:
        supabase.table("parts").upsert(batch, on_conflict="product_no").execute()
        return True
    except Exception as e:
        _upsert_failed_batches += 1
        print(f"  [Batch Upsert Error] {e}")
        return False


def exit_if_upsert_failed():
    """upsert が1件でも失敗していたら警告して異常終了する

    各クローラーの最後に呼ぶ。クロール自体は成功していても保存が全滅している
    状態（キーの権限不足・RLS違反など）を「成功」で終わらせないための歯止め。
    実際に FD Ricambi はこれが無かったため、書き込みが RLS で弾かれ続けた
    2026-05-26〜08-08 の約3ヶ月間、[OK] 表示のまま更新が止まっていた。
    """
    if _upsert_failed_batches == 0:
        return
    print("")
    print("=" * 60)
    print(f"[FAILED] クロールは完了しましたが、Supabaseへの保存に失敗しました"
          f"（失敗バッチ数: {_upsert_failed_batches}）")
    print("  上の [Batch Upsert Error] を確認してください。よくある原因:")
    print("  - SUPABASE_SERVICE_KEY / SUPABASE_KEY が書き込み権限のないキー")
    print("  - parts テーブルのRLSポリシー違反")
    print("=" * 60)
    sys.exit(1)
