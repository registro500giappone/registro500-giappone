"""
YouTubeポータル AI要約「手順カード」生成スクリプト（方法A・本実装）

HANDOFF.md §7・§8 が正本。is_howto=true の動画を Gemini に「視聴」させ、
実際の整備作業を日本語の番号付き手順（原語併記・注意点付き）JSON にして
videos.steps_ja に書き込む。動画は YouTube URL を直接 Gemini に渡す（方法A）。

ルール（HANDOFF §8 不変条件）:
  - 対象は is_howto=true のみ（手を動かす系=整備/レストア/チューニング）。
  - AI生成であることを明示（表示側で「AI生成」ピル＋定型注意書きを付与）。
  - 字幕全文の翻訳・再配布はしない。映像からの手順要約＝安全側。原題は消さない。
  - 映像から手順を起こせない場合は steps:[] を返させ、DBは更新せず skip（次回再挑戦）。

steps_ja 形式:
  {"steps":[{"t":"見出し","d":"本文（専門用語=日本語＋原語併記）"}, ...最大8], "caution":"注意点1行"}

使い方:
    python youtube_steps.py                 # is_howto=true かつ steps_ja IS NULL を全件
    python youtube_steps.py --limit 30      # 先頭30件だけ（夜間バッチ/テスト）
    python youtube_steps.py --dry-run       # 1本だけ生成しDB書込なしで結果表示

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

MAX_STEPS = 8
SLEEP_BETWEEN = 3  # 1本ごとの待機（レート配慮）

PROMPT = f"""あなたはクラシックFIAT 500/126（空冷2気筒 499/594/650cc）専門の整備解説者です。
次の動画を実際に視聴し、動画の中で行っている整備・作業の手順を日本語でまとめてください。

【出力ルール】
- 動画の映像で実際に行っている作業だけを、行う順に番号付きで並べる（最大{MAX_STEPS}手順）。
- 各手順は「見出し(t)」＋「本文(d)」。見出しは短く（例：状態を確認する）。本文は1〜2文で具体的に。
- 専門用語は日本語＋原語（イタリア語/英語）を併記（例：ガラスモール（guarnizioni）／点火時期（anticipo）／タペット（punterie））。
- 最後に「注意点(caution)」を1行だけ（安全・破損防止など最も重要なもの）。
- 動画が整備の実作業でない／映像から手順を起こせない場合は steps を空配列 [] にする（無理に作らない）。
- 逐語の字幕書き起こしはしない。あくまで作業手順の要約。

【返却形式】JSONオブジェクトのみ（前後に文章を付けない）:
{{"steps":[{{"t":"見出し","d":"本文"}}],"caution":"注意点1行"}}
"""


def call_gemini_video(youtube_id):
    """動画URLを直接渡して手順JSONを得る。
    返り値: dict(成功) / 'RATE'(分単位レート超過=待って再試行) / 'QUOTA'(日次上限=停止) / None(その他失敗)。"""
    url = f"https://www.youtube.com/watch?v={youtube_id}"
    try:
        resp = model.generate_content(
            genai.protos.Content(parts=[
                genai.protos.Part(file_data=genai.protos.FileData(file_uri=url)),
                genai.protos.Part(text=PROMPT),
            ])
        )
        m = re.search(r"\{.*\}", resp.text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return None
    except Exception as e:
        msg = str(e).lower()
        if "429" in msg or "resource_exhausted" in msg or "quota" in msg:
            # 日次上限（PerDay）はその日はもう回復しない → 停止シグナル。分単位レートは待って再試行。
            if "perday" in msg or "per day" in msg or "daily" in msg:
                return "QUOTA"
            return "RATE"
        print(f"   [AI Error] {youtube_id}: {e}")
        return None


def normalize(obj):
    """Geminiの応答を steps_ja の正規形に整える。無効なら None。"""
    if not isinstance(obj, dict):
        return None
    raw_steps = obj.get("steps")
    if not isinstance(raw_steps, list):
        return None
    steps = []
    for s in raw_steps[:MAX_STEPS]:
        if not isinstance(s, dict):
            continue
        t = (s.get("t") or "").strip()
        d = (s.get("d") or "").strip()
        if t or d:
            steps.append({"t": t, "d": d})
    if not steps:
        return {"steps": [], "caution": ""}  # 生成不能＝skip対象
    caution = (obj.get("caution") or "").strip()
    return {"steps": steps, "caution": caution}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="処理件数の上限（0=全部）")
    ap.add_argument("--dry-run", action="store_true", help="1本だけ生成しDB書込なしで表示")
    args = ap.parse_args()

    supabase = create_client(SUPABASE_URL, SUPABASE_WRITE_KEY)

    fetch_limit = 1 if args.dry_run else (args.limit or 10000)
    rows = (
        supabase.table("videos")
        .select("id, youtube_id, title_original, title_ja, channel_name")
        .eq("is_howto", True)
        .is_("steps_ja", "null")
        .order("source_tier", desc=False)
        .order("view_count", desc=True)
        .limit(fetch_limit)
        .execute()
        .data
    )

    if not rows:
        print("[COMPLETE] 対象なし（is_howto=true かつ steps_ja IS NULL は 0 件）。")
        return

    print(f"[START] 対象 {len(rows)}件 / model={MODEL_NAME} / dry_run={args.dry_run}")

    done = 0
    skipped = 0
    failed = 0
    consec_fail = 0  # 連続失敗（原因不明の連鎖はネット/キー異常の疑い→打ち切り）

    for i, r in enumerate(rows, 1):
        yt = r["youtube_id"]
        label = r.get("title_ja") or r.get("title_original") or yt
        print(f"\n[{i}/{len(rows)}] {yt}  {label[:40]}", flush=True)

        # レート超過は最大2回まで待って再試行。日次上限(QUOTA)は即停止。
        result = None
        for attempt in range(3):
            result = call_gemini_video(yt)
            if result == "QUOTA":
                print("   [QUOTA] Geminiの日次上限に到達。今日はここまで。未処理は次回（or 夜間cron）で継続。", flush=True)
                print(f"\n[STOP-QUOTA] 生成 {done}件 / skip {skipped}件 / 失敗 {failed}件（未処理は残す）", flush=True)
                return
            if result == "RATE":
                print("   [RATE] 分単位レート超過。60秒待機して再試行...", flush=True)
                time.sleep(60)
                continue
            break

        if result in (None, "RATE"):
            failed += 1
            consec_fail += 1
            if consec_fail >= 6:
                print("[ABORT] 連続6件失敗。ネットワーク/APIキー異常の疑い。打ち切り（未処理は残す）。", flush=True)
                break
            continue

        steps_ja = normalize(result)
        if steps_ja is None:
            print("   [SKIP] 応答が不正形。", flush=True)
            failed += 1
            consec_fail += 1
            time.sleep(SLEEP_BETWEEN)
            continue
        consec_fail = 0

        if args.dry_run:
            print("   [DRY-RUN] 生成結果:")
            print(json.dumps(steps_ja, ensure_ascii=False, indent=2))
            return

        if not steps_ja["steps"]:
            print("   [SKIP] 映像から手順を起こせず（steps空）。DBは更新しない（次回再挑戦）。")
            skipped += 1
            time.sleep(SLEEP_BETWEEN)
            continue

        try:
            supabase.table("videos").update({"steps_ja": steps_ja}).eq("id", r["id"]).execute()
            done += 1
            print(f"   [OK] steps={len(steps_ja['steps'])} caution={'有' if steps_ja['caution'] else '無'}")
        except Exception as e:
            print(f"   [書込エラー] {yt}: {e}")
            failed += 1

        time.sleep(SLEEP_BETWEEN)

    print(f"\n[DONE] 生成 {done}件 / skip {skipped}件 / 失敗 {failed}件")


if __name__ == "__main__":
    main()
