#!/usr/bin/env python3
"""
個別動画ページ（video.html?id=…）の sitemap を生成する。

動画ポータルの検索流入は「個別動画ページがGoogleにインデックスされること」で生まれる。
videos テーブル全件を読み、リポジトリルートに sitemap-videos.xml を書き出す。
robots.txt に2つ目の Sitemap 行として登録済み。

- loc は video.html の canonical と一致（https://www.registro500.com/video?id=<youtube_id>）
- lastmod は updated_at（無ければ published_at）の YYYY-MM-DD
- videos は RLS public read なので anon キー（SUPABASE_KEY）で読める

env (py/.env): SUPABASE_URL / SUPABASE_KEY
使い方: python gen_video_sitemap.py
"""
import os
import sys
from xml.sax.saxutils import escape
from urllib.parse import quote

from dotenv import load_dotenv
from supabase import create_client

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

PY_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(PY_DIR)
load_dotenv(os.path.join(PY_DIR, ".env"))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ["SUPABASE_SERVICE_KEY"]

SITE_BASE = "https://www.registro500.com"
OUT_PATH = os.path.join(REPO_ROOT, "sitemap-videos.xml")
PAGE_SIZE = 1000


def fetch_all_videos(supabase):
    """videos を range で1000行ずつページングして全件取得。"""
    rows = []
    offset = 0
    while True:
        res = (
            supabase.table("videos")
            .select("youtube_id,updated_at,published_at")
            .order("youtube_id")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def lastmod_of(row):
    """updated_at 優先・無ければ published_at を YYYY-MM-DD に。"""
    ts = row.get("updated_at") or row.get("published_at") or ""
    return ts[:10] if len(ts) >= 10 else ""


def build_xml(rows):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for row in rows:
        yid = row.get("youtube_id")
        if not yid:
            continue
        loc = escape(f"{SITE_BASE}/video?id={quote(yid, safe='')}")
        lastmod = lastmod_of(row)
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        if lastmod:
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("    <changefreq>weekly</changefreq>")
        lines.append("    <priority>0.6</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    rows = fetch_all_videos(supabase)
    xml = build_xml(rows)
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(xml)
    print(f"生成: {OUT_PATH}  （{len(rows)} 本）")


if __name__ == "__main__":
    main()
