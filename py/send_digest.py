# -*- coding: utf-8 -*-
"""
朝ダイジェスト配信スクリプト（Brevo経由メール送信）

GAS の main.gs sendDailyDigest() からの移植。挙動は1:1で揃えてある。

なぜGASから移したか:
  2026-08-07 にSupabaseのレガシーAPIキー（anon/service_role）が無効化された。
  新形式のシークレットキー（sb_secret_）は User-Agent がブラウザに見えるリクエストを
  Supabase側が401で弾く仕様で、GASの UrlFetchApp は UA が
  "Mozilla/5.0 (compatible; Google-Apps-Script; ...)" 固定・変更不可のため、
  GASからシークレットキーでRESTを叩くことが原理的にできなくなった。
  レガシーキーは再有効化できるがローテーション手段が既に廃止されており、
  過去に公開リポジトリへ露出した service_role キーを無効化できないため戻せない。
  → Python + GitHub Actions（既に py/send_report.py が同じ形で稼働中）へ移した。

配信対象の判定はすべてDB側のフラグで決まる。スクリプトは状態を持たない。
  - 新規車両     cars.notification_sent = false        かつ 14日以内
  - 新規イベント  events.notification_sent = false      かつ 14日以内 かつ 開催日が今日以降
  - 新規ストーリー car_episodes.notification_sent = false かつ is_published = true かつ 14日以内
  - 新規車載手帳  equipment_records.notification_sent = false かつ is_public = true かつ 14日以内
                 （2026-09-09 追加。公開時から通知経路が無かったため後付け。
                   車に紐づかない手帳＝vehicle_id が null は行き先が無いので載せない）
  - 新規おすすめ工具 owner_tools.notification_sent = false かつ is_hidden = false かつ 14日以内
                 （2026-10-07 追加。TOOLS_DIGEST_ON が True のときだけ。オフの間はフラグも立てない）
  - マイ整備手帳  maint_records.digest_sent_at IS NULL かつ is_public かつ 作業日あり かつ 14日以内（1台1日1行）
                 （2026-10-29 追加。MAINT_DIGEST_ON が True のときだけ）
  - つないだ投稿 owner_articles.digest_sent_at IS NULL かつ is_hidden = false かつ 14日以内（貼った日）
                 （2026-10-29 追加。ARTICLES_DIGEST_ON が True のときだけ。載せた記事の書き手には「紹介しました」を1通）
  - お知らせ      news.sent_at IS NULL                  かつ 14日以内（最大5件）

宛先＝手放していない車の持ち主。mail_subscriptions（list=owner_digest）で配信を止めた人は除き、
1人ずつ配信停止リンクを付けて送る（2026-11-04〜。それまでは BCC 一括）。

送信に1通も成功しなかった場合はフラグを更新せず、次回実行で再送する。
一部chunkだけ失敗した場合はフラグを立てる（同一メールの重複送信を避けるため）。

実行: python py/send_digest.py
env (py/.env): SUPABASE_URL / SUPABASE_SERVICE_KEY(無ければ SUPABASE_KEY) / BREVO_API_KEY
環境変数 DIGEST_DRY_RUN=1 で「管理者1人だけに送り、フラグは更新しない」試運転になる。
"""
import json
import os
import re
import sys
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

# 設定（py/.env 優先・無ければ環境変数）・Supabase REST・Brevo は py/common.py に寄せた（2026-09-30）。
# 差出人などの定数は main.gs と同一の値を common.py が持つ。
from mail_html import text_to_html as _mail_html
from common import (cfg, require, supa_key, sb_select, sb_patch, sb_rpc, sb_upsert, brevo_send, supa_url, _request,
                    SENDER_EMAIL, SENDER_NAME, REPLY_TO_EMAIL, ADMIN_EMAIL, SITE)

CHUNK_SIZE = 90          # 1回の呼び出しで送る人数（main.gs の BCC 上限の値を引き継ぐ・messageVersions の上限は2000人）
WINDOW_DAYS = 14         # 取り残し救済窓（配信失敗しても14日以内は自動リカバリ）
NEWS_LIMIT = 5           # main.gs の getUnsentNewsAll_ と同じ

# マイ整備手帳の記録を載せるか（2026-10-29 ユーザー決裁「載せたい。1台1日1行でいい」）。
# 整備手帳はまだ導線なし＝公開の判断をユーザーが出すまで False。False の間は対象を読まず、印も付けない。
# 公開前から有る記録は digest_sent_at を埋めてある（maint-notebook/digest_2026-10-29.sql）＝入れた日に過去分は流れない。
MAINT_DIGEST_ON = True
MAINT_LIST_MAX = 10      # 1通に並べる行（台×日）の上限。超えた分は印を付けず翌朝へ

# おすすめ工具（/tools）の新着をダイジェストに載せるか（2026-10-07）。
# ⚠️ダイジェストは登録オーナー全員に届く＝URLを載せた時点で実質公開になる。
#    ページを公開する（導線を付ける）判断をユーザーが出すまで False のまま。
#    False の間は対象を読まず、フラグも立てない＝True にした日から14日以内の分が載る。
TOOLS_DIGEST_ON = True
TOOLS_LIST_MAX = 10      # 1通に並べる件数の上限（手帳からの移行で一度に増えたとき用）

# 「わたしも使ってる」「参考になった」を、紹介した本人にだけ知らせる（2026-10-22・owner-tools/HANDOFF.md §6b・§6c）。
# ダイジェスト（全員に同じBCC）とは別の個別メール。投稿者ごとに1日1通まとめ、
# 同じ（工具, 押した車）の組は owner_tool_metoo_notices に残して二度と知らせない。
# 画面に件数は出さない＝押されたときだけ届くので「0」を見せることもない。
# 宛先は投稿者本人だけ（既に /tools を知っている人）なので、ページ公開前でも鳴らしてよい。
METOO_NOTICE_ON = True

# 整備の記録の「👍 参考になった」を、記録の車の持ち主にだけ知らせる（2026-11-04・工具の参考になったと同じ扱い）。
# 数は画面に出さない。ボタンは整備手帳の公開スイッチと一緒にしか出ないので、公開前は押されず何も送らない。
MAINT_HELPFUL_NOTICE_ON = True

# 車をすべて手放した人に「お知らせだけ続けますか？」を1回だけ（2026-11-04・Amici の段5）。
# ⚠️このメールは /amici（車なしでお知らせを受け取る登録画面）への案内＝入口と同じ＝入口を開ける日まで False。
# 対象＝手放して FORMER_ASK_DAYS 日以内・いま手放していない車が1台も無い・まだ聞いていない・週刊にまだ登録していない人。
# ⛔FORMER_ASK_SINCE より前に手放した人には聞かない（2026-11-04 ユーザー決裁「今回の対象者には送らない。新規の離脱者から」）。
# 聞いたら mail_former_asks に1行＝二度と聞かない。返事が無ければそれきり（催促しない）。
FORMER_ASK_ON = True
FORMER_ASK_DAYS = 30
FORMER_ASK_SINCE = datetime(2026, 11, 4, 15, 0, tzinfo=timezone.utc)   # 2026-11-05 0:00 JST

# 年に一度の「今も乗っていますか？」（2026-11-17・mail/liveness_2026-11-17.sql）。
# 1年動きのなかった車のオーナーにだけ、1台につき年1回。返事は /alive のボタン1つ（ログインなし）。催促はしない。
# 答えがなくても何も消さない・公開の表示も変えない。⛔最後に確認した日・答えのない回数を公開ページに出さない。
# ⚠️新しい種類のメール＝policy にも書いてから送る。配信開始は 2027年1月（ユーザー決裁）＝その日まで False。
# 動きの記録（liveness_sync）は False の間も毎朝回す（セッションは消えるので、残しておかないと1年後に分からない）。
LIVENESS_ON = False
LIVENESS_DAILY_MAX = 10   # 1日に聞く台数の上限＝初日にまとめて出さず、古い登録から順に回す
# 開始の時期を管理人に知らせる：この日以降、スイッチが OFF の間は毎週月曜の朝に管理人へ1通（ON にすれば止まる）
LIVENESS_REMIND_FROM = datetime(2027, 1, 3, 15, 0, tzinfo=timezone.utc)   # 2027-01-04（月）0:00 JST

# ブログ・SNSとつなぐ（つないだ投稿＝ブログ・動画などへのリンク・/my-articles で載せる）を載せるか（2026-10-29・owner-articles/HANDOFF.md §1-5）。
# ⚠️ダイジェストは登録オーナー全員に届く＝載せた時点で実質公開。公開の判断をユーザーが出すまで False のまま。
#    False の間は対象を読まず、印（digest_sent_at）も付けない＝True にした日から14日以内に貼られた分が載る。
# 載せた記事の書き手には、同じ朝に「あなたの記事を紹介しました」を1人1通（工具の「わたしも使ってる」と同じ形）。
ARTICLES_DIGEST_ON = True
ARTICLES_LIST_MAX = 10   # 1通に並べる件数の上限（超えた分は印を付けず翌朝に回す＝「ほか◯件」だと一度も紹介されないまま終わる）


def is_ig(url) -> bool:
    """Instagram の投稿か。朝の便・週刊便りには載せない（2026-11-18 ユーザー決裁＝題名とリンクしか出せず受け手に中身がない／
    本人は全員にメールで届くと思っていない／投稿は頻繁でメールの枠に先に当たる）。車両ページの歩みと更新情報には出る。"""
    return bool(re.match(r"^https://(www\.)?instagram\.com/", url or "", re.I))

DRY_RUN = str(cfg("DIGEST_DRY_RUN", "")).strip().lower() in ("1", "true", "yes")


def log(msg):
    print(msg, flush=True)


# =========================================================
# Brevo（送信そのものは common.brevo_send）
# =========================================================
ADMIN_NAMES = ("管理者", "管理人")


def sama(name):
    """名前に「様」を付ける。管理者には付けない（2026-11-07 ユーザー指示）。"""
    name = str(name or "").strip()
    return name if name in ADMIN_NAMES else f"{name}様"


def text_to_html(text):
    """テキスト本文の書き方を読み取って HTML 版を作る（2026-11-07 体裁を刷新＝py/mail_html.py）。
    ⛔件名をメール本文の冒頭に題字として出さない＝メールアプリが件名を上に出すので二重になる（同日 ユーザー判断）"""
    return _mail_html(text)


def send_broadcast(bcc_list, subject, text_body):
    """main.gs sendBroadcastViaBrevo の移植。失敗は例外にする。"""
    payload = {
        "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
        "replyTo": {"name": SENDER_NAME, "email": REPLY_TO_EMAIL},
        "to": [{"email": REPLY_TO_EMAIL}],
        "bcc": [{"email": e} for e in bcc_list],
        "subject": subject,
        "textContent": text_body,
        "htmlContent": text_to_html(text_body),
        "trackClicks": True,
        "trackOpens": True,
    }
    brevo_send(payload, timeout=60)   # 失敗は RuntimeError（HTTP コード＋本文の先頭）


def unsub_footer(token):
    """1人ずつの配信停止リンク（特定電子メール法＝毎回、停止の方法を書く）。
    区切り線より後のフッターに続けて置く＝空行を挟まない（2026-11-17・HTML 版では「こちらから配信を止められます」の1行になる）"""
    return ("\nこのお知らせが不要な方は、次のリンクから配信を止められます（ログイン不要）。\n"
            f"{SITE}/unsubscribe?t={token}\n")


def unsub_headers(token):
    """Gmail などの「登録解除」ボタンの行き先を自分たちの停止にする（RFC 8058 のワンクリック・2026-11-17）。
    付けないと Brevo が自動で自分の停止リンクを付け、押されると news@ からのメールが Brevo 側で全部止まる
    （312 で実測。登録のお礼・手放した人への問いかけなども届かなくなる）。札が無い試運転では付けない"""
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", str(token or "")):
        return {}
    return {"headers": {"List-Unsubscribe": f"<{SITE}/api/unsubscribe?t={token}>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}}


def send_personal(chunk, subject, text_body):
    """宛先ごとに停止リンクと停止ヘッダーの違う本文を1通ずつ送る。chunk は [(email, token), ...]。
    2026-11-17 に messageVersions（1回の呼び出しでまとめて）から1通ずつへ＝messageVersions はヘッダーを宛先ごとに
    変えられないため。Brevo の送信数の数え方は同じ＝1人1通。1人も送れなければ例外にする。"""
    ok, errors = 0, []
    for email, token in chunk:
        text = text_body + unsub_footer(token)
        try:
            brevo_send({
                "sender": {"name": SENDER_NAME, "email": SENDER_EMAIL},
                "replyTo": {"name": SENDER_NAME, "email": REPLY_TO_EMAIL},
                "to": [{"email": email}],
                "subject": subject,
                "textContent": text,
                "htmlContent": text_to_html(text),
                **unsub_headers(token),
                "trackClicks": True,
                "trackOpens": True,
            }, timeout=60)
            ok += 1
        except Exception as e:
            errors.append(str(e))
    if errors:
        log(f"一部送れませんでした {len(errors)}/{len(chunk)}: {errors[0]}")
        if not ok:
            raise RuntimeError(errors[0])


def send_notice(to, subject, body, token=None):
    """反応のお知らせを1通送る。token（owner_notice の札）があれば停止リンクと停止ヘッダーを付ける"""
    if token:
        body = body + unsub_footer(token)
    brevo_send({
        "replyTo": {"name": SENDER_NAME, "email": REPLY_TO_EMAIL},
        "to": [{"email": to}],
        "subject": subject,
        "textContent": body,
        "htmlContent": text_to_html(body),
        **unsub_headers(token),
    })


def notice_token(mail):
    """反応のお知らせ（わたしも使ってる・参考になった・記事を紹介した）の停止の札（2026-11-17〜）。
    戻り値は (送ってよいか, 札)。止めた人には送らない（記録はする＝溜めない）。試運転は管理人宛てなので札を作らない"""
    if DRY_RUN:
        return True, None
    t = owner_digest_tokens([mail], "owner_notice")
    if mail not in t:
        log("反応のお知らせを止めている人を飛ばしました")
    return mail in t, t.get(mail)


def owner_digest_tokens(emails, lst="owner_digest"):
    """宛先ごとの停止用の札を mail_subscriptions から引く（無い人には作る）。
    戻り値は {email: token}。停止済みの人は入らない＝送らない。
    lst＝owner_digest（朝の新着情報）／owner_notice（反応のお知らせ・2026-11-17〜）"""
    if emails:
        sb_upsert("mail_subscriptions",
                  [{"list": lst, "email": e, "source": "owner"} for e in emails],
                  on_conflict="list,email", ignore_dup=True)
    rows = sb_select("mail_subscriptions", "email,unsub_token,unsubscribed_at",
                     {"list": f"eq.{lst}"})
    wanted = set(emails)
    return {r["email"]: r["unsub_token"] for r in rows
            if r["email"] in wanted and not r.get("unsubscribed_at")}


def send_admin_alert(subject, body):
    """管理者への異常通知。Brevo自体が落ちている場合は届かないが、
    その場合も終了コード1でGitHub Actionsが失敗しオーナーへ通知メールが飛ぶ。"""
    try:
        send_broadcast([ADMIN_EMAIL], subject, body)
    except Exception as e:
        log(f"⚠️ 管理者アラートの送信にも失敗: {e}")


# =========================================================
# 本体
# =========================================================
def main():
    require("SUPABASE_URL", "BREVO_API_KEY")
    if not supa_key():
        raise SystemExit("必須の設定がありません: SUPABASE_SERVICE_KEY/SUPABASE_KEY")

    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(days=WINDOW_DAYS)).isoformat().replace("+00:00", "Z")
    # main.gs は now.toISOString().slice(0,10)（UTC日付）で足切りしている。
    # 6:20 JST 実行時は UTC では前日になるため「前日開催のイベントも拾う」挙動になるが、
    # 移植で取りこぼしを増やさないよう、あえて同じ UTC 日付を使う。
    today_utc = now.strftime("%Y-%m-%d")

    log(f"sendDailyDigest 開始: {now.isoformat()}" + ("  ★DRY RUN★" if DRY_RUN else ""))
    try:
        sweep_brevo_blocks()               # 送る前に＝止めたばかりの人に送らない
    except Exception as e:
        log(f"❌ 停止リストの見回り: {e}")
        send_admin_alert("【要確認】500 の停止リストの見回りの失敗", str(e))

    # 1. 未送信お知らせ
    news = sb_select("news", "id,title,content",
                     {"sent_at": "is.null", "created_at": f"gte.{window_start}"},
                     f"order=id.asc&limit={NEWS_LIMIT}")

    # 2. 新車
    cars_raw = sb_select(
        "cars", "id,document_id,handle_name,model_display_c,notification_sent,created_at",
        {"notification_sent": "eq.false", "created_at": f"gte.{window_start}"},
        "order=created_at.asc")
    new_cars = [{"id": c["document_id"], "name": c["handle_name"],
                 "model": c.get("model_display_c") or "FIAT 500", "db_id": c["id"]}
                for c in cars_raw]

    # 3. 新規イベント（開催日を過ぎたものは救済配信しない）
    events_raw = sb_select(
        "events", "id,event_name,event_date,owner_name,location,notification_sent,created_at",
        {"notification_sent": "eq.false", "created_at": f"gte.{window_start}",
         "event_date": f"gte.{today_utc}"},
        "order=created_at.asc")
    # 行き先はイベントの個別ページ（2026-10-29 ユーザー指示）。個別ページは gen_event_pages.py が6時間ごとに作る＝
    # まだ slug が無い登録直後のイベントだけ一覧へ
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "event-slugs.json"), encoding="utf-8") as f:
            event_slugs = json.load(f)
    except Exception as ex:
        log(f"event-slugs.json が読めないので、イベントは一覧へ案内します: {ex}")
        event_slugs = {}
    new_events = []
    for e in events_raw:
        d = datetime.strptime(str(e["event_date"])[:10], "%Y-%m-%d")
        slug = event_slugs.get(e["id"])
        new_events.append({"name": e["event_name"],
                           "date": f"{d.year}年{d.month}月{d.day}日（{'月火水木金土日'[d.weekday()]}）",
                           "url": f"{SITE}/event/{slug}/" if slug else f"{SITE}/event",
                           "owner": e["owner_name"], "loc": " ".join(str(e["location"] or "").split()), "db_id": e["id"]})

    # 4. 新規ストーリー
    eps_raw = sb_select(
        "car_episodes", "id,car_id,type,title,created_at,notification_sent,is_published",
        {"notification_sent": "eq.false", "is_published": "eq.true",
         "created_at": f"gte.{window_start}"},
        "order=created_at.asc")
    ep_car_map = {}
    if eps_raw:
        ids = sorted({ep["car_id"] for ep in eps_raw if ep.get("car_id")})
        if ids:
            in_list = ",".join('"' + str(i) + '"' for i in ids)
            for c in sb_select("cars", "document_id,handle_name,car_type",
                               {"document_id": f"in.({in_list})"}):
                ep_car_map[c["document_id"]] = c
    new_episodes = [{"id": ep["id"], "title": ep.get("title") or "(無題)",
                     "owner": (ep_car_map.get(ep.get("car_id")) or {}).get("handle_name") or "オーナー"}
                    for ep in eps_raw]

    # 5. 新規の車載手帳（公開設定のものだけ。2026-09-09 追加）
    #    非公開の手帳を新着として流すと、本人が見せていないものを全オーナーに知らせてしまう。
    #    車に紐づかない手帳（vehicle_id が null）は行き先が無いので載せない＝フラグも立てず、
    #    14日の救済窓を過ぎたら自然に対象から外れる。
    nb_raw = sb_select(
        "equipment_records", "id,vehicle_id,created_at,notification_sent,is_public",
        {"notification_sent": "eq.false", "is_public": "eq.true",
         "created_at": f"gte.{window_start}"},
        "order=created_at.asc")
    nb_car_map = {}
    if nb_raw:
        ids = sorted({r["vehicle_id"] for r in nb_raw if r.get("vehicle_id")})
        if ids:
            in_list = ",".join('"' + str(i) + '"' for i in ids)
            for c in sb_select("cars", "document_id,handle_name,model_display_c",
                               {"document_id": f"in.({in_list})"}):
                nb_car_map[c["document_id"]] = c
    new_notebooks = [{"id": r["id"], "doc": r["vehicle_id"],
                      "owner": (nb_car_map.get(r["vehicle_id"]) or {}).get("handle_name") or "オーナー"}
                     for r in nb_raw if r.get("vehicle_id")]

    # 5d. マイ整備手帳（2026-10-29 追加・MAINT_DIGEST_ON のときだけ）
    #     公開で作業日のある記録（みんなの整備手帳に出るものと同じ条件）。1台・1日（登録したJSTの日）で1行に畳む。
    #     手放された車は載せない＝印も付けず、14日で対象から外れる
    new_maint, maint_ids = [], []
    if MAINT_DIGEST_ON:
        mr_raw = sb_select(
            "maint_records", "id,car_id,title,created_at",
            {"digest_sent_at": "is.null", "is_public": "eq.true", "work_date": "not.is.null",
             "created_at": f"gte.{window_start}"},
            "order=created_at.asc")
        mr_car_map = {}
        if mr_raw:
            in_list = ",".join('"' + str(i) + '"' for i in sorted({r["car_id"] for r in mr_raw}))
            for c in sb_select("cars", "document_id,handle_name,model_display_c,is_sold",
                               {"document_id": f"in.({in_list})"}):
                mr_car_map[c["document_id"]] = c
        groups = {}
        for r in mr_raw:
            car = mr_car_map.get(r["car_id"])
            if not car or car.get("is_sold"):
                continue
            day = (datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")) + timedelta(hours=9)).date()
            g = groups.setdefault((r["car_id"], day), {
                "doc": r["car_id"], "owner": car.get("handle_name") or "オーナー",
                "model": car.get("model_display_c") or "FIAT 500", "titles": [], "ids": []})
            g["titles"].append(r["title"])
            g["ids"].append(r["id"])
        new_maint = list(groups.values())[:MAINT_LIST_MAX]
        maint_ids = [i for g in new_maint for i in g["ids"]]

    # 5b. 新規おすすめ工具（2026-10-07 追加・TOOLS_DIGEST_ON のときだけ）
    new_tools = []
    if TOOLS_DIGEST_ON:
        tl_raw = sb_select(
            "owner_tools", "id,car_id,name,created_at,notification_sent,is_hidden",
            {"notification_sent": "eq.false", "is_hidden": "eq.false",
             "created_at": f"gte.{window_start}"},
            "order=created_at.asc")
        tl_car_map = {}
        if tl_raw:
            in_list = ",".join('"' + str(i) + '"' for i in sorted({r["car_id"] for r in tl_raw}))
            for c in sb_select("cars", "document_id,handle_name", {"document_id": f"in.({in_list})"}):
                tl_car_map[c["document_id"]] = c
        new_tools = [{"id": r["id"], "name": r["name"],
                      "owner": (tl_car_map.get(r["car_id"]) or {}).get("handle_name") or "オーナー"}
                     for r in tl_raw]

    # 5c. つないだ投稿（2026-10-29 追加・ARTICLES_DIGEST_ON のときだけ）
    #     手放された車の記事は載せない（更新情報と同じ）＝印も付けず、14日で対象から外れる
    #     Instagram の投稿も載せない（is_ig）＝印も付けず、14日で対象から外れる
    new_articles = []
    if ARTICLES_DIGEST_ON:
        ar_raw = sb_select(
            "owner_articles", "id,car_id,author_user_id,title,url,site_name,created_at",
            {"digest_sent_at": "is.null", "is_hidden": "eq.false",
             "created_at": f"gte.{window_start}"},
            "order=created_at.asc")
        ar_raw = [r for r in ar_raw if not is_ig(r.get("url"))]
        ar_car_map = {}
        if ar_raw:
            in_list = ",".join('"' + str(i) + '"' for i in sorted({r["car_id"] for r in ar_raw}))
            for c in sb_select("cars", "document_id,handle_name,owner_email,owner_user_id,is_sold",
                               {"document_id": f"in.({in_list})"}):
                ar_car_map[c["document_id"]] = c
        for r in ar_raw:
            car = ar_car_map.get(r["car_id"])
            if not car or car.get("is_sold"):
                continue
            new_articles.append({
                "id": r["id"], "doc": r["car_id"], "title": r["title"], "url": r["url"],
                "site": r.get("site_name") or "", "owner": car.get("handle_name") or "オーナー",
                # 知らせの宛先は、書いた人がいまもその車の持ち主のときだけ（前の持ち主には送らない）
                "mail": (str(car.get("owner_email") or "").strip().lower()
                         if car.get("owner_user_id") and car.get("owner_user_id") == r.get("author_user_id") else "")})
        new_articles = new_articles[:ARTICLES_LIST_MAX]

    if not (news or new_cars or new_events or new_episodes or new_notebooks or new_maint or new_tools or new_articles):
        log("配信対象なし")
        if DRY_RUN:
            # 対象が無い日でも Brevo 送信経路まで通しておかないと試運転の意味が薄い
            log("DRY RUN: 配信対象が無いため、Supabase読み取り＋Brevo送信の疎通確認だけ行います")
            send_broadcast(
                [ADMIN_EMAIL], "[DRY RUN] 朝ダイジェスト 疎通確認",
                "配信対象はありませんでした。\n"
                "Supabaseの読み取りとBrevoの送信経路が通っていることの確認メールです。\n"
                "実際のオーナーには送信していません。\n\n" + SITE + "/")
            log(f"✅ DRY RUN: {ADMIN_EMAIL} に疎通確認メールを送信しました。")
        return

    # 6. 件名・本文（2026-10-29 全面見直し・ユーザー決裁）
    #    件名は毎日同じ＝中身を件名に並べない（欄が多い日に「新着」が何度も並んで読めなかったため）。
    #    見出しは「◯◯（N件）が登録されました」にそろえ、一覧URLは見出しの直後（2026-10-27 ユーザー指示）。
    #    名前は「◯◯様」・括弧は全角・URLは .html の付かない形にそろえる。
    subject = "【Registro500/126】新着情報のお知らせ"

    # ⛔時刻に依存する挨拶にしない（2026-09-09 ユーザー確定）。Actions の schedule は
    # 実測18分〜3時間34分遅れ、午前9時台に届くことがある＝「おはようございます」が嘘になる。
    body = ("Registro500 / Registro126 Giappone オーナーの皆様\n\n"
            "ご愛用ありがとうございます。新着情報のお知らせです。\n")

    def section(emoji, heading, list_url=None):
        s = f"\n■ {emoji} {heading}\n"
        if list_url:
            s += f"一覧：{SITE}{list_url}\n"
        return s + "\n"

    if new_cars:
        body += section("🚗", f"新しい仲間（{len(new_cars)}台）が登録されました")
        for c in new_cars:
            body += f"・{c['model']}（{sama(c['name'])}）\n　{SITE}/detail?doc={c['id']}\n"

    if new_events:
        body += section("📅", f"新しいイベント（{len(new_events)}件）が登録されました", "/event")
        for e in new_events:
            body += (f"・{e['name']}（{sama(e['owner'])}）\n"
                     f"　日時：{e['date']}\n"   # 場所は載せずサイトへ誘う（2026-11-07 ユーザー指示）
                     f"　{e['url']}\n")

    if new_episodes:
        body += section("📖", f"新しいストーリー（{len(new_episodes)}件）が投稿されました", "/stories")
        for e in new_episodes:
            body += f"・「{e['title']}」（{sama(e['owner'])}）\n　{SITE}/episode?ep={e['id']}\n"

    if new_notebooks:
        body += section("🧰", f"新しい車載手帳（{len(new_notebooks)}冊）が登録されました", "/equipment")
        for n in new_notebooks:
            body += f"・{n['owner']}様の車載手帳\n　{SITE}/detail?doc={n['doc']}#equipment-notebook\n"

    if new_maint:
        # 1台1日1行（2026-10-29 ユーザー決裁）。題名は3つまで並べ、残りは「ほか◯件」
        body += section("🛠️", f"新しい整備の記録（{sum(len(m['titles']) for m in new_maint)}件）が登録されました",
                        "/maintenance")
        for m in new_maint:
            names = "・".join(m["titles"][:3]) + (f" ほか{len(m['titles']) - 3}件" if len(m["titles"]) > 3 else "")
            body += f"・{m['model']}（{sama(m['owner'])}）：{names}\n　{SITE}/detail?doc={m['doc']}#history\n"

    if new_tools:
        # 個々の投稿ではなく一覧の先頭へ（2026-10-29 ユーザー指示＝ついでに全部見てほしい）
        body += section("🔧", f"新しいおすすめ工具・パーツ（{len(new_tools)}件）が登録されました", "/tools")
        for t in new_tools[:TOOLS_LIST_MAX]:
            body += f"・{t['name']}（{sama(t['owner'])}）\n"
        if len(new_tools) > TOOLS_LIST_MAX:
            body += f"・ほか{len(new_tools) - TOOLS_LIST_MAX}件\n"

    if new_articles:
        # 題名の下に記事そのものへのURL。⛔閲覧数・件数の比較は出さない（owner-articles/HANDOFF.md §1-9）
        body += section("📝", f"ブログ・動画が{len(new_articles)}件つながりました", "/activity")
        for a in new_articles:
            via = f"・{a['site']}" if a["site"] else ""
            body += f"・「{a['title']}」（{sama(a['owner'])}{via}）\n　{a['url']}\n"

    if news:
        body += f"\n■ 📢 お知らせ（{len(news)}件）\n一覧：{SITE}/news\n"
        for n in news:
            body += f"\n【{n['title']}】\n{n['content']}\n"

    body += ("\n---------------------------------------------------------\n"
             "このメールは、新着があった日の朝だけ、愛車を登録したオーナーの皆様にお送りしています。\n"
             "Registro500 / Registro126 Giappone\n" + SITE + "/")

    # 7. 宛先（is_sold=true のオーナーは除外）
    recipients = sorted({
        str(c.get("owner_email") or "").strip().lower()
        for c in sb_select("cars", "owner_email", {"is_sold": "is.false"})
        if "@" in str(c.get("owner_email") or "")
    })
    # 配信を止めた人を除き、残る人に停止用の札を付ける（2026-11-04・mail/schema_2026-11-04.sql）。
    # 札が引けないと停止リンク無しで送ることになる＝送らずに止め、フラグ据え置きで翌朝に回す。
    try:
        tokens = owner_digest_tokens(recipients)
    except Exception as e:
        log(f"❌ 配信停止の札を引けませんでした: {e}")
        send_admin_alert("【要確認】朝ダイジェスト送信中止",
                         f"mail_subscriptions を読めなかったため送信を止めました: {e}")
        raise SystemExit(1)
    stopped = len(recipients) - len(tokens)
    recipients = [(e, tokens[e]) for e in recipients if e in tokens]

    if DRY_RUN:
        log("---- DRY RUN: 実際の宛先には送りません ----")
        log(f"件名: {subject}")
        log(f"本来の宛先数: {len(recipients)}人（配信停止 {stopped}人）")
        log("---- 本文 ----\n" + body + "\n--------------")
        # 管理人は車の持ち主でないことがある＝管理人にも札を作り、本番と同じ送り方（1人ずつの停止リンク）で試す
        admin_token = tokens.get(ADMIN_EMAIL.lower()) or owner_digest_tokens([ADMIN_EMAIL.lower()]).get(ADMIN_EMAIL.lower())
        if admin_token:
            send_personal([(ADMIN_EMAIL, admin_token)], "[DRY RUN] " + subject, body)
        else:
            send_broadcast([ADMIN_EMAIL], "[DRY RUN] " + subject, body + unsub_footer("（試運転のため札なし）"))
        log(f"✅ DRY RUN: {ADMIN_EMAIL} にのみ送信しました。フラグは更新していません。")
        send_article_notices(new_articles)   # 試運転では管理者宛になる
        return

    sent_chunks = 0
    failed_chunks = 0
    for i in range(0, len(recipients), CHUNK_SIZE):
        chunk = recipients[i:i + CHUNK_SIZE]
        try:
            send_personal(chunk, subject, body)
            sent_chunks += 1
            time.sleep(1)
        except Exception as e:
            failed_chunks += 1
            log(f"メール送信エラー (chunk {i}): {e}")

    # 8. フラグ更新（1chunk以上成功した場合のみ。全滅ならフラグ据え置きで次回再送）
    if sent_chunks == 0:
        log(f"❌ 全chunk送信失敗（成功:0, 失敗:{failed_chunks}）→ フラグ更新スキップ。次回実行で再送されます。")
        send_admin_alert("【要確認】朝ダイジェスト送信失敗",
                         f"全{failed_chunks}chunkの送信に失敗しました（成功:0）。件名: {subject}")
        raise SystemExit(1)

    if failed_chunks > 0:
        log(f"⚠️ 一部chunk送信失敗（成功:{sent_chunks}, 失敗:{failed_chunks}）"
            "→ 同一メールの重複送信を避けるため送信済みフラグを更新します。")

    for c in new_cars:
        try:
            sb_patch("cars", c["db_id"], {"notification_sent": True})
        except Exception as e:
            log(f"cars フラグ更新エラー: {e}")
    for e in new_events:
        try:
            sb_rpc("mark_event_notification_sent", {"p_event_id": e["db_id"]})
        except Exception as ex:
            log(f"events フラグ更新エラー: {ex}")
    for ep in new_episodes:
        try:
            sb_patch("car_episodes", ep["id"], {"notification_sent": True})
        except Exception as e:
            log(f"car_episodes フラグ更新エラー: {e}")
    for nb in new_notebooks:
        try:
            sb_patch("equipment_records", nb["id"], {"notification_sent": True})
        except Exception as e:
            log(f"equipment_records フラグ更新エラー: {e}")
    for t in new_tools:
        try:
            sb_patch("owner_tools", t["id"], {"notification_sent": True})
        except Exception as e:
            log(f"owner_tools フラグ更新エラー: {e}")
    stamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for mid in maint_ids:
        try:
            sb_patch("maint_records", mid, {"digest_sent_at": stamp})
        except Exception as e:
            log(f"maint_records 印の更新エラー: {e}")
    for a in new_articles:
        try:
            sb_patch("owner_articles", a["id"], {"digest_sent_at": stamp})
        except Exception as e:
            log(f"owner_articles 印の更新エラー: {e}")
    for n in news:
        try:
            sb_patch("news", n["id"], {
                "sent_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "email_sent": True})
        except Exception as e:
            log(f"❌ news フラグ更新エラー (id={n['id']}): {e}")

    log(f"メール配信完了: お知らせ{len(news)}件、車両{len(new_cars)}台、"
        f"イベント{len(new_events)}件、ストーリー{len(new_episodes)}件、"
        f"車載手帳{len(new_notebooks)}冊、整備{len(maint_ids)}件、工具{len(new_tools)}件、記事{len(new_articles)}件"
        f"（送信chunk {sent_chunks}成功/{failed_chunks}失敗、宛先{len(recipients)}人・配信停止{stopped}人）")

    # ダイジェストが届いたあとで、載せた記事の書き手へ。こちらの失敗はダイジェストの結果を変えない
    try:
        send_article_notices(new_articles)
    except Exception as e:
        log(f"❌ 記事を紹介した知らせでエラー: {e}")
        send_admin_alert("【要確認】記事を紹介した知らせの失敗",
                         f"send_digest.py の send_article_notices で例外が発生しました: {e}")


def send_article_notices(articles):
    """ダイジェストに載せたつないだ投稿の書き手へ、「あなたの記事を紹介しました」を1人1通。
    ダイジェストと同じ朝に1回だけ（印は digest_sent_at＝ダイジェスト側で付く）。送れなくても再送はしない
    ＝同じ記事の紹介を二度知らせないほうを取る。宛先の無い人・前の持ち主には送らない。"""
    by_mail = {}
    for a in articles:
        if "@" in a["mail"]:
            by_mail.setdefault(a["mail"], {"name": a["owner"], "items": []})["items"].append(a)
    sent = 0
    for mail, entry in by_mail.items():
        ok, token = notice_token(mail)
        if not ok:
            continue
        lines = "\n".join(f"・「{a['title']}」\n　{a['url']}" for a in entry["items"])
        doc = entry["items"][0]["doc"]
        body = (
            f"{entry['name']}さん\n\n"
            "登録オーナーのみなさんへのお知らせメールで、あなたの記事を「ブログ・動画」の欄で紹介しました。\n\n"
            + lines + "\n\n"
            "車両ページの「この1台の歩み」にも並んでいます。\n"
            f"{SITE}/detail?doc={doc}#history\n\n"
            "新しい記事を書いたときも、URLを貼るだけで同じように紹介されます。\n"
            f"{SITE}/my-articles\n\n"
            "---------------------------------------------------------\n"
            "このメールは、記事がお知らせメールに載った日に1通だけお送りしています。\n"
            "Registro500 / Registro126 Giappone")
        to = ADMIN_EMAIL if DRY_RUN else mail
        try:
            send_notice(to, ("[DRY RUN] " if DRY_RUN else "") + "【Registro500/126】あなたの記事を紹介しました", body, token)
            sent += 1
        except Exception as e:
            log(f"記事を紹介した知らせ: 送信エラー（{entry['name']}）: {e}")
    log(f"記事を紹介した知らせ: {sent}通送信" + ("（DRY RUN＝管理者宛）" if DRY_RUN else ""))


def send_metoo_notices():
    """「🔧 わたしも使ってる」「👍 参考になった」が押された投稿の投稿者へ、1人1通の知らせを送る。
    参考になったの数は画面に出さない＝ここが唯一の届け先（owner-tools/HANDOFF.md §6b・§6c）。
    押した直後に取り消された組は行が消えているので知らせない。
    伏せた工具・自分の車どうし・売却済みの車・宛先の無い車には送らない。"""
    if not METOO_NOTICE_ON:
        return
    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(days=WINDOW_DAYS)).isoformat().replace("+00:00", "Z")
    presses = []
    for table, kind in (("owner_tool_users", "metoo"), ("owner_tool_helpful", "helpful")):
        for p in sb_select(table, "tool_id,car_id,created_at",
                           {"created_at": f"gte.{window_start}"}, "order=created_at.asc"):
            p["kind"] = kind
            presses.append(p)
    if not presses:
        log("わたしも使ってる・参考になった: 知らせる対象なし")
        return
    tool_ids = sorted({p["tool_id"] for p in presses})
    in_tools = ",".join(tool_ids)
    done = {(r["tool_id"], r["car_id"], r.get("kind") or "metoo") for r in sb_select(
        "owner_tool_metoo_notices", "tool_id,car_id,kind", {"tool_id": f"in.({in_tools})"})}
    presses = [p for p in presses if (p["tool_id"], p["car_id"], p["kind"]) not in done]
    if not presses:
        log("わたしも使ってる・参考になった: 知らせる対象なし（すべて知らせ済み）")
        return

    tools = {t["id"]: t for t in sb_select(
        "owner_tools", "id,car_id,name,is_hidden", {"id": f"in.({in_tools})"})}
    car_ids = sorted({p["car_id"] for p in presses} | {t["car_id"] for t in tools.values()})
    in_cars = ",".join('"' + str(i) + '"' for i in car_ids)
    cars = {c["document_id"]: c for c in sb_select(
        "cars", "document_id,handle_name,model_display_c,owner_email,owner_user_id,is_sold",
        {"document_id": f"in.({in_cars})"})}

    # 投稿者のメールごとにまとめる
    by_mail = {}
    for p in presses:
        tool = tools.get(p["tool_id"])
        if not tool or tool.get("is_hidden"):
            continue                       # 伏せた・消えた工具は知らせない（記録もしない＝14日で対象外になる）
        poster, presser = cars.get(tool["car_id"]) or {}, cars.get(p["car_id"]) or {}
        mail = str(poster.get("owner_email") or "").strip().lower()
        same_owner = poster.get("owner_user_id") and poster.get("owner_user_id") == presser.get("owner_user_id")
        entry = by_mail.setdefault(mail, {"name": poster.get("handle_name") or "オーナー", "items": [], "keys": []})
        entry["keys"].append({"tool_id": p["tool_id"], "car_id": p["car_id"], "kind": p["kind"]})
        if same_owner or poster.get("is_sold") or "@" not in mail:
            continue                       # 送らないが記録はする（翌日以降も読み直さないため）
        who = (presser.get("handle_name") or "オーナー") + "さん"
        if presser.get("model_display_c"):
            who += "（" + presser["model_display_c"] + "）"
        entry["items"].append((tool["name"], p["kind"], who))

    VERB = {"metoo": "🔧 わたしも使ってる", "helpful": "👍 参考になった"}
    sent = 0
    for mail, entry in by_mail.items():
        if entry["items"] and (tok := notice_token(mail))[0]:
            lines = []
            for name in dict.fromkeys(n for n, _, _ in entry["items"]):
                lines.append("・" + name)
                lines += [f"　　{VERB[k]} ― {w}" for n, k, w in entry["items"] if n == name]
            kinds = {k for _, k, _ in entry["items"]}
            if kinds == {"helpful"}:
                lead = "「みんなのおすすめ工具・パーツ」でのあなたの紹介が、ほかのオーナーの参考になりました。"
                subject = "【Registro500/126】あなたの紹介が、ほかのオーナーの参考になりました"
            elif kinds == {"metoo"}:
                lead = ("「みんなのおすすめ工具・パーツ」で紹介していただいた物に、"
                        "ほかのオーナーから「🔧 わたしも使ってる」が届きました。")
                subject = "【Registro500/126】あなたの紹介した物を、ほかのオーナーも使っています"
            else:
                lead = "「みんなのおすすめ工具・パーツ」に、ほかのオーナーから声が届きました。"
                subject = "【Registro500/126】あなたの紹介に、ほかのオーナーから声が届きました"
            body = (
                f"{entry['name']}さん\n\n" + lead + "\n\n"
                + "\n".join(lines) + "\n\n"
                "ありがとうございます。\n\n"
                f"ほかのオーナーのおすすめ工具・パーツも見る\n{SITE}/tools\n\n"
                "---------------------------------------------------------\n"
                "このメールは、紹介に「わたしも使ってる」「参考になった」が押されたとき、"
                "翌朝にまとめて1通だけお送りしています。"
                "「参考になった」の数はサイトには表示せず、このメールでだけお知らせしています。\n"
                "Registro500 / Registro126 Giappone")
            to = ADMIN_EMAIL if DRY_RUN else mail
            try:
                send_notice(to, ("[DRY RUN] " if DRY_RUN else "") + subject, body, tok[1])
                sent += 1
            except Exception as e:
                log(f"わたしも使ってる・参考になった: 送信エラー（{entry['name']}）: {e}")
                continue                   # 記録しない＝翌朝もう一度
        if DRY_RUN:
            continue                       # 試運転は記録しない
        try:
            sb_upsert("owner_tool_metoo_notices", entry["keys"], on_conflict="tool_id,car_id,kind", ignore_dup=True)
        except Exception as e:
            log(f"わたしも使ってる・参考になった: 記録エラー（{entry['name']}）: {e}")
    log(f"わたしも使ってる・参考になった: {sent}通送信" + ("（DRY RUN＝管理者宛・記録なし）" if DRY_RUN else ""))


def send_maint_helpful_notices():
    """整備の記録に「👍 参考になった」が押された車の持ち主へ、1人1通の知らせを送る。
    数は画面に出さない＝ここが唯一の届け先（工具の send_metoo_notices と同じ扱い）。
    押した直後に取り消された組は行が消えているので知らせない。
    非公開に戻した記録・自分の車どうし・売却済みの車・宛先の無い車には送らない。"""
    if not MAINT_HELPFUL_NOTICE_ON:
        return
    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(days=WINDOW_DAYS)).isoformat().replace("+00:00", "Z")
    presses = sb_select("maint_helpful", "record_id,car_id,created_at",
                        {"created_at": f"gte.{window_start}"}, "order=created_at.asc")
    if not presses:
        log("整備の参考になった: 知らせる対象なし")
        return
    rec_ids = sorted({p["record_id"] for p in presses})
    in_recs = ",".join(rec_ids)
    done = {(r["record_id"], r["car_id"]) for r in sb_select(
        "maint_helpful_notices", "record_id,car_id", {"record_id": f"in.({in_recs})"})}
    presses = [p for p in presses if (p["record_id"], p["car_id"]) not in done]
    if not presses:
        log("整備の参考になった: 知らせる対象なし（すべて知らせ済み）")
        return

    recs = {r["id"]: r for r in sb_select(
        "maint_records", "id,car_id,title,is_public", {"id": f"in.({in_recs})"})}
    car_ids = sorted({p["car_id"] for p in presses} | {r["car_id"] for r in recs.values()})
    in_cars = ",".join('"' + str(i) + '"' for i in car_ids)
    cars = {c["document_id"]: c for c in sb_select(
        "cars", "document_id,handle_name,model_display_c,owner_email,owner_user_id,is_sold",
        {"document_id": f"in.({in_cars})"})}

    by_mail = {}
    for p in presses:
        rec = recs.get(p["record_id"])
        if not rec or not rec.get("is_public"):
            continue                       # 消えた・非公開に戻した記録は知らせない（記録もしない＝14日で対象外になる）
        owner, presser = cars.get(rec["car_id"]) or {}, cars.get(p["car_id"]) or {}
        mail = str(owner.get("owner_email") or "").strip().lower()
        same_owner = owner.get("owner_user_id") and owner.get("owner_user_id") == presser.get("owner_user_id")
        entry = by_mail.setdefault(mail, {"name": owner.get("handle_name") or "オーナー", "items": [], "keys": []})
        entry["keys"].append({"record_id": p["record_id"], "car_id": p["car_id"]})
        if same_owner or owner.get("is_sold") or "@" not in mail:
            continue                       # 送らないが記録はする（翌日以降も読み直さないため）
        who = (presser.get("handle_name") or "オーナー") + "さん"
        if presser.get("model_display_c"):
            who += "（" + presser["model_display_c"] + "）"
        entry["items"].append((rec["id"], rec["title"], who))

    sent = 0
    for mail, entry in by_mail.items():
        if entry["items"] and (tok := notice_token(mail))[0]:
            lines = []
            for rid in dict.fromkeys(r for r, _, _ in entry["items"]):
                title = next(t for r, t, _ in entry["items"] if r == rid)
                lines.append("・" + title)
                lines += [f"　　👍 参考になった ― {w}" for r, _, w in entry["items"] if r == rid]
                lines.append(f"　　{SITE}/maintenance?r={rid}")
            body = (
                f"{entry['name']}さん\n\n"
                "整備手帳に書いていただいた記録が、ほかのオーナーの参考になりました。\n\n"
                + "\n".join(lines) + "\n\n"
                "ありがとうございます。\n\n"
                f"ほかのオーナーの整備手帳も見る\n{SITE}/maintenance\n\n"
                "---------------------------------------------------------\n"
                "このメールは、整備の記録に「参考になった」が押されたとき、翌朝にまとめて1通だけお送りしています。"
                "「参考になった」の数はサイトには表示せず、このメールでだけお知らせしています。\n"
                "Registro500 / Registro126 Giappone")
            to = ADMIN_EMAIL if DRY_RUN else mail
            try:
                send_notice(to, ("[DRY RUN] " if DRY_RUN else "") + "【Registro500/126】あなたの整備の記録が、ほかのオーナーの参考になりました",
                            body, tok[1])
                sent += 1
            except Exception as e:
                log(f"整備の参考になった: 送信エラー（{entry['name']}）: {e}")
                continue                   # 記録しない＝翌朝もう一度
        if DRY_RUN:
            continue                       # 試運転は記録しない
        try:
            sb_upsert("maint_helpful_notices", entry["keys"], on_conflict="record_id,car_id", ignore_dup=True)
        except Exception as e:
            log(f"整備の参考になった: 記録エラー（{entry['name']}）: {e}")
    log(f"整備の参考になった: {sent}通送信" + ("（DRY RUN＝管理者宛・記録なし）" if DRY_RUN else ""))


def send_former_owner_asks():
    if not FORMER_ASK_ON:
        log("手放した人への問いかけ: スイッチ OFF")
        return
    since = max(datetime.now(timezone.utc) - timedelta(days=FORMER_ASK_DAYS), FORMER_ASK_SINCE)
    sold = sb_select("cars", "document_id,handle_name,model_display_c,owner_email,sold_at",
                     {"is_sold": "eq.true", "sold_at": f"gte.{since.isoformat().replace('+00:00', 'Z')}"},
                     "order=sold_at.asc")
    if not sold:
        log("手放した人への問いかけ: 対象なし")
        return
    current = {str(c.get("owner_email") or "").strip().lower()
               for c in sb_select("cars", "owner_email", {"is_sold": "is.false"})}
    done = {r["email"] for r in sb_select("mail_former_asks", "email")}
    done |= {r["email"] for r in sb_select("mail_subscriptions", "email", {"list": "eq.weekly"})}
    targets = {}
    for c in sold:   # 手放した日の古い順＝同じ人が2台なら最後に手放した車が残る
        mail = str(c.get("owner_email") or "").strip().lower()
        if "@" in mail and mail not in current and mail not in done:
            targets[mail] = c
    sent = 0
    for mail, c in targets.items():
        body = (f"{c.get('handle_name') or 'オーナー'}さん\n\n"
                f"{c.get('model_display_c') or 'お車'}を手放されたと伺いました。"
                "これまで Registro500 / Registro126 Giappone にご登録いただき、ありがとうございました。\n\n"
                "車を手放されたため、「新着情報のお知らせ」はこれからはお届けしません。\n\n"
                "車をお持ちでなくても、「週刊 Registro 便り」で、新しい登録車・イベント・記事のお知らせを"
                "週に1回お届けできます。続けて受け取りたい方は、次のページでメールアドレスを入れ、"
                "届いた確認コードを入力してください。\n"
                f"{SITE}/amici?from=former\n\n"
                "このご案内は1回だけお送りしています。何もしなければ、これ以降お知らせは届きません。\n\n"
                "---------------------------------------------------------\n"
                "Registro500 / Registro126 Giappone\n" + SITE + "/\n"
                "お問い合わせ：registro500giappone@gmail.com")
        to = ADMIN_EMAIL if DRY_RUN else mail
        subject = ("[DRY RUN] " if DRY_RUN else "") + "【Registro500/126】これからもお知らせをお届けしましょうか"
        try:
            brevo_send({"replyTo": {"name": SENDER_NAME, "email": REPLY_TO_EMAIL},
                        "to": [{"email": to}], "subject": subject,
                        "textContent": body, "htmlContent": text_to_html(body)}, timeout=30)
        except Exception as e:
            log(f"手放した人への問いかけ 送信エラー（{c['document_id']}）: {e}")
            continue
        sent += 1
        if DRY_RUN:
            break   # 試運転は管理者に1通だけ・記録しない
        sb_upsert("mail_former_asks", {"email": mail, "car_id": c["document_id"]},
                  on_conflict="email", ignore_dup=True)
    log(f"手放した人への問いかけ: {sent}通送信" + ("（DRY RUN＝管理者宛・記録なし）" if DRY_RUN else ""))


def send_liveness_asks():
    """年に一度の「今も乗っていますか？」。動きの記録は毎朝・聞くのはスイッチ ON のときだけ"""
    if not DRY_RUN:
        n = sb_rpc("liveness_sync")
        log(f"生存確認: 動きの記録を {n} 台ぶん更新")
    if not LIVENESS_ON:
        log("生存確認: スイッチ OFF")
        now_jst = datetime.now(timezone(timedelta(hours=9)))
        if datetime.now(timezone.utc) >= LIVENESS_REMIND_FROM and now_jst.weekday() == 0 and not DRY_RUN:
            send_admin_alert("【開始の時期です】年に一度の「今も乗っていますか？」の確認",
                             "2027年1月に始めると決めた確認メールが、まだ止まったままです（毎週月曜にお知らせします）。\n\n"
                             "Claude に「生存確認を始めて」と伝えれば、次の順で進めます。\n"
                             "1. policy.html に1行を足し、お知らせを1本出す（下書きは用意済み）\n"
                             "2. 管理人宛てに試し送り（DIGEST_DRY_RUN=1）\n"
                             "3. py/send_digest.py の LIVENESS_ON を True にして push\n\n"
                             "やめる・延ばす場合も Claude に伝えてください（このお知らせも止めます）。")
            log("生存確認: 開始の時期を管理人に知らせました")
        return
    rows = sb_rpc("liveness_targets", {"p_limit": LIVENESS_DAILY_MAX}) or []
    if not rows:
        log("生存確認: 対象なし")
        return
    by_mail = {}
    for r in rows:   # 同じ人の車が同じ日に重なったら1通にまとめる
        by_mail.setdefault(r["owner_email"], []).append(r)
    now = datetime.now(timezone.utc)
    sent = 0
    for mail, cars in by_mail.items():
        tokens = {c["car_id"]: str(uuid.uuid4()) for c in cars}
        name = cars[0].get("handle_name") or "オーナー"
        lines = "\n".join(f"・{c['model']}\n  {SITE}/alive?t={tokens[c['car_id']]}" for c in cars)
        what = cars[0]["model"] if len(cars) == 1 else "ご登録の車"
        body = (f"{name}さん\n\n"
                f"Registro500 / Registro126 Giappone にご登録いただいている{what}について、年に一度のご確認です。\n"
                "この1年、サイトへのログインや車両情報の更新がなかった方にだけお送りしています。\n\n"
                "いまの様子を、次のページのボタン1つで教えてください（ログインは要りません）。\n\n"
                f"{lines}\n\n"
                "・今も乗っている → 「今も乗っています」を押してください。ほかは何も変わりません。\n"
                "・手放した → 「手放しました」を押すと、車両ページは【過去所有】の印が付いて残ります（写真や記録は消えません）。\n\n"
                "このご確認は年に一度だけです。お返事がなくても、車両ページや記録はそのまま残ります。\n\n"
                "---------------------------------------------------------\n"
                "Registro500 / Registro126 Giappone\n" + SITE + "/\n"
                "お問い合わせ：registro500giappone@gmail.com")
        to = ADMIN_EMAIL if DRY_RUN else mail
        subject = (("[DRY RUN] " if DRY_RUN else "") + "【Registro500/126】" + what
                   + "は今もお手元にありますか（年に一度のご確認）")
        try:
            brevo_send({"replyTo": {"name": SENDER_NAME, "email": REPLY_TO_EMAIL},
                        "to": [{"email": to}], "subject": subject,
                        "textContent": body, "htmlContent": text_to_html(body)}, timeout=30)
        except Exception as e:
            log(f"生存確認 送信エラー（{', '.join(tokens)}）: {e}")
            continue          # 記録しない＝翌朝また対象に入る
        sent += 1
        if DRY_RUN:
            break             # 試運転は管理者に1通だけ・記録しない（札も効かない）
        sb_upsert("car_liveness",
                  [{"car_id": c["car_id"], "asked_at": now.isoformat().replace("+00:00", "Z"),
                    "token": tokens[c["car_id"]], "answer": None, "answered_at": None,
                    "missed": int(c.get("missed") or 0) + 1,
                    "updated_at": now.isoformat().replace("+00:00", "Z")} for c in cars],
                  on_conflict="car_id")
    log(f"生存確認: {sent}通送信（{len(rows)}台）" + ("（DRY RUN＝管理者宛・記録なし）" if DRY_RUN else ""))


# =========================================================
# Brevo の停止リストの見回り（2026-11-17〜・312 と同じ）
# =========================================================
def brevo_api(method, path):
    req = urllib.request.Request("https://api.brevo.com/v3" + path, method=method,
                                 headers={"api-key": cfg("BREVO_API_KEY"), "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Brevo {method} {path.split('?')[0]} → {e.code}: {e.read().decode()[:300]}")


def sweep_brevo_blocks():
    """Gmail などの「登録解除」で Brevo の停止リストに載った人（unsubscribedViaEmail）を、こちらの停止に移す。
    ①お知らせ（朝の新着・反応のお知らせ・週刊便り）をこちらの DB で止める＝本人の「止めたい」を守る
    ②Brevo の停止リストから外す＝登録のお礼・問い合わせの返事など、本人の操作で出るメールは届くように戻す
    ③管理人に知らせる。自前の停止ヘッダーを付けたので本来は載らないはず＝載ったら Brevo の自動の停止が使われたということ
    確認コード（auth@）で押された人は、Brevo の停止を外すだけ（ログインできるように）"""
    rows, offset = [], 0
    while True:
        got = (brevo_api("GET", f"/smtp/blockedContacts?limit=100&offset={offset}") or {}).get("contacts", [])
        rows += got
        offset += 100
        if len(got) < 100:
            break
    hits = [r for r in rows if (r.get("reason") or {}).get("code") == "unsubscribedViaEmail"]
    if not hits:
        log("停止リストの見回り: 該当なし")
        return
    done = []
    for r in hits:
        email = str(r.get("email") or "").strip().lower()
        sender_addr = str(r.get("senderEmail") or "")
        # GAS の時代（〜2026-08）の朝ダイジェストは registro500giappone@gmail.com から出ていた＝同じお知らせとして扱う
        # （その送信元の停止は news@ に移ったあと効いていない＝こちらの DB で止めて本人の意思を守る）
        if not (sender_addr.endswith("@registro500.com") or sender_addr.lower() == ADMIN_EMAIL.lower()) or "@" not in email:
            done.append(f"・{email}（送信元 {sender_addr}）＝500 の送信元ではないので触っていません")
            continue
        if DRY_RUN:
            done.append(f"・{email}（送信元 {sender_addr}）＝試運転なので何もしていません")
            continue
        if not sender_addr.startswith("auth@"):
            sb_upsert("mail_subscriptions", [{"list": l, "email": email, "source": "owner"}
                                             for l in ("owner_digest", "owner_notice")],
                      on_conflict="list,email", ignore_dup=True)
            _request("PATCH", f"{supa_url()}/rest/v1/mail_subscriptions?email=eq.{urllib.parse.quote(email)}"
                              "&unsubscribed_at=is.null",
                     {"unsubscribed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
                     headers={"Prefer": "return=minimal"})
        brevo_api("DELETE", "/smtp/blockedContacts/" + urllib.parse.quote(email))
        done.append(f"・{email}（送信元 {sender_addr}）＝"
                    + ("確認コードのメールで押された＝Brevo の停止だけ外しました（ログインできるように）"
                       if sender_addr.startswith("auth@") else "お知らせをこちらで止め、Brevo の停止は外しました"))
    log(f"停止リストの見回り: {len(hits)}件")
    send_admin_alert("【確認】500 のメールの「登録解除」が押されました",
                     "Gmail などの「登録解除」で Brevo の停止リストに載った人がいたので、次のとおり処理しました。\n\n"
                     + "\n".join(done) + "\n\nお知らせメールには自前の停止ヘッダーを付けているので、本来ここには載りません。"
                     "続くようなら Brevo が自前のヘッダーを使っていない可能性があります。")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as err:
        log(f"❌ sendDailyDigest エラー: {err}")
        send_admin_alert("【要確認】朝ダイジェスト送信失敗",
                         f"send_digest.py で例外が発生しました: {err}")
        sys.exit(1)
    # ダイジェストとは独立。こちらが落ちてもダイジェストの結果は変えない（管理者にだけ知らせる）。
    try:
        send_metoo_notices()
    except Exception as err:
        log(f"❌ わたしも使ってるの知らせでエラー: {err}")
        send_admin_alert("【要確認】わたしも使ってるの知らせ失敗",
                         f"send_digest.py の send_metoo_notices で例外が発生しました: {err}")
    try:
        send_maint_helpful_notices()
    except Exception as err:
        log(f"❌ 整備の参考になったの知らせでエラー: {err}")
        send_admin_alert("【要確認】整備の参考になったの知らせ失敗",
                         f"send_digest.py の send_maint_helpful_notices で例外が発生しました: {err}")
    try:
        send_former_owner_asks()
    except Exception as err:
        log(f"❌ 手放した人への問いかけでエラー: {err}")
        send_admin_alert("【要確認】手放した人への問いかけ失敗",
                         f"send_digest.py の send_former_owner_asks で例外が発生しました: {err}")
    try:
        send_liveness_asks()
    except Exception as err:
        log(f"❌ 生存確認でエラー: {err}")
        send_admin_alert("【要確認】生存確認（今も乗っていますか）の失敗",
                         f"send_digest.py の send_liveness_asks で例外が発生しました: {err}")
