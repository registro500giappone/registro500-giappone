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
MODEL_NAME = 'models/gemini-flash-lite-latest'  # v9で動作していたモデル
model = genai.GenerativeModel(MODEL_NAME)

def get_ai_translation(batch_data):
    """
    商品名を解析し、日本語で整理 + 検索キーワードを生成
    """
    prompt = f"""
あなたはフィアット500/126専門店Registro500の熟練メカニックです。
提供する商品名（英語またはイタリア語）を解析し、以下の5つを日本語で整理してJSON形式で返してください。

【重要】
・EuroItalia500やD'Angelo Motoriの商品は「イタリア語」で記載されています。必ず日本語に翻訳してください。
・"Marmitta" -> "マフラー", "Guarnizione" -> "パッキン/ガスケット" のように専門用語で翻訳すること。

【ルール】
1. name_jp: 日本のオーナーが使う通称。Wiki(w.atwiki.jp/fiat500-onlinemanual/)の用語を最優先。
2. specs: 寸法(mm, Ø)、材質、歯数、左右、前後などの仕様を抽出。
3. category: [エンジン・吸排気、駆動系・ミッション、足回り・ブレーキ、電装・ライト・点火系、外装・ボディ・幌、内装・インテリア、アクセサリー・その他] から1つ。
4. target_cars: 適合車種を「すべて」抽出。
   - 商品名に "500" が含まれる場合: 必ず "Fiat 500" を含める
   - "N", "D", "F", "L", "R" などのサブモデルも含める
   - "126" が含まれる場合: "Fiat 126" を含める
   - "600" が含まれる場合: "Fiat 600" を含める
   - 複数ある場合はカンマ区切り: 例 "Fiat 500 N/D/F/L/R, Fiat 126, Fiat 600"
   - 車種情報がない場合: "Fiat 500 (全モデル)"
5. search_keywords_jp: 検索用の日本語キーワード（カンマ区切りで5-10個）
   - 商品の種類、部位、機能を含める
   - 同義語も含める（例: ガスケット, パッキン, シール）

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

def main():
    print(f"=" * 60)
    print(f"AI翻訳マラソン - 改善版（v9ベース）")
    print(f"改善点: target_cars抽出強化 + search_keywords_jp生成")
    print(f"=" * 60)

    # 処理モードを選択
    print("\n処理モードを選択してください:")
    print("1. 全件を再処理")
    print("2. 未処理のみ")
    print("3. 特定ショップのみ")
    mode = input("選択 (1/2/3): ").strip()

    if mode == "1":
        confirm = input("全件再処理します。よろしいですか？ (yes/no): ").strip()
        if confirm.lower() != "yes":
            print("キャンセルしました。")
            return
        print("\n全データをリセット中...")
        supabase.table("parts").update({
            "category": None,
            "name_jp": None,
            "specs": None,
            "target_cars": None,
            "search_keywords_jp": None
        }).neq("id", 0).execute()
        print("リセット完了！")

    elif mode == "3":
        shop_name = input("ショップ名を入力: ").strip()
        confirm = input(f"{shop_name} を再処理します。よろしいですか？ (yes/no): ").strip()
        if confirm.lower() != "yes":
            print("キャンセルしました。")
            return
        print(f"\n{shop_name} をリセット中...")
        supabase.table("parts").update({
            "category": None,
            "name_jp": None,
            "specs": None,
            "target_cars": None,
            "search_keywords_jp": None
        }).eq("shop_name", shop_name).execute()
        print("リセット完了！")

    # 翻訳処理
    total_done = 0
    batch_size = 10

    print(f"\n翻訳処理を開始します（バッチサイズ: {batch_size}件）...")

    while True:
        res = supabase.table("parts").select("id, name_en, shop_name").is_("category", "null").limit(batch_size).execute()
        records = res.data

        if not records or len(records) == 0:
            print("\n" + "=" * 60)
            print(f"[COMPLETE] すべて完了しました！総処理件数: {total_done}件")
            print("=" * 60)
            break

        input_list = "\n".join([f"ID:{r['id']} | Name:{r['name_en']}" for r in records])
        results = get_ai_translation(input_list)

        if results == "RETRY":
            continue

        if results:
            success_count = 0
            for r_ai in results:
                try:
                    record_id = int(r_ai['id'])
                    supabase.table("parts").update({
                        "name_jp": r_ai.get('name_jp', ''),
                        "specs": r_ai.get('specs', ''),
                        "category": r_ai.get('category', 'アクセサリー・その他'),
                        "target_cars": r_ai.get('target_cars', 'Fiat 500 (全モデル)'),
                        "search_keywords_jp": r_ai.get('search_keywords_jp', '')
                    }).eq("id", record_id).execute()
                    success_count += 1
                except:
                    continue

            total_done += success_count
            print(f"[OK] {success_count}件処理完了（累計: {total_done}件）")
            time.sleep(3)
        else:
            print("[WARN] 応答なし。スキップします。")
            time.sleep(5)

if __name__ == "__main__":
    main()
