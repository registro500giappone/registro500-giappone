"""
YouTubeポータル AI要約 生成スクリプト（方法A・本実装）

HANDOFF.md §7・§8 が正本。steps_ja IS NULL の全動画を Gemini に「視聴」させ、
中身の分かる日本語要約（原語併記）JSON にして videos.steps_ja に書き込む。
動画は YouTube URL を直接 Gemini に渡す（方法A）。is_howto で2種を出し分け：
  - is_howto=true  → 手順カード（番号付き・工具/部品/数値/コツまで拾う密度）kind="howto"
  - is_howto=false → 要点まとめ（見る/知る系。事実・数値・結論を箇条書き）    kind="points"

ルール（HANDOFF §8 不変条件）:
  - AI生成であることを明示（表示側で「AI生成」ピル＋定型注意書きを付与）。
  - 字幕全文の翻訳・再配布はしない。映像からの"要約"＝自分の言葉で再構成＝権利安全側。原題は消さない。
  - 映像から中身を起こせない（宣伝/BGMのみ等）場合は steps:[] を返させ、DBは更新せず skip（次回再挑戦）。

steps_ja 形式:
  {"kind":"howto"|"points", "steps":[{"t":"見出し","d":"本文（専門用語=日本語＋原語併記）"}, ...最大12], "caution":"注意点1行"}

使い方:
    python youtube_steps.py                 # steps_ja IS NULL を全件（source_tier昇順→再生数降順）
    python youtube_steps.py --limit 30      # 先頭30件だけ（夜間バッチ/テスト）
    python youtube_steps.py --dry-run       # 1本だけ生成しDB書込なしで結果表示
    python youtube_steps.py --id XXXX --dry-run  # 特定動画で確認（見る系のテスト等）

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
MODEL_NAME = "models/gemini-flash-latest"  # 詳細度優先で flash（lite から昇格）。無料枠は lite より渋く、超過は QUOTA で自動停止＝課金は発生しない
model = genai.GenerativeModel(MODEL_NAME)

MAX_STEPS = 20
SLEEP_BETWEEN = 3  # 1本ごとの待機（レート配慮）

# steps_ja のスキーマ世代。プロンプト/モデルを更新して全動画を作り直すたびに +1 する。
# --regenerate 時は「steps_ja が無い or v がこの値未満」の動画だけを対象にする＝
# 途中で止まっても再開でき、既に新版化された動画は二度打ちしない。旧要約は差し替わるまで残す（無料枠で数週間かけて自然置換）。
STEPS_VERSION = 2  # v2 = flash + 粒度重視プロンプト（v1 = flash-lite + 旧プロンプト）

# how-to（手を動かす系）＝詳しい手順カード。「読めばほぼ作業できる」密度で工具/部品/数値/コツも拾う。
PROMPT_HOWTO = f"""あなたはクラシックFIAT 500/126（空冷2気筒 499/594/650cc）専門の整備解説者です。
次の動画を実際に視聴し、動画で行っている整備・作業を、日本語だけで「読めばほぼ作業できる」密度でまとめてください。

【出力ルール】
- 動画で実際に行っている作業を、手を動かした順に細かく分解して並べる（最大{MAX_STEPS}手順）。動画が短く操作が少なければ手順数は少なくてよい（水増ししない）。
- 【重要】複数の操作を1手順にまとめない。「〜を外して〜を確認する」のように別々の操作が続く場合は、原則それぞれを独立した手順に分ける。動画がわざわざ映して/語っている中間操作（仮組み・位置合わせ・確認・清掃・印付け・締め直し等）を省略しない。
- 各手順の本文(d)は、その操作を「どの部品を・どちら向きに・どの程度・何を見ながら・どうなったら次へ」まで、動画で語られている範囲で具体的に書く。使う工具・部品名・数値（トルク/隙間/番手/容量など）・コツ・失敗しやすい点も動画から拾って盛り込む（動画が言っていない数値は創作しない）。
- 専門用語は日本語＋原語（伊/英）併記（例：タペット（punterie）／点火時期（anticipo）／隙間ゲージ（spessimetro））。
- 最後に「注意点(caution)」を1行だけ（安全・破損防止など最も重要なもの）。
- 動画が整備の実作業でない／映像から手順を起こせない場合は steps を空配列 [] にする（無理に作らない）。
- 逐語の字幕書き起こしはしない。自分の言葉で内容を再構成した要約にする（ただし操作の粒度は落とさない）。

【返却形式】JSONオブジェクトのみ（前後に文章を付けない）:
{{"steps":[{{"t":"見出し","d":"本文"}}],"caution":"注意点1行"}}
"""

# 見る/知る系（解説・比較・試乗・費用・歴史など）＝内容の要点まとめ。手順動画ではない。
PROMPT_POINTS = f"""あなたはクラシックFIAT 500/126に詳しい編集者です。
次の動画を実際に視聴し、日本語を読むだけで動画の中身が分かるように「要点」をまとめてください
（この動画は実作業の手順動画ではなく、解説・比較・試乗・費用・歴史など"見る/知る"系です）。

【出力ルール】
- 動画が伝える事実・数値・結論・比較・見どころを、話の流れに沿って自分の言葉で漏れなく箇条書きにする（最大{MAX_STEPS}項目）。
- 各項目は「見出し(t)」＋「本文(d)」。金額・数値・型式・結論など具体を必ず入れる。
- 専門用語・固有名詞は日本語＋原語（伊/英）併記。
- 逐語訳・字幕の書き起こしはしない。あくまで内容の要約。
- 動画が宣伝/チャンネル告知/BGMのみの走行クリップ等で中身が無ければ steps を空配列 [] にする。
- caution は該当すれば1行、なければ空文字。

【返却形式】JSONオブジェクトのみ（前後に文章を付けない）:
{{"steps":[{{"t":"見出し","d":"本文"}}],"caution":""}}
"""


def call_gemini_video(youtube_id, prompt):
    """動画URLを直接渡してAI要約JSONを得る（prompt=手順 or 要点）。
    返り値: dict(成功) / 'RATE'(分単位レート超過=待って再試行) / 'QUOTA'(日次上限=停止) / None(その他失敗)。"""
    url = f"https://www.youtube.com/watch?v={youtube_id}"
    try:
        resp = model.generate_content(
            genai.protos.Content(parts=[
                genai.protos.Part(file_data=genai.protos.FileData(file_uri=url)),
                genai.protos.Part(text=prompt),
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
    ap.add_argument("--id", default=None, help="特定のyoutube_idだけ対象（テスト/再生成用。steps_jaの有無を問わず処理）")
    ap.add_argument("--regenerate", action="store_true",
                    help=f"全動画を作り直す（steps_ja が無い or v<{STEPS_VERSION} を対象。既に v{STEPS_VERSION} 済みは飛ばす＝再開可）")
    args = ap.parse_args()

    supabase = create_client(SUPABASE_URL, SUPABASE_WRITE_KEY)

    sel = "id, youtube_id, title_original, title_ja, channel_name, is_howto"
    if args.id:
        # 指定IDのみ（既存steps_jaがあっても再生成・テスト用）
        rows = supabase.table("videos").select(sel).eq("youtube_id", args.id).limit(1).execute().data
    elif args.regenerate:
        # 全動画の作り直し。steps_ja(と v)も取得し、「未生成 or 旧世代(v<STEPS_VERSION)」だけを
        # Python側で絞る（jsonbのPostgREST絞り込みは脆いので全件取得→フィルタが確実）。source_tier昇順→再生数降順。
        limit = 1 if args.dry_run else (args.limit or 10000)
        all_rows = []
        offset = 0
        while True:
            batch = (
                supabase.table("videos")
                .select(sel + ", steps_ja")
                .order("source_tier", desc=False)
                .order("view_count", desc=True)
                .range(offset, offset + 999)
                .execute()
                .data
            )
            all_rows.extend(batch)
            if len(batch) < 1000:
                break
            offset += 1000
        pending = [r for r in all_rows
                   if not r.get("steps_ja") or (r["steps_ja"] or {}).get("v", 1) < STEPS_VERSION]
        print(f"[REGEN] 全{len(all_rows)}本中 未v{STEPS_VERSION}={len(pending)}本（このバッチ上限{limit}）", flush=True)
        rows = [{k: v for k, v in r.items() if k != "steps_ja"} for r in pending[:limit]]
    else:
        fetch_limit = 1 if args.dry_run else (args.limit or 10000)
        rows = (
            supabase.table("videos")
            .select(sel)
            .is_("steps_ja", "null")
            .order("source_tier", desc=False)
            .order("view_count", desc=True)
            .limit(fetch_limit)
            .execute()
            .data
        )

    if not rows:
        print(f"[COMPLETE] 対象なし（{'全動画がv'+str(STEPS_VERSION)+'済み' if args.regenerate else 'steps_ja IS NULL は 0 件'}）。")
        return

    print(f"[START] 対象 {len(rows)}件 / model={MODEL_NAME} / dry_run={args.dry_run}")

    done = 0
    skipped = 0
    failed = 0
    consec_fail = 0  # 連続失敗（原因不明の連鎖はネット/キー異常の疑い→打ち切り）

    for i, r in enumerate(rows, 1):
        yt = r["youtube_id"]
        label = r.get("title_ja") or r.get("title_original") or yt
        is_howto = bool(r.get("is_howto"))
        kind = "howto" if is_howto else "points"
        prompt = PROMPT_HOWTO if is_howto else PROMPT_POINTS
        print(f"\n[{i}/{len(rows)}] {yt}  [{kind}]  {label[:40]}", flush=True)

        # レート超過は最大2回まで待って再試行。日次上限(QUOTA)は即停止。
        result = None
        for attempt in range(3):
            result = call_gemini_video(yt, prompt)
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
        steps_ja["kind"] = kind  # howto=手順カード / points=要点まとめ（表示側で出し分け）
        steps_ja["v"] = STEPS_VERSION  # スキーマ世代。--regenerate の再開判定に使う（表示側は無視）

        if args.dry_run:
            print("   [DRY-RUN] 生成結果:")
            print(json.dumps(steps_ja, ensure_ascii=False, indent=2))
            return

        if not steps_ja["steps"]:
            # 【2026-08-22】空stepsの詰まり対策。旧実装はDBを更新せず「次回再挑戦」にしていたため、
            # 対象の並び順が固定である以上、同じ動画を毎晩呼び直して同じ結果を得る無限ループになっていた
            # （実測: 30本中27〜29本がこれ・1本あたり映像込み17万トークン）。原因は is_howto の誤分類で、
            # 手順動画でないものに PROMPT_HOWTO を使うと Gemini が正しく「手順なし」と答えるため。
            # → 要点まとめで1回だけ聞き直し（大半はこれで救済される）、それでも空なら諦め印を残して外す。
            rescued = None
            if kind == "howto":
                print("   [空] 手順が起こせず。要点まとめで聞き直す…", flush=True)
                alt = call_gemini_video(yt, PROMPT_POINTS)
                if alt == "QUOTA":
                    print("   [QUOTA] Geminiの日次上限に到達。今日はここまで。未処理は次回（or 夜間cron）で継続。", flush=True)
                    print(f"\n[STOP-QUOTA] 生成 {done}件 / skip {skipped}件 / 失敗 {failed}件（未処理は残す）", flush=True)
                    return
                if alt not in (None, "RATE"):
                    cand = normalize(alt)
                    if cand and cand["steps"]:
                        rescued = cand

            if rescued:
                kind = "points"
                steps_ja = rescued
                steps_ja["kind"] = kind
                steps_ja["v"] = STEPS_VERSION
                print("   [FALLBACK] 要点まとめで救済。", flush=True)
            else:
                # 諦め印。空のまま v を付けて保存すると `steps_ja IS NULL` の対象から外れ、毎晩の再試行が止まる。
                # 表示側(video.html)は steps.length で判定するので、空でも見た目は従来通り description_ja へフォールバックする。
                # プロンプト/モデルを直したときは STEPS_VERSION を上げれば --regenerate で再挑戦される。
                steps_ja["kind"] = kind
                steps_ja["v"] = STEPS_VERSION
                steps_ja["empty"] = True
                try:
                    supabase.table("videos").update({"steps_ja": steps_ja}).eq("id", r["id"]).execute()
                    print("   [GIVEUP] 要点でも起こせず。空印を記録して対象から外す（毎晩の再試行を止める）。", flush=True)
                except Exception as e:
                    print(f"   [書込エラー] {yt}: {e}", flush=True)
                    failed += 1
                skipped += 1
                time.sleep(SLEEP_BETWEEN)
                continue

        try:
            supabase.table("videos").update({"steps_ja": steps_ja}).eq("id", r["id"]).execute()
            done += 1
            print(f"   [OK] {kind} items={len(steps_ja['steps'])} caution={'有' if steps_ja['caution'] else '無'}")
        except Exception as e:
            print(f"   [書込エラー] {yt}: {e}")
            failed += 1

        time.sleep(SLEEP_BETWEEN)

    print(f"\n[DONE] 生成 {done}件 / skip {skipped}件 / 失敗 {failed}件")

    # 【2026-08-22】静かな失敗の見張り。旧実装は全件スキップでも exit 0 で終わるため、
    # 3週間ほぼ空回りしていたのに Actions は success のままだった（パーツクローラーで塞いだのと同型の穴）。
    # 対象があったのに1本も生成できていない＝プロンプト/モデル/APIキーの異常を疑う状態なので、
    # ジョブを失敗させて気づけるようにする。QUOTA/ABORT の正常な打ち切りは上で return/break 済み。
    if not args.dry_run and len(rows) >= 5 and done == 0:
        print("[ALERT] 対象があったのに生成0件。プロンプト/モデル/APIキーの異常を疑うこと。", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
