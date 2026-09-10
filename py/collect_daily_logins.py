# -*- coding: utf-8 -*-
"""
日次ユニークログイン人数の収集（延べ=セッション数ではなく実人数）。

同じ人が1日に何度ログインしても1人として数える。集計本体はDB側の
public.sync_daily_logins()（SECURITY DEFINER・auth.sessions を参照）で行い、
このスクリプトはそれを1回呼ぶだけの薄い実行役。

書き込み先 public.daily_logins は RLS 有効・ポリシーなしの非公開テーブル。
service_role キーでしか読み書きできない＝公開Webからは触れない。
個人の特定（誰がログインしたか）は Supabase MCP や SQL で daily_logins を
直接見る運用にしており、自動エクスポートはあえて作っていない。

実行: python py/collect_daily_logins.py（毎日1回想定・GitHub Actions）
      引数なし＝JSTの「昨日」を収集。過去分を埋め直したい時だけ
      python py/collect_daily_logins.py 2026-09-01 のように日付を渡す。
"""
import json, sys, urllib.request, os, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(BASE, "py", ".env")

env = {}
for line in open(ENV, encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k] = v

SUPA_URL = env["SUPABASE_URL"].rstrip("/")
# auth.sessions を参照する SECURITY DEFINER 関数を呼ぶため service_role が必須
SUPA_KEY = env.get("SUPABASE_SERVICE_KEY")
if not SUPA_KEY:
    sys.exit("SUPABASE_SERVICE_KEY が未設定（daily_logins は非公開テーブルのため anon キーでは書けない）")

target_date = sys.argv[1] if len(sys.argv) > 1 else None
payload = json.dumps({"target_date": target_date}).encode()

req = urllib.request.Request(
    f"{SUPA_URL}/rest/v1/rpc/sync_daily_logins", data=payload,
    headers={"apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY,
             "Content-Type": "application/json"})
n = json.load(urllib.request.urlopen(req, timeout=40))

d = target_date or (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
print(f"daily_logins: {d} のユニークログイン {n}人を記録")
