"""Search Console の検索語（クエリ）を取る。

GA4 と同じサービスアカウント（py/ga4_sa.json）を使う。
Search Console 側でこのサービスアカウントを「制限付き」ユーザーとして追加してあることが前提。

    python gsc_queries.py            # 直近28日と前28日のクエリ・ページ上位
    python gsc_queries.py --days 7   # 期間を変える
"""
import argparse
import datetime as dt
import json
import os
import urllib.parse
import urllib.request

from google.auth.transport.requests import Request
from google.oauth2 import service_account

SA_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ga4_sa.json")
API = "https://www.googleapis.com/webmasters/v3"


def token():
    c = service_account.Credentials.from_service_account_file(
        SA_JSON, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
    c.refresh(Request())
    return c.token


def call(tok, path, body=None):
    req = urllib.request.Request(
        API + path, data=json.dumps(body).encode() if body else None,
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def query(tok, site, start, end, dim, limit):
    body = {"startDate": str(start), "endDate": str(end), "dimensions": [dim], "rowLimit": limit}
    return call(tok, f"/sites/{urllib.parse.quote(site, safe='')}/searchAnalytics/query", body).get("rows", [])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--limit", type=int, default=30)
    a = ap.parse_args()

    tok = token()
    sites = [s["siteUrl"] for s in call(tok, "/sites").get("siteEntry", [])]
    if not sites:
        print("サービスアカウントに見えるプロパティがありません（Search Console でユーザー追加が必要）")
        return
    site = next((s for s in sites if "registro500" in s), sites[0])
    # Search Console は2〜3日遅れで確定する
    end = dt.date.today() - dt.timedelta(days=3)
    cur = (end - dt.timedelta(days=a.days - 1), end)
    prev = (cur[0] - dt.timedelta(days=a.days), cur[0] - dt.timedelta(days=1))
    print(f"site={site}  今期 {cur[0]}〜{cur[1]} / 前期 {prev[0]}〜{prev[1]}")

    for dim in ("query", "page"):
        now = query(tok, site, *cur, dim, a.limit)
        before = {r["keys"][0]: r["clicks"] for r in query(tok, site, *prev, dim, 1000)}
        print(f"\n== {dim} 上位（clicks / 前期clicks / impressions / CTR / 平均順位）==")
        for r in now:
            k = r["keys"][0]
            print(f"{r['clicks']:>5.0f} {before.get(k, 0):>5.0f} {r['impressions']:>7.0f} "
                  f"{r['ctr'] * 100:>5.1f}% {r['position']:>5.1f}  {k[:80]}")


if __name__ == "__main__":
    main()
