# -*- coding: utf-8 -*-
"""
イベント探索スクリプト（週次メール配信）

イベントページ再構成 第2段階（events-portal/HANDOFF.md §2-6・§2-7）の実装。

何をするか
----------
週に1回、日本国内の旧車・クラシックカー系イベントをウェブ検索（Gemini の
検索グラウンディング）で探し、まだ `events` テーブルに載っていない・
過去にメール済みでもないものだけを候補として管理人1人にメールする。

絶対に守る設計（events-portal/HANDOFF.md の不変条件8〜10に対応）
----------------------------------------------------------------
1. `events` テーブルには一切書き込まない（読むだけ）。載せる判断と入力は
   必ず人間がやる。イベントの自動下書きは作らない。
2. サイトのHTMLも生成しない。出力はメールと `event_discovery_log` への
   記録だけ。
3. SNS（Instagram/Facebook/X/Twitter）は自動収集の対象外。
4. 判定は絞りすぎない。人間が目で見て取捨選択する前提なので、ノイズ0を
   狙って漏らすより、多少ノイズがある方がよい。
5. 候補が0件の週でも必ずメールを送る（沈黙は故障と区別できないため）。

探索の2本柱
------------
A. 定点巡回: 既存 events の url 列 ＋ event_discovery_log の url 列から
   ホストを集め、`site:<ホスト> ...` で検索する（＝管理人が実際に情報を
   得ている先を追い続ける。見つかった先は次回以降の巡回先に自動で育つ）。
   HTMLを直接取ってパースするやり方は、サイトごとに構造が違い改装で
   静かに壊れるため採らない。`site:` 検索なら Google のインデックス任せ
   で壊れない。
B. 一般検索: キーワード×地域×時期 の組み合わせで、FIAT専門に絞らず
   広く旧車・イタリア車・オフ会系のイベント告知を探す。

環境変数は py/.env から読む（send_report.py と同じ手書きパーサを踏襲）。
使い方:
  python py/find_events.py                 # 本番実行（メール送信＋台帳記録）
  python py/find_events.py --dry-run        # メール送信・台帳記録をせず標準出力へ
  python py/find_events.py --limit 5        # 使うクエリ数を5件に絞る（疎通確認用）
"""
import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from html import escape, unescape
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests
from google import genai
from google.genai import types

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE, "py", ".env")

# --- 環境変数の読み込み（send_report.py 1〜27行目と同じ手書きパーサを踏襲） ---
env = {}
for line in open(ENV_PATH, encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k] = v

SUPA_URL = env["SUPABASE_URL"].rstrip("/")
SUPA_KEY = env.get("SUPABASE_SERVICE_KEY") or env["SUPABASE_KEY"]
GEMINI_API_KEY = env["GEMINI_API_KEY"]
BREVO_KEY = env["BREVO_API_KEY"]

SENDER_EMAIL = "news@registro500.com"
SENDER_NAME = "Registro500 Giappone"
TO_EMAIL = "registro500giappone@gmail.com"

UA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Registro500EventBot/1.0; +https://www.registro500.com)",
    "Accept-Language": "ja,en;q=0.5",
}

# 都道府県（gen_event_pages.py 90行目付近の PREFECTURES と同じ表記・並びを踏襲。
# gen_event_pages.py 自体は編集しないので、ここに複製する）。
PREFECTURES = [
    "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
    "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川",
    "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知",
    "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
    "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知",
    "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄",
]

# SNSは自動収集の対象外（確定済みの方針）。定点巡回のホスト種からも
# 一般検索の結果からも、この一覧に該当するものは落とす。
SNS_DOMAINS = ("instagram.com", "facebook.com", "x.com", "twitter.com")

# 一般検索のキーワード。FIAT専門に絞らず広く（管理人の指示）。
KEYWORDS = [
    "旧車", "クラシックカー", "ヒストリックカー", "イタリア車",
    "カーミーティング", "モーニングクルーズ", "オールドカー",
]

# 地域は8地方区分。日本国内のみ（海外は対象外）。
REGIONS = ["北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州沖縄"]

# 一般検索1クエリあたり、地域ごとに使うキーワード×時期の組み合わせ数。
# 8地域 × 3 = 24件（定点巡回の十数件と合わせて週あたり40件目安に収まる）。
GENERAL_COMBOS_PER_REGION = 3

JST = timezone(timedelta(hours=9))

# 既存イベントとのイベント名突合（部分一致）で「含まれる側」の正規化後の
# 長さがこの文字数未満なら不採用にする下限。2〜3文字の地名や「ミーティング」
# 「オフ会」のような一般名詞だけの短い一致は無関係イベント同士でも
# 容易に起きてしまうため、固有名詞相当の実質的な長さ（6文字）を下限にした
# （例: "LaFestaAutunno" のように地名や催事名がひとまとまりで入っている長さ）。
NAME_SUBSTR_MIN_LEN = 6

# 既存イベントとのホスト＋開催日突合で「同一イベント」とみなす日数差の許容幅。
# 複数日開催のラリー・ミーティングは、告知元によって初日と最終日の
# どちらを代表日として載せるかがぶれるため、同じホストで数日以内の
# ずれは同一イベントの表記ゆれとみなす。
HOST_DATE_PROXIMITY_DAYS = 3


def sb_get(table, select="*", extra=""):
    """Supabase REST(PostgREST) へのGET。send_report.py の sb() と同じ形。"""
    url = f"{SUPA_URL}/rest/v1/{table}?select={select}"
    if extra:
        url += "&" + extra
    req = urllib.request.Request(url, headers={
        "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY})
    return json.load(urllib.request.urlopen(req, timeout=40))


def sb_insert_ignore_dup(table, rows, conflict_col):
    """UNIQUE制約に衝突したら無視する挿入（台帳への書き込み専用）。"""
    if not rows:
        return
    url = f"{SUPA_URL}/rest/v1/{table}?on_conflict={conflict_col}"
    req = urllib.request.Request(
        url,
        data=json.dumps(rows).encode("utf-8"),
        headers={
            "apikey": SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates,return=minimal",
        },
        method="POST",
    )
    urllib.request.urlopen(req, timeout=40)


# --- URL・イベント名の正規化（既知イベントとの突合・台帳の重複排除に使う） ---

def normalize_url(url):
    """URLを比較用キーに正規化する。
    scheme を https に統一・www. 除去・クエリ/フラグメント除去・
    末尾スラッシュ除去・小文字化。
    """
    if not url:
        return ""
    u = url.strip()
    u = re.sub(r"^http://", "https://", u, flags=re.I)
    if not u.startswith("https://"):
        u = "https://" + u
    u = re.sub(r"^https://www\.", "https://", u, flags=re.I)
    u = u.split("?", 1)[0].split("#", 1)[0]
    u = u.rstrip("/")
    return u.lower()


def strip_tracking_params(url):
    """計測用のクエリだけを落とす。`?eid=00006` のような、そのページを
    指すのに必須のパラメータは残す（normalize_url と違い表示用）。
    """
    if not url or "?" not in url:
        return url
    sp = urlsplit(url)
    kept = [(k, v) for k, v in parse_qsl(sp.query, keep_blank_values=True)
            if not (k.lower().startswith(("utm_", "mc_")) or k.lower() in
                    {"fbclid", "gclid", "yclid", "msclkid", "ref", "ref_src"})]
    return urlunsplit((sp.scheme, sp.netloc, sp.path, urlencode(kept), sp.fragment))


def normalize_event_name(name):
    """イベント名を比較用キーに正規化する。
    全角/半角の揺れ(NFKC)・年号・空白・記号を除いて比較できるようにする。
    同じイベントが別URLで出てくるケースの突合に使うため、
    「今年の年号だけ違う同一イベント」を意図的に同一視する。
    """
    if not name:
        return ""
    s = unicodedata.normalize("NFKC", name)
    s = re.sub(r"(19|20)\d{2}年?", "", s)  # 年号（19xx/20xx）を除去
    # 空白・主な記号（全角/半角の括弧・区切り記号等）を除去
    s = re.sub(r"[\s　!-/:-@\[-`{-~！-／：-＠［-｀｛-～、。・「」『』【】（）]+", "", s)
    return s.lower()


def loose_event_name(name):
    """開催回数の表記まで落とした、ゆるい比較用キー。

    同じ回のイベントでも告知元によって「2026 vol.2」と書いたり
    「第2回」と書いたりするため、回数を残したままでは突合できない
    （実例＝西日本スポーツカーフェス at イオンモール高松 10/4 が、
    この違いだけで3回メールに載った）。

    ただし回数を落とすと、月例の定例イベントが回どうしで一致してしまう
    （実例＝さくらモーニングクルーズ Vol.151 / 152 / 154 は別々の回）。
    **このキーは開催日がほぼ同じ（HOST_DATE_PROXIMITY_DAYS 以内）と
    分かっているときにだけ使うこと**。単独で同一判定に使ってはいけない。
    """
    if not name:
        return ""
    s = unicodedata.normalize("NFKC", name)
    s = re.sub(r"第\s*\d+\s*回", " ", s)
    s = re.sub(r"vol\s*\.?\s*\d+", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"#\s*\d+", " ", s)
    return normalize_event_name(s)


def same_day_variant(loose_key, event_date, other_loose_key, other_date):
    """回数の書き方だけが違う「同じ日の同じイベント」か。

    開催日がほぼ同じであることを先に確かめてから、回数を落とした名前で
    突合する。日付という強い手がかりがあるため、定例イベントの別の回を
    取り違える心配がない。
    """
    if not (event_date and other_date):
        return False
    if abs((event_date - other_date).days) > HOST_DATE_PROXIMITY_DAYS:
        return False
    return name_key_matches(loose_key, other_loose_key)


def to_jst_date(ts):
    """DBのtimestamptz文字列をJSTの日付(date)に直す。空/不正ならNone。
    gen_event_pages.py の to_jst() と同じ考え方（UTCの日付部分をそのまま
    使うと1日ずれるため、必ずJSTへ直してから日付を取り出す）。
    """
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(JST).date()
    except ValueError:
        return None


def name_key_matches(name_key, known_name_key):
    """正規化済みイベント名どうしの一致判定（完全一致 or 部分一致）。
    片方がもう片方に含まれていれば同一イベントとみなす。ただし短い名前
    での誤爆を避けるため、含まれる側（＝短い方）の長さが
    NAME_SUBSTR_MIN_LEN 以上のときだけ部分一致を適用する。
    """
    if not name_key or not known_name_key:
        return False
    if name_key == known_name_key:
        return True
    if len(name_key) <= len(known_name_key):
        shorter, longer = name_key, known_name_key
    else:
        shorter, longer = known_name_key, name_key
    return len(shorter) >= NAME_SUBSTR_MIN_LEN and shorter in longer


def is_known_event(url_key, name_key, loose_key, host, event_date, known_events):
    """候補が既存 events のいずれかと同一イベントかどうかを判定する。
    次の4種類のいずれかで一致すれば既知とみなす。
    1. URL正規化キーの完全一致
    2. イベント名の正規化キーの一致（完全一致・部分一致）
    3. 同じホスト かつ 開催日の差が HOST_DATE_PROXIMITY_DAYS 日以内
       （日付不明の候補には適用しない）
    4. 開催日がほぼ同じ かつ 回数の表記だけが違う同名イベント
    """
    for ke in known_events:
        if url_key and ke["url_key"] and url_key == ke["url_key"]:
            return True
        if name_key_matches(name_key, ke["name_key"]):
            return True
        if (event_date and ke["date"] and host and ke["host"] and host == ke["host"]
                and abs((event_date - ke["date"]).days) <= HOST_DATE_PROXIMITY_DAYS):
            return True
        if same_day_variant(loose_key, event_date, ke["loose_key"], ke["date"]):
            return True
    return False


def is_already_sent(name_key, loose_key, event_date, log_named):
    """過去にメールした候補と同じ回の同じイベントか。

    URLだけで見ていると、同じイベントが別サイトのURLで毎週上がってくる
    （実例＝西日本スポーツカーフェスが arc-group.club と nicetown.co.jp）。
    ただし名前だけで切ると来年の同名イベントも消えるので、開催日が
    近いことを条件にする。どちらかの日付が無いときは同名なら同じとみなす。

    名前が完全に揃わなくても、開催日がほぼ同じで回数の書き方だけが違う
    ものは同じ回とみなす（同上の実例が3度目に「第2回 …」の表記で来た）。
    """
    if not name_key:
        return False
    for e in log_named:
        if same_day_variant(loose_key, event_date, e["loose_key"], e["date"]):
            return True
        if not name_key_matches(name_key, e["name_key"]):
            continue
        if event_date and e["date"]:
            if abs((event_date - e["date"]).days) <= 30:
                return True
        else:
            return True
    return False


def extract_host(url):
    """URLからホスト名を取り出す（www.は外す）。取れなければNone。"""
    if not url:
        return None
    try:
        host = urlsplit(url).netloc.lower()
    except Exception:
        return None
    if host.startswith("www."):
        host = host[4:]
    return host or None


def is_sns_host(host):
    if not host:
        return False
    return any(host == d or host.endswith("." + d) for d in SNS_DOMAINS)


def is_sns_url(url):
    return is_sns_host(extract_host(url))


# --- 投稿フォームの下書きリンク ---
# 候補ごとに /event の投稿フォームを開き、機械が分かっている欄だけ埋めた状態に
# するリンクを作る。DBには一切書かない＝載せる判断と保存は人間が行う（不変条件2）。
# 受け側は event.html の stashDraftFromUrl() / applyDraftIfAny()。
SITE_URL = "https://www.registro500.com"


def draft_link(c):
    """候補1件から、投稿フォームを開く下書きURLを作る。

    埋めるのは4欄（イベント名・開催日・開催場所・ウェブサイトURL）だけ。
    開催時間・費用・詳細は告知ページでの書かれ方がばらばらで、機械が読み違えた
    まま欄に入ると気づかず保存されるため埋めない（構造化データで offers を
    出さないのと同じ理由）。判定理由は機械の推測なので載せない。
    """
    loc = (c.get("location") or "").strip()
    pref = (c.get("prefecture") or "").strip()
    # 既存データに合わせて「都道府県＋改行＋会場」の形にする。
    # 都道府県が場所の文字列に既に含まれていれば二重に書かない。
    if pref and pref not in loc:
        loc = f"{pref}\n{loc}" if loc else pref
    params = {
        "draft": "1",
        "name": (c.get("event_name") or "").strip(),
        "loc": loc,
        "url": c.get("url") or "",
    }
    if "_date" in c:
        params["date"] = c["_date"].isoformat()
    return f"{SITE_URL}/event?" + urlencode(params)


# --- 検索クエリの組み立て ---

def add_months(d, n):
    """日付dにnヶ月加える（外部ライブラリ非依存の簡易実装）。"""
    m0 = d.month - 1 + n
    y = d.year + m0 // 12
    m = m0 % 12 + 1
    # 月末日の食い違い対策（29〜31日を安全な範囲に切り詰める）。
    for day in (d.day, 28, 29, 30, 31):
        try:
            return d.replace(year=y, month=m, day=day)
        except ValueError:
            continue
    return d.replace(year=y, month=m, day=1)


def month_phrases(start, n):
    """startを含めてnヶ月分の『YYYY年M月』文字列を返す。"""
    phrases = []
    for i in range(n):
        d = add_months(start, i)
        phrases.append(f"{d.year}年{d.month}月")
    return phrases


def build_queries(known_hosts, log_hosts, today, limit=None):
    """定点巡回(site:)＋一般検索のクエリ一覧を組み立てる。

    各クエリは {"query": 検索語, "found_via": メールに出す経路表記} の辞書。
    定点巡回を先に、一般検索を後に積むので --limit で絞ると定点巡回が
    優先的に残る（既知の情報源を優先確認する方が実利が大きい）。
    """
    queries = []

    # A. 定点巡回：既存events＋台帳のURLホストのうちSNSでないもの。
    #    台帳のホストも合流させるので、探索で見つかった先が次回以降の
    #    巡回先に自動で育つ。
    hosts = sorted({h for h in (known_hosts | log_hosts) if h and not is_sns_host(h)})
    for host in hosts:
        queries.append({
            "query": f"site:{host} {today.year}年 イベント OR 集会 OR ミーティング 開催",
            "found_via": f"定点巡回:{host}",
        })

    # B. 一般検索：キーワード×時期の組合せを、地域ごとに
    #    GENERAL_COMBOS_PER_REGION 件だけ選ぶ。全組合せ(7語×6ヶ月=42通り)を
    #    毎週使うと問い合わせが多すぎるため、週番号を種にして少しずつ
    #    ローテーションさせる（数ヶ月かけて全組合せを一巡する）。
    #    ランダムでなく決定的にしているのは、同じ週に何度実行しても
    #    結果が変わらないようにするため。
    time_phrases = month_phrases(today.replace(day=1), 6)
    combos = [(kw, ph) for kw in KEYWORDS for ph in time_phrases]
    week_index = today.toordinal() // 7
    for ri, region in enumerate(REGIONS):
        start = (week_index * len(REGIONS) + ri * GENERAL_COMBOS_PER_REGION) % len(combos)
        for i in range(GENERAL_COMBOS_PER_REGION):
            kw, ph = combos[(start + i) % len(combos)]
            queries.append({
                "query": f"{region} {kw} {ph} イベント 開催 旧車",
                "found_via": f"一般検索:{region}/{kw}/{ph}",
            })

    if limit is not None:
        queries = queries[:limit]
    return queries


# --- Gemini 検索グラウンディング ---

SEARCH_PROMPT = """あなたは日本国内の旧車・クラシックカー関連イベントを集めるリサーチャーです。
次の検索語でウェブ検索し、日本国内で開催される（開催予定を含む）旧車・クラシックカー系の
イベント告知ページを探してください。対象は旧車全般・イタリア車・輸入車のオフ会や
モーニングクルーズ、カーミーティングなども含みます（FIATに限りません）。
Instagram・Facebook・X（旧Twitter）の投稿は対象外です（サイト自体の告知ページのみ）。
海外開催のイベントは対象外です。

検索語: {query}

見つかった告知ごとに、以下の形のJSON配列だけを出力してください。前後に説明文や
```のようなコードブロック記号は付けないでください。1件も見つからなければ
空配列 [] を返してください。

[
  {{
    "event_name": "イベント名",
    "event_date": "YYYY-MM-DD（開催日が不明ならnull）",
    "location": "会場や地域を表す文字列",
    "prefecture": "都道府県（例: 東京。不明ならnull）",
    "url": "告知ページの実際のURL",
    "reason": "旧車・クラシックカー系イベントの告知だと判断した理由を一言"
  }}
]
"""

_client = None


def gemini_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def parse_json_candidates(text):
    """Geminiの応答テキストからJSON配列を取り出す。失敗したら空配列を返す。"""
    if not text:
        return []
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    data = None
    try:
        data = json.loads(t)
    except json.JSONDecodeError:
        m = re.search(r"\[.*\]", t, re.S)
        if m:
            try:
                data = json.loads(m.group(0))
            except json.JSONDecodeError:
                data = None
    if isinstance(data, dict):
        data = data.get("events") or data.get("candidates") or []
    if not isinstance(data, list):
        return []
    return [d for d in data if isinstance(d, dict) and d.get("url")]


def resolve_redirect(uri):
    """grounding_chunks の vertexaisearch リダイレクトURLを実URLへ解決する。
    失敗したら諦めてNoneを返す（呼び出し側でスキップする前提）。
    """
    try:
        r = requests.head(uri, allow_redirects=True, timeout=10, headers=UA_HEADERS)
        if r.url and r.url != uri:
            return r.url
        r = requests.get(uri, allow_redirects=True, timeout=10, headers=UA_HEADERS, stream=True)
        return r.url
    except Exception:
        return None


def search_events(query):
    """1クエリぶんのGemini検索を実行し、(候補リスト, 解決済みURL一覧)を返す。

    候補リストの各要素は本文JSONから取れたイベント情報（URLはモデルが
    本文中に書いた文字列なのでハルシネーションの可能性がある＝後段の
    実在確認が必須）。解決済みURL一覧は grounding_chunks のリダイレクトを
    解決した実URLで、本文URLが実在確認で落ちたときの救済に使う。
    """
    client = gemini_client()
    prompt = SEARCH_PROMPT.format(query=query)
    resp = client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
        ),
    )
    candidates = parse_json_candidates(getattr(resp, "text", None))

    resolved_urls = []
    try:
        gm = resp.candidates[0].grounding_metadata
        for chunk in (gm.grounding_chunks or []):
            if chunk.web and chunk.web.uri:
                real = resolve_redirect(chunk.web.uri)
                if real:
                    resolved_urls.append(real)
    except Exception:
        pass

    return candidates, resolved_urls


# --- URL実在確認とページ内容の照合 ---

# ページ本文の読み込み上限。照合に必要なのは冒頭だけなので、
# 巨大ページを丸ごと落とさないよう打ち切る。
MAX_PAGE_BYTES = 300_000


def decode_html(raw, resp):
    """バイト列を文字列へ。旧車系サイトは Shift_JIS / EUC-JP も現役なので、
    ヘッダ→metaタグ→よくある順、で総当たりする。
    """
    enc = None
    m = re.search(r"charset=([\w\-]+)", resp.headers.get("Content-Type", ""), re.I)
    if m:
        enc = m.group(1)
    if not enc:
        m = re.search(rb'charset=["\']?([\w\-]+)', raw[:4096], re.I)
        if m:
            enc = m.group(1).decode("ascii", "ignore")
    for e in [enc, "utf-8", "cp932", "euc-jp"]:
        if not e:
            continue
        try:
            return raw.decode(e)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace")


def fetch_url(url):
    """URLへ実際にアクセスし、200が返るかとページ本文を取得する。
    戻り値: (生きているか, リダイレクト後の最終URL, ページ本文のテキスト)

    本文まで取るのは、200が返っても中身が目的のイベント告知とは限らない
    ため（実例＝存在しないIDでトップページを200で返す・会場サイトの
    アクセス案内ページを指している）。判定は page_looks_like_event() 側。
    """
    try:
        r = requests.get(url, allow_redirects=True, timeout=15, headers=UA_HEADERS, stream=True)
        if r.status_code != 200:
            return False, None, ""
        buf = b""
        for chunk in r.iter_content(8192):
            buf += chunk
            if len(buf) >= MAX_PAGE_BYTES:
                break
        r.close()
        return True, r.url, decode_html(buf, r)
    except Exception:
        return False, None, ""


def html_to_text(html):
    """タグとscript/styleを落として素のテキストにする。"""
    s = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    return unescape(s)


# イベント名のうち固有性の低い語。照合ではこれらを除いた「いちばん長い
# トークン」＝そのイベント固有の語がページ本文にあるかを見る。
GENERIC_WORDS_JA = sorted([
    "クラシックカー", "オールドカー", "カーミーティング", "ヒストリックカー",
    "スポーツカー", "フェスティバル", "ミーティング", "ミーテイング",
    "オフミーティング", "カーフェスタ", "カーフェス", "クラシック", "ツーリング",
    "オフ会", "展示会", "博覧会", "マーケット", "イベント", "ラリー", "ショー",
    "フェスタ", "フェス", "旧車", "名車", "自動車", "カー", "祭典", "祭り", "祭",
], key=len, reverse=True)  # 長い語から消す（「カーフェスタ」を「カーフェス」より先に）
GENERIC_WORDS_EN = {
    "classic", "classics", "car", "cars", "show", "shows", "meeting", "meet",
    "meetings", "event", "events", "festival", "fest", "market", "rally",
    "club", "japan", "japanese", "vintage", "old", "auto", "autos", "motor",
    "motors", "the", "in", "at", "of", "and", "vol", "day", "days", "annual",
    "west", "east", "north", "south",
}
# 地名は「その土地の別ページ」と一致してしまうので照合の手がかりにしない。
GENERIC_PLACE_WORDS = set(PREFECTURES) | {
    "東京都", "大阪府", "京都府", "北海道", "関東", "北関東", "南関東", "関西",
    "近畿", "中部", "東海", "北陸", "甲信越", "東北", "中国", "四国", "九州",
    "九州沖縄", "西日本", "東日本", "全国",
}


def event_key_tokens(name):
    """イベント名から固有性の高いトークンを取り出す（一般語・地名を除く）。

    地名を外すのは、会場サイトの無関係なページが地名だけで一致してしまう
    ため（実例＝「クラシックカーコネクション in 九州」が北九州メディアドームの
    アクセス案内ページと「九州」で一致した）。
    """
    if not name:
        return []
    s = unicodedata.normalize("NFKC", name).lower()
    s = re.sub(r"第\s*\d+\s*回", " ", s)
    s = re.sub(r"(19|20)\d{2}年?", " ", s)
    for w in GENERIC_WORDS_JA:  # 長い語から順に消す（リストの並び順が効く）
        s = s.replace(w.lower(), " ")
    parts = re.split(r"[^0-9a-z぀-ヿ一-鿿]+", s)
    tokens = []
    for p in parts:
        if len(p) < 2:
            continue
        if p in GENERIC_WORDS_EN or p in GENERIC_PLACE_WORDS:
            continue
        tokens.append(p)
    return tokens


def date_variants(d):
    """ページ内での開催日の書かれ方の候補（空白を除いた形）。"""
    return [
        f"{d.year}年{d.month}月{d.day}日",
        f"{d.month}月{d.day}日",
        d.isoformat(),
        f"{d.year}/{d.month}/{d.day}",
        f"{d.year}/{d.month:02d}/{d.day:02d}",
        f"{d.month}/{d.day}",
        f"{d.month:02d}/{d.day:02d}",
        f"{d.year}.{d.month}.{d.day}",
    ]


def page_looks_like_event(page_text, event_name, event_date):
    """取得したページが本当にそのイベントの告知かを緩く確かめる。

    イベント固有の語か開催日のどちらかが本文にあれば通す（OR）。
    絞りすぎない方針（不変条件・§2-6）なので、判定材料が無いときは通す。
    落ちたものも捨てず、メールでは「URL要確認」として別枠に出す。
    """
    if not page_text:
        return True  # 本文が取れなかった＝判定材料なし。人間に見てもらう
    text = unicodedata.normalize("NFKC", html_to_text(page_text)).lower()
    text = re.sub(r"\s+", "", text)  # 改行やタグ跡での分断を避けるため空白を潰す
    tokens = event_key_tokens(event_name)
    if any(t in text for t in tokens):
        return True
    if event_date and any(v in text for v in date_variants(event_date)):
        return True
    if not tokens and not event_date:
        return True  # 照合の手がかりが無いので判断しない
    return False


# --- メイン処理 ---

def main():
    parser = argparse.ArgumentParser(description="日本国内の旧車イベントを週次で探索し、新規候補をメールする")
    parser.add_argument("--dry-run", action="store_true", help="メール送信・台帳記録をせず標準出力へ出す")
    parser.add_argument("--limit", type=int, default=None, help="使うクエリ数を絞る（疎通確認用）")
    parser.add_argument("--html-out", default=None,
                        help="--dry-run のとき、メールのHTML版をこのパスへ書き出す（見た目の確認用）")
    args = parser.parse_args()

    today = date.today()
    window_end = add_months(today, 6)

    # 既存の events（読むだけ）と event_discovery_log（既出の突合・ホスト種）を取得。
    events = sb_get("events", select="url,event_name,event_date")
    log_rows = sb_get("event_discovery_log", select="url_key,url,event_name,event_date")

    # 既存イベントとの突合用（URL完全一致／イベント名一致／ホスト＋日付近接の3種）。
    known_events = [{
        "url_key": normalize_url(e.get("url")),
        "name_key": normalize_event_name(e.get("event_name")),
        "loose_key": loose_event_name(e.get("event_name")),
        "host": extract_host(e.get("url")),
        "date": to_jst_date(e.get("event_date")),
    } for e in events]

    log_url_keys = {row["url_key"] for row in log_rows if row.get("url_key")}

    # 同じイベントが別URLで毎週上がってくるのを止めるための突合材料
    # （実例＝西日本スポーツカーフェスが arc-group.club と nicetown.co.jp の
    # 2つのURLで別々に上がった）。年をまたいだ同名の別回は送りたいので、
    # 開催日が近いことも条件にする。
    log_named = [{
        "name_key": normalize_event_name(row.get("event_name")),
        "loose_key": loose_event_name(row.get("event_name")),
        "date": to_jst_date(row.get("event_date")),
    } for row in log_rows if row.get("event_name")]

    known_hosts = {extract_host(e.get("url")) for e in events}
    log_hosts = {extract_host(row.get("url")) for row in log_rows}

    queries = build_queries(known_hosts, log_hosts, today, limit=args.limit)
    n_site = sum(1 for q in queries if q["found_via"].startswith("定点巡回"))
    n_general = len(queries) - n_site

    print(f"[find_events] クエリ {len(queries)}件（定点巡回{n_site}／一般検索{n_general}）を実行します…")

    raw_candidates = []
    for q in queries:
        try:
            cands, resolved_urls = search_events(q["query"])
        except Exception as e:
            # 1クエリの失敗（API障害・タイムアウト等）で全体を止めない。
            print(f"  [警告] クエリ失敗（スキップ）: {q['query']!r} -> {e}")
            continue
        for c in cands:
            c["_found_via"] = q["found_via"]
            c["_resolved_urls"] = resolved_urls
            raw_candidates.append(c)

    counters = {
        "raw": len(raw_candidates),
        "dead": 0,
        "sns": 0,
        "known": 0,
        "log_dup": 0,
        "date_out": 0,
        "url_repaired": 0,
    }

    seen_this_run = set()
    seen_names = set()
    # 今回の実行で既に採用した候補（過去分＝log_named と同じ形で持ち、
    # 回数の表記だけが違う同じ日のイベントを1回の実行の中でも弾く）。
    seen_named = []
    kept_dated = []
    date_unknown = []

    for c in raw_candidates:
        url = (c.get("url") or "").strip()
        if not url:
            counters["dead"] += 1
            continue

        # 1. URL実在確認（LLMがでっち上げたURLを止める）。本文も一緒に取る。
        alive, final_url, page_text = fetch_url(url)
        if not alive:
            # 本文URLが死んでいても、同じクエリのgrounding_chunksの中に
            # 同じホストの実URLがあれば差し替えて救済する。
            host = extract_host(url)
            repaired = None
            for ru in c.get("_resolved_urls", []):
                if extract_host(ru) == host:
                    ok, fu, ptext = fetch_url(ru)
                    if ok:
                        repaired = fu or ru
                        page_text = ptext
                        break
            if repaired:
                url = repaired
            else:
                counters["dead"] += 1
                continue
        else:
            url = final_url or url

        # 2. SNSは対象外（本文にSNSのURLが混じった場合の保険）。
        if is_sns_url(url):
            counters["sns"] += 1
            continue

        url_key = normalize_url(url)
        name_key = normalize_event_name(c.get("event_name"))
        loose_key = loose_event_name(c.get("event_name"))
        host = extract_host(url)

        # 開催日をここで解析する（3の「ホスト＋日付近接」判定に使うため、
        # 開催日の窓チェックより先に済ませておく）。
        date_str = (c.get("event_date") or "").strip() if isinstance(c.get("event_date"), str) else None
        parsed = None
        if date_str and date_str.lower() != "null":
            try:
                parsed = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                parsed = None

        # 3. ページ内容の照合。200が返っても告知ページとは限らないため
        #    （実例＝存在しないIDでトップを200で返す／会場のアクセス案内ページ）。
        #    落ちたときは同じクエリの検索結果URLの中から通るものを探して差し替え、
        #    それでも駄目なら捨てずに「URL要確認」の印を付けて人間に見てもらう。
        url_ok = page_looks_like_event(page_text, c.get("event_name"), parsed)
        if not url_ok:
            for ru in c.get("_resolved_urls", []):
                if is_sns_url(ru) or normalize_url(ru) == url_key:
                    continue
                alive2, final2, text2 = fetch_url(ru)
                if alive2 and page_looks_like_event(text2, c.get("event_name"), parsed):
                    url = final2 or ru
                    url_key = normalize_url(url)
                    host = extract_host(url)
                    url_ok = True
                    counters["url_repaired"] += 1
                    break
        c["_url_ok"] = url_ok

        # 4. 既存イベントとの突合（URL一致／イベント名一致／ホスト＋日付近接）。
        if is_known_event(url_key, name_key, loose_key, host, parsed, known_events):
            counters["known"] += 1
            continue

        # 5. 既出の除外。URLが同じ場合に加え、URLが違っても同じ回の同じ
        #    イベントなら二度は送らない（過去にメール済み／今回すでに拾った分）。
        if url_key in log_url_keys or url_key in seen_this_run:
            counters["log_dup"] += 1
            continue
        if (is_already_sent(name_key, loose_key, parsed, log_named + seen_named)
                or (name_key and name_key in seen_names)):
            counters["log_dup"] += 1
            continue
        seen_this_run.add(url_key)
        if name_key:
            seen_names.add(name_key)
            seen_named.append({"name_key": name_key, "loose_key": loose_key, "date": parsed})

        c["url"] = strip_tracking_params(url)
        c["_url_key"] = url_key

        # 6. 開催日の窓（今日から6ヶ月以内）。日付不明は別枠へ回す。
        if parsed:
            if parsed < today or parsed > window_end:
                counters["date_out"] += 1
                continue
            c["_date"] = parsed
            kept_dated.append(c)
        else:
            date_unknown.append(c)

    kept_dated.sort(key=lambda c: c["_date"])
    total_kept = len(kept_dated) + len(date_unknown)

    # --- メール本文の組み立て ---
    # URLがそのイベントの告知ページか確認できなかったものは、捨てずに
    # 末尾へ回す（イベント自体は実在することが多く、探し直せば拾えるため）。
    ok_dated = [c for c in kept_dated if c.get("_url_ok")]
    ok_unknown = [c for c in date_unknown if c.get("_url_ok")]
    doubtful = [c for c in kept_dated + date_unknown if not c.get("_url_ok")]

    lines = []
    lines.append(f"今回投げたクエリ数: {len(queries)}件（定点巡回{n_site}／一般検索{n_general}）")
    lines.append(f"生の候補数: {counters['raw']}件")
    lines.append(f"・URL実在確認で除外: {counters['dead']}件")
    lines.append(f"・SNSリンクのため除外: {counters['sns']}件")
    lines.append(f"・既存イベントと一致のため除外: {counters['known']}件")
    lines.append(f"・過去に送付済み/重複のため除外: {counters['log_dup']}件")
    lines.append(f"・開催日が対象期間外のため除外: {counters['date_out']}件")
    lines.append(f"・URLを検索結果のものへ差し替え: {counters['url_repaired']}件")
    lines.append(f"→ 新規候補: {total_kept}件（日付確定{len(kept_dated)}／日付未確定{len(date_unknown)}）")
    if doubtful:
        lines.append(f"　※うち{len(doubtful)}件はURLが告知ページか怪しく、末尾に分けています")
    lines.append("")
    summary_lines = list(lines)  # 集計部分はHTML版でも同じものを使う

    def format_item(c, with_date):
        out = [f"・{c.get('event_name') or '（イベント名不明）'}"]
        if with_date:
            out.append(f"  日付: {c['_date'].isoformat()}")
        loc = c.get("location") or "不明"
        pref = c.get("prefecture") or "都道府県不明"
        out.append(f"  場所: {loc}（{pref}）")
        out.append(f"  URL: {c['url']}")
        out.append(f"  見つけた経路: {c['_found_via']}")
        reason = c.get("reason")
        if reason:
            out.append(f"  判定理由: {reason}")
        out.append(f"  ▶ この内容でフォームを開く: {draft_link(c)}")
        return "\n".join(out)

    def format_item_html(c, with_date):
        out = ['<div style="margin:0 0 16px;padding:12px 14px;border:1px solid #dcd6c8;'
               'border-radius:6px;">']
        out.append('<div style="font-weight:bold;font-size:15px;margin-bottom:6px;">'
                   + escape(c.get("event_name") or "（イベント名不明）") + "</div>")
        if with_date:
            out.append(f'<div>日付: {c["_date"].isoformat()}</div>')
        out.append("<div>場所: " + escape(c.get("location") or "不明")
                   + "（" + escape(c.get("prefecture") or "都道府県不明") + "）</div>")
        out.append('<div>URL: <a href="' + escape(c["url"], quote=True) + '">'
                   + escape(c["url"]) + "</a></div>")
        out.append('<div style="color:#666;font-size:12px;">見つけた経路: '
                   + escape(c["_found_via"]) + "</div>")
        reason = c.get("reason")
        if reason:
            out.append('<div style="color:#666;font-size:12px;">判定理由: '
                       + escape(reason) + "</div>")
        out.append('<div style="margin-top:10px;"><a href="' + escape(draft_link(c), quote=True)
                   + '" style="display:inline-block;padding:8px 14px;background:#2f5d50;'
                   'color:#fff;text-decoration:none;border-radius:4px;font-size:14px;">'
                   "▶ この内容でフォームを開く</a></div>")
        out.append("</div>")
        return "".join(out)

    # 見出しごとに (題, 候補, 日付を出すか（Noneなら候補ごとに判定）, 注記) を並べ、
    # プレーンテキストとHTMLの両方を同じ順序で組み立てる。
    doubt_note = [
        "　イベント自体は実在しても、リンク先が会場案内やトップページの",
        "　ことがあります。載せる前に本当の告知ページを探してください。",
    ]
    sections = []
    if ok_dated:
        sections.append(("■ 開催日が分かっている候補", ok_dated, True, []))
    if ok_unknown:
        sections.append(("■ 日付未確定の候補（『今年も開催予定』等の告知）", ok_unknown, False, []))
    if doubtful:
        sections.append(("■ URL要確認の候補（ページにイベント名も開催日も見当たらなかった）",
                         doubtful, None, doubt_note))

    html_parts = []
    if total_kept == 0:
        lines.append("今回は新規候補はありませんでした。")
        html_parts.append("<p>今回は新規候補はありませんでした。</p>")
    else:
        for title, items, with_date, note in sections:
            if lines and lines[-1] != "":
                lines.append("")
            lines.append(title)
            lines.extend(note)
            html_parts.append('<h3 style="font-size:15px;margin:22px 0 6px;">'
                              + escape(title) + "</h3>")
            for n in note:
                html_parts.append('<p style="color:#666;font-size:12px;margin:0 0 10px;">'
                                  + escape(n.strip()) + "</p>")
            for c in items:
                wd = ("_date" in c) if with_date is None else with_date
                lines.append("")
                lines.append(format_item(c, with_date=wd))
                html_parts.append(format_item_html(c, with_date=wd))

    body_text = "\n".join(lines)

    # HTML版。中身はプレーンテキストと同じで、候補ごとに下書きリンクを押せる形にする。
    body_html = (
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\','
        'sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:640px;">'
        + '<p style="margin:0 0 12px;padding:10px 12px;background:#f4f1e8;border-radius:6px;'
          'font-size:13px;color:#555;">'
          "「▶ この内容でフォームを開く」を押すと /event の投稿フォームが開き、"
          "<b>イベント名・開催日・開催場所・URL</b> が入った状態になります。"
          "開催時間・費用・詳細は告知ページを見て手で足してください。"
          "<b>保存を押すまでサイトには載りません。</b></p>"
        + '<div style="white-space:pre-wrap;color:#666;font-size:12px;margin:0 0 8px;">'
        + escape("\n".join(summary_lines).rstrip()) + "</div>"
        + "".join(html_parts)
        + "</div>"
    )
    subject = f"🔎 イベント候補 {total_kept}件（{today.month:02d}/{today.day:02d}週）"

    if args.dry_run:
        print("=" * 60)
        print(f"件名: {subject}")
        print("=" * 60)
        print(body_text)
        print("=" * 60)
        if args.html_out:
            with open(args.html_out, "w", encoding="utf-8") as f:
                f.write(body_html)
            print(f"[find_events] HTML版を書き出しました: {args.html_out}")
        print("[find_events] --dry-run のため送信・台帳記録はしていません。")
        return

    payload = {
        "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
        "to": [{"email": TO_EMAIL}],
        "subject": subject,
        "textContent": body_text,
        "htmlContent": body_html,
    }
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={"api-key": BREVO_KEY, "Content-Type": "application/json", "Accept": "application/json"},
        method="POST")
    try:
        resp = json.load(urllib.request.urlopen(req, timeout=40))
        print("OK 送信完了:", resp.get("messageId"))
    except urllib.error.HTTPError as e:
        print("送信失敗:", e.code, e.read().decode())
        raise

    # メール送信が成功したあとに台帳へ記録する（送信失敗時に記録だけ進んで
    # 候補が埋もれるのを避けるため）。UNIQUE(url_key)への衝突は無視する。
    log_entries = []
    for c in kept_dated + date_unknown:
        log_entries.append({
            "url_key": c["_url_key"],
            "url": c["url"],
            "event_name": c.get("event_name"),
            "event_date": c["_date"].isoformat() if "_date" in c else None,
            "prefecture": c.get("prefecture"),
            "found_via": c["_found_via"],
        })
    try:
        sb_insert_ignore_dup("event_discovery_log", log_entries, conflict_col="url_key")
        print(f"[find_events] 台帳に{len(log_entries)}件記録しました。")
    except Exception as e:
        print(f"[find_events] 台帳への記録に失敗しました（メールは送信済み）: {e}")


if __name__ == "__main__":
    main()
