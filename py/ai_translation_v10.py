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
MODEL_NAME = 'gemini-pro'  # 安定版モデルを使用
model = genai.GenerativeModel(MODEL_NAME)

def get_ai_translation(batch_data):
    """
    商品名を解析し、日本語で整理 + 検索キーワードを生成
    """
    prompt = f"""
あなたはフィアット500/126専門店の熟練メカニックです。
提供する商品名（英語またはイタリア語）を解析し、以下の5つを日本語で整理してJSON形式で返してください。

【重要な注意事項】
1. イタリア語の専門用語を正しく翻訳:
   - "Marmitta" → "マフラー"
   - "Guarnizione" → "ガスケット/パッキン"
   - "Freno" → "ブレーキ"
   - "Frizione" → "クラッチ"
   - "Ammortizzatore" → "ショックアブソーバー"

2. 適合車種（target_cars）の抽出ルール:
   - 商品名に含まれる **すべての車種** を抽出
   - "500" が含まれる場合は必ず "Fiat 500" を含める
   - "126" が含まれる場合は "Fiat 126" を含める
   - "600" が含まれる場合は "Fiat 600" を含める
   - "N", "D", "F", "L", "R" などのサブモデルも含める
   - カンマ区切りで列挙: 例 "Fiat 500 N/D/F/L/R, Fiat 126, Fiat 600"
   - 車種情報がない場合: "Fiat 500 (全モデル)" とする

3. カテゴリ分類:
   以下から **1つだけ** 選択:
   - エンジン・吸排気
   - 駆動系・ミッション
   - 足回り・ブレーキ
   - 電装・ライト・点火系
   - 外装・ボディ・幌
   - 内装・インテリア
   - アクセサリー・その他

【出力項目】
1. name_jp: 日本のオーナーが使う通称（簡潔に）
2. specs: 寸法(mm, Ø)、材質、歯数、左右、前後などの仕様
3. category: 上記カテゴリから1つ
4. target_cars: 適合車種（上記ルールに従う）
5. search_keywords_jp: 検索用の日本語キーワード（カンマ区切りで5-10個）
   - 商品の種類、部位、機能、材質などを含める
   - 同義語も含める（例: ガスケット, パッキン）

【対象リスト】
{batch_data}

【返却形式】(JSON配列のみ、説明文は不要)
[
  {{
    "id": 数値,
    "name_jp": "...",
    "specs": "...",
    "category": "...",
    "target_cars": "...",
    "search_keywords_jp": "..."
  }}
]
"""
    try:
        response = model.generate_content(prompt)
        text = response.text

        # JSONを抽出
        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())

        print(f"   [WARN] JSON形式が見つかりません: {text[:200]}")
        return None

    except Exception as e:
        if "429" in str(e) or "quota" in str(e).lower():
            print("\n[RETRY] API制限。60秒休憩します...")
            time.sleep(60)
            return "RETRY"
        if "503" in str(e):
            print("\n[RETRY] サーバー過負荷。30秒休憩します...")
            time.sleep(30)
            return "RETRY"
        print(f"   [AI Error] {e}")
        return None

def main():
    print(f"=" * 60)
    print(f"AI翻訳マラソン v10 - 全面改善版")
    print(f"改善点:")
    print(f"  1. target_cars の抽出精度向上")
    print(f"  2. search_keywords_jp の生成")
    print(f"  3. 最新AIモデル使用")
    print(f"=" * 60)

    # 処理モードを選択
    print("\n処理モードを選択してください:")
    print("1. 全件を再処理（category を NULL に戻して全件再翻訳）")
    print("2. 未処理のみ（category IS NULL のデータのみ）")
    print("3. 特定ショップのみ再処理")

    mode = input("選択 (1/2/3): ").strip()

    if mode == "1":
        confirm = input("全件再処理します。よろしいですか？ (yes/no): ").strip()
        if confirm.lower() != "yes":
            print("キャンセルしました。")
            return

        # category を NULL にリセット
        print("\n全データの category を NULL にリセット中...")
        supabase.table("parts").update({
            "category": None,
            "name_jp": None,
            "specs": None,
            "target_cars": None,
            "search_keywords_jp": None
        }).neq("id", 0).execute()
        print("リセット完了！")

    elif mode == "3":
        shop_name = input("ショップ名を入力 (例: Axel Gerstl): ").strip()
        confirm = input(f"{shop_name} のデータを再処理します。よろしいですか？ (yes/no): ").strip()
        if confirm.lower() != "yes":
            print("キャンセルしました。")
            return

        # 特定ショップの category を NULL にリセット
        print(f"\n{shop_name} のデータをリセット中...")
        supabase.table("parts").update({
            "category": None,
            "name_jp": None,
            "specs": None,
            "target_cars": None,
            "search_keywords_jp": None
        }).eq("shop_name", shop_name).execute()
        print("リセット完了！")

    # 翻訳処理開始
    total_done = 0
    batch_size = 10  # 20件→10件に削減（精度向上のため）

    print(f"\n翻訳処理を開始します...")
    print(f"バッチサイズ: {batch_size}件")

    while True:
        # category が NULL のデータを取得
        res = supabase.table("parts")\
            .select("id, name_en, shop_name")\
            .is_("category", "null")\
            .limit(batch_size)\
            .execute()

        records = res.data

        if not records or len(records) == 0:
            print("\n" + "=" * 60)
            print(f"[COMPLETE] すべて完了しました！")
            print(f"総処理件数: {total_done}件")
            print("=" * 60)
            break

        # AI送信用（ショップ名もヒントとして渡す）
        input_list = "\n".join([
            f"ID:{r['id']} | Shop:{r['shop_name']} | Name:{r['name_en']}"
            for r in records
        ])

        results = get_ai_translation(input_list)

        if results == "RETRY":
            continue

        if results:
            success_count = 0
            for r_ai in results:
                try:
                    record_id = int(r_ai['id'])

                    # 更新データを準備
                    update_data = {
                        "name_jp": r_ai.get('name_jp', ''),
                        "specs": r_ai.get('specs', ''),
                        "category": r_ai.get('category', 'アクセサリー・その他'),
                        "target_cars": r_ai.get('target_cars', 'Fiat 500 (全モデル)'),
                        "search_keywords_jp": r_ai.get('search_keywords_jp', '')
                    }

                    supabase.table("parts").update(update_data).eq("id", record_id).execute()
                    success_count += 1

                except Exception as e:
                    print(f"   [ERROR] ID {r_ai.get('id', '?')} の更新に失敗: {e}")
                    continue

            total_done += success_count
            print(f"[OK] {success_count}件処理完了（累計: {total_done}件）")

            time.sleep(3)  # API負荷軽減
        else:
            print("[WARN] AI応答なし。スキップします。")
            time.sleep(5)

if __name__ == "__main__":
    main()
