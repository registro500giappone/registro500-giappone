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
  - オーナーの記事 owner_articles.digest_sent_at IS NULL かつ is_hidden = false かつ 14日以内（貼った日）
                 （2026-10-29 追加。ARTICLES_DIGEST_ON が True のときだけ。載せた記事の書き手には「紹介しました」を1通）
  - お知らせ      news.sent_at IS NULL                  かつ 14日以内（最大5件）

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
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

# 設定（py/.env 優先・無ければ環境変数）・Supabase REST・Brevo は py/common.py に寄せた（2026-09-30）。
# 差出人などの定数は main.gs と同一の値を common.py が持つ。
from common import (cfg, require, supa_key, sb_select, sb_patch, sb_rpc, sb_upsert, brevo_send,
                    SENDER_EMAIL, SENDER_NAME, REPLY_TO_EMAIL, ADMIN_EMAIL, SITE)

CHUNK_SIZE = 90          # Brevo の BCC 上限に合わせた main.gs と同じ値
WINDOW_DAYS = 14         # 取り残し救済窓（配信失敗しても14日以内は自動リカバリ）
NEWS_LIMIT = 5           # main.gs の getUnsentNewsAll_ と同じ

# マイ整備手帳の記録を載せるか（2026-10-29 ユーザー決裁「載せたい。1台1日1行でいい」）。
# 整備手帳はまだ導線なし＝公開の判断をユーザーが出すまで False。False の間は対象を読まず、印も付けない。
# 公開前から有る記録は digest_sent_at を埋めてある（maint-notebook/digest_2026-10-29.sql）＝入れた日に過去分は流れない。
MAINT_DIGEST_ON = False
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

# オーナーの記事（ブログなど外部記事へのリンク・/my-articles で載せる）を載せるか（2026-10-29・owner-articles/HANDOFF.md §1-5）。
# ⚠️ダイジェストは登録オーナー全員に届く＝載せた時点で実質公開。公開の判断をユーザーが出すまで False のまま。
#    False の間は対象を読まず、印（digest_sent_at）も付けない＝True にした日から14日以内に貼られた分が載る。
# 載せた記事の書き手には、同じ朝に「あなたの記事を紹介しました」を1人1通（工具の「わたしも使ってる」と同じ形）。
ARTICLES_DIGEST_ON = False
ARTICLES_LIST_MAX = 10   # 1通に並べる件数の上限（超えた分は印を付けず翌朝に回す＝「ほか◯件」だと一度も紹介されないまま終わる）

DRY_RUN = str(cfg("DIGEST_DRY_RUN", "")).strip().lower() in ("1", "true", "yes")


def log(msg):
    print(msg, flush=True)


# =========================================================
# Brevo（送信そのものは common.brevo_send）
# =========================================================
def text_to_html(text):
    """main.gs textToHtml_ の移植"""
    escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    linked = re.sub(
        r'https?://[^\s<>"]+',
        lambda m: f'<a href="{m.group(0)}" style="color:#c0392b;">{m.group(0)}</a>',
        escaped,
    )
    body = linked.replace("\n", "<br>\n")
    return (
        '<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:14px;'
        'line-height:1.8;color:#333;max-width:600px;margin:0 auto;padding:20px;">'
        + body + "</body></html>"
    )


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
                           "owner": e["owner_name"], "loc": e["location"], "db_id": e["id"]})

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

    # 5c. オーナーの記事（2026-10-29 追加・ARTICLES_DIGEST_ON のときだけ）
    #     手放された車の記事は載せない（更新情報と同じ）＝印も付けず、14日で対象から外れる
    new_articles = []
    if ARTICLES_DIGEST_ON:
        ar_raw = sb_select(
            "owner_articles", "id,car_id,author_user_id,title,url,site_name,created_at",
            {"digest_sent_at": "is.null", "is_hidden": "eq.false",
             "created_at": f"gte.{window_start}"},
            "order=created_at.asc")
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
            body += f"・{c['model']}（{c['name']}様）\n　{SITE}/detail?doc={c['id']}\n"

    if new_events:
        body += section("📅", f"新しいイベント（{len(new_events)}件）が登録されました", "/event")
        for e in new_events:
            body += (f"・{e['name']}（{e['owner']}様）\n"
                     f"　日時：{e['date']}　場所：{e['loc']}\n"
                     f"　{e['url']}\n")

    if new_episodes:
        body += section("📖", f"新しいストーリー（{len(new_episodes)}件）が投稿されました", "/stories")
        for e in new_episodes:
            body += f"・「{e['title']}」（{e['owner']}様）\n　{SITE}/episode?ep={e['id']}\n"

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
            body += f"・{m['model']}（{m['owner']}様）：{names}\n　{SITE}/detail?doc={m['doc']}#history\n"

    if new_tools:
        # 個々の投稿ではなく一覧の先頭へ（2026-10-29 ユーザー指示＝ついでに全部見てほしい）
        body += section("🔧", f"新しいおすすめ工具・パーツ（{len(new_tools)}件）が登録されました", "/tools")
        for t in new_tools[:TOOLS_LIST_MAX]:
            body += f"・{t['name']}（{t['owner']}様）\n"
        if len(new_tools) > TOOLS_LIST_MAX:
            body += f"・ほか{len(new_tools) - TOOLS_LIST_MAX}件\n"

    if new_articles:
        # 題名の下に記事そのものへのURL。⛔閲覧数・件数の比較は出さない（owner-articles/HANDOFF.md §1-9）
        body += section("📝", f"オーナーの記事（{len(new_articles)}件）が登録されました", "/activity")
        for a in new_articles:
            via = f"・{a['site']}" if a["site"] else ""
            body += f"・「{a['title']}」（{a['owner']}様{via}）\n　{a['url']}\n"

    if news:
        body += f"\n■ 📢 お知らせ（{len(news)}件）\n一覧：{SITE}/news\n"
        for n in news:
            body += f"\n【{n['title']}】\n{n['content']}\n"

    body += ("\n---------------------------------------------------------\n"
             "Registro500 / Registro126 Giappone\n" + SITE + "/")

    # 7. 宛先（is_sold=true のオーナーは除外）
    recipients = sorted({
        str(c.get("owner_email") or "").strip().lower()
        for c in sb_select("cars", "owner_email", {"is_sold": "is.false"})
        if "@" in str(c.get("owner_email") or "")
    })

    if DRY_RUN:
        log("---- DRY RUN: 実際の宛先には送りません ----")
        log(f"件名: {subject}")
        log(f"本来の宛先数: {len(recipients)}人")
        log("---- 本文 ----\n" + body + "\n--------------")
        send_broadcast([ADMIN_EMAIL], "[DRY RUN] " + subject, body)
        log(f"✅ DRY RUN: {ADMIN_EMAIL} にのみ送信しました。フラグは更新していません。")
        send_article_notices(new_articles)   # 試運転では管理者宛になる
        return

    sent_chunks = 0
    failed_chunks = 0
    for i in range(0, len(recipients), CHUNK_SIZE):
        chunk = recipients[i:i + CHUNK_SIZE]
        try:
            send_broadcast(chunk, subject, body)
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
        f"（送信chunk {sent_chunks}成功/{failed_chunks}失敗、宛先{len(recipients)}人）")

    # ダイジェストが届いたあとで、載せた記事の書き手へ。こちらの失敗はダイジェストの結果を変えない
    try:
        send_article_notices(new_articles)
    except Exception as e:
        log(f"❌ 記事を紹介した知らせでエラー: {e}")
        send_admin_alert("【要確認】記事を紹介した知らせの失敗",
                         f"send_digest.py の send_article_notices で例外が発生しました: {e}")


def send_article_notices(articles):
    """ダイジェストに載せたオーナーの記事の書き手へ、「あなたの記事を紹介しました」を1人1通。
    ダイジェストと同じ朝に1回だけ（印は digest_sent_at＝ダイジェスト側で付く）。送れなくても再送はしない
    ＝同じ記事の紹介を二度知らせないほうを取る。宛先の無い人・前の持ち主には送らない。"""
    by_mail = {}
    for a in articles:
        if "@" in a["mail"]:
            by_mail.setdefault(a["mail"], {"name": a["owner"], "items": []})["items"].append(a)
    sent = 0
    for mail, entry in by_mail.items():
        lines = "\n".join(f"・「{a['title']}」\n　{a['url']}" for a in entry["items"])
        doc = entry["items"][0]["doc"]
        body = (
            f"{entry['name']} さん\n\n"
            "登録オーナーのみなさんへのお知らせメールで、あなたの記事を「オーナーの記事」として紹介しました。\n\n"
            + lines + "\n\n"
            "車両ページの「この1台の歩み」にも並んでいます。\n"
            f"{SITE}/detail.html?doc={doc}#history\n\n"
            "新しい記事を書いたときも、URLを貼るだけで同じように紹介されます。\n"
            f"{SITE}/my-articles\n\n"
            "――\n"
            "このメールは、記事がお知らせメールに載った日に1通だけお送りしています。\n"
            "Registro500 Giappone")
        to = ADMIN_EMAIL if DRY_RUN else mail
        try:
            brevo_send({
                "replyTo": {"name": SENDER_NAME, "email": REPLY_TO_EMAIL},
                "to": [{"email": to}],
                "subject": ("[DRY RUN] " if DRY_RUN else "") + "【Registro500】あなたの記事を紹介しました",
                "textContent": body,
                "htmlContent": text_to_html(body),
            })
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
        if entry["items"]:
            lines = []
            for name in dict.fromkeys(n for n, _, _ in entry["items"]):
                lines.append("・" + name)
                lines += [f"　　{VERB[k]} ― {w}" for n, k, w in entry["items"] if n == name]
            kinds = {k for _, k, _ in entry["items"]}
            if kinds == {"helpful"}:
                lead = "「みんなのおすすめ工具・パーツ」に書いていただいた紹介が、ほかのオーナーの参考になりました。"
                subject = "【Registro500】あなたの紹介が、ほかのオーナーの参考になりました"
            elif kinds == {"metoo"}:
                lead = ("「みんなのおすすめ工具・パーツ」で紹介していただいた物に、"
                        "ほかのオーナーから「🔧 わたしも使ってる」が届きました。")
                subject = "【Registro500】あなたの紹介した物を、ほかのオーナーも使っています"
            else:
                lead = "「みんなのおすすめ工具・パーツ」に書いていただいた紹介に、ほかのオーナーから声が届きました。"
                subject = "【Registro500】あなたの紹介に、ほかのオーナーから声が届きました"
            body = (
                f"{entry['name']} さん\n\n" + lead + "\n\n"
                + "\n".join(lines) + "\n\n"
                "あなたの紹介が、ほかのオーナーの役に立っています。ありがとうございます。\n\n"
                f"みんなのおすすめ工具・パーツ\n{SITE}/tools\n\n"
                "――\n"
                "このメールは、紹介に「わたしも使ってる」「参考になった」が押されたとき、"
                "翌朝にまとめて1通だけお送りしています。"
                "「参考になった」の数はサイトには表示せず、このメールでだけお知らせしています。\n"
                "Registro500 Giappone")
            to = ADMIN_EMAIL if DRY_RUN else mail
            try:
                brevo_send({
                    "replyTo": {"name": SENDER_NAME, "email": REPLY_TO_EMAIL},
                    "to": [{"email": to}],
                    "subject": ("[DRY RUN] " if DRY_RUN else "") + subject,
                    "textContent": body,
                    "htmlContent": text_to_html(body),
                })
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
