# -*- coding: utf-8 -*-
"""
成長レポート配信スクリプト（Brevo経由メール送信）
gen_report.py が生成した report.html と weekly_metrics の前週比を、サマリメールとして送る。
実行: python py/send_report.py（gen_report.py の後に実行）
"""
import json, urllib.request, urllib.error, base64, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(BASE, "py", ".env")
REPORT_HTML = os.path.join(BASE, "report.html")

env = {}
for line in open(ENV, encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k] = v

SUPA_URL = env["SUPABASE_URL"].rstrip("/")
SUPA_KEY = env.get("SUPABASE_SERVICE_KEY") or env["SUPABASE_KEY"]
BREVO_KEY = env["BREVO_API_KEY"]

SENDER_EMAIL = "news@registro500.com"
SENDER_NAME = "Registro500 Giappone"
TO_EMAIL = "registro500giappone@gmail.com"


def sb(table, select="*", extra=""):
    url = f"{SUPA_URL}/rest/v1/{table}?select={select}"
    if extra:
        url += "&" + extra
    req = urllib.request.Request(url, headers={
        "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY})
    return json.load(urllib.request.urlopen(req, timeout=40))


def pct(n, d):
    return f"{n / d * 100:.0f}%" if d else "—"


def g(row, key):
    return row.get(key) if row else None


def delta_line(label, cur, prev, unit=""):
    if cur is None:
        return None
    if prev is None:
        return f"・{label}: {cur}{unit}（前週記録なし）"
    d = cur - prev
    sign = "▲" if d > 0 else ("▼" if d < 0 else "→")
    return f"・{label}: {cur}{unit}（前週 {prev}{unit} / {sign} {d:+d}{unit}）"


rows = sb("weekly_metrics", "*", "order=week_start.desc&limit=2")
if not rows:
    raise SystemExit("weekly_metrics にデータがありません。先に gen_report.py を実行してください。")
cur = rows[0]
prev = rows[1] if len(rows) > 1 else None

total = cur.get("total_cars") or 0
linked = cur.get("linked") or 0
active90 = cur.get("active_90d") or 0
p_total = g(prev, "total_cars")
linked_rate = pct(linked, total)
active_rate = pct(active90, total)
p_linked_rate = pct(g(prev, "linked") or 0, p_total) if p_total else None
p_active_rate = pct(g(prev, "active_90d") or 0, p_total) if p_total else None

lines = [
    f"成長レポート週次サマリ（{cur['week_start']}〜）",
    "",
    delta_line("累計登録台数", total, g(prev, "total_cars")),
    delta_line("今週の新規登録", cur.get("new_regs_7d") or 0, g(prev, "new_regs_7d")),
    f"・連携率: {linked_rate}" + (f"（前週 {p_linked_rate}）" if p_linked_rate else "（前週記録なし）"),
    f"・実アクティブ率(90日): {active_rate}" + (f"（前週 {p_active_rate}）" if p_active_rate else "（前週記録なし）"),
    delta_line("PV(GA4/7日)", cur.get("pv"), g(prev, "pv")),
    delta_line("訪問数(GA4/7日)", cur.get("visits"), g(prev, "visits")),
    delta_line("登録完了(sign_up)", cur.get("signups"), g(prev, "signups")),
    delta_line("アフィリクリック(GA4/7日)", cur.get("affil_clicks"), g(prev, "affil_clicks")),
    "",
    "詳細は添付の report.html を参照（noindex・社内限定）",
]
body_text = "\n".join(line for line in lines if line is not None)

if not os.path.exists(REPORT_HTML):
    raise SystemExit("report.html が見つかりません。先に gen_report.py を実行してください。")
with open(REPORT_HTML, "rb") as f:
    report_b64 = base64.b64encode(f.read()).decode()

payload = {
    "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
    "to": [{"email": TO_EMAIL}],
    "subject": f"📊 成長レポート {cur['week_start']}週",
    "textContent": body_text,
    "attachment": [{
        "content": report_b64,
        "name": f"report_{cur['week_start'].replace('-', '')}.html",
    }],
}
req = urllib.request.Request(
    "https://api.brevo.com/v3/smtp/email",
    data=json.dumps(payload).encode(),
    headers={"api-key": BREVO_KEY, "Content-Type": "application/json", "Accept": "application/json"},
    method="POST")
try:
    resp = json.load(urllib.request.urlopen(req, timeout=40))
    print("OK 送信完了:", resp.get("messageId"))
except urllib.error.HTTPError as e:
    print("送信失敗:", e.code, e.read().decode())
    raise
