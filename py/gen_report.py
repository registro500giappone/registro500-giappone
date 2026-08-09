# -*- coding: utf-8 -*-
"""
成長レポートHTML生成スクリプト（4セグメント・週次前週比・ダッシュボード表示）
設計: repo の report-design.md を参照。

構成:
  ① 躊躇層（獲得）   : 月次/週次の新規登録。ファネル（GA4）はフェーズ2配線待ち
  ② 登録のみ層（活性化）: 連携率・休眠・未連携名簿CSV
  ③ アクティブ層（満足）: 真アクティブ率・コホート定着・機能利用・死蔵機能
  ④ 収益（送客）     : アフィリクリック。GA4拡張計測ONで取得開始（フェーズ2）
  流入（2026-08-09〜 GA4 が主・Cloudflare は保険。下記「流入データの主従」を参照）

時系列:
  - フロー指標（登録など）は created_at で遡及し前週比
  - ストック指標（連携率・アクティブ率）は weekly_metrics に毎週記録し前週比
実行: python py/gen_report.py（週1回想定）
"""
import json, urllib.request, urllib.parse, datetime, os, html, csv
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(BASE, "py", ".env")
OUT = os.path.join(BASE, "report.html")

# REPORT_DRY_RUN=1 で実行すると weekly_metrics への書き込みをスキップし、HTML も
# report_dryrun.html へ出す。週次スナップショットの時系列を汚さずに動作確認するため。
DRY_RUN = os.environ.get("REPORT_DRY_RUN") == "1"
if DRY_RUN:
    OUT = os.path.join(BASE, "report_dryrun.html")

env = {}
for line in open(ENV, encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k] = v

TOKEN = env["CLOUDFLARE_ANALYTICS_TOKEN"]
ACC = "ecd969022f5ba171fefeb39cf33e9eed"
SITE = "8544926213c64b7b9474c495f5b59029"
SUPA_URL = env["SUPABASE_URL"].rstrip("/")
# レポートは管理タスク。集計・auth参照・個人情報CSVのため service_role を使う（anonにフォールバック）
SUPA_KEY = env.get("SUPABASE_SERVICE_KEY") or env["SUPABASE_KEY"]


# ───────────────────────── Supabase ヘルパ ─────────────────────────
def sb(table, select="*", extra=""):
    url = f"{SUPA_URL}/rest/v1/{table}?select={select}"
    if extra:
        url += "&" + extra
    req = urllib.request.Request(url, headers={
        "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY})
    return json.load(urllib.request.urlopen(req, timeout=40))


def sb_rpc(fn):
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/rpc/{fn}", data=b"{}",
        headers={"apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY,
                 "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=40))


def sb_upsert(table, row):
    req = urllib.request.Request(
        f"{SUPA_URL}/rest/v1/{table}", data=json.dumps(row).encode(),
        headers={"apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY,
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
        method="POST")
    urllib.request.urlopen(req, timeout=40)


def parse_ts(t):
    return datetime.datetime.fromisoformat(t.replace("Z", "+00:00")) if t else None


def pct(n, d):
    return f"{n / d * 100:.0f}%" if d else "—"


today = datetime.date.today()
week_start = (today - datetime.timedelta(days=today.weekday())).isoformat()  # 今週の月曜
d7 = (today - datetime.timedelta(days=7)).isoformat()
d14 = (today - datetime.timedelta(days=14)).isoformat()
d30 = (today - datetime.timedelta(days=30)).isoformat()

# ───────────────────────── ① 拡大: cars 集計 ─────────────────────────
cars = sb("cars", "created_at,updated_at,car_type,is_sold,owner_user_id,accept_inquiry,sns_share_optout,photo_main")
monthly = defaultdict(lambda: {"500": 0, "126": 0})
for c in cars:
    ym = (c["created_at"] or "")[:7]
    if ym:
        monthly[ym][c.get("car_type") or "500"] += 1

total = len(cars)
n_500 = sum(1 for c in cars if (c.get("car_type") or "500") == "500")
n_126 = total - n_500
sold = sum(1 for c in cars if c.get("is_sold"))
linked = sum(1 for c in cars if c.get("owner_user_id"))
accept = sum(1 for c in cars if c.get("accept_inquiry"))
optout = sum(1 for c in cars if c.get("sns_share_optout"))


def cdate(c):
    return (c["created_at"] or "")[:10]


new_7d = sum(1 for c in cars if cdate(c) >= d7)
prev_7d = sum(1 for c in cars if d14 <= cdate(c) < d7)
reg30 = sum(1 for c in cars if cdate(c) >= d30)


def is_edited(c):
    cr, up = parse_ts(c.get("created_at")), parse_ts(c.get("updated_at"))
    return bool(cr and up and (up - cr) > datetime.timedelta(days=1))


edited = sum(1 for c in cars if is_edited(c))

# ───────────────────────── ③ エンゲージメント集計 ─────────────────────────
rels = sb("user_relations", "status,user_id")
rel_want = sum(1 for r in rels if r.get("status") == "want")
rel_met = sum(1 for r in rels if r.get("status") == "met")
rel_users = len({r["user_id"] for r in rels if r.get("user_id")})
eparts = sb("event_participants", "car_id")
event_cars = len({e["car_id"] for e in eparts if e.get("car_id")})
episodes = sb("car_episodes", "car_id,is_published")
ep_pub = sum(1 for e in episodes if e.get("is_published"))
favs = sb("favorite_spots", "owner_user_id")
fav_users = len({f["owner_user_id"] for f in favs if f.get("owner_user_id")})
gnotes = len(sb("garage_notes", "id"))
usel = len(sb("user_selections", "id"))

# 真のアクティブ率 & コホート（auth.users 由来、集計RPC経由）
act = sb_rpc("report_owner_activity")
linked_n = act["summary"]["linked"]
active30 = act["summary"]["active_30d"]
active90 = act["summary"]["active_90d"]
cohort = act["cohort"]

# ───────────────────────── ② 未連携名簿（CSV・個人情報のためHTML非掲載）─────────────────────────
unlinked = sb("cars", "owner_email,handle_name,car_type,created_at",
              "owner_user_id=is.null&order=created_at.asc")
n_unlinked = len(unlinked)
CSV_OUT = os.path.join(BASE, "py", "unlinked_owners.csv")
with open(CSV_OUT, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["email", "handle_name", "car_type", "registered_at"])
    for u in unlinked:
        w.writerow([u.get("owner_email"), u.get("handle_name"),
                    u.get("car_type"), (u.get("created_at") or "")[:10]])


# ───────────────────────── 流入: Cloudflare（保険・GA4が落ちたときの代替）─────────────────────────
PAGE_LABEL = {
    "/": "トップ", "/detail": "車両個別ページ", "/event": "イベント",
    "/episode": "エピソード", "/stories": "ストーリー一覧", "/edit": "登録・編集",
    "/mappa": "マップ", "/parts-shops": "パーツ店", "/126/": "126姉妹サイト",
    "/spot-guide": "スポット案内", "/spot": "スポット", "/goods": "物販",
    "/stats": "統計", "/parts": "パーツ", "/news": "お知らせ", "/howto": "使い方",
    "/support": "支援", "/garage-notes": "整備メモ", "/mypage": "マイページ",
}
REF_LABEL = {
    "www.registro500.com": "サイト内回遊", "(直接)": "直接・ブックマーク",
    "www.google.com": "Google検索", "search.yahoo.co.jp": "Yahoo!検索",
    "t.co": "X (Twitter)", "l.instagram.com": "Instagram",
    "l.facebook.com": "Facebook", "www.facebook.com": "Facebook",
    # GA4 の pageReferrer は Facebook のホストが分かれて出る（2026-08-09 実測で
    # facebook.com / lm.facebook.com / l.facebook.com の3種を確認）ので全部ラベル化する
    "facebook.com": "Facebook", "lm.facebook.com": "Facebook", "m.facebook.com": "Facebook",
    "www.instagram.com": "Instagram", "instagram.com": "Instagram",
    "www.bing.com": "Bing検索", "note.com": "note",
    "accounts.google.com": "Googleログイン経由", "mail.google.com": "Gmail",
    "com.google.android.gm": "Gmailアプリ",
}


def gql(q, v):
    body = json.dumps({"query": q, "variables": v}).encode()
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/graphql", data=body,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=40))


def fetch(geq, leq):
    q = """query($a:String!,$s:String!,$g:String!,$l:String!){viewer{accounts(filter:{accountTag:$a}){
      tot:rumPageloadEventsAdaptiveGroups(limit:1,filter:{siteTag:$s,date_geq:$g,date_leq:$l}){count sum{visits}}
      byday:rumPageloadEventsAdaptiveGroups(limit:31,orderBy:[date_ASC],filter:{siteTag:$s,date_geq:$g,date_leq:$l}){count sum{visits} dimensions{date}}
      paths:rumPageloadEventsAdaptiveGroups(limit:12,orderBy:[count_DESC],filter:{siteTag:$s,date_geq:$g,date_leq:$l}){count dimensions{requestPath}}
      ref:rumPageloadEventsAdaptiveGroups(limit:12,orderBy:[count_DESC],filter:{siteTag:$s,date_geq:$g,date_leq:$l}){count dimensions{refererHost}}
      country:rumPageloadEventsAdaptiveGroups(limit:8,orderBy:[count_DESC],filter:{siteTag:$s,date_geq:$g,date_leq:$l}){count dimensions{countryName}}
      dev:rumPageloadEventsAdaptiveGroups(limit:6,orderBy:[count_DESC],filter:{siteTag:$s,date_geq:$g,date_leq:$l}){count dimensions{deviceType}}
    }}}"""
    a = gql(q, {"a": ACC, "s": SITE, "g": geq, "l": leq})["data"]["viewer"]["accounts"][0]
    return {
        "pv": a["tot"][0]["count"], "visits": a["tot"][0]["sum"]["visits"],
        "byday": [(d["dimensions"]["date"], d["count"], d["sum"]["visits"]) for d in a["byday"]],
        "paths": [(d["dimensions"]["requestPath"], d["count"]) for d in a["paths"]],
        "ref": [(d["dimensions"]["refererHost"] or "(直接)", d["count"]) for d in a["ref"]],
        "country": [(d["dimensions"]["countryName"], d["count"]) for d in a["country"]],
        "dev": [(d["dimensions"]["deviceType"], d["count"]) for d in a["dev"]],
    }


g1 = (today - datetime.timedelta(days=7)).isoformat()
l1 = today.isoformat()
g0 = (today - datetime.timedelta(days=14)).isoformat()
l0 = g1


def empty_traffic():
    return {"pv": 0, "visits": 0, "byday": [], "paths": [], "ref": [], "country": [], "dev": []}


# Cloudflare は 2026-08-09 の GA4 照合をもって「引退予定・保険」の位置づけに降格した。
# 28日間の実測で総量は GA4 と +6%(PV)/+5%(訪問) の差に収まり整合したが、
# Cloudflare 側はサンプリング外挿で日別が全て10の倍数に丸められており日次の精度が無い。
# ユーザー数・イベント計測も取れないため主データには使わない。
# ビーコンとトークンは GA4 が壊れたときの保険として残してあるので取得は続けるが、
# **失敗してもレポートは止めない**（以前はここが素の呼び出しで、Cloudflare が落ちると
# 週次レポート全体が例外で配信されなくなる主従逆転の状態だった）。
cf_cur = cf_prev = None
try:
    cf_cur = fetch(g1, l1)
    cf_prev = fetch(g0, g1)
except Exception as e:
    print("Cloudflare取得失敗（GA4のみでレポートを継続）:", e)

# ───────────────────────── GA4 Data API（フェーズ2配線・失敗時はpending表示にフォールバック）─────────────────────────
GA4_PROPERTY_ID = env.get("GA4_PROPERTY_ID")
GA4_SA_JSON = os.path.join(BASE, "py", "ga4_sa.json")
GA4_EDIT_PATH = "/edit"

ga4 = None


def ga4_report(metrics, dimensions=None, dimension_filter=None,
               start="7daysAgo", end="today", limit=None, order_desc=None):
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request as GARequest
    creds = service_account.Credentials.from_service_account_file(
        GA4_SA_JSON, scopes=["https://www.googleapis.com/auth/analytics.readonly"])
    creds.refresh(GARequest())
    body = {"dateRanges": [{"startDate": start, "endDate": end}],
            "metrics": [{"name": m} for m in metrics]}
    if dimensions:
        body["dimensions"] = [{"name": d} for d in dimensions]
    if dimension_filter:
        body["dimensionFilter"] = dimension_filter
    if limit:
        body["limit"] = limit
    if order_desc:
        body["orderBys"] = [{"metric": {"metricName": order_desc}, "desc": True}]
    req = urllib.request.Request(
        f"https://analyticsdata.googleapis.com/v1beta/properties/{GA4_PROPERTY_ID}:runReport",
        data=json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + creds.token, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=40))


SELF_HOSTS = ("www.registro500.com", "registro500.com")


def ga4_traffic(start, end):
    """流入データを GA4 から取り、Cloudflare の fetch() と同じ形の辞書で返す。

    2026-08-09 以降はこちらが流入セクションの主データ。取得できなければ None を返し、
    呼び出し側が Cloudflare → 空 の順にフォールバックする。
    """
    if not (GA4_PROPERTY_ID and os.path.exists(GA4_SA_JSON)):
        return None
    try:
        trows = ga4_report(["screenPageViews", "sessions"], start=start, end=end).get("rows") or []
        pv = int(trows[0]["metricValues"][0]["value"]) if trows else 0
        visits = int(trows[0]["metricValues"][1]["value"]) if trows else 0

        byday = []
        for r in ga4_report(["screenPageViews", "sessions"], ["date"],
                            start=start, end=end, limit=40).get("rows", []):
            d = r["dimensionValues"][0]["value"]  # YYYYMMDD
            byday.append((f"{d[:4]}-{d[4:6]}-{d[6:]}",
                          int(r["metricValues"][0]["value"]),
                          int(r["metricValues"][1]["value"])))
        byday.sort()

        paths = [(r["dimensionValues"][0]["value"], int(r["metricValues"][0]["value"]))
                 for r in ga4_report(["screenPageViews"], ["pagePath"], start=start, end=end,
                                     limit=12, order_desc="screenPageViews").get("rows", [])]

        # 参照元は Cloudflare の refererHost に合わせてホスト名へ揃える（REF_LABELS がホスト名基準のため）。
        # 自サイト内の遷移は流入ではないので除く。
        agg = {}
        label_rep = {}  # 同じ表示ラベルになるホストは1行にまとめる（Facebook が3ホストに割れるため）
        # pageReferrer はフルURL単位で行が出るため件数が多い。ホスト集約の取りこぼしを
        # 避けるので limit は大きめに取る（2026-08-09 実測: 直近7日で生100行→21ホスト）。
        for r in ga4_report(["sessions"], ["pageReferrer"], start=start, end=end,
                            limit=500, order_desc="sessions").get("rows", []):
            raw = (r["dimensionValues"][0]["value"] or "").strip()
            host = urllib.parse.urlparse(raw).netloc if "://" in raw else raw
            if host in SELF_HOSTS:
                continue  # サイト内の遷移は流入ではない（Cloudflare 版では「サイト内回遊」として混ざっていた）
            host = host or "(直接)"
            lab = REF_LABEL.get(host)
            key = label_rep.setdefault(lab, host) if lab else host
            agg[key] = agg.get(key, 0) + int(r["metricValues"][0]["value"])
        ref = sorted(agg.items(), key=lambda x: -x[1])[:12]

        dev = [(r["dimensionValues"][0]["value"], int(r["metricValues"][0]["value"]))
               for r in ga4_report(["screenPageViews"], ["deviceCategory"],
                                   start=start, end=end).get("rows", [])]

        return {"pv": pv, "visits": visits, "byday": byday, "paths": paths,
                "ref": ref, "country": [], "dev": dev}
    except Exception as e:
        print("GA4流入データ取得失敗（Cloudflareへフォールバック）:", e)
        return None


if GA4_PROPERTY_ID and os.path.exists(GA4_SA_JSON):
    try:
        traffic = ga4_report(["screenPageViews", "sessions"])
        trows = traffic.get("rows")
        g_pv = int(trows[0]["metricValues"][0]["value"]) if trows else 0
        g_visits = int(trows[0]["metricValues"][1]["value"]) if trows else 0

        sp = ga4_report(["screenPageViews"], dimension_filter={
            "filter": {"fieldName": "pagePath", "stringFilter": {"value": GA4_EDIT_PATH, "matchType": "EXACT"}}})
        signup_page_views = sum(int(r["metricValues"][0]["value"]) for r in sp.get("rows", []))

        su = ga4_report(["eventCount"], dimension_filter={
            "filter": {"fieldName": "eventName", "stringFilter": {"value": "sign_up", "matchType": "EXACT"}}})
        signups = sum(int(r["metricValues"][0]["value"]) for r in su.get("rows", []))

        affil_filter = {"andGroup": {"expressions": [
            {"filter": {"fieldName": "eventName", "stringFilter": {"value": "click", "matchType": "EXACT"}}},
            {"filter": {"fieldName": "linkDomain",
                        "stringFilter": {"value": "amazon", "matchType": "CONTAINS"}}},
        ]}}
        ac = ga4_report(["eventCount"], dimension_filter=affil_filter)
        affil_clicks = sum(int(r["metricValues"][0]["value"]) for r in ac.get("rows", []))

        acp = ga4_report(["eventCount"], dimensions=["pagePath"], dimension_filter=affil_filter)
        affil_click_by_page = {r["dimensionValues"][0]["value"]: int(r["metricValues"][0]["value"])
                                for r in acp.get("rows", [])}

        ga4 = {
            "pv": g_pv, "visits": g_visits,
            "signup_page_views": signup_page_views, "signups": signups,
            "signup_cvr": (signups / signup_page_views) if signup_page_views else None,
            "affil_clicks": affil_clicks, "affil_click_by_page": affil_click_by_page,
        }
    except Exception as e:
        print("GA4取得失敗（pending表示にフォールバック）:", e)

# ───────── 流入データの主従（2026-08-09〜）: GA4 が主・Cloudflare は保険 ─────────
# どちらか片方が落ちてもレポートは必ず出る。両方落ちたときだけ流入セクションが空になる。
_g_cur = ga4_traffic(g1, l1)
_g_prev = ga4_traffic(g0, g1)
if _g_cur:
    cur, prev = _g_cur, (_g_prev or empty_traffic())
    traffic_source = "GA4"
elif cf_cur:
    cur, prev = cf_cur, (cf_prev or empty_traffic())
    traffic_source = "Cloudflare（GA4取得失敗のため代替）"
else:
    cur = prev = empty_traffic()
    traffic_source = "取得失敗"
    print("流入データを GA4・Cloudflare のどちらからも取得できませんでした。")
prev_paths = dict(prev["paths"])
prev_ref = dict(prev["ref"])


# ───────────────────────── 週次スナップショット（前週比の起点）─────────────────────────
_psnap = sb("weekly_metrics", "*", f"week_start=lt.{week_start}&order=week_start.desc&limit=1")
prev_snap = _psnap[0] if _psnap else None

snap = {
    "week_start": week_start,
    "total_cars": total, "n_500": n_500, "n_126": n_126, "new_regs_7d": new_7d,
    "linked": linked, "active_30d": active30, "active_90d": active90, "edited": edited,
    "unlinked": n_unlinked,
    "rel_count": rel_want + rel_met, "rel_users": rel_users, "event_cars": event_cars,
    "fav_users": fav_users, "episodes_pub": ep_pub,
    "garage_notes": gnotes, "user_selections": usel,
    # pv_7d / visits_7d は Cloudflare 由来の時系列。GA4 の値は下の pv / visits に別カラムで入るので、
    # 過去との継続性を壊さないよう混ぜない。Cloudflare が取れなかった週は null のままにする。
    "pv_7d": cf_cur["pv"] if cf_cur else None,
    "visits_7d": cf_cur["visits"] if cf_cur else None,
}
if ga4:
    snap.update({
        "pv": ga4["pv"], "visits": ga4["visits"],
        "signup_page_views": ga4["signup_page_views"], "signups": ga4["signups"],
        "signup_cvr": ga4["signup_cvr"],
        "affil_clicks": ga4["affil_clicks"], "affil_click_by_page": ga4["affil_click_by_page"],
    })
if DRY_RUN:
    print(f"[DRY RUN] weekly_metrics への upsert をスキップ（week_start={week_start}／流入ソース={traffic_source}）")
else:
    sb_upsert("weekly_metrics", snap)


# ───────────────────────── 表示ヘルパ（前週比）─────────────────────────
def delta(c, p):
    """フロー指標の前週比（実数）。"""
    d = c - p
    if p == 0:
        return f'<span class="up">+{d}</span>'
    pc = d / p * 100
    if d > 0:
        return f'<span class="up">▲ +{d} (+{pc:.0f}%)</span>'
    if d < 0:
        return f'<span class="down">▼ {d} ({pc:.0f}%)</span>'
    return '<span class="flat">→ ±0</span>'


def wdelta(key, cur_val):
    """ストック指標の前週比（weekly_metrics の前回記録と比較）。"""
    if not prev_snap or prev_snap.get(key) is None:
        return '<span class="flat">前週記録なし</span>'
    p = prev_snap[key]
    d = cur_val - p
    if d > 0:
        return f'<span class="up">▲ +{d}</span> <small>前週 {p}</small>'
    if d < 0:
        return f'<span class="down">▼ {d}</span> <small>前週 {p}</small>'
    return f'<span class="flat">→ ±0</span> <small>前週 {p}</small>'


# 詳細表用の行（コホート・流入）
cohort_rows = ""
for r in cohort:
    reg, lk, a90 = r["registered"], r["linked"], r["active_90d"]
    rate = a90 / reg * 100 if reg else 0
    cls = "up" if rate >= 60 else ("down" if rate < 30 else "flat")
    cohort_rows += (f'<tr><td>{r["ym"]}</td><td class="num">{reg}</td>'
                    f'<td class="num">{lk}</td><td class="num">{a90}</td>'
                    f'<td class="num"><span class="{cls}">{rate:.0f}%</span></td></tr>')
path_rows = ""
for path, c in cur["paths"]:
    label = PAGE_LABEL.get(path, "")
    pc = prev_paths.get(path, 0)
    path_rows += (f'<tr><td><code>{html.escape(path)}</code> <span class="lbl">{label}</span></td>'
                  f'<td class="num">{c}</td><td class="num">{pc}</td><td>{delta(c, pc)}</td></tr>')
ref_rows = ""
for host, c in cur["ref"]:
    label = REF_LABEL.get(host, host)
    pc = prev_ref.get(host, 0)
    ref_rows += (f'<tr><td>{html.escape(label)}</td>'
                 f'<td class="num">{c}</td><td class="num">{pc}</td><td>{delta(c, pc)}</td></tr>')
total_d = sum(c for _, c in cur["dev"]) or 1
DEV_JP = {"mobile": "📱 モバイル", "desktop": "💻 PC", "tablet": "🖧 タブレット"}
dev_rows = "".join(
    f'<li>{DEV_JP.get(n, n)} <b>{c/total_d*100:.0f}%</b> <small>({c})</small></li>'
    for n, c in cur["dev"])
ppv = "%.2f" % (cur["pv"] / cur["visits"]) if cur["visits"] else "—"
gen_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

# ───────────────────────── 読み解き ─────────────────────────
this_ym = today.strftime("%Y-%m")
complete = [m for m in months if m < this_ym] if (months := sorted(monthly.keys())) else []
peak_ym = max(months, key=lambda m: monthly[m]["500"] + monthly[m]["126"]) if months else ""
peak_n = (monthly[peak_ym]["500"] + monthly[peak_ym]["126"]) if peak_ym else 0
last_ym = complete[-1] if complete else (months[-1] if months else "")
last_n = (monthly[last_ym]["500"] + monthly[last_ym]["126"]) if last_ym else 0


def _cohort_rate(ym):
    for r in cohort:
        if r["ym"] == ym and r["registered"]:
            return r["active_90d"] / r["registered"] * 100
    return 0


_boom = _cohort_rate("2025-12")
_recent = [r["active_90d"] / r["registered"] * 100 for r in cohort if r["ym"] >= "2026-03" and r["registered"]]
_recent_avg = sum(_recent) / len(_recent) if _recent else 0

read_reg = (f"今週の新規登録は {new_7d}台（前週 {prev_7d}台）。月次ピーク {peak_ym} の {peak_n}台に対し直近完了月 "
            f"{last_ym} は {last_n}台。旧車ゆえ台数の急増は構造的に見込みにくく、<b>“数”より“質”を重視する局面</b>。")
read_retain = (f"登録 {total}台のうち連携は {linked}台（{pct(linked, total)}）。残り {n_unlinked}台は"
               f"<b>メール登録のみの休眠</b>。名簿は py/unlinked_owners.csv に出力済。<b>声掛けで最も簡単に活性化できる資産</b>。")
read_active = (f"連携 {linked_n}人中、90日ログインは {active90}人（{pct(active90, linked_n)}）。"
               f"<b>連携できれば定着は良好</b>。全登録比の実アクティブは {pct(active90, total)}（90日）。")
read_cohort = (f"12月の大量登録はいま定着 {_boom:.0f}% まで低下。対して 2026-03 以降は平均 {_recent_avg:.0f}%。"
               f"<b>「数は減ったが質は上がった」</b>。最近の獲得・オンボーディングを伸ばすのが正解。")
read_engage = (f"繋がり {rel_want + rel_met}件が {rel_users}人に集中。イベント {event_cars}台・スポット {fav_users}人・"
               f"エピソード {ep_pub}件。<b>少数のコアが牽引し大多数は沈黙</b>。コア層への要望ヒアリングが鍵。")
unused = []
if gnotes == 0:
    unused.append("整備メモ 0件")
if usel <= 2:
    unused.append(f"比べ太郎の保存 {usel}件")
read_unused = "／".join(unused) if unused else "目立った未使用機能なし"
active_rate90 = pct(active90, total)

# ───────────────────────── チャート用データ ─────────────────────────
_coh_rates = [round(r["active_90d"] / r["registered"] * 100) if r["registered"] else 0 for r in cohort]


def _coh_color(x):
    return "#2e7d32" if x >= 60 else ("#e0a800" if x >= 30 else "#c62828")


chart = {
    "months": [m[2:] for m in months],
    "reg500": [monthly[m]["500"] for m in months],
    "reg126": [monthly[m]["126"] for m in months],
    "cohYm": [r["ym"][2:] for r in cohort],
    "cohRate": _coh_rates,
    "cohColor": [_coh_color(x) for x in _coh_rates],
    "cohReg": [r["registered"] for r in cohort],
    "linked": linked, "unlinked": n_unlinked,
    "active30": active30, "active90": active90, "linkedN": linked_n,
    "featLabels": ["連携(台)", "登録後編集(台)", "繋がり(件)", "イベント(台)", "スポット(人)", "エピソード(件)"],
    "featVals": [linked, edited, rel_want + rel_met, event_cars, fav_users, ep_pub],
    "bydayDate": [d[5:] for d, _, _ in cur["byday"]],
    "bydayPv": [pv for _, pv, _ in cur["byday"]],
}
chart_json = json.dumps(chart, ensure_ascii=False)

CSS = """
:root{--g:#2e7d32;--r:#c62828;--bl:#2856a8;--am:#e0a800;--bd:#e3e6ea;--bg:#f4f6f9;--ink:#1f2733;--sub:#6b7682;}
*{box-sizing:border-box}
body{font-family:-apple-system,"Segoe UI","Hiragino Sans",Meiryo,sans-serif;margin:0;background:var(--bg);color:var(--ink);line-height:1.55}
.wrap{max-width:1080px;margin:0 auto;padding:22px 18px 80px}
h1{font-size:1.4rem;margin:.1em 0}
.sub{color:var(--sub);font-size:.84rem;margin-bottom:1.2em}
.seg-title{font-size:1.05rem;font-weight:700;margin:1.6em 0 .7em;padding-left:10px;border-left:4px solid var(--bl)}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:.6em}
.kpi{border-radius:16px;padding:16px 18px;color:#fff;box-shadow:0 4px 14px rgba(20,30,50,.10)}
.kpi.blue{background:linear-gradient(135deg,#2856a8,#3f74d6)}
.kpi.green{background:linear-gradient(135deg,#2e7d32,#54a85a)}
.kpi.amber{background:linear-gradient(135deg,#d99800,#f0b73d)}
.kpi.red{background:linear-gradient(135deg,#c62828,#e25555)}
.kpi .k{font-size:.8rem;opacity:.92}
.kpi .v{font-size:2.3rem;font-weight:800;line-height:1.1;margin:.1em 0}
.kpi .d{font-size:.8rem;opacity:.95}
.kpi .d .up,.kpi .d .down,.kpi .d .flat{color:#fff !important;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px}
.cardbox{background:#fff;border:1px solid var(--bd);border-radius:14px;padding:14px 16px}
.cardbox h3{font-size:.95rem;margin:.1em 0 .2em}
.cardbox .cap{font-size:.78rem;color:var(--sub);margin-bottom:.4em}
.cbox{position:relative;height:230px}
.note{font-size:.82rem;color:var(--sub);margin:.5em 0 0;background:#f8fafc;border-radius:8px;padding:8px 10px}
.pending{background:#fff8e1;border:1px dashed #e0c060;border-radius:10px;padding:12px 14px;font-size:.84rem;color:#7a5c00}
table{width:100%;border-collapse:collapse;font-size:.88rem}
th,td{text-align:left;padding:6px 6px;border-bottom:1px solid #f0f2f5}
th{color:var(--sub);font-weight:600;font-size:.78rem}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
code{background:#f3f3f3;padding:1px 5px;border-radius:4px;font-size:.85em}
.lbl{color:#9aa3ad;font-size:.8em}
.up{color:var(--g);font-weight:700}.down{color:var(--r);font-weight:700}.flat{color:#9aa3ad}
ul.flat-list{list-style:none;padding:0;margin:.3em 0 0;display:flex;flex-wrap:wrap;gap:6px 18px}
details{margin-top:14px;background:#fff;border:1px solid var(--bd);border-radius:12px;padding:6px 14px}
summary{cursor:pointer;font-weight:600;font-size:.9rem;padding:8px 0}
.foot{text-align:center;color:#aeb6bf;font-size:.78rem;margin-top:26px}
"""

CHART_JS = """
const f={responsive:true,maintainAspectRatio:false};
const noLeg={...f,plugins:{legend:{display:false}}};
new Chart(document.getElementById('cReg'),{type:'bar',
 data:{labels:D.months,datasets:[
  {label:'500',data:D.reg500,backgroundColor:'#2856a8',borderRadius:4},
  {label:'126',data:D.reg126,backgroundColor:'#e0a800',borderRadius:4}]},
 options:{...f,plugins:{legend:{position:'bottom'}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}}}});
new Chart(document.getElementById('cCoh'),{type:'bar',
 data:{labels:D.cohYm,datasets:[{data:D.cohRate,backgroundColor:D.cohColor,borderRadius:4}]},
 options:{...noLeg,scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'}}},
  plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>'定着 '+c.raw+'%（登録'+D.cohReg[c.dataIndex]+'台）'}}}}});
new Chart(document.getElementById('cLink'),{type:'doughnut',
 data:{labels:['連携済','休眠(未連携)'],datasets:[{data:[D.linked,D.unlinked],backgroundColor:['#2e7d32','#d0d5db']}]},
 options:{...f,cutout:'62%',plugins:{legend:{position:'bottom'}}}});
new Chart(document.getElementById('cFeat'),{type:'bar',
 data:{labels:D.featLabels,datasets:[{data:D.featVals,backgroundColor:'#3f74d6',borderRadius:4}]},
 options:{...noLeg,indexAxis:'y',scales:{x:{beginAtZero:true}}}});
new Chart(document.getElementById('cDay'),{type:'line',
 data:{labels:D.bydayDate,datasets:[{data:D.bydayPv,borderColor:'#2e7d32',backgroundColor:'rgba(46,125,50,.12)',fill:true,tension:.3,pointRadius:2}]},
 options:{...noLeg,scales:{y:{beginAtZero:true}}}});
"""

# ───────────────────────── ① 獲得ファネル・④ 収益（GA4取得結果 or pending）─────────────────────────
if ga4:
    cvr_str = pct(ga4["signups"], ga4["signup_page_views"])
    funnel_html = (
        '<table><tr><th>指標</th><th class="num">値</th></tr>'
        f'<tr><td>登録ページ到達（7日）</td><td class="num">{ga4["signup_page_views"]:,}</td></tr>'
        f'<tr><td>登録完了（sign_up）</td><td class="num">{ga4["signups"]:,}</td></tr>'
        f'<tr><td>到達→完了率</td><td class="num">{cvr_str}</td></tr></table>'
    )
    top_pages = sorted(ga4["affil_click_by_page"].items(), key=lambda x: -x[1])[:8]
    page_rows = "".join(f'<tr><td>{html.escape(p)}</td><td class="num">{c}</td></tr>' for p, c in top_pages)
    revenue_html = (
        f'<div class="kpi-grid"><div class="kpi green"><div class="k">アフィリクリック(7日)</div>'
        f'<div class="v">{ga4["affil_clicks"]:,}</div></div></div>'
        + (f'<table style="margin-top:.6em"><tr><th>ページ</th><th class="num">クリック</th></tr>{page_rows}</table>'
           if page_rows else "")
    )
else:
    funnel_html = ('<div class="pending">⏳ フェーズ2で配線予定。<code>sign_up</code> イベントは実装済み'
                    '（デプロイ後にGA4でキーイベント指定）。ONになれば「来訪したのに登録しなかった層」と'
                    '離脱箇所が見え始めます。</div>')
    revenue_html = ('<div class="pending">⏳ <b>GA4「外部リンククリック（拡張計測）」をONにすれば、'
                     '無改修で来週から取得開始</b>。goods.html に Amazonアソシエイト等の送客リンクが多数あり、'
                     '現状クリックは未計測。ON後は「どのページ・商品・ショップが送客しているか」'
                     '「閲覧→クリック率」が見え、goods改善/新規の判断材料になります。報酬額は提携先レポートと突合。</div>')

HTML = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>成長レポート | registro500.com 管理</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
<h1>📊 成長レポート</h1>
<div class="sub">対象週 {week_start} 〜（週次）／ 登録・定着=Supabase全期間・流入={traffic_source}直近7日／ 北極星は「質・活性化・満足・収益」</div>

<div class="kpi-grid">
  <div class="kpi blue"><div class="k">累計 登録台数</div><div class="v">{total}</div><div class="d">500:{n_500} / 126:{n_126}</div></div>
  <div class="kpi green"><div class="k">今週の新規登録</div><div class="v">{new_7d}</div><div class="d">{delta(new_7d, prev_7d)}</div></div>
  <div class="kpi amber"><div class="k">実アクティブ率(90日)</div><div class="v">{active_rate90}</div><div class="d">{active90}/{total}台 ・ {wdelta('active_90d', active90)}</div></div>
  <div class="kpi red"><div class="k">休眠（未連携）</div><div class="v">{n_unlinked}</div><div class="d">{pct(n_unlinked, total)} ・ {wdelta('unlinked', n_unlinked)}</div></div>
</div>

<div class="seg-title">① 躊躇層を動かす ― 獲得</div>
<div class="grid">
  <div class="cardbox">
    <h3>月次の新規登録</h3><div class="cap">青=500 / 黄=126（積み上げ・全期間）</div>
    <div class="cbox"><canvas id="cReg"></canvas></div>
    <div class="note">{read_reg}</div>
  </div>
  <div class="cardbox">
    <h3>獲得ファネル（GA4）</h3><div class="cap">登録ページ到達→完了率（直近7日）</div>
    {funnel_html}
  </div>
</div>

<div class="seg-title">② 登録のみ層を動かす ― 活性化</div>
<div class="grid">
  <div class="cardbox">
    <h3>連携 vs 休眠</h3><div class="cap">休眠＝メール登録のみで機能を使えない層</div>
    <div class="cbox"><canvas id="cLink"></canvas></div>
    <div class="note">{read_retain}</div>
  </div>
  <div class="cardbox">
    <h3>定着の状態</h3><div class="cap">登録後の能動度（前週比つき）</div>
    <table>
      <tr><th>指標</th><th class="num">数</th><th class="num">割合</th><th>前週比</th></tr>
      <tr><td>アカウント連携</td><td class="num">{linked}</td><td class="num">{pct(linked, total)}</td><td>{wdelta('linked', linked)}</td></tr>
      <tr><td>休眠（未連携）</td><td class="num">{n_unlinked}</td><td class="num">{pct(n_unlinked, total)}</td><td>{wdelta('unlinked', n_unlinked)}</td></tr>
      <tr><td>登録後に追記・更新</td><td class="num">{edited}</td><td class="num">{pct(edited, total)}</td><td>{wdelta('edited', edited)}</td></tr>
      <tr><td>問い合わせ受付ON</td><td class="num">{accept}</td><td class="num">{pct(accept, total)}</td><td>—</td></tr>
      <tr><td>手放し済み</td><td class="num">{sold}</td><td class="num">{pct(sold, total)}</td><td>—</td></tr>
    </table>
  </div>
</div>

<div class="seg-title">③ アクティブ層を満足させる ― 定着と機能</div>
<div class="kpi-grid">
  <div class="kpi green"><div class="k">90日アクティブ</div><div class="v">{active90}</div><div class="d">連携比 {pct(active90, linked_n)}</div></div>
  <div class="kpi green"><div class="k">30日アクティブ</div><div class="v">{active30}</div><div class="d">連携比 {pct(active30, linked_n)}</div></div>
  <div class="kpi blue"><div class="k">繋がり（件 / 人）</div><div class="v">{rel_want + rel_met}</div><div class="d">{rel_users}人に集中</div></div>
  <div class="kpi blue"><div class="k">イベント参加 車両</div><div class="v">{event_cars}</div><div class="d">台</div></div>
</div>
<div class="grid">
  <div class="cardbox">
    <h3>コホート定着率</h3><div class="cap">登録月ごとの「いま生きている率」（緑=好調 / 赤=低迷）</div>
    <div class="cbox"><canvas id="cCoh"></canvas></div>
    <div class="note">{read_cohort}</div>
  </div>
  <div class="cardbox">
    <h3>機能の使われ方</h3><div class="cap">単位が違う点に注意（台/件/人）。相対的な使われ度の比較</div>
    <div class="cbox"><canvas id="cFeat"></canvas></div>
    <div class="note">{read_engage}<br>⚠️ ほぼ未使用: {read_unused}</div>
  </div>
</div>

<div class="seg-title">④ 収益 ― アフィリエイト送客</div>
{revenue_html}

<div class="seg-title">流入（{traffic_source} 直近7日）</div>
<div class="kpi-grid">
  <div class="kpi blue"><div class="k">ページビュー</div><div class="v">{cur['pv']:,}</div><div class="d">{delta(cur['pv'], prev['pv'])}</div></div>
  <div class="kpi blue"><div class="k">訪問数</div><div class="v">{cur['visits']:,}</div><div class="d">{delta(cur['visits'], prev['visits'])}</div></div>
  <div class="kpi green"><div class="k">回遊の深さ</div><div class="v">{ppv}</div><div class="d">ページ/訪問</div></div>
</div>
<div class="grid">
  <div class="cardbox">
    <h3>日別アクセス（PV）</h3><div class="cap">直近7日 ※最終日は集計途中で低く出ます</div>
    <div class="cbox"><canvas id="cDay"></canvas></div>
  </div>
  <div class="cardbox">
    <h3>流入元（前週比）</h3><div class="cap">どこから来ているか（セッション数・サイト内の遷移は除く）</div>
    <table><tr><th>流入元</th><th class="num">今週</th><th class="num">前週</th><th>増減</th></tr>{ref_rows}</table>
  </div>
</div>

<details>
  <summary>▸ 詳細データ（コホート表・人気ページ・デバイス）</summary>
  <p style="font-size:.85rem;color:#555;margin:.8em 0 .3em">コホート定着（登録月別）</p>
  <table><tr><th>登録月</th><th class="num">登録</th><th class="num">連携</th><th class="num">90日活動</th><th class="num">定着率</th></tr>{cohort_rows}</table>
  <p style="font-size:.85rem;color:#555;margin:1.2em 0 .3em">人気ページ（前週比）</p>
  <table><tr><th>ページ</th><th class="num">今週</th><th class="num">前週</th><th>増減</th></tr>{path_rows}</table>
  <p style="font-size:.85rem;color:#555;margin:1.2em 0 .3em">デバイス</p>
  <ul class="flat-list">{dev_rows}</ul>
</details>

<div class="foot">生成 {gen_at} ／ 週次スナップショット記録済（前週比の起点）／ noindex</div>
</div>
<script>const D={chart_json};</script>
<script>{CHART_JS}</script>
</body>
</html>
"""

with open(OUT, "w", encoding="utf-8") as f:
    f.write(HTML)
print("OK ->", OUT)
print(f"登録 {total} / 連携 {linked} / 実アクティブ90日 {active90} / 休眠 {n_unlinked} / 今週登録 {new_7d}(前週 {prev_7d})")
print(f"週次スナップショット: week_start={week_start} / 前週記録={'あり' if prev_snap else 'なし(初回)'}")
