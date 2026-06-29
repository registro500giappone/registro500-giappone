"""
YouTubeポータル 取得スクリプト（タスク3）

HANDOFF.md §4(キーワード)・§5(足切り)・§7-3 が正本。
フェーズ1キーワードで search.list(order=viewCount) → videos.list で詳細取得し、
機械フィルタを通過した動画を videos テーブルに upsert する。AI分類は youtube_classify.py（タスク4）。

使い方:
    python youtube_fetch.py --dry-run --limit-queries 1   # DB書込なし・1クエリだけ（疎通/件数確認）
    python youtube_fetch.py                                # フェーズ1全クエリ・本取得（service_roleで書込）

設定:
    youtube-portal/fetch_config.json （キーワード・除外語・閾値）
env (py/.env):
    YOUTUBE_API_KEY        … YouTube Data API v3
    SUPABASE_URL           … Supabase
    SUPABASE_SERVICE_KEY   … 書込用（無ければ SUPABASE_KEY にフォールバック）
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

# Windowsコンソール(cp932)でも記号・日本語を出力できるようUTF-8化
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# --- パス・設定読み込み ---
PY_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(PY_DIR)
CONFIG_PATH = os.path.join(REPO_DIR, "youtube-portal", "fetch_config.json")

load_dotenv(os.path.join(PY_DIR, ".env"))
YOUTUBE_API_KEY = os.environ["YOUTUBE_API_KEY"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
# 書込は service_role（RLSバイパス）。無ければ anon にフォールバック（gen_report.py と同パターン）
SUPABASE_WRITE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]

API_BASE = "https://www.googleapis.com/youtube/v3"


# ============================================================================
# YouTube API ヘルパ
# ============================================================================
def _api_get(endpoint, params, max_retries=3):
    """YouTube Data API を叩いてJSONを返す。一時エラーはリトライ。"""
    params = dict(params)
    params["key"] = YOUTUBE_API_KEY
    url = f"{API_BASE}/{endpoint}?" + urllib.parse.urlencode(params)
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            # 403 quota/rate は致命的。それ以外の5xxはリトライ。
            if e.code in (500, 503) and attempt < max_retries - 1:
                print(f"   [API {e.code}] リトライ {attempt + 1}/{max_retries} (30秒待機)")
                time.sleep(30)
                continue
            reason = ""
            try:
                reason = json.loads(body)["error"]["errors"][0].get("reason", "")
            except Exception:
                reason = body[:300]
            print(f"   [API HTTPError {e.code}] {reason}")
            raise
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"   [API Error] {e} → リトライ {attempt + 1}/{max_retries}")
                time.sleep(10)
                continue
            raise
    return None


def search_videos(query, max_results, relevance_language):
    """search.list で query に対する動画IDを再生数順に取得（最大50・1ページ）。100ユニット消費。"""
    data = _api_get("search", {
        "part": "snippet",
        "q": query,
        "type": "video",
        "order": "viewCount",
        "maxResults": min(max_results, 50),
        "relevanceLanguage": relevance_language,
    })
    ids = [item["id"]["videoId"] for item in data.get("items", []) if item.get("id", {}).get("videoId")]
    return ids


def fetch_video_details(video_ids):
    """videos.list で詳細取得（50件ずつ）。1ユニット/回。"""
    out = []
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        data = _api_get("videos", {
            "part": "snippet,statistics,contentDetails,status",
            "id": ",".join(chunk),
        })
        out.extend(data.get("items", []))
    return out


# ============================================================================
# パース・フィルタ
# ============================================================================
def parse_iso8601_duration(s):
    """ISO8601 (PT#H#M#S) を秒に変換。"""
    if not s:
        return None
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s)
    if not m:
        return None
    h, mi, se = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + se


def passes_mechanical_filter(item, cfg):
    """HANDOFF §5 機械フィルタ。通過=True、(False, 理由)で除外。"""
    sn = item.get("snippet", {})
    title = (sn.get("title") or "").lower()
    desc = (sn.get("description") or "").lower()
    text = f"{title} {desc}"
    filters = cfg["filters"]
    excl = cfg["exclusion_words"]

    # 500/126 を含む串刺し動画は other_models 除外をスキップ（FD Ricambi系を残す）
    has_target = bool(re.search(r"\b500\b|cinquecento|\b126\b", text))

    # 現行チンクエチェント除外（常に適用）
    for w in excl.get("modern_cinquecento", []):
        if w in text:
            return False, f"現行車除外語: {w}"

    # 別車種除外（500/126串刺しは残す）
    if not has_target:
        for w in excl.get("other_models", []):
            if w in text:
                return False, f"別車種除外語: {w}"

    # 動画長さ下限
    dur = parse_iso8601_duration(item.get("contentDetails", {}).get("duration"))
    if dur is not None and dur <= filters["min_duration_seconds"]:
        return False, f"短尺({dur}s)"

    # 再生数下限
    vc = int(item.get("statistics", {}).get("viewCount", 0) or 0)
    if vc < filters["min_view_count"]:
        return False, f"再生数不足({vc})"

    return True, None


def to_video_row(item):
    """videos テーブル行に整形。"""
    sn = item.get("snippet", {})
    cd = item.get("contentDetails", {})
    st = item.get("status", {})
    stats = item.get("statistics", {})
    thumbs = sn.get("thumbnails", {})
    thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
    return {
        "youtube_id": item["id"],
        "title_original": sn.get("title"),
        "channel_name": sn.get("channelTitle"),
        "duration_seconds": parse_iso8601_duration(cd.get("duration")),
        "thumbnail_url": thumb,
        "published_at": sn.get("publishedAt"),
        "view_count": int(stats.get("viewCount", 0) or 0),
        "has_captions": str(cd.get("caption", "false")).lower() == "true",
        "embeddable": bool(st.get("embeddable", True)),
    }


# ============================================================================
# メイン
# ============================================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="DB書込せず取得・フィルタ結果のサマリのみ")
    ap.add_argument("--limit-queries", type=int, default=0, help="先頭Nクエリのみ実行（テスト用・0=全部）")
    args = ap.parse_args()

    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = json.load(f)

    max_results = cfg["filters"]["max_results_per_query"]
    rel_lang = cfg["search_defaults"]["relevance_language"]

    # キーワード群を (part_tag_slug, query) のフラット列に展開
    queries = []
    for slug, qs in cfg["keyword_groups"].items():
        if slug.startswith("_"):
            continue
        for q in qs:
            queries.append((slug, q))
    if args.limit_queries > 0:
        queries = queries[:args.limit_queries]

    print(f"=== YouTube取得開始 {'[DRY-RUN]' if args.dry_run else '[本取得]'} ===")
    print(f"クエリ数: {len(queries)} / 想定search消費: 約{len(queries) * 100}ユニット\n")

    # 全クエリのID収集（重複排除）
    all_ids = {}  # youtube_id -> set(part_tag_slug)（取得時のヒント。タスク4の参考用にログ表示のみ）
    for slug, q in queries:
        try:
            ids = search_videos(q, max_results, rel_lang)
        except Exception as e:
            print(f"  [{slug}] '{q}' 検索失敗: {e}")
            continue
        for vid in ids:
            all_ids.setdefault(vid, set()).add(slug)
        print(f"  [{slug}] '{q}' → {len(ids)}件")
        time.sleep(0.2)

    print(f"\nユニーク動画ID: {len(all_ids)}件。詳細取得中...")
    items = fetch_video_details(list(all_ids.keys()))
    print(f"詳細取得: {len(items)}件\n")

    # 機械フィルタ
    passed, dropped = [], []
    for item in items:
        ok, reason = passes_mechanical_filter(item, cfg)
        if ok:
            passed.append(item)
        else:
            dropped.append((item.get("snippet", {}).get("title", "?"), reason))

    print(f"=== フィルタ結果: 通過 {len(passed)} / 除外 {len(dropped)} ===")
    if dropped:
        print("--- 除外サンプル(最大10件) ---")
        for title, reason in dropped[:10]:
            print(f"  ✗ [{reason}] {title[:60]}")

    if args.dry_run:
        print("\n--- 通過サンプル(最大10件) ---")
        for item in passed[:10]:
            row = to_video_row(item)
            tags = ",".join(sorted(all_ids.get(item["id"], [])))
            print(f"  ✓ {row['view_count']:>9,}回 [{tags}] {row['title_original'][:55]}")
        print("\n[DRY-RUN] DB書込はしていません。")
        return

    # --- 本取得: videos へ upsert + view_history 追記 ---
    supabase = create_client(SUPABASE_URL, SUPABASE_WRITE_KEY)
    rows = [to_video_row(item) for item in passed]
    if not rows:
        print("\n投入対象なし。終了。")
        return

    print(f"\nvideos へ upsert: {len(rows)}件 ...")
    supabase.table("videos").upsert(rows, on_conflict="youtube_id").execute()

    # view_history 追記用に id を引き直す（upsert後のUUIDが必要）
    yt_ids = [r["youtube_id"] for r in rows]
    vc_by_yt = {r["youtube_id"]: r["view_count"] for r in rows}
    history = []
    for i in range(0, len(yt_ids), 100):
        chunk = yt_ids[i:i + 100]
        res = supabase.table("videos").select("id, youtube_id").in_("youtube_id", chunk).execute()
        for v in res.data:
            history.append({"video_id": v["id"], "view_count": vc_by_yt[v["youtube_id"]]})
    if history:
        supabase.table("view_history").insert(history).execute()

    print(f"完了: videos {len(rows)}件 upsert / view_history {len(history)}件追記")
    print("次は: python youtube_classify.py （AI分類・日本語化）")


if __name__ == "__main__":
    main()
