# -*- coding: utf-8 -*-
"""
週刊 Registro 便り（週1回・土曜の朝）— 2026-11-04

車をお持ちでない人（Amici＝/amici で登録した人）へ、その週の新着をまとめて送る。
朝のダイジェスト（send_digest.py・オーナー向け）の一般公開版:
  - ⛔オーナー先行のものは載せない（旅手帳は一般公開になった回だけ・先行公開の告知の news も除く）
  - 公開前の機能（整備の記録・オーナーの記事）は send_digest.py のスイッチにそろえる＝入れたら両方に載る

集め方は「直近7日に登録・作成されたもの」。ダイジェストの送信済みの印（notification_sent など）は
ダイジェストのものなので、ここでは読むだけで触らない。
並び（2026-11-04 ユーザー決裁）：お知らせ → 新しい登録車 → これからのイベント → 旅手帳 → ストーリー → 工具・パーツ。

宛先＝mail_subscriptions（list=weekly）で止めていない人。いま手放していない車の持ち主は
朝のダイジェストが届くので除く。1人ずつ配信停止リンクを付ける（send_digest.send_personal）。
同じ日に二度送らない＝mail_weekly_sends に1日1行（宛先の人数も残す）。

実行: python py/send_weekly.py
環境変数 WEEKLY_DRY_RUN=1 で「管理者1人だけに送り、控えも残さない」試運転になる。
"""
import json
import os
import time
from datetime import datetime, timedelta, timezone

from common import (cfg, require, supa_key, sb_select, sb_upsert, ADMIN_EMAIL, SITE)
from send_digest import (log, send_personal, send_broadcast, send_admin_alert, unsub_footer, CHUNK_SIZE,
                         TOOLS_DIGEST_ON, MAINT_DIGEST_ON, ARTICLES_DIGEST_ON)

WINDOW_DAYS = 7
EVENT_AHEAD_DAYS = 14    # 登録が古くても、2週間以内に開かれるイベントは載せる
NEWS_LIMIT = 5
LIST_MAX = 10            # 1つの欄に並べる上限（超えた分は「ほか◯件」）
JOURNEY_NEWS_PREFIX = "電装トラブルの旅手帳"   # 旅手帳の告知（先行公開を含む）＝日程表から出し直すので news からは除く
# Brevo 無料枠は1日300通。土曜は朝のダイジェスト（約180通）と同じ日＝超えそうなら有料プランの検討を管理人へ（⛔契約は承認制）
WARN_RECIPIENTS = 100

DRY_RUN = str(cfg("WEEKLY_DRY_RUN", "")).strip().lower() in ("1", "true", "yes")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def in_list(ids):
    return "(" + ",".join('"' + str(i) + '"' for i in sorted(ids)) + ")"


def car_map(ids, select="document_id,handle_name,model_display_c,is_sold"):
    if not ids:
        return {}
    return {c["document_id"]: c for c in sb_select("cars", select, {"document_id": f"in.{in_list(ids)}"})}


def jp_date(s):
    d = datetime.strptime(str(s)[:10], "%Y-%m-%d")
    return f"{d.month}月{d.day}日（{'月火水木金土日'[d.weekday()]}）"


def more(n):
    return f"・ほか{n - LIST_MAX}件\n" if n > LIST_MAX else ""


def main():
    require("SUPABASE_URL", "BREVO_API_KEY")
    if not supa_key():
        raise SystemExit("必須の設定がありません: SUPABASE_SERVICE_KEY/SUPABASE_KEY")

    now = datetime.now(timezone.utc)
    today = (now + timedelta(hours=9)).date()           # JST
    since = (now - timedelta(days=WINDOW_DAYS)).isoformat().replace("+00:00", "Z")
    log(f"週刊 Registro 便り 開始: {now.isoformat()}" + ("  ★DRY RUN★" if DRY_RUN else ""))

    if not DRY_RUN and sb_select("mail_weekly_sends", "sent_on", {"sent_on": f"eq.{today}"}, paged=False):
        log(f"{today} は送信済み → 何もしません")
        return

    # 1. お知らせ（旅手帳の告知は除く）
    news = [n for n in sb_select("news", "id,title,content,created_at", {"created_at": f"gte.{since}"},
                                 "order=id.asc")
            if not str(n.get("title") or "").startswith(JOURNEY_NEWS_PREFIX)][:NEWS_LIMIT]

    # 2. 新しい登録車
    cars = sb_select("cars", "document_id,handle_name,model_display_c",
                     {"created_at": f"gte.{since}"}, "order=created_at.asc")

    # 3. これからのイベント（今週登録されたもの＋2週間以内に開かれるもの・開催日順）
    try:
        with open(os.path.join(ROOT, "event-slugs.json"), encoding="utf-8") as f:
            slugs = json.load(f)
    except Exception as ex:
        log(f"event-slugs.json が読めないので、イベントは一覧へ案内します: {ex}")
        slugs = {}
    ev_raw = sb_select("events", "id,event_name,event_date,owner_name,location,created_at",
                       {"event_date": f"gte.{today}"}, "order=event_date.asc")
    soon = today + timedelta(days=EVENT_AHEAD_DAYS)
    events = [e for e in ev_raw
              if e["created_at"] >= since or str(e["event_date"])[:10] <= soon.isoformat()]

    # 4. 旅手帳＝この1週間（前の土曜〜今日）に一般公開になった回。⛔先行（early）は載せない
    with open(os.path.join(ROOT, "journey-schedule.json"), encoding="utf-8") as f:
        sch = json.load(f)
    lo = (today - timedelta(days=WINDOW_DAYS - 1)).isoformat()
    journeys = [dict(it, label=f"第{it['n']}回") for it in sch["issues"] if lo <= it["public"] <= today.isoformat()]
    journeys += [dict(e, label="別冊") for e in sch.get("extras", []) if lo <= e["public"] <= today.isoformat()]

    # 5. ストーリー
    eps = sb_select("car_episodes", "id,car_id,title",
                    {"is_published": "eq.true", "created_at": f"gte.{since}"}, "order=created_at.asc")
    ep_cars = car_map({e["car_id"] for e in eps if e.get("car_id")})

    # 6. おすすめ工具・パーツ
    tools, tl_cars = [], {}
    if TOOLS_DIGEST_ON:
        tools = sb_select("owner_tools", "id,car_id,name",
                          {"is_hidden": "eq.false", "created_at": f"gte.{since}"}, "order=created_at.asc")
        tl_cars = car_map({t["car_id"] for t in tools if t.get("car_id")})

    # 7. 整備の記録（スイッチ連動・1台1行・手放された車は載せない）
    maint = []
    if MAINT_DIGEST_ON:
        mr = sb_select("maint_records", "car_id,title",
                       {"is_public": "eq.true", "work_date": "not.is.null", "created_at": f"gte.{since}"},
                       "order=created_at.asc")
        mr_cars = car_map({r["car_id"] for r in mr})
        groups = {}
        for r in mr:
            car = mr_cars.get(r["car_id"])
            if car and not car.get("is_sold"):
                groups.setdefault(r["car_id"], {"car": car, "titles": []})["titles"].append(r["title"])
        maint = [dict(g, doc=k) for k, g in groups.items()]

    # 8. オーナーの記事（スイッチ連動・手放された車は載せない）
    articles = []
    if ARTICLES_DIGEST_ON:
        ar = sb_select("owner_articles", "car_id,title,url,site_name",
                       {"is_hidden": "eq.false", "created_at": f"gte.{since}"}, "order=created_at.asc")
        ar_cars = car_map({r["car_id"] for r in ar})
        articles = [dict(r, owner=ar_cars[r["car_id"]].get("handle_name") or "オーナー")
                    for r in ar if r["car_id"] in ar_cars and not ar_cars[r["car_id"]].get("is_sold")]

    n_items = len(news) + len(cars) + len(events) + len(journeys) + len(eps) + len(tools) + len(maint) + len(articles)
    if not n_items:
        log("今週は載せるものがありません → 送りません")
        return

    # 本文（⛔時刻に依存する挨拶にしない＝Actions の schedule は数時間遅れることがある）
    subject = f"【週刊 Registro 便り】{today.month}月{today.day}日号"
    body = ("Registro500 / Registro126 Giappone の Amici の皆様\n\n"
            "今週の新しい登録車・イベント・記事をお届けします。\n"
            "気になる車やイベントは、リンクから写真や詳しい内容をご覧ください。\n")

    def section(emoji, heading, list_url=None):
        s = f"\n■ {emoji} {heading}\n"
        if list_url:
            s += f"一覧：{SITE}{list_url}\n"
        return s + "\n"

    if news:
        body += section("📢", f"お知らせ（{len(news)}件）", "/news")
        for n in news:
            body += f"【{n['title']}】\n{n['content']}\n\n"
    if cars:
        body += section("🚗", f"新しい仲間（{len(cars)}台）が登録されました")
        for c in cars[:LIST_MAX]:
            body += (f"・{c.get('model_display_c') or 'FIAT 500'}（{c.get('handle_name') or 'オーナー'}様）\n"
                     f"　{SITE}/detail?doc={c['document_id']}\n")
        body += more(len(cars))
    if events:
        body += section("📅", f"これからのイベント（{len(events)}件）", "/event")
        for e in events[:LIST_MAX]:
            slug = slugs.get(e["id"])   # 個別ページがまだ無い登録直後のものは、見出しの一覧へ
            body += (f"・{e['event_name']}（{e.get('owner_name') or ''}様）\n"
                     f"　日時：{jp_date(e['event_date'])}　場所：{' '.join(str(e.get('location') or '').split())}\n")
            if slug:
                body += f"　{SITE}/event/{slug}/\n"
        body += more(len(events))
    if journeys:
        body += section("🔌", "電装トラブルの旅手帳が公開されました", "/wiring-journey")
        for j in journeys:
            body += f"・{j['label']}「{j['title']}」\n　{SITE}/wiring-journey-{j['slug']}\n"
    if eps:
        body += section("📖", f"新しいストーリー（{len(eps)}件）が投稿されました", "/stories")
        for e in eps[:LIST_MAX]:
            owner = (ep_cars.get(e.get("car_id")) or {}).get("handle_name") or "オーナー"
            body += f"・「{e.get('title') or '(無題)'}」（{owner}様）\n　{SITE}/episode?ep={e['id']}\n"
        body += more(len(eps))
    if tools:
        body += section("🔧", f"新しいおすすめ工具・パーツ（{len(tools)}件）が登録されました", "/tools")
        for t in tools[:LIST_MAX]:
            body += f"・{t['name']}（{(tl_cars.get(t.get('car_id')) or {}).get('handle_name') or 'オーナー'}様）\n"
        body += more(len(tools))
    if maint:
        body += section("🛠️", f"新しい整備の記録（{sum(len(m['titles']) for m in maint)}件）が登録されました",
                        "/maintenance")
        for m in maint[:LIST_MAX]:
            names = "・".join(m["titles"][:3]) + (f" ほか{len(m['titles']) - 3}件" if len(m["titles"]) > 3 else "")
            body += (f"・{m['car'].get('model_display_c') or 'FIAT 500'}（{m['car'].get('handle_name') or 'オーナー'}様）"
                     f"：{names}\n　{SITE}/detail?doc={m['doc']}#history\n")
        body += more(len(maint))
    if articles:
        body += section("✍️", f"オーナーの記事（{len(articles)}件）")
        for a in articles[:LIST_MAX]:
            via = f"・{a['site_name']}" if a.get("site_name") else ""
            body += f"・「{a['title']}」（{a['owner']}様{via}）\n　{a['url']}\n"
        body += more(len(articles))

    # 未来のオーナーへの道筋（2026-11-04 ユーザー決裁＝興味の維持→購入→オーナー登録）。毎号の末尾に同じ一言
    body += ("\n■ 🔑 500 / 126 を手に入れたら\n"
             "オーナーとして登録すると、愛車のページができ、新着がある日の朝のお知らせに切り替わります。\n"
             f"{SITE}/howto\n")

    # 送信者の表示（特定電子メール法）。配信停止リンクは send_personal が1人ずつ足す
    body += ("\n---------------------------------------------------------\n"
             "週刊 Registro 便り\n"
             "送信者：Registro500 / Registro126 Giappone\n" + SITE + "/\n"
             "お問い合わせ：registro500giappone@gmail.com")

    # 宛先＝止めていない Amici から、いまの車の持ち主（朝のダイジェストが届く人）を除く
    owners = {str(c.get("owner_email") or "").strip().lower()
              for c in sb_select("cars", "owner_email", {"is_sold": "is.false"})}
    subs = sb_select("mail_subscriptions", "email,unsub_token",
                     {"list": "eq.weekly", "unsubscribed_at": "is.null"})
    recipients = [(s["email"], s["unsub_token"]) for s in subs if s["email"] not in owners]

    if DRY_RUN:
        log("---- DRY RUN: 実際の宛先には送りません ----")
        log(f"件名: {subject}\n本来の宛先数: {len(recipients)}人（載せたもの {n_items}件）")
        log("---- 本文 ----\n" + body + "\n--------------")
        send_broadcast([ADMIN_EMAIL], "[DRY RUN] " + subject,
                       body + unsub_footer("（試運転のため、ここに1人ずつの札が入ります）"))
        log(f"✅ DRY RUN: {ADMIN_EMAIL} にのみ送信しました。控えは残していません。")
        return

    if not recipients:
        log("宛先がいません → 送りません")
        return
    if len(recipients) > WARN_RECIPIENTS:
        send_admin_alert("【要確認】週刊 Registro 便りの宛先が増えました",
                         f"今回の宛先は {len(recipients)}人です。土曜は朝のダイジェストと合わせて "
                         "Brevo 無料枠（1日300通）に近づきます。有料プランの検討をお願いします。")

    sent, failed = 0, 0
    for i in range(0, len(recipients), CHUNK_SIZE):
        try:
            send_personal(recipients[i:i + CHUNK_SIZE], subject, body)
            sent += 1
            time.sleep(1)
        except Exception as e:
            failed += 1
            log(f"メール送信エラー (chunk {i}): {e}")
    if sent == 0:
        send_admin_alert("【要確認】週刊 Registro 便りの送信失敗", f"全{failed}chunkの送信に失敗しました。件名: {subject}")
        raise SystemExit(1)

    sb_upsert("mail_weekly_sends", {"sent_on": today.isoformat(), "recipients": len(recipients), "items": n_items},
              on_conflict="sent_on", ignore_dup=True)
    log(f"✅ 週刊 Registro 便り 配信完了: 宛先{len(recipients)}人・載せたもの{n_items}件"
        f"（chunk {sent}成功/{failed}失敗）")


if __name__ == "__main__":
    main()
