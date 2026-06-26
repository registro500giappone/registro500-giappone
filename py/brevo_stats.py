#!/usr/bin/env python3
"""
Brevo Transactional Email 統計・ログ取得ヘルパー

使い方:
    python py/brevo_stats.py stats              # 直近7日の統計サマリー
    python py/brevo_stats.py stats --days 30    # 指定日数の統計
    python py/brevo_stats.py logs               # 直近配信ログ（20件）
    python py/brevo_stats.py logs --limit 50
    python py/brevo_stats.py logs --email user@example.com  # 特定宛先のログ
    python py/brevo_stats.py bounces            # ハードバウンス一覧
    python py/brevo_stats.py account            # アカウント情報・残送信数

API キーは py/.env の BREVO_API_KEY_READONLY から読み込み（git管理外）。
"""
import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib import request, parse, error


API_BASE = "https://api.brevo.com/v3"


def load_api_key():
    """py/.env から BREVO_API_KEY_READONLY を取得"""
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        sys.exit(f"ERROR: {env_path} が存在しません。.env を作成して BREVO_API_KEY_READONLY を設定してください。")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("BREVO_API_KEY_READONLY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("ERROR: py/.env に BREVO_API_KEY_READONLY が設定されていません。")


def api_get(path, api_key, params=None):
    url = API_BASE + path
    if params:
        url += "?" + parse.urlencode({k: v for k, v in params.items() if v is not None})
    req = request.Request(url, headers={
        "api-key": api_key,
        "accept": "application/json",
    })
    try:
        with request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        sys.exit(f"HTTP {e.code}: {body}")
    except error.URLError as e:
        sys.exit(f"URL error: {e}")


def cmd_stats(args, api_key):
    end = date.today()
    start = end - timedelta(days=args.days)
    data = api_get("/smtp/statistics/aggregatedReport", api_key, {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
    })
    print(f"=== Brevo Statistics ({start} ~ {end}) ===")
    for k, v in data.items():
        print(f"  {k}: {v}")
    # 主要比率も表示
    sent = data.get("requests", 0) or 0
    delivered = data.get("delivered", 0) or 0
    opens_unique = data.get("uniqueOpens", 0) or 0
    clicks_unique = data.get("uniqueClicks", 0) or 0
    hard_bounces = data.get("hardBounces", 0) or 0
    soft_bounces = data.get("softBounces", 0) or 0
    if sent > 0:
        print("--- 比率 ---")
        print(f"  配信成功率: {delivered/sent*100:.2f}% ({delivered}/{sent})")
        if delivered > 0:
            print(f"  ユニーク開封率: {opens_unique/delivered*100:.2f}%")
            print(f"  ユニーククリック率: {clicks_unique/delivered*100:.2f}%")
        print(f"  ハードバウンス率: {hard_bounces/sent*100:.2f}%")
        print(f"  ソフトバウンス率: {soft_bounces/sent*100:.2f}%")


def cmd_logs(args, api_key):
    params = {"limit": args.limit, "offset": 0}
    if args.email:
        params["email"] = args.email
    data = api_get("/smtp/statistics/events", api_key, params)
    events = data.get("events", [])
    print(f"=== Brevo Event Logs (count={len(events)}) ===")
    for ev in events:
        ts = ev.get("date", "")
        event = ev.get("event", "")
        email = ev.get("email", "")
        subject = ev.get("subject", "")[:60]
        reason = ev.get("reason", "")
        print(f"  [{ts}] {event:12s} {email:40s} {subject}" + (f"  reason={reason}" if reason else ""))


def cmd_bounces(args, api_key):
    # Brevoのevent名はキャメルケース（hardBounces / softBounces）
    for ev_name, label in (("hardBounces", "Hard Bounces"), ("softBounces", "Soft Bounces")):
        data = api_get("/smtp/statistics/events", api_key, {
            "limit": args.limit,
            "event": ev_name,
        })
        events = data.get("events", [])
        print(f"=== {label} (count={len(events)}) ===")
        for ev in events:
            print(f"  {ev.get('date','')} {ev.get('email','')} reason={ev.get('reason','')}")


def cmd_account(args, api_key):
    data = api_get("/account", api_key)
    print("=== Account ===")
    print(f"  Email: {data.get('email','')}")
    print(f"  Company: {data.get('companyName','')}")
    plan = data.get("plan", [])
    if plan:
        print("  Plan:")
        for p in plan:
            print(f"    - type={p.get('type','')} credits={p.get('credits','')} creditsType={p.get('creditsType','')}")


def main():
    parser = argparse.ArgumentParser(description="Brevo stats helper")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_stats = sub.add_parser("stats", help="集計統計")
    p_stats.add_argument("--days", type=int, default=7)

    p_logs = sub.add_parser("logs", help="配信ログ")
    p_logs.add_argument("--limit", type=int, default=20)
    p_logs.add_argument("--email", type=str, default=None)

    p_bounces = sub.add_parser("bounces", help="バウンス（hard/soft 両方）")
    p_bounces.add_argument("--limit", type=int, default=50)

    sub.add_parser("account", help="アカウント情報")

    args = parser.parse_args()
    api_key = load_api_key()

    {
        "stats": cmd_stats,
        "logs": cmd_logs,
        "bounces": cmd_bounces,
        "account": cmd_account,
    }[args.cmd](args, api_key)


if __name__ == "__main__":
    main()
