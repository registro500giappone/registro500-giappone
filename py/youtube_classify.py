"""
YouTubeポータル AI分類・日本語化スクリプト（タスク4）

HANDOFF.md §7-4・§5・§8 が正本。youtube_fetch.py で取り込んだ動画を Gemini で分類し、
主分類(category 1つ)・箇所タグ(複数)・車種(複数)・title_ja・description_ja を生成して反映する。

ルール（HANDOFF §8 不変条件）:
  - 主分類は1つ / 箇所タグは複数 / 車種は複数
  - 車種タグは粗い粒度（fiat-500 / fiat-126 / giardiniera / abarth / giannini）
  - AI解説は監修なしだが commentary_source='ai'・原題(title_original)は消さない
  - クラシック期のみ（無関係・現行車は relevant=false で除外）
  - confidence 低 → category は付けるが箇所タグ空＝「未分類」

使い方:
    python youtube_classify.py            # title_ja IS NULL の動画を分類
    python youtube_classify.py --limit 20 # 先頭20件だけ（テスト用）

env (py/.env): GEMINI_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY(無ければSUPABASE_KEY)
"""

import argparse
import json
import os
import re
import sys
import time

import google.generativeai as genai
from dotenv import load_dotenv
from supabase import create_client

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

PY_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(PY_DIR, ".env"))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_WRITE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]

genai.configure(api_key=GEMINI_API_KEY)
MODEL_NAME = "models/gemini-flash-lite-latest"
model = genai.GenerativeModel(MODEL_NAME)

CONFIDENCE_THRESHOLD = 0.5  # これ未満は箇所タグを付けず「未分類」扱い
BATCH_SIZE = 20


def load_master(supabase):
    """categories中区分(子のみ)・part_tags・vehicles の slug一覧を取得。"""
    cats = supabase.table("categories").select("slug, name_ja, parent_id").execute().data
    # 中区分のみ（parent_id が NULL でない＝子）を分類候補にする
    child_cats = [c for c in cats if c.get("parent_id")]
    parts = supabase.table("part_tags").select("slug, name_ja").execute().data
    vehs = supabase.table("vehicles").select("slug, name_display").execute().data
    return child_cats, parts, vehs


def build_prompt(records, child_cats, parts, vehs):
    cat_lines = "\n".join(f"  - {c['slug']}: {c['name_ja']}" for c in child_cats)
    part_lines = "\n".join(f"  - {p['slug']}: {p['name_ja']}" for p in parts)
    veh_lines = "\n".join(f"  - {v['slug']}: {v['name_display']}" for v in vehs)
    items = "\n".join(
        f"ID:{r['youtube_id']} | title:{r.get('title_original','')} | channel:{r.get('channel_name','')}"
        for r in records
    )
    return f"""あなたはクラシックFIAT 500/126専門の整備に詳しい編集者です。
以下のYouTube動画(イタリア語/英語が主)を分類し、日本語見出しと解説を作ってください。

【主分類 category_slug（1つだけ・以下から選ぶ）】
{cat_lines}

【箇所タグ part_tag_slugs（複数可・該当するものだけ・無ければ空配列）】
{part_lines}

【車種 vehicle_slugs（複数可・粗い粒度・以下から選ぶ）】
{veh_lines}

【判定ルール】
- relevant: クラシックFIAT 500/126の整備・レストア・チューニング・走行・歴史・イベント等に関係するなら true。
  キーワードは一致するが内容が無関係（ミニカー/キーホルダー/BGMだけの走行クリップ/現行新型500）は false。
- category_slug: 最も適切な中区分を1つ。
- part_tag_slugs: 動画で実際に扱う整備箇所のみ。確信が持てなければ空配列。
- vehicle_slugs: 対象車種。500/126両方なら両方。判別不能なら ["fiat-500"]。
- title_ja: 逐語訳でなく「意味が伝わる日本語見出し」(30字以内目安)。
- description_ja: 日本語ワンポイント解説3〜4行。何の作業/見どころかを具体的に。注意書きは付けない(表示側で付与)。
- confidence: 分類の自信度 0.0〜1.0。

【対象動画】
{items}

【返却形式】JSON配列のみ(前後に文章を付けない):
[ {{"youtube_id":"...","relevant":true,"category_slug":"...","part_tag_slugs":["..."],"vehicle_slugs":["..."],"title_ja":"...","description_ja":"...","confidence":0.0}} ]
"""


def call_gemini(prompt):
    try:
        resp = model.generate_content(prompt)
        m = re.search(r"\[.*\]", resp.text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return None
    except Exception as e:
        if "429" in str(e):
            print("   [RETRY] 混雑。60秒待機...")
            time.sleep(60)
            return "RETRY"
        print(f"   [AI Error] {e}")
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="処理件数の上限（0=全部）")
    args = ap.parse_args()

    supabase = create_client(SUPABASE_URL, SUPABASE_WRITE_KEY)
    child_cats, parts, vehs = load_master(supabase)
    cat_slugs = {c["slug"] for c in child_cats}
    part_slugs = {p["slug"] for p in parts}
    veh_slugs = {v["slug"] for v in vehs}

    # slug -> id 解決マップ
    cat_id = {c["slug"]: c["id"] for c in supabase.table("categories").select("id, slug").execute().data}
    part_id = {p["slug"]: p["id"] for p in supabase.table("part_tags").select("id, slug").execute().data}
    veh_id = {v["slug"]: v["id"] for v in supabase.table("vehicles").select("id, slug").execute().data}

    total_done = 0
    total_excluded = 0
    total_unclassified = 0
    stall = 0  # 同じバッチで全く進捗しない回数（無限ループ防止）

    while True:
        q = supabase.table("videos").select(
            "id, youtube_id, title_original, channel_name"
        ).is_("title_ja", "null").limit(BATCH_SIZE)
        records = q.execute().data
        if not records:
            print(f"\n[COMPLETE] 分類完了。処理 {total_done}件 / 除外 {total_excluded}件 / 未分類 {total_unclassified}件")
            break

        if args.limit and total_done + total_excluded >= args.limit:
            print(f"\n[LIMIT] 上限{args.limit}件に到達。")
            break

        prompt = build_prompt(records, child_cats, parts, vehs)
        results = call_gemini(prompt)
        if results == "RETRY":
            continue
        if not results:
            print("[WARN] 応答なし。5秒後に再試行...")
            time.sleep(5)
            continue

        by_yt = {r["youtube_id"]: r["id"] for r in records}
        resolved_this_batch = 0
        for a in results:
            yt = a.get("youtube_id")
            vid = by_yt.get(yt)
            if not vid:
                continue
            try:
                # 無関係 → 削除（除外）
                if not a.get("relevant", False):
                    supabase.table("videos").delete().eq("id", vid).execute()
                    total_excluded += 1
                    resolved_this_batch += 1
                    continue

                conf = float(a.get("confidence", 0) or 0)
                cslug = a.get("category_slug")
                update = {
                    "title_ja": a.get("title_ja"),
                    "description_ja": a.get("description_ja"),
                    "commentary_source": "ai",
                }
                if cslug in cat_slugs:
                    update["category_id"] = cat_id[cslug]
                supabase.table("videos").update(update).eq("id", vid).execute()

                # 車種紐付け（confidenceに関わらず付ける・粗い粒度）
                vslugs = [s for s in (a.get("vehicle_slugs") or []) if s in veh_slugs]
                if vslugs:
                    supabase.table("video_vehicles").upsert(
                        [{"video_id": vid, "vehicle_id": veh_id[s]} for s in vslugs]
                    ).execute()

                # 箇所タグ: confidence 低 → 付けない（未分類）
                if conf >= CONFIDENCE_THRESHOLD:
                    pslugs = [s for s in (a.get("part_tag_slugs") or []) if s in part_slugs]
                    if pslugs:
                        supabase.table("video_part_tags").upsert(
                            [{"video_id": vid, "part_tag_id": part_id[s]} for s in pslugs]
                        ).execute()
                    else:
                        total_unclassified += 1
                else:
                    total_unclassified += 1

                total_done += 1
                resolved_this_batch += 1
            except Exception as e:
                print(f"   [反映エラー] {yt}: {e}")
                continue

        # 無限ループ防止: このバッチで1件も解決できなければ stall を加算し、3回連続で打ち切り
        if resolved_this_batch == 0:
            stall += 1
            print(f"   [WARN] このバッチは未解決（stall {stall}/3）。Geminiが該当youtube_idを返さなかった可能性。")
            if stall >= 3:
                print("[ABORT] 3回連続で進捗なし。処理を打ち切ります。残りは再実行で対応してください。")
                break
        else:
            stall = 0

        print(f"[OK] 分類 {total_done}件 / 除外 {total_excluded}件 / 未分類 {total_unclassified}件")
        time.sleep(3)


if __name__ == "__main__":
    main()
