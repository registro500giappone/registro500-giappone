# -*- coding: utf-8 -*-
"""
成長レポート配信スクリプト（Brevo経由メール送信）
gen_report.py が生成した report.html と weekly_metrics の前週比を、サマリメールとして送る。
実行: python py/send_report.py（gen_report.py の後に実行）
"""
import base64, os

from common import BASE, ADMIN_EMAIL, require, sb_select, brevo_send

REPORT_HTML = os.path.join(BASE, "report.html")
require("SUPABASE_URL", "BREVO_API_KEY")

TO_EMAIL = ADMIN_EMAIL


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


rows = sb_select("weekly_metrics", "*", extra="order=week_start.desc&limit=2", paged=False)
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
    "to": [{"email": TO_EMAIL}],
    "subject": f"📊 成長レポート {cur['week_start']}週",
    "textContent": body_text,
    "attachment": [{
        "content": report_b64,
        "name": f"report_{cur['week_start'].replace('-', '')}.html",
    }],
}
print("OK 送信完了:", brevo_send(payload))
