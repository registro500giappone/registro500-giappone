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


def load_excluded_ids(supabase):
    """excluded_videos（除外ID台帳＝人手デノリスト）の youtube_id を全件ロードして set で返す。
    丸ごとフェッチ/月次再取得で「一度人手で無関係と判断した動画」が復活するのを防ぐ主防御。"""
    excluded = set()
    start = 0
    page = 1000
    while True:
        res = supabase.table("excluded_videos").select("youtube_id").range(start, start + page - 1).execute()
        rows = res.data or []
        for r in rows:
            excluded.add(r["youtube_id"])
        if len(rows) < page:
            break
        start += page
    return excluded


def fetch_channel_video_ids(channel_id):
    """信頼チャンネルの全動画IDを取得。
    channels.list で uploads プレイリストIDを得て、playlistItems を全ページ巡回。1ユニット/50件と安価。"""
    data = _api_get("channels", {"part": "contentDetails", "id": channel_id})
    items = data.get("items", [])
    if not items:
        return []
    uploads = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
    ids = []
    page_token = None
    while True:
        params = {"part": "contentDetails", "playlistId": uploads, "maxResults": 50}
        if page_token:
            params["pageToken"] = page_token
        pdata = _api_get("playlistItems", params)
        for it in pdata.get("items", []):
            vid = it.get("contentDetails", {}).get("videoId")
            if vid:
                ids.append(vid)
        page_token = pdata.get("nextPageToken")
        if not page_token:
            break
        time.sleep(0.1)
    return ids


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


def passes_mechanical_filter(item, cfg, trusted=False):
    """HANDOFF §5 機械フィルタ。通過=True、(False, 理由)で除外。
    trusted=True（信頼チャンネル）は再生数下限のみ trusted_min_view_count(既定0) に緩める。
    現行車除外語・別車種・短尺フィルタは信頼chにも共通適用（現行Abarth等は弾く）。"""
    sn = item.get("snippet", {})
    title = (sn.get("title") or "").lower()
    filters = cfg["filters"]
    excl = cfg["exclusion_words"]

    # 車種・現行判定はタイトル基準。説明文はショップの定型文（全モデル列挙・年号・URL）で
    # 誤検出する（例: FDの説明に "500L" 在庫表記 → 中核How-toが誤除外）ため判定に使わない。
    has_target = bool(re.search(r"\b500\b|cinquecento|\b126\b", title))

    # 現行チンクエチェント除外（常に適用）。500e/500l/500x 等の英数モデルコードは
    # 語境界で判定する（伊語 "500 epoca"=クラシック を "500 e" で誤検出しない）。
    for w in excl.get("modern_cinquecento", []):
        if re.fullmatch(r"500[a-z]", w):
            if re.search(rf"\b{re.escape(w)}\b", title):
                return False, f"現行車除外語: {w}"
        elif w in title:
            return False, f"現行車除外語: {w}"

    # 別車種除外（500/126串刺しは残す）
    if not has_target:
        for w in excl.get("other_models", []):
            if w in title:
                return False, f"別車種除外語: {w}"

    # 動画長さ下限
    dur = parse_iso8601_duration(item.get("contentDetails", {}).get("duration"))
    if dur is not None and dur <= filters["min_duration_seconds"]:
        return False, f"短尺({dur}s)"

    # 再生数下限（信頼chは trusted_min_view_count=0 で実質無効）
    vc = int(item.get("statistics", {}).get("viewCount", 0) or 0)
    floor = filters.get("trusted_min_view_count", 0) if trusted else filters["min_view_count"]
    if vc < floor:
        return False, f"再生数不足({vc})"

    return True, None


def to_video_row(item, source_tier=3):
    """videos テーブル行に整形。source_tier=1/2:信頼ch, 3:キーワード/その他。"""
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
        "channel_id": sn.get("channelId"),
        "source_tier": source_tier,
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
    ap.add_argument("--limit-queries", type=int, default=0, help="先頭Nキーワードクエリのみ実行（テスト用・0=全部）")
    ap.add_argument("--skip-channels", action="store_true", help="信頼チャンネル取得をスキップ（キーワードのみ）")
    ap.add_argument("--channels-only", action="store_true", help="信頼チャンネルのみ取得しキーワード検索をスキップ（丸ごとフェッチ用）")
    args = ap.parse_args()

    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = json.load(f)

    max_results = cfg["filters"]["max_results_per_query"]
    rel_lang = cfg["search_defaults"]["relevance_language"]

    # キーワード群を (part_tag_slug, query) のフラット列に展開
    # --channels-only なら信頼chだけに絞る（--skip-channels が trusted=[] にするのと対称）
    queries = []
    if not args.channels_only:
        for slug, qs in cfg["keyword_groups"].items():
            if slug.startswith("_"):
                continue
            for q in qs:
                queries.append((slug, q))
        if args.limit_queries > 0:
            queries = queries[:args.limit_queries]

    trusted = [] if args.skip_channels else cfg.get("trusted_channels", [])

    # 除外ID台帳ロード（主防御）。dry-runでも読み取りだけは行い間引き効果を確認する。
    # 読み取りは service_role/anon どちらでも可（RLSで公開読取）。
    supabase = create_client(SUPABASE_URL, SUPABASE_WRITE_KEY)
    try:
        excluded_ids = load_excluded_ids(supabase)
    except Exception as e:
        print(f"[WARN] 除外台帳の読み込みに失敗（間引きスキップ）: {e}")
        excluded_ids = set()

    print(f"=== YouTube取得開始 {'[DRY-RUN]' if args.dry_run else '[本取得]'} ===")
    print(f"信頼チャンネル: {len(trusted)}件 / キーワードクエリ: {len(queries)}件 / 除外台帳: {len(excluded_ids)}件\n")

    # youtube_id -> 最小tier（信頼ch=1/2を優先、キーワード=3）
    tier_by_id = {}
    part_hint = {}  # youtube_id -> set(part_tag_slug)（dry-run表示用のヒント）

    # 1) 信頼チャンネルまるごと取得（tier 1/2）
    for ch in trusted:
        try:
            ids = fetch_channel_video_ids(ch["channel_id"])
        except Exception as e:
            print(f"  [信頼ch] {ch.get('name')} 取得失敗: {e}")
            continue
        t = int(ch.get("tier", 1))
        for vid in ids:
            if vid not in tier_by_id or t < tier_by_id[vid]:
                tier_by_id[vid] = t
        print(f"  [信頼ch tier{t}] {ch.get('name')} → {len(ids)}本")

    # 2) キーワード検索（tier 3。信頼chに既出ならtierは小さい方を維持）
    for slug, q in queries:
        try:
            ids = search_videos(q, max_results, rel_lang)
        except Exception as e:
            print(f"  [{slug}] '{q}' 検索失敗: {e}")
            continue
        for vid in ids:
            part_hint.setdefault(vid, set()).add(slug)
            tier_by_id.setdefault(vid, 3)
        print(f"  [{slug}] '{q}' → {len(ids)}件")
        time.sleep(0.2)

    all_ids = list(tier_by_id.keys())
    # 除外台帳で間引く（fetch_video_details の前＝無駄なAPIユニットも節約）
    before = len(all_ids)
    all_ids = [vid for vid in all_ids if vid not in excluded_ids]
    skipped = before - len(all_ids)
    if skipped:
        print(f"除外台帳で {skipped} 件スキップ（{before}→{len(all_ids)}件）")

    print(f"\nユニーク動画ID: {len(all_ids)}件。詳細取得中...")
    items = fetch_video_details(all_ids)
    print(f"詳細取得: {len(items)}件\n")

    # 機械フィルタ（信頼chは再生数下限を緩める）
    passed, dropped = [], []
    for item in items:
        tier = tier_by_id.get(item["id"], 3)
        ok, reason = passes_mechanical_filter(item, cfg, trusted=(tier < 3))
        if ok:
            passed.append((item, tier))
        else:
            dropped.append((item.get("snippet", {}).get("title", "?"), reason))

    print(f"=== フィルタ結果: 通過 {len(passed)} / 除外 {len(dropped)} ===")
    if dropped:
        print("--- 除外サンプル(最大10件) ---")
        for title, reason in dropped[:10]:
            print(f"  ✗ [{reason}] {title[:60]}")

    # ティア内訳サマリ
    tier_counts = {}
    for _item, t in passed:
        tier_counts[t] = tier_counts.get(t, 0) + 1
    print("通過ティア内訳: " + " / ".join(f"T{t}:{tier_counts[t]}本" for t in sorted(tier_counts)))

    if args.dry_run:
        print("\n--- 通過サンプル(最大12件) ---")
        for item, tier in passed[:12]:
            row = to_video_row(item, tier)
            tags = ",".join(sorted(part_hint.get(item["id"], [])))
            print(f"  ✓ T{tier} {row['view_count']:>9,}回 [{tags}] {row['title_original'][:50]}")
        print("\n[DRY-RUN] DB書込はしていません。")
        return

    # --- 本取得: videos へ upsert + view_history 追記 ---（supabaseは冒頭で作成済を再利用）
    rows = [to_video_row(item, tier) for item, tier in passed]
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
