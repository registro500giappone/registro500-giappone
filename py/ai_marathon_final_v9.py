import google.generativeai as genai
import os
import re
import json
import time
from supabase import create_client
from dotenv import load_dotenv

# --- 設定 ---
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
# ------------------------------------

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_API_KEY)
MODEL_NAME = 'models/gemini-flash-lite-latest'
model = genai.GenerativeModel(MODEL_NAME)

def get_ai_cleaning(batch_data):
    """
    フェーズ1: イタリア語・英語の商品名を解析し、日本語で整理する（category IS NULL 対象）
    """
    prompt = f"""
    あなたはフィアット500専門店Registro500の熟練メカニックです。
    提供する商品名（英語またはイタリア語）を解析し、以下の5つを日本語で整理してJSON形式で返してください。

    【重要】
    ・EuroItalia500やD'Angelo Motoriの商品は「イタリア語」で記載されています。必ず日本語に翻訳してください。
    ・"Marmitta" -> "マフラー", "Guarnizione" -> "パッキン" のように専門用語で翻訳すること。

    【ルール】
    1. name_jp: 日本のオーナーが使う通称。Wiki(w.atwiki.jp/fiat500-onlinemanual/)の用語を最優先。
    2. specs: 寸法(mm, Ø)、材質、歯数、左右、前後などの仕様を抽出。
    3. category: [エンジン・吸排気、駆動系・ミッション、足回り・ブレーキ、電装・ライト・点火系、外装・ボディ・幌、内装・インテリア、アクセサリー・その他] から1つ。
    4. target_cars: 適合車種(F, L, R, D, N, Giardiniera, 126, 600等)を抽出。
    5. search_keywords_jp: 日本語検索キーワードをカンマ区切りで5〜10個。同義語・略称・関連部品名・俗称を含める。
       例: "キャブレター, キャブ, 気化器, ウェーバー, 吸気系"
       例: "ガスケット, パッキン, シール, ヘッドガスケット, エンジン"

    【対象リスト】
    {batch_data}

    【返却形式】(JSON配列のみ)
    [ {{"id": "数値", "name_jp": "...", "specs": "...", "category": "...", "target_cars": "...", "search_keywords_jp": "..."}} ]
    """
    try:
        response = model.generate_content(prompt)
        text = response.text
        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return None
    except Exception as e:
        if "429" in str(e):
            print("\n[RETRY] 混雑しています。60秒休憩します...")
            time.sleep(60)
            return "RETRY"
        print(f"   [AI Error] {e}")
        return None

def get_ai_keywords(batch_data):
    """
    フェーズ2: 既翻訳データに search_keywords_jp を追加生成（search_keywords_jp IS NULL 対象）
    """
    prompt = f"""
    あなたはフィアット500専門店Registro500の熟練メカニックです。
    以下の商品リストに対して、日本語検索キーワードを生成してください。

    【ルール】
    - search_keywords_jp: 日本語キーワードをカンマ区切りで5〜10個。
    - name_jp（日本語名）と name_en（英語原文）の両方を参考にすること。
    - 同義語・略称・関連部品名・俗称・素材・規格を含める。
    - 例（カムシャフト): "カム, カムシャフト, 弁機構, バルブタイミング, エンジン内部"
    - 例（ウェザーストリップ): "ウェザーストリップ, ゴムモール, シール, ドアゴム, 雨漏り対策"

    【対象リスト】
    {batch_data}

    【返却形式】(JSON配列のみ)
    [ {{"id": "数値", "search_keywords_jp": "..."}} ]
    """
    try:
        response = model.generate_content(prompt)
        text = response.text
        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return None
    except Exception as e:
        if "429" in str(e):
            print("\n[RETRY] 混雑しています。60秒休憩します...")
            time.sleep(60)
            return "RETRY"
        print(f"   [AI Error] {e}")
        return None

def main():
    print(f"--- AIお掃除マラソン(v10:keywords対応) 開始 ---")

    # ===== フェーズ1: category IS NULL の翻訳処理 =====
    print("\n=== フェーズ1: 未翻訳データの処理（category IS NULL）===")
    total_done = 0

    while True:
        res = supabase.table("parts").select("id, name_en, shop_name").is_("category", "null").limit(20).execute()
        records = res.data

        if not records or len(records) == 0:
            print(f"[COMPLETE] フェーズ1完了（合計 {total_done}件）")
            break

        input_list = "\n".join([f"ID:{r['id']} | Name:{r['name_en']}" for r in records])
        results = get_ai_cleaning(input_list)

        if results == "RETRY": continue

        if results:
            success_count = 0
            for r_ai in results:
                try:
                    record_id = int(r_ai['id'])
                    supabase.table("parts").update({
                        "name_jp": r_ai['name_jp'],
                        "specs": r_ai['specs'],
                        "category": r_ai['category'],
                        "target_cars": r_ai['target_cars'],
                        "search_keywords_jp": r_ai.get('search_keywords_jp', '')
                    }).eq("id", record_id).execute()
                    success_count += 1
                except: continue

            total_done += success_count
            print(f"[OK] フェーズ1: 合計 {total_done}件 完了")
            time.sleep(5)
        else:
            print("[WARN] 応答なし。スキップします。")
            time.sleep(5)

    # ===== フェーズ2: search_keywords_jp IS NULL の補完処理 =====
    print("\n=== フェーズ2: 検索キーワード生成（search_keywords_jp IS NULL）===")
    total_done2 = 0

    while True:
        res = supabase.table("parts").select("id, name_en, name_jp").is_("search_keywords_jp", "null").limit(20).execute()
        records = res.data

        if not records or len(records) == 0:
            print(f"[COMPLETE] フェーズ2完了（合計 {total_done2}件）")
            break

        input_list = "\n".join([f"ID:{r['id']} | name_en:{r['name_en']} | name_jp:{r.get('name_jp', '')}" for r in records])
        results = get_ai_keywords(input_list)

        if results == "RETRY": continue

        if results:
            success_count = 0
            for r_ai in results:
                try:
                    record_id = int(r_ai['id'])
                    supabase.table("parts").update({
                        "search_keywords_jp": r_ai['search_keywords_jp']
                    }).eq("id", record_id).execute()
                    success_count += 1
                except: continue

            total_done2 += success_count
            print(f"[OK] フェーズ2: 合計 {total_done2}件 完了")
            time.sleep(5)
        else:
            print("[WARN] 応答なし。スキップします。")
            time.sleep(5)

    print("\n===== 全処理完了 =====")

if __name__ == "__main__":
    main()
