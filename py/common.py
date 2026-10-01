# -*- coding: utf-8 -*-
"""
py/ の運用スクリプト共通部品（標準ライブラリだけ・pip 不要）。

2026-09-30 の棚卸しで、`.env` の手書きパーサが6本・Supabase REST のヘルパが
ファイルごとに別名（sb / sb_get / sb_select …）・Brevo の送信が3か所に手書き
されていたのを1つに寄せた。クローラー側の supabase-py 版は crawler_common.py（別物）。

使い方:
    from common import cfg, sb_select, sb_rpc, sb_upsert, sb_patch, brevo_send
    rows = sb_select("cars", "id,handle_name", extra="order=id")
    brevo_send({"to": [...], "subject": ..., "textContent": ...})

設定の読み方（cfg）は py/.env を優先し、無ければ環境変数を見る。GitHub Actions は
各ワークフローが Secrets から py/.env を書き出しているので、どちらでも同じ値になる。

キーの優先順位は1つに固定する:
    SUPABASE_SERVICE_KEY があればそれ、無ければ SUPABASE_KEY（公開キー）。
    公開キーで「あえて」読みたいとき（RLS を効かせて匿名に見える範囲だけ取る）は
    supa_key(service=False) を明示する（build_wallpaper_sprite.py がその例）。
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # リポジトリ直下
ENV_PATH = os.path.join(BASE, "py", ".env")

# main.gs 時代から同じ差出人（send_digest.py と一致させる）
SENDER_EMAIL = "news@registro500.com"
SENDER_NAME = "Registro500 Giappone"
REPLY_TO_EMAIL = "registro500giappone@gmail.com"
ADMIN_EMAIL = "registro500giappone@gmail.com"
SITE = "https://www.registro500.com"

_TIMEOUT = 40


# ───────────────────────── 設定 ─────────────────────────
def load_env(path=ENV_PATH):
    """py/.env を dict にする。無ければ空 dict（CI では環境変数から拾う）。"""
    env = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


_ENV = load_env()


def cfg(name, default=None):
    """py/.env を優先し、無ければ環境変数。どちらにも無ければ default。"""
    return _ENV.get(name) or os.environ.get(name) or default


def require(*names):
    """必須設定が揃っているか。欠けていれば SystemExit（Actions を赤くして気づかせる）。"""
    missing = [n for n in names if not cfg(n)]
    if missing:
        raise SystemExit("必須の設定がありません: " + ", ".join(missing))


def supa_url():
    return (cfg("SUPABASE_URL") or "").rstrip("/")


def supa_key(service=True):
    """service=True: service_role 優先（無ければ公開キー）。service=False: 公開キーだけ。"""
    if service:
        return cfg("SUPABASE_SERVICE_KEY") or cfg("SUPABASE_KEY")
    return cfg("SUPABASE_KEY")


# ───────────────────────── Supabase REST (PostgREST) ─────────────────────────
def _headers(key, extra=None):
    h = {"apikey": key, "Authorization": "Bearer " + key}
    if extra:
        h.update(extra)
    return h


def _request(method, url, payload=None, headers=None, key=None, timeout=_TIMEOUT):
    """生の HTTP。2xx 以外は RuntimeError（本文の先頭を添える）。本文が空なら None。"""
    key = key or supa_key()
    data = None
    h = _headers(key, headers)
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            body = res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"{method} {url.split('?')[0]} HTTP {e.code} / {body}")
    return json.loads(body) if body.strip() else None


def sb_select(table, select="*", filters=None, extra="", key=None, paged=True):
    """GET。filters は {"id": "eq.1", "or": "(a.is.null,b.eq.x)"} のように PostgREST 記法で渡す。
    paged=True なら 1000 行の既定上限に当たらないよう Range で全件たどる。"""
    safe = '.()*,"'
    params = ["select=" + urllib.parse.quote(select, safe=safe)]
    for k, v in (filters or {}).items():
        params.append(k + "=" + urllib.parse.quote(str(v), safe=safe))
    if extra:
        params.append(extra)
    url = f"{supa_url()}/rest/v1/{table}?" + "&".join(params)
    key = key or supa_key()
    if not paged:
        return _request("GET", url, key=key)
    rows, page, offset = [], 1000, 0
    while True:
        chunk = _request("GET", url, key=key,
                         headers={"Range-Unit": "items", "Range": f"{offset}-{offset + page - 1}"})
        if not isinstance(chunk, list):
            raise RuntimeError(f"{table} の応答が配列ではありません: {chunk}")
        rows.extend(chunk)
        if len(chunk) < page:
            return rows
        offset += page


def sb_rpc(fn, payload=None, key=None):
    """POST /rpc/<fn>。戻り値があれば JSON、無ければ None。"""
    return _request("POST", f"{supa_url()}/rest/v1/rpc/{fn}", payload if payload is not None else {}, key=key)


def sb_upsert(table, rows, on_conflict=None, ignore_dup=False, key=None):
    """POST。ignore_dup=True なら UNIQUE 衝突を無視（台帳への追記用）、
    False なら merge-duplicates（同じキーを上書き）。rows は dict でも list でも可。"""
    url = f"{supa_url()}/rest/v1/{table}"
    if on_conflict:
        url += "?on_conflict=" + urllib.parse.quote(on_conflict)
    resolution = "ignore-duplicates" if ignore_dup else "merge-duplicates"
    return _request("POST", url, rows, key=key,
                    headers={"Prefer": f"resolution={resolution},return=minimal"})


def sb_patch(table, row_id, data, key=None, id_col="id"):
    url = f"{supa_url()}/rest/v1/{table}?{id_col}=eq.{urllib.parse.quote(str(row_id))}"
    return _request("PATCH", url, data, key=key, headers={"Prefer": "return=minimal"})


# ───────────────────────── Brevo ─────────────────────────
def brevo_send(payload, timeout=60):
    """/v3/smtp/email に1通投げる。sender が無ければ差出人を補う。
    成功で messageId（無ければ None）、失敗は RuntimeError（HTTP コードと本文の先頭）。"""
    api_key = cfg("BREVO_API_KEY")
    if not api_key:
        raise SystemExit("必須の設定がありません: BREVO_API_KEY")
    payload = dict(payload)
    payload.setdefault("sender", {"name": SENDER_NAME, "email": SENDER_EMAIL})
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            body = res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Brevo API error: HTTP {e.code} / {e.read().decode('utf-8', 'replace')[:300]}")
    try:
        return json.loads(body).get("messageId") if body.strip() else None
    except ValueError:
        return None
