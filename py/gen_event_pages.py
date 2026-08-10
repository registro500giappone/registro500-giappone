#!/usr/bin/env python3
"""
イベント個別ページ（/event/<slug>/）の静的HTMLを生成する。

なぜ静的生成なのか
------------------
LINE・X・Facebook の共有カードを作るクローラーは JavaScript を実行しない。
既存の detail.html / video.html のように「開いてからJSが中身を書く」方式だと、
共有時にサイト名しか出ない（実際いまイベントを共有してもそうなっている）。
そこでイベントページだけは骨格を本物のHTMLとして書き出す。

- 骨格（イベント名・日時・場所・説明・OGP・JSON-LD）＝ ここで静的に埋める
- 参加表明の顔ぶれ ＝ 焼き付けると古くなるのでブラウザ側で都度取得（ハイブリッド）

日付の扱い（重要）
------------------
event.html は日付を `YYYY-MM-DDT00:00:00+09:00` の形で保存する。DBには
UTCで入るため、UTCの日付部分をそのまま使うと1日ずれる。必ずJSTへ直してから
日付を取り出すこと。またJSTで 00:00 ちょうどは「開催時刻が未入力」を意味する
規約になっている（event.html の時間判定ロジックと同じ）。誤った時刻を
構造化データに出すとGoogleのイベント情報の品質ガイドラインに触れるため、
時刻が未入力なら startDate は日付のみで出す。

URLの安定性
-----------
イベント名を後から直してもURLが変わらないよう、決めたslugを
リポジトリ直下の event-slugs.json に記録する。一度書かれた対応は変更しない。
英字の当て方を変えたいときはこのファイルを手で直せばよい（次回以降も維持される）。
DBに列を足さないのは、本番DBの変更をローカルPCからに限る取り決めのため。

env (py/.env): SUPABASE_URL / SUPABASE_KEY
使い方: python py/gen_event_pages.py
"""
import html
import json
import os
import re
import shutil
import sys
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlparse

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
# DB取得用。書き込み権限のある鍵が入りうるので、生成HTMLへは絶対に埋めない。
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ["SUPABASE_SERVICE_KEY"]


def load_public_key() -> str:
    """生成HTMLに埋める公開キーを config.js から読む。

    取得用の SUPABASE_KEY を使い回さないこと。GitHub Actions の
    secrets.SUPABASE_KEY はパーツクローラー等と共用で書き込み権限があり、
    実際に service_role キーが35枚の公開HTMLへ焼かれ public リポジトリに
    push された（2026-08-07・commit 5dc55f2）。ここで形式を検査して、
    公開キーでなければ生成そのものを止める。
    """
    config_path = os.path.join(REPO_ROOT, "config.js")
    with open(config_path, encoding="utf-8") as f:
        m = re.search(r'SUPABASE_ANON_KEY\s*[:=]\s*"([^"]+)"', f.read())
    if not m:
        raise SystemExit("config.js から SUPABASE_ANON_KEY を読めませんでした。生成を中止します")
    key = m.group(1)
    if not key.startswith("sb_publishable_"):
        raise SystemExit(f"公開キーの形式ではありません（{key[:12]}…）。生成を中止します")
    return key


PUBLIC_KEY = load_public_key()

SITE_BASE = "https://www.registro500.com"
OUT_DIR = os.path.join(REPO_ROOT, "event")
SLUG_MAP_PATH = os.path.join(REPO_ROOT, "event-slugs.json")
# 確認用の使い捨て一覧。公開用の一覧は /event（event.html）が担う（render_review 参照）。
REVIEW_PATH = os.path.join(REPO_ROOT, "event-review.html")
JST = timezone(timedelta(hours=9))

# 2026-08-10 公開（ユーザー指示）。一覧からのリンク・sitemap 登録と揃えて False にした。
# 再び伏せたくなったらここを True に戻して再生成すれば、35件すべてに検索避けが戻る。
NOINDEX = False

# 個別ページの sitemap。イベントは増減するので手書きの sitemap.xml には載せず、
# 生成のたびに作り直す専用ファイルにする（sitemap-videos.xml と同じ考え方）。
SITEMAP_PATH = os.path.join(REPO_ROOT, "sitemap-events.xml")

# 都道府県（event.html の地域フィルタと同じ並び）。構造化データの addressRegion に使う。
PREFECTURES = [
    "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
    "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川",
    "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知",
    "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
    "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知",
    "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄",
]

# pykakasi は外来語を音のままローマ字にする（ミーティング→miitingu）。
# このサイトに繰り返し出る語だけ先に英語へ寄せて、読めるURLにする。
# 長い語から順に置換したいので、適用時に長さ降順で回す。
LOANWORDS = {
    "ミーティング": "meeting", "クラシックカー": "classic-car", "オフ会": "offkai",
    "フィアット": "fiat", "アバルト": "abarth", "ピクニック": "picnic",
    "フェスタ": "festa", "ツーリング": "touring", "レビュー": "review",
    "イベント": "event", "オーナーズ": "owners", "イタリア": "italia",
    "ミーティン": "meeting", "パーツ": "parts", "カフェ": "cafe",
    "レトロカー": "retro-car", "ラリー": "rally", "コンクール": "concours",
    "日本海": "nihonkai", "全国": "zenkoku", "秋の部": "aki", "春の部": "haru",
}


def to_jst(ts: str):
    """DBのタイムスタンプ文字列をJSTのdatetimeに直す。空ならNone。"""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(JST)
    except ValueError:
        return None


def has_time(dt) -> bool:
    """JSTで00:00ちょうどは『開催時刻の入力なし』という保存側の規約。"""
    return not (dt.hour == 0 and dt.minute == 0)


def romanize(text: str) -> str:
    """日本語を含む文字列をURL向けのローマ字に。pykakasiが無い環境では素通し。"""
    for word in sorted(LOANWORDS, key=len, reverse=True):
        text = text.replace(word, f" {LOANWORDS[word]} ")
    try:
        import pykakasi
    except ImportError:
        return text
    conv = pykakasi.kakasi()
    return " ".join(item["hepburn"] for item in conv.convert(text))


def slugify(event_name: str, year: int) -> str:
    """イベント名と開催年から `2026-nikitou-meeting-7` 形式のslugを作る。"""
    name = unicodedata.normalize("NFKC", event_name or "")
    # 括弧の中は日本語読みの併記（La Festa Autunno（ラ フェスタ アウトゥンノ））や
    # 補足（申請中・関東）がほとんどで、URLに入れると同じ語の繰り返しになる。
    # ただし括弧を外すと何も残らない名前もあるので、その場合は外さない。
    stripped = re.sub(r"[(（][^)）]*[)）]", " ", name)
    if stripped.strip():
        name = stripped
    # 名前に既に年が入っている場合（La Festa Autunno 2026 など）は頭の年と重複するので落とす。
    # 「フェスタ2026」のように前後が日本語だと \b が成立しないため境界は要求しない。
    name = name.replace(str(year), " ")
    name = romanize(name).lower()
    name = re.sub(r"[^a-z0-9]+", "-", name).strip("-")
    name = re.sub(r"-{2,}", "-", name)
    if len(name) > 60:
        name = name[:60].rsplit("-", 1)[0]
    return f"{year}-{name}" if name else str(year)


def assign_slugs(events, slug_map):
    """未登録のイベントにだけslugを振る。既存の対応は絶対に変えない（URLを固定するため）。"""
    used = set(slug_map.values())
    added = []
    for ev in events:
        if ev["id"] in slug_map:
            continue
        start = to_jst(ev.get("event_date"))
        base = slugify(ev.get("event_name"), start.year if start else 0)
        slug, n = base, 2
        while slug in used:
            slug, n = f"{base}-{n}", n + 1
        slug_map[ev["id"]] = slug
        used.add(slug)
        added.append((ev["id"], slug, ev.get("event_name")))
    return added


def find_prefecture(location: str):
    for pref in PREFECTURES:
        if pref in (location or ""):
            return pref if pref == "北海道" else pref + ("都" if pref == "東京" else "府" if pref in ("大阪", "京都") else "県")
    return None


def build_jsonld(ev, start, end, url):
    """schema.org/Event。推測で埋めないのが原則。

    - organizer は外部主催のイベントも多く、こちらでは分からないので出さない
      （Registro500 名義で出すと事実と異なる）
    - offers は費用が自由記述（「3000円」「カンパ制」等）で価格を確実に取れないため出さない
    - image はイベントごとの写真をまだ持っていないので出さない（第4段階で写真が付いたら足す）
    """
    data = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": ev.get("event_name") or "",
        "startDate": start.isoformat() if has_time(start) else start.strftime("%Y-%m-%d"),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "url": url,
    }
    if end:
        data["endDate"] = end.strftime("%Y-%m-%d")
    loc = (ev.get("location") or "").strip()
    if loc:
        place = {"@type": "Place", "name": loc.splitlines()[0]}
        address = {"@type": "PostalAddress", "addressCountry": "JP",
                   "streetAddress": " ".join(loc.split())}
        pref = find_prefecture(loc)
        if pref:
            address["addressRegion"] = pref
        place["address"] = address
        data["location"] = place
    desc = (ev.get("description") or "").strip()
    if desc:
        data["description"] = " ".join(desc.split())[:300]
    return data


def fmt_date(start, end) -> str:
    w = "月火水木金土日"[start.weekday()]
    out = f"{start.year}年{start.month}月{start.day}日（{w}）"
    if has_time(start):
        out += f" {start:%H:%M}〜"
    if end and end.date() != start.date():
        out += f" 〜 {end.month}月{end.day}日"
    return out


def render(ev, slug, start, end) -> str:
    e = lambda s: html.escape(str(s or ""), quote=True)
    url = f"{SITE_BASE}/event/{slug}/"
    name = ev.get("event_name") or "イベント"
    date_label = fmt_date(start, end)
    loc_lines = [x.strip() for x in (ev.get("location") or "").splitlines() if x.strip()]
    loc_first = loc_lines[0] if loc_lines else ""
    summary = f"{date_label}／{loc_first}".strip("／")
    desc_meta = f"{name}｜{summary}｜クラシックFIAT 500/126 のイベント情報 - Registro500 Giappone"

    # --- 日付は個別ページの主役なので、行の一つではなく上部に大きく出す ---
    weekday = "月火水木金土日"[start.weekday()]
    time_str = f"{start:%H:%M}〜" if has_time(start) else ""
    end_str = ""
    if end and end.date() != start.date():
        end_str = f"〜 {end.month}月{end.day}日（{'月火水木金土日'[end.weekday()]}）"
    # 開催済みかの判定と残り日数はJSに任せる。6時間おきの生成では日付をまたいだ瞬間に古くなるため。
    last_day = (end or start).strftime("%Y-%m-%d")

    # 車種バッジは一覧カードと同じ配色に揃える（ページごとに色が違うと別サイトに見える）
    badge = ""
    if ev.get("target_car_type") == "500":
        badge = '<span class="badge b500">500</span>'
    elif ev.get("target_car_type") == "126":
        badge = '<span class="badge b126">126</span>'

    # 地図は施設名と住所を両方入れた方が当たる（例:「静岡県磐田市豊浜4127 福田漁港」）
    map_html = ""
    if loc_lines:
        map_html = (f'    <a class="btn btn-map" href="https://www.google.com/maps/search/?api=1&amp;query='
                    f'{quote(" ".join(loc_lines))}" target="_blank" rel="noopener">Googleマップで開く</a>')

    rows = [("開催場所", ev.get("location")), ("費用", ev.get("fee"))]
    rows_html = "\n".join(
        f'      <div class="row"><span class="lbl">{e(k)}</span>'
        f'<div class="val">{e(v).replace(chr(10), "<br>")}</div></div>'
        for k, v in rows if v
    )
    desc_html = ""
    if ev.get("description"):
        desc_html = e(ev["description"]).replace("\n", "<br>")
        # 説明文に書かれたURLは押せるようにする（一覧の linkify と同じ扱い）。
        # エスケープ済みなので & は &amp; になっているが、href の中では正しい書き方。
        desc_html = re.sub(r"(https?://[^\s<]+)",
                           r'<a href="\1" target="_blank" rel="noopener nofollow">\1</a>', desc_html)
    # リンク先は主催者のサイトとは限らない。実データでは個人ブログ4件・SNS5件・
    # チケット販売・会場のページなどが混じっているので「主催者の」とは名乗らせない。
    # 代わりに飛び先のドメインを添えて、押す前にどこへ行くか分かるようにする。
    link_html = ""
    if ev.get("url"):
        host = urlparse(ev["url"]).netloc.replace("www.", "")
        link_html = (f'    <a class="btn btn-ext" href="{e(ev.get("url"))}" target="_blank" '
                     f'rel="noopener nofollow">詳しい情報を見る</a>\n'
                     f'    <p class="ext-host">{e(host)}</p>')
    jsonld = json.dumps(build_jsonld(ev, start, end, url), ensure_ascii=False, indent=2)

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{'<meta name="robots" content="noindex, nofollow">' if NOINDEX else ''}
<link rel="canonical" href="{url}">
<title>{e(name)} | Registro500</title>
<meta name="description" content="{e(desc_meta)}">
<meta property="og:type" content="article">
<meta property="og:title" content="{e(name)}">
<meta property="og:description" content="{e(summary)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE_BASE}/logo_horizontal.png">
<meta property="og:site_name" content="Registro500 Giappone">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/style.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.0" integrity="sha384-NFPmVbJvc91cC9zbheWJA+qZKj0Kod2IEMvGnxVKB5A7wLgRNA6Aobu8neZmQ19J" crossorigin="anonymous"></script>
<script>const supabaseClient = supabase.createClient({json.dumps(SUPABASE_URL)}, {json.dumps(PUBLIC_KEY)});</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-27SHHC4JYH"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', 'G-27SHHC4JYH');
</script>
<script type="application/ld+json">
{jsonld}
</script>
<style>
  :root {{ --bg-main:#f4f4f7; --card-bg:#fff; --accent:#2856a8; --text-main:#111827; --sub:#6b7280; --line:#e5e7eb; --nav:#1A1A18; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg-main:#0f172a; --card-bg:#1e293b; --accent:#7aa2e3; --text-main:#e2e8f0; --sub:#94a3b8; --line:#334155; }}
  }}
  * {{ box-sizing:border-box; }}
  body {{ font-family:system-ui,sans-serif; background:var(--bg-main); color:var(--text-main); margin:0; padding:0 0 90px; line-height:1.6; }}

  /* サイトの一部だと分かるように、動画ページ(video.html)と同じ形のバーを載せる */
  .ev-nav {{ position:sticky; top:0; z-index:50; height:46px; background:var(--nav);
             display:flex; align-items:center; justify-content:space-between; padding:0 18px; }}
  .ev-nav a {{ color:rgba(255,255,255,.8); text-decoration:none; font-size:.82rem; letter-spacing:.06em; }}
  .ev-nav a:hover {{ color:#fff; }}
  .ev-nav .brand {{ letter-spacing:.25em; text-transform:uppercase; font-size:.72rem; color:rgba(255,255,255,.6); }}

  .page {{ max-width:800px; margin:0 auto; padding:18px 16px 0; }}
  .card {{ background:var(--card-bg); border:1px solid var(--line); border-radius:14px; overflow:hidden; }}

  /* 日付はこのページの主役。行の一つに埋めず、上に置いて最初に目に入るようにする */
  .hero {{ background:var(--accent); color:#fff; padding:16px 22px 14px; }}
  .hero.past {{ background:#6b7280; }}
  .hero-y {{ font-size:.8rem; opacity:.85; letter-spacing:.08em; }}
  .hero-d {{ font-size:1.75rem; font-weight:700; line-height:1.25; margin-top:2px; }}
  .hero-d .wd {{ font-size:1.1rem; font-weight:600; margin-left:2px; }}
  .hero-sub {{ font-size:.95rem; opacity:.92; margin-top:2px; }}
  .hero-cd {{ display:inline-block; margin-top:10px; background:rgba(255,255,255,.18);
              border-radius:999px; padding:3px 14px; font-size:.85rem; font-weight:600; }}

  .body {{ padding:18px 22px 22px; }}
  h1 {{ font-size:1.4rem; margin:0 0 .6em; line-height:1.4; }}
  .badge {{ display:inline-block; font-size:.72rem; border-radius:5px; padding:3px 9px;
            vertical-align:middle; margin-left:8px; font-weight:600; }}
  .b500 {{ background:#e0f2fe; color:#0369a1; }}
  .b126 {{ background:#ffedd5; color:#9a3412; }}
  .row {{ display:flex; gap:12px; padding:10px 0; border-top:1px solid var(--line); }}
  .lbl {{ flex:0 0 5.5em; color:var(--sub); font-size:.85rem; }}
  .val {{ flex:1; }}

  .btn {{ display:block; text-align:center; text-decoration:none; border-radius:10px;
          padding:11px 16px; font-size:.95rem; font-weight:600; margin-top:12px; }}
  /* 絵文字は環境によって豆腐や黒塗りになる（🗺で実際に発生）ので、ボタンには使わない */
  .btn-map {{ background:var(--bg-main); color:var(--accent); border:1px solid var(--line); }}
  .btn-ext {{ background:var(--accent); color:#fff; }}
  .btn-ext::after {{ content:" →"; }}
  .ext-host {{ text-align:center; font-size:.78rem; color:var(--sub); margin:6px 0 0; word-break:break-all; }}
  /* 共有は「行く人が仲間を誘う」動線なので参加予定の直後に置く。地図と同じ控えめな見た目にして、
     このページで一番押してほしい参加ボタン（塗り）と主役を争わせない。button なので font 継承が要る */
  .btn-share {{ background:var(--bg-main); color:var(--accent); border:1px solid var(--line);
                width:100%; cursor:pointer; font-family:inherit; }}
  @media (prefers-color-scheme: dark) {{ .btn-map, .btn-share {{ background:#0f172a; }} }}

  .desc {{ margin-top:16px; padding-top:14px; border-top:1px solid var(--line); }}
  .desc a {{ color:var(--accent); word-break:break-all; }}
  .join {{ margin-top:18px; padding-top:14px; border-top:1px solid var(--line); }}
  .join h2 {{ font-size:1rem; margin:0 0 .6em; }}
  .names {{ display:flex; flex-wrap:wrap; gap:6px; }}
  .name {{ background:var(--bg-main); border:1px solid var(--line); border-radius:999px; padding:4px 13px; font-size:.88rem; }}
  a.name {{ color:var(--accent); text-decoration:none; font-weight:600; }}
  a.name:hover {{ background:var(--accent); color:#fff; border-color:var(--accent); }}
  @media (prefers-color-scheme: dark) {{ .name {{ background:#0f172a; }} }}
  .muted {{ color:var(--sub); font-size:.9rem; }}
  .foot {{ margin-top:20px; font-size:.8rem; color:var(--sub); }}
  .back-bottom {{ display:block; text-align:center; margin:18px 0 0; padding:12px;
                  color:var(--accent); text-decoration:none; font-size:.92rem; }}

  /* 参加表明ボタン（video.htmlのいいねボタンと同じ位置づけ。終了イベントではJSが隠す） */
  .btn-join {{ display:block; width:100%; text-align:center; border:0; border-radius:10px;
               padding:11px 16px; font-size:.95rem; font-weight:700; margin:0 0 12px;
               background:var(--accent); color:#fff; cursor:pointer; }}
  .btn-join.joined {{ background:var(--bg-main); color:var(--accent); border:1px solid var(--line); }}
  @media (prefers-color-scheme: dark) {{ .btn-join.joined {{ background:#0f172a; }} }}
  .btn-join:disabled {{ opacity:.6; cursor:default; }}
  .join-hint {{ margin:0 0 12px; font-size:.9rem; color:var(--sub); }}
  .join-hint a {{ color:var(--accent); }}

  /* ログインモーダル（video.htmlと同じメールOTPコード方式。配色だけこのページの変数に合わせる） */
  #loginModal {{ display:none; position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:10000;
                 align-items:center; justify-content:center; padding:16px; }}
  #loginModal .box {{ background:var(--card-bg); color:var(--text-main); padding:26px 22px; border-radius:16px;
                       max-width:340px; width:100%; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,.25); }}
  #loginModal input {{ padding:11px; border:1px solid var(--line); border-radius:8px; font-size:15px;
                        width:100%; background:var(--bg-main); color:var(--text-main); }}
  #loginModal .pri {{ padding:12px; border:0; border-radius:8px; background:var(--accent); color:#fff;
                       font-weight:700; cursor:pointer; width:100%; font-size:.95rem; }}
</style>
</head>
<body>
<nav class="ev-nav">
  <a href="/event">← イベント一覧</a>
  <a class="brand" href="/">Registro500</a>
</nav>
<div class="page">
  <article class="card">
    <div class="hero" id="hero" data-last-day="{last_day}">
      <div class="hero-y">{start.year}年</div>
      <div class="hero-d">{start.month}月{start.day}日<span class="wd">（{weekday}）</span></div>
      {f'<div class="hero-sub">{e(end_str)}</div>' if end_str else ''}
      {f'<div class="hero-sub">{e(time_str)}</div>' if time_str else ''}
      <div class="hero-cd" id="countdown" hidden></div>
    </div>
    <div class="body">
      <h1>{e(name)}{badge}</h1>
{rows_html}
{map_html}
      {f'<div class="desc">{desc_html}</div>' if desc_html else ''}
{link_html}
      <div class="join">
        <h2 id="joinHead">参加予定</h2>
        <button type="button" class="btn-join" id="joinBtn" style="display:none;">✋ 参加する</button>
        <p class="join-hint" id="joinHint" style="display:none;"></p>
        <div id="participants" class="muted">読み込み中…</div>
      </div>
      <button type="button" class="btn btn-share" id="shareBtn" onclick="shareThisEvent()">このイベントを共有する</button>
      <p class="foot">掲載: {e(ev.get('owner_name'))}／内容が変わることがあります。お出かけ前に最新の告知をご確認ください。</p>
    </div>
  </article>
  <a class="back-bottom" href="/event">← イベント一覧へ戻る</a>
</div>

<!-- ログインモーダル（メールOTPコード方式・video.htmlと共通の認証方式） -->
<div id="loginModal">
  <div class="box">
    <h3 style="margin-top:0;">ログイン</h3>
    <p style="font-size:13px;color:var(--sub);margin:0 0 16px;">登録したメールアドレスにコードを送ってログインします</p>
    <div id="otpStep1" style="display:flex;flex-direction:column;gap:10px;text-align:left;">
      <input type="email" id="emailLoginInput" placeholder="登録したメールアドレス" autocomplete="email">
      <button type="button" id="clearEmailBtn" onclick="clearLoginEmail()" style="display:none;background:none;border:0;color:var(--sub);font-size:12px;cursor:pointer;align-self:flex-start;padding:0;">別のアドレスを使う</button>
      <button id="emailLoginBtn" class="pri" onclick="sendOtpCode()">確認コードを送信</button>
    </div>
    <div id="otpStep2" style="display:none;flex-direction:column;gap:10px;text-align:left;">
      <p style="font-size:13px;color:#2e7d32;margin:0;">✅ <span id="otpSentEmail" style="font-weight:700;"></span> に6桁の確認コードを送信しました。届いたコードを入力してください。</p>
      <input type="text" id="otpCodeInput" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"
             style="font-size:22px;letter-spacing:8px;text-align:center;">
      <button id="otpVerifyBtn" class="pri" onclick="verifyOtpCode()">ログイン</button>
      <button onclick="resendOtpCode()" style="background:none;border:0;color:var(--accent);cursor:pointer;font-size:13px;">確認コードを再送する</button>
    </div>
    <p id="otpErrorMsg" style="display:none;font-size:13px;color:#c62828;margin:8px 0 0;"></p>
    <button onclick="closeLoginModal()" style="margin-top:16px;background:none;border:0;color:var(--sub);cursor:pointer;font-size:13px;">閉じる</button>
  </div>
</div>
<script src="/fab-nav.js" defer></script>
<script>
// 「あと何日」「終了しました」は今日を基準に変わる。6時間おきの生成で焼き込むと
// 日付をまたいだ瞬間に嘘になるので、表示時に出す。
var rgIsPast = (function () {{
  var hero = document.getElementById('hero');
  var cd = document.getElementById('countdown');
  var p = hero.dataset.lastDay.split('-');
  var last = new Date(+p[0], +p[1] - 1, +p[2]);   // 開催最終日のローカル(JST)0時
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var days = Math.round((last - today) / 86400000);
  if (days < 0) {{ hero.classList.add('past'); cd.textContent = '終了しました'; }}
  else if (days === 0) {{ cd.textContent = '本日開催'; }}
  else if (days === 1) {{ cd.textContent = '明日開催'; }}
  else {{ cd.textContent = 'あと' + days + '日'; }}
  cd.hidden = false;
  return days < 0;
}})();

const EVENT_ID = {json.dumps(ev['id'])};
const EVENT_NAME = {json.dumps(name, ensure_ascii=False)};

// 共有。スマホでは共有シート（LINE等が並ぶ）、対応していない環境ではリンクをコピーする。
// alert を出さずボタンの文字で結果を伝える＝押した指の近くで完結し、閉じる操作が要らない。
// 配るURLは canonical と同じ /event/<slug>/ に固定する（クエリやハッシュが付いた状態で
// 共有されると、同じページが別URLとして出回りSNSのシェア数も分散するため）。
function shareThisEvent() {{
  const url = location.origin + location.pathname;
  const btn = document.getElementById('shareBtn');
  if (navigator.share) {{
    navigator.share({{ title: EVENT_NAME, url: url }}).catch(function () {{}});
    return;   // 共有をやめた場合も含め、ここで完了
  }}
  navigator.clipboard.writeText(url).then(function () {{
    const before = btn.textContent;
    btn.textContent = 'リンクをコピーしました';
    setTimeout(function () {{ btn.textContent = before; }}, 2000);
  }}).catch(function () {{
    prompt('このリンクをコピーしてください:', url);
  }});
}}

let currentUser = null;
let myCarId = null;
let myCarHandle = null;

// ── ログインモーダル（video.htmlと同じメールOTPコード方式）──
let otpEmail = '';
function openLoginModal(){{
  const m = document.getElementById('loginModal'); if (m) m.style.display = 'flex';
  const inp = document.getElementById('emailLoginInput'), cb = document.getElementById('clearEmailBtn');
  const saved = localStorage.getItem('r500_login_email');
  if (saved && inp) {{ inp.value = saved; if (cb) cb.style.display = 'block'; }}
}}
function clearLoginEmail(){{
  const inp = document.getElementById('emailLoginInput'), cb = document.getElementById('clearEmailBtn');
  if (inp) {{ inp.value = ''; inp.focus(); }}
  localStorage.removeItem('r500_login_email');
  if (cb) cb.style.display = 'none';
}}
function closeLoginModal(){{
  const m = document.getElementById('loginModal'); if (m) m.style.display = 'none';
  const s1 = document.getElementById('otpStep1'), s2 = document.getElementById('otpStep2');
  if (s1) s1.style.display = 'flex'; if (s2) s2.style.display = 'none';
  showOtpError('');
}}
function showOtpError(msg){{
  const el = document.getElementById('otpErrorMsg'); if (!el) return;
  if (!msg) {{ el.style.display = 'none'; return; }}
  el.textContent = msg; el.style.display = 'block';
}}
async function sendOtpCode(){{
  const email = document.getElementById('emailLoginInput').value.trim();
  if (!email) {{ alert('メールアドレスを入力してください'); return; }}
  const btn = document.getElementById('emailLoginBtn');
  btn.disabled = true; btn.textContent = '送信中…';
  const {{ error }} = await supabaseClient.auth.signInWithOtp({{ email }});
  btn.disabled = false; btn.textContent = '確認コードを送信';
  if (error) {{ showOtpError('送信に失敗しました：' + error.message); return; }}
  otpEmail = email;
  localStorage.setItem('r500_login_email', email);
  document.getElementById('otpSentEmail').textContent = email;
  document.getElementById('otpStep1').style.display = 'none';
  document.getElementById('otpStep2').style.display = 'flex';
  showOtpError('');
}}
async function verifyOtpCode(){{
  const code = document.getElementById('otpCodeInput').value.trim();
  if (!code) {{ alert('確認コードを入力してください'); return; }}
  const btn = document.getElementById('otpVerifyBtn');
  btn.disabled = true; btn.textContent = '確認中…';
  const {{ error }} = await supabaseClient.auth.verifyOtp({{ email: otpEmail, token: code, type: 'email' }});
  btn.disabled = false; btn.textContent = 'ログイン';
  if (error) {{ showOtpError('コードが正しくないか、期限切れです。もう一度お試しください。'); return; }}
  closeLoginModal();  // 成功 → onAuthStateChange が参加ボタンを更新
}}
async function resendOtpCode(){{
  if (!otpEmail) return;
  const {{ error }} = await supabaseClient.auth.signInWithOtp({{ email: otpEmail }});
  showOtpError(error ? ('再送に失敗しました：' + error.message) : '');
  if (!error) alert('確認コードを再送しました。');
}}

// ── 参加表明。event_participants は匿名読み取り可（一覧ページと同じ扱い）──
async function checkMyCar(user){{
  try {{
    const {{ data: cars }} = await supabaseClient.from('cars')
      .select('document_id, handle_name').eq('owner_user_id', user.id);
    if (cars && cars.length > 0) {{ myCarId = cars[0].document_id; myCarHandle = cars[0].handle_name; }}
    else {{ myCarId = null; myCarHandle = null; }}
  }} catch (e) {{ myCarId = null; myCarHandle = null; }}
}}

function updateJoinButton(rows){{
  const btn = document.getElementById('joinBtn');
  const hint = document.getElementById('joinHint');
  if (!btn || rgIsPast) return;  // 終了したイベントには参加ボタンを出さない
  hint.style.display = 'none';
  if (!currentUser) {{
    btn.textContent = '✋ 参加する';
    btn.classList.remove('joined');
    btn.onclick = openLoginModal;
    btn.style.display = 'block';
    return;
  }}
  // event_participants は car_id だけで人を見分けており、車両未登録だと
  // 全員が同じ値に集約されて互いの参加表明を消せてしまう。ここでは登録を促す。
  if (!myCarId) {{
    btn.style.display = 'none';
    hint.innerHTML = '愛車を登録すると参加表明できます。<a href="/edit">車両を登録する</a>';
    hint.style.display = 'block';
    return;
  }}
  const joined = rows.some((r) => r.car_id === myCarId);
  btn.textContent = joined ? '✅ 参加予定です' : '✋ 参加する';
  btn.classList.toggle('joined', joined);
  btn.onclick = toggleJoin;
  btn.style.display = 'block';
}}

async function refreshParticipants(){{
  const box = document.getElementById('participants');
  const head = document.getElementById('joinHead');
  try {{
    const {{ data: rows, error }} = await supabaseClient.from('event_participants')
      .select('car_id, handle_name').eq('event_id', EVENT_ID);
    if (error) throw error;
    const list = rows || [];
    if (list.length === 0) {{
      box.textContent = rgIsPast ? '参加表明はありませんでした。' : 'まだ参加表明はありません。';
      box.className = 'muted';
    }} else {{
      head.textContent = list.length + '人が参加' + (rgIsPast ? 'しました' : '予定');
      box.className = 'names';
      box.innerHTML = '';
      for (const row of list) {{
        // 名前から愛車のページへ行けるようにする。オーナー同士が繋がるための
        // 導線で、ここがこのサイトの本筋（検索流入はあくまで副次的）。
        // 同じタブで開くので、detail 側の戻るボタン（fab-nav.js）でも
        // ブラウザの戻るでも、このイベントページへ帰ってこられる。
        // car_id が 'ADMIN' の行は車両を持たない参加者なのでリンクにしない。
        const linkable = row.car_id && row.car_id !== 'ADMIN';
        const el = document.createElement(linkable ? 'a' : 'span');
        el.className = 'name';
        if (linkable) el.href = '/detail?doc=' + encodeURIComponent(row.car_id);
        el.textContent = row.handle_name || '(名称未設定)';
        box.appendChild(el);
      }}
    }}
    updateJoinButton(list);
  }} catch (err) {{
    box.textContent = '参加者の読み込みに失敗しました。';
  }}
}}

async function toggleJoin(){{
  const btn = document.getElementById('joinBtn');
  if (!myCarId) return;   // 車両未登録には上で案内を出しており、ここへは来ない
  btn.disabled = true;
  try {{
    const {{ data: existing }} = await supabaseClient.from('event_participants')
      .select('id').eq('event_id', EVENT_ID).eq('car_id', myCarId).maybeSingle();
    if (existing) {{
      const {{ error }} = await supabaseClient.from('event_participants').delete().eq('id', existing.id);
      if (error) throw error;
    }} else {{
      const {{ error }} = await supabaseClient.from('event_participants').insert([
        {{ event_id: EVENT_ID, car_id: myCarId, handle_name: myCarHandle || 'オーナー' }}
      ]);
      if (error) throw error;
    }}
    await refreshParticipants();
  }} catch (e) {{
    alert('通信エラーが発生しました');
  }} finally {{
    btn.disabled = false;
  }}
}}

supabaseClient.auth.onAuthStateChange((event, session) => {{
  const user = session ? session.user : null;
  currentUser = user;
  (async () => {{
    if (user) await checkMyCar(user); else {{ myCarId = null; myCarHandle = null; }}
    await refreshParticipants();
  }})();
}});
refreshParticipants();
</script>
</body>
</html>
"""


def fetch_participant_counts(supabase):
    """イベントごとの参加表明数。確認用一覧でだけ使う（個別ページは表示時に取りに行く）。"""
    rows = supabase.table("event_participants").select("event_id").execute().data or []
    counts = {}
    for row in rows:
        counts[row["event_id"]] = counts.get(row["event_id"], 0) + 1
    return counts


def render_review(live, counts) -> str:
    """確認用の一覧（/event-review）。

    公開用の一覧は `/event`（event.html）が担うので、これは**確認専用の使い捨て**。
    同じ役割のページを2つ公開すると、どちらを育てるかで迷いが出て検索でも共倒れになる。
    確認が済んだらこのファイルごと削除してよい。

    `event/index.html` に置かない理由: いまは `/event/` が `/event` へ308で正規化されている。
    そこにファイルを置くと `/event` と `/event/` が別々の中身を返すようになり、
    一覧ページの正規URLが濁る。
    """
    e = lambda s: html.escape(str(s or ""), quote=True)
    now = datetime.now(JST)
    upcoming = [x for x in live if x[2] >= now]
    past = sorted([x for x in live if x[2] < now], key=lambda x: x[2], reverse=True)

    def rows(items):
        out = []
        for ev, slug, start in items:
            n = counts.get(ev["id"], 0)
            # 一覧に細かい住所は出さない（それは個別ページの仕事）。県名が無い登録だけ先頭行を短く。
            loc = find_prefecture(ev.get("location")) or (ev.get("location") or "").splitlines()[0][:14]
            out.append(
                f'<tr><td class="d">{start:%Y/%m/%d}（{"月火水木金土日"[start.weekday()]}）'
                f'{f"<br><small>{start:%H:%M}〜</small>" if has_time(start) else ""}</td>'
                f'<td><a href="/event/{e(slug)}/">{e(ev.get("event_name"))}</a>'
                f'<br><small class="u">/event/{e(slug)}/</small></td>'
                f'<td class="l">{e(loc)}</td>'
                f'<td class="n">{n if n else "—"}</td></tr>')
        return "\n".join(out)

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>イベント個別ページ 確認用一覧</title>
<style>
  :root {{ --bg:#f4f4f7; --card:#fff; --accent:#2856a8; --ink:#111827; --sub:#6b7280; --line:#e5e7eb; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg:#0f172a; --card:#1e293b; --accent:#7aa2e3; --ink:#e2e8f0; --sub:#94a3b8; --line:#334155; }}
  }}
  body {{ font-family:system-ui,sans-serif; background:var(--bg); color:var(--ink); margin:0; padding:20px 16px 60px; line-height:1.6; font-size:17px; }}
  .page {{ max-width:1000px; margin:0 auto; }}
  h1 {{ font-size:1.4rem; margin:.2em 0; }}
  h2 {{ font-size:1.15rem; margin:1.6em 0 .4em; }}
  .warn {{ background:#fff8e1; border:1px dashed #e0c060; color:#7a5c00; border-radius:10px; padding:12px 16px; font-size:.95rem; margin:12px 0 20px; }}
  @media (prefers-color-scheme: dark) {{ .warn {{ background:#332a10; color:#e8cf8e; }} }}
  table {{ width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }}
  th, td {{ text-align:left; padding:12px 14px; border-bottom:1px solid var(--line); font-size:1rem; vertical-align:top; }}
  th {{ color:var(--sub); font-size:.85rem; font-weight:600; }}
  td.d {{ white-space:nowrap; }} td.n {{ text-align:right; white-space:nowrap; }}
  td.d small {{ font-size:.9rem; color:var(--sub); }}
  td.l {{ color:var(--ink); white-space:nowrap; }}
  td a {{ font-size:1.05rem; font-weight:600; }}
  a {{ color:var(--accent); }}
  small.u {{ color:var(--sub); font-size:.82rem; font-weight:400; word-break:break-all; }}
  /* スマホでは4列が収まらず横スクロールになるので、1件を縦に積む */
  @media (max-width: 640px) {{
    table {{ border-radius:12px; }}
    table tr {{ display:block; padding:12px 14px; border-bottom:1px solid var(--line); }}
    table tr:first-child {{ display:none; }}  /* 見出し行 */
    td {{ display:block; border:none; padding:2px 0; }}
    td.d {{ color:var(--sub); font-size:.92rem; }}
    td.d br {{ display:none; }}
    td.d small {{ margin-left:.4em; }}
    td.l {{ font-size:.95rem; }}
    td.l::before {{ content:"📍 "; }}
    td.n {{ text-align:left; font-size:.95rem; }}
    td.n::before {{ content:"参加 "; color:var(--sub); }}
  }}
</style>
</head>
<body>
<div class="page">
  <h1>イベント個別ページ 確認用一覧（{len(live)}件）</h1>
  <div class="warn">
    <b>確認専用のページです。</b>どこからもリンクしておらず、検索避け（noindex）が入っています。
    公開用の一覧は <a href="/event">/event</a> が担うので、確認が済んだらこのページは削除します。<br>
    個別ページも現在すべて noindex です。公開手順は <code>events-portal/HANDOFF.md §5</code>。
  </div>

  <h2>開催前（{len(upcoming)}件）</h2>
  <table><tr><th>開催日</th><th>イベント名 / URL</th><th>場所</th><th>参加</th></tr>
{rows(upcoming)}
  </table>

  <h2>終了済み（{len(past)}件・新しい順）</h2>
  <table><tr><th>開催日</th><th>イベント名 / URL</th><th>場所</th><th>参加</th></tr>
{rows(past)}
  </table>
</div>
</body>
</html>
"""


def render_sitemap(live):
    """個別ページ全件の sitemap を組み立てる。

    lastmod に生成日時を入れてはいけない。6時間おきの再生成のたびに全35件が
    「更新された」ことになり、Googleへ嘘の更新シグナルを送り続けることになる。
    events に updated_at は無いので、動かない値である created_at（登録日）を使う。

    changefreq は開催前だけ weekly（参加者が増える・詳細が埋まる）。
    終了したイベントはもう変わらないので yearly にして、クロール枠を開催前へ回す。
    """
    today = datetime.now(JST).date()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for ev, slug, start in live:
        created = to_jst(ev.get("created_at"))
        upcoming = start.date() >= today
        lines.append("  <url>")
        lines.append(f"    <loc>{SITE_BASE}/event/{slug}/</loc>")
        if created:
            lines.append(f"    <lastmod>{created.date().isoformat()}</lastmod>")
        lines.append(f"    <changefreq>{'weekly' if upcoming else 'yearly'}</changefreq>")
        lines.append(f"    <priority>{'0.7' if upcoming else '0.4'}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    events = (supabase.table("events")
              .select("id,event_name,event_date,event_date_end,location,fee,url,"
                      "description,target_car_type,owner_name,created_at")
              .order("event_date").execute().data or [])

    slug_map = {}
    if os.path.exists(SLUG_MAP_PATH):
        with open(SLUG_MAP_PATH, encoding="utf-8") as f:
            slug_map = json.load(f)
    added = assign_slugs(events, slug_map)

    written, live = 0, []
    for ev in events:
        start = to_jst(ev.get("event_date"))
        if not start:
            print(f"  スキップ（開催日が読めない）: {ev.get('event_name')}")
            continue
        slug = slug_map[ev["id"]]
        out_dir = os.path.join(OUT_DIR, slug)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8", newline="\n") as f:
            f.write(render(ev, slug, start, to_jst(ev.get("event_date_end"))))
        written += 1
        live.append((ev, slug, start))

    # 手で event-slugs.json のslugを直したときや、イベントがDBから消えたときに
    # 古いフォルダが残り続けると、消したはずのURLが生き続けてしまう。毎回掃除する。
    removed = []
    keep = set(slug_map.values())
    for name in os.listdir(OUT_DIR) if os.path.isdir(OUT_DIR) else []:
        path = os.path.join(OUT_DIR, name)
        if os.path.isdir(path) and name not in keep:
            shutil.rmtree(path)
            removed.append(name)

    with open(SLUG_MAP_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(slug_map, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    with open(REVIEW_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(render_review(live, fetch_participant_counts(supabase)))

    with open(SITEMAP_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(render_sitemap(live))

    print(f"生成: {written} ページ（event/<slug>/index.html）")
    print(f"sitemap: {os.path.basename(SITEMAP_PATH)} （{len(live)} URL）")
    print(f"確認用一覧: {os.path.basename(REVIEW_PATH)} （/event-review）")
    if removed:
        print(f"古いフォルダを削除 {len(removed)} 件: {', '.join(removed[:5])}"
              + (" ほか" if len(removed) > 5 else ""))
    if added:
        print(f"新しくURLを割り当てたイベント {len(added)} 件:")
        for _id, slug, nm in added:
            print(f"  /event/{slug}/  ← {nm}")
    if NOINDEX:
        print("※ NOINDEX=True のため検索避けが入っています（公開時に False へ）")


if __name__ == "__main__":
    main()
