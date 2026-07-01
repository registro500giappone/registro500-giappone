"""
YouTubeポータル 手動追加スクリプト（経路② 管理者が手動追加）

自動更新（月次バッチ youtube_fetch.py）とは別に、管理者が任意の1本を掲載する入口。
オーナーからのメール要望を受けて追加する場合は --by で推薦者名を記名する。

使い方:
    python youtube_add.py "https://youtu.be/XXXXXXXXXXX"                 # 無記名で追加
    python youtube_add.py "https://www.youtube.com/watch?v=XXXX" --by "たろうさん"   # 記名で追加
    python youtube_add.py XXXXXXXXXXX --by "たろうさん"                   # 11桁IDでも可

追加後は youtube_classify.py が title_ja IS NULL の当該動画を拾って日本語化・分類する
（workflow youtube-add-video.yml は add→classify を続けて実行）。

- source_tier は既定 0（手動追加＝最上位・classifyの無関係判定でも自動削除されない）。
- 取得ロジック・整形は youtube_fetch.py の関数を流用（DRY）。
env (py/.env): YOUTUBE_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY(無ければ SUPABASE_KEY)
"""

import argparse
import re
import sys

from supabase import create_client

# 取得・整形ロジックは youtube_fetch.py を流用（module import で .env も読まれる）
import youtube_fetch as yf

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def extract_video_id(url_or_id):
    """フルURL（youtu.be / watch?v= / shorts/ / embed/）または11桁IDから video_id を取り出す。"""
    s = (url_or_id or "").strip()
    # 素の11桁IDならそのまま
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", s):
        return s
    # 各種URL形式から抽出
    m = re.search(r"(?:youtu\.be/|watch\?v=|/shorts/|/embed/|/v/)([A-Za-z0-9_-]{11})", s)
    if m:
        return m.group(1)
    # ?v= が他パラメータ中にある場合の保険
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{11})", s)
    if m:
        return m.group(1)
    return None


def main():
    ap = argparse.ArgumentParser(description="YouTube動画をポータルに手動追加する")
    ap.add_argument("url", help="YouTube動画のURL または 11桁の動画ID")
    ap.add_argument("--by", default=None, help="推薦者名（記名。省略時は無記名）")
    ap.add_argument("--tier", type=int, default=0, help="source_tier（既定0=手動追加・最上位・削除保護）")
    args = ap.parse_args()

    vid = extract_video_id(args.url)
    if not vid:
        print(f"[ERROR] 動画IDを抽出できませんでした: {args.url}")
        sys.exit(1)

    print(f"=== YouTube手動追加 id={vid} tier={args.tier} by={args.by or '(無記名)'} ===")

    items = yf.fetch_video_details([vid])
    if not items:
        print(f"[ERROR] 動画が見つかりません（削除/非公開の可能性）: {vid}")
        sys.exit(1)

    row = yf.to_video_row(items[0], source_tier=args.tier)
    row["recommended_by_name"] = args.by  # None=無記名

    supabase = create_client(yf.SUPABASE_URL, yf.SUPABASE_WRITE_KEY)

    print(f"videos へ upsert: {row.get('title_original')!r} / {row.get('channel_name')!r}")
    supabase.table("videos").upsert(row, on_conflict="youtube_id").execute()

    # view_history 追記（upsert後のUUIDを引き直す）
    res = supabase.table("videos").select("id").eq("youtube_id", vid).single().execute()
    video_uuid = res.data["id"]
    supabase.table("view_history").insert(
        {"video_id": video_uuid, "view_count": row["view_count"]}
    ).execute()

    print(f"完了: videos upsert / view_history 追記（view_count={row['view_count']}）")
    print("次は: python youtube_classify.py （AI分類・日本語化。title_ja IS NULL を拾う）")


if __name__ == "__main__":
    main()
