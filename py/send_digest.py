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

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(BASE, "py", ".env")

env = {}
if os.path.exists(ENV):
    for line in open(ENV, encoding="utf-8"):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v


def cfg(name, default=None):
    """py/.env を優先し、無ければ環境変数を見る（ローカル実行と CI の両対応）"""
    return env.get(name) or os.environ.get(name) or default


SUPA_URL = (cfg("SUPABASE_URL") or "").rstrip("/")
SUPA_KEY = cfg("SUPABASE_SERVICE_KEY") or cfg("SUPABASE_KEY")
BREVO_KEY = cfg("BREVO_API_KEY")

# main.gs と同一
SENDER_EMAIL = "news@registro500.com"
SENDER_NAME = "Registro500 Giappone"
REPLY_TO_EMAIL = "registro500giappone@gmail.com"
ADMIN_EMAIL = "registro500giappone@gmail.com"
SITE = "https://www.registro500.com"

CHUNK_SIZE = 90          # Brevo の BCC 上限に合わせた main.gs と同じ値
WINDOW_DAYS = 14         # 取り残し救済窓（配信失敗しても14日以内は自動リカバリ）
NEWS_LIMIT = 5           # main.gs の getUnsentNewsAll_ と同じ

DRY_RUN = str(cfg("DIGEST_DRY_RUN", "")).strip().lower() in ("1", "true", "yes")


def log(msg):
    print(msg, flush=True)


# =========================================================
# Supabase
# =========================================================
def _request(method, url, payload=None, extra_headers=None):
    headers = {
        "apikey": SUPA_KEY,
        "Authorization": "Bearer " + SUPA_KEY,
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=40) as res:
        body = res.read().decode("utf-8")
        return res.status, body


def sb_select(table, select, filters=None, extra=None):
    """PostgREST の GET。1000行の既定上限に当たらないよう Range でページングする。"""
    # PostgREST のフィルタ値は eq. / in.("a","b") の記法をそのまま通す必要がある
    safe_chars = '.()*,' + '"'
    params = ["select=" + urllib.parse.quote(select)]
    for key, val in (filters or {}).items():
        params.append(key + "=" + urllib.parse.quote(str(val), safe=safe_chars))
    if extra:
        params.append(extra)
    url = f"{SUPA_URL}/rest/v1/{table}?" + "&".join(params)

    rows = []
    page = 1000
    offset = 0
    while True:
        req = urllib.request.Request(url, headers={
            "apikey": SUPA_KEY,
            "Authorization": "Bearer " + SUPA_KEY,
            "Range-Unit": "items",
            "Range": f"{offset}-{offset + page - 1}",
        })
        with urllib.request.urlopen(req, timeout=40) as res:
            chunk = json.loads(res.read().decode("utf-8"))
        if not isinstance(chunk, list):
            raise RuntimeError(f"{table} の応答が配列ではありません: {chunk}")
        rows.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return rows


def sb_patch(table, row_id, data):
    url = f"{SUPA_URL}/rest/v1/{table}?id=eq.{urllib.parse.quote(str(row_id))}"
    code, body = _request("PATCH", url, data, {"Prefer": "return=minimal"})
    if not 200 <= code < 300:
        raise RuntimeError(f"{table} PATCH HTTP {code} / {body}")


def sb_rpc(fn, payload):
    code, body = _request("POST", f"{SUPA_URL}/rest/v1/rpc/{fn}", payload)
    if not 200 <= code < 300:
        raise RuntimeError(f"rpc {fn} HTTP {code} / {body}")


# =========================================================
# Brevo
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
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={"api-key": BREVO_KEY, "Content-Type": "application/json",
                 "accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            if not 200 <= res.status < 300:
                raise RuntimeError(f"Brevo API error: HTTP {res.status}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            f"Brevo API error: HTTP {e.code} / {e.read().decode('utf-8', 'replace')[:300]}")


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
    missing = [n for n, v in
               (("SUPABASE_URL", SUPA_URL), ("SUPABASE_SERVICE_KEY/SUPABASE_KEY", SUPA_KEY),
                ("BREVO_API_KEY", BREVO_KEY)) if not v]
    if missing:
        raise SystemExit("必須の設定がありません: " + ", ".join(missing))

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
    new_events = []
    for e in events_raw:
        d = datetime.strptime(str(e["event_date"])[:10], "%Y-%m-%d")
        new_events.append({"name": e["event_name"], "date": f"{d.year}/{d.month}/{d.day}",
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

    if not (news or new_cars or new_events or new_episodes):
        log("配信対象なし")
        return

    # 5. 件名・本文（main.gs と同一の文面）
    parts = []
    if new_cars:
        parts.append(f"新着車両{len(new_cars)}台")
    if new_events:
        parts.append(f"新着イベント{len(new_events)}件")
    if new_episodes:
        parts.append(f"新着ストーリー{len(new_episodes)}件")
    if news:
        parts.append("お知らせ")
    subject = "【Registro500/126 Giappone】" + "・".join(parts)

    body = "Registro500 / Registro126 Giappone オーナーの皆様\n\nおはようございます。\n"

    if new_cars:
        body += f"\n■ 🚗 新しい仲間 ({len(new_cars)}台)\n"
        for c in new_cars:
            body += f"・{c['model']} ({c['name']}様)\n　{SITE}/detail.html?doc={c['id']}\n"

    if new_events:
        body += f"\n■ 📅 新しいイベント ({len(new_events)}件)\n"
        for e in new_events:
            body += (f"・{e['date']}開催: {e['name']} (by {e['owner']}様)\n"
                     f"　場所: {e['loc']}\n　詳細: {SITE}/event.html\n")

    if new_episodes:
        body += f"\n■ 📖 新しいストーリー ({len(new_episodes)}件)\n"
        for e in new_episodes:
            body += f"・「{e['title']}」({e['owner']}様)\n　{SITE}/episode.html?ep={e['id']}\n"
        body += f"\n一覧: {SITE}/stories.html\n"

    if news:
        body += "\n■ 📢 お知らせ\n"
        for n in news:
            body += f"\n【{n['title']}】\n{n['content']}\n"
        body += f"\n詳細: {SITE}/news.html\n"

    body += ("\n---------------------------------------------------------\n"
             "Registro500 / Registro126 Giappone\n" + SITE + "/")

    # 6. 宛先（is_sold=true のオーナーは除外）
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

    # 7. フラグ更新（1chunk以上成功した場合のみ。全滅ならフラグ据え置きで次回再送）
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
    for n in news:
        try:
            sb_patch("news", n["id"], {
                "sent_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "email_sent": True})
        except Exception as e:
            log(f"❌ news フラグ更新エラー (id={n['id']}): {e}")

    log(f"メール配信完了: お知らせ{len(news)}件、車両{len(new_cars)}台、"
        f"イベント{len(new_events)}件、ストーリー{len(new_episodes)}件"
        f"（送信chunk {sent_chunks}成功/{failed_chunks}失敗、宛先{len(recipients)}人）")


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
