"""
YouTubeポータル 人手除外スクリプト（除外ID台帳＝永続デノリスト）

AI分類をすり抜けて紛れ込んだ「クラシックFIAT 500/126でない無関係動画」を、
人間が目視で判断したら1コマンドで恒久除外する入口。youtube_add.py の鏡写し。

これまでの「Claudeが対話でMCP DELETE」だと台帳登録を忘れて再取得で復活する事故が
起き得た。本スクリプトは **videos からの削除と excluded_videos への登録を必ずセット** で行う。
以後 youtube_fetch.py が起動時に台帳をロードし、丸ごとフェッチ/月次再取得の前に間引くので復活しない。

使い方:
    python youtube_exclude.py XXXXXXXXXXX YYYYYYYYYYY               # 11桁ID複数
    python youtube_exclude.py "https://youtu.be/XXXX" --reason "他車種(トポリーノ)"
    python youtube_exclude.py XXXX --dry-run                        # 対象確認のみ・DB無変更

- 各IDを excluded_videos に upsert（reason・channel_name は videos から取れれば埋める）
  ＋ videos から delete（cascade で video_part_tags/video_vehicles/recommendations/view_history も消える）。
- URL各形式（youtu.be/watch?v=/shorts/embed）＋11桁IDに対応（youtube_add.py のID抽出を流用）。
- 復活させたい時は youtube_add.py で追加すれば台帳から自動解除される。

env (py/.env): SUPABASE_URL / SUPABASE_SERVICE_KEY(無ければ SUPABASE_KEY)
"""

import argparse
import sys

from supabase import create_client

# 接続情報・ID抽出は既存スクリプトを流用（DRY）。import で .env も読まれる。
import youtube_fetch as yf
from youtube_add import extract_video_id

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser(description="YouTube動画を恒久除外する（削除＋除外ID台帳登録）")
    ap.add_argument("urls", nargs="+", help="YouTube動画のURL または 11桁の動画ID（複数可）")
    ap.add_argument("--reason", default=None, help="除外理由（台帳に記録・省略可）")
    ap.add_argument("--dry-run", action="store_true", help="対象を表示するだけでDB無変更")
    args = ap.parse_args()

    # 入力を11桁IDへ正規化（不正な入力は警告して飛ばす）
    ids = []
    for u in args.urls:
        vid = extract_video_id(u)
        if not vid:
            print(f"[WARN] 動画IDを抽出できませんでした（スキップ）: {u}")
            continue
        if vid not in ids:
            ids.append(vid)

    if not ids:
        print("[ERROR] 有効な動画IDがありません。")
        sys.exit(1)

    print(f"=== YouTube人手除外 {len(ids)}件 {'[DRY-RUN]' if args.dry_run else ''} ===")
    print(f"理由: {args.reason or '(未記入)'}")

    supabase = create_client(yf.SUPABASE_URL, yf.SUPABASE_WRITE_KEY)

    # channel_name を videos から引いて台帳に添える（存在すれば）
    res = supabase.table("videos").select("youtube_id, channel_name, title_original").in_("youtube_id", ids).execute()
    meta = {r["youtube_id"]: r for r in (res.data or [])}

    for vid in ids:
        m = meta.get(vid)
        label = (m or {}).get("title_original") or "(videos に不在)"
        ch = (m or {}).get("channel_name")
        print(f"  ✗ {vid}  [{ch or '-'}]  {str(label)[:60]}")

    if args.dry_run:
        print("\n[DRY-RUN] DBは変更していません。")
        return

    # 台帳へ upsert（再除外なら reason/excluded_at を更新）
    ledger_rows = [
        {
            "youtube_id": vid,
            "reason": args.reason,
            "channel_name": (meta.get(vid) or {}).get("channel_name"),
        }
        for vid in ids
    ]
    supabase.table("excluded_videos").upsert(ledger_rows, on_conflict="youtube_id").execute()
    print(f"\n除外ID台帳へ登録: {len(ledger_rows)}件")

    # videos から削除（cascade で関連行も消える）
    deleted = 0
    for vid in ids:
        if vid in meta:  # videos に在るものだけ delete（不在は台帳登録のみで十分）
            supabase.table("videos").delete().eq("youtube_id", vid).execute()
            deleted += 1
    print(f"videos から削除: {deleted}件（台帳のみ登録={len(ids) - deleted}件）")
    print("完了: 以後 youtube_fetch.py が台帳で間引くため再取得しても復活しません。")


if __name__ == "__main__":
    main()
