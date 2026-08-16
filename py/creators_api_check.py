"""Amazon Creators API の疎通チェック（旧 PA-API の後継）

PA-API v5 は 2026-05-15 に廃止され、認証は OAuth2 client_credentials に変わった。
旧 PA-API の資料・SDK は使えないので注意（署名方式もパラメータ名も別物）。

用途:
    商品データ取得を実装する前に、まずこれを実行して 403 が解けているか確認する。
    403 AssociateNotEligible は「過去30日で適格販売10件」の要件未達を意味し、
    コードを直しても通らない。売上が回復すれば発送完了から約2日で自動的に復活する。

    ※ 管理画面 assoc_credentials/home の緑チェック2つは「認証情報を発行できるか」の
      判定であって「APIを呼べるか」ではない。緑が点いていても403は起こる。

使い方:
    cd py && python creators_api_check.py
"""

import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = pathlib.Path(__file__).with_name(".env")
TOKEN_URL = "https://api.amazon.co.jp/auth/o2/token"
API_URL = "https://creatorsapi.amazon/catalog/v1/getItems"
MARKETPLACE = "www.amazon.co.jp"
TEST_ASIN = "B00KM3U2T4"  # CTEK MXS 5.0JP（goods.html 掲載）

# resources は camelCase かつ offersV2 系。旧 "ItemInfo.Title" 等は 400 で弾かれる。
# 有効な値を忘れたら適当な値で一度叩けば、エラー本文に enum が全部列挙される。
RESOURCES = ["itemInfo.title", "offersV2.listings.price", "images.primary.small"]


def load_env():
    env = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def get_token(env):
    """PAAPI_* という変数名だが、中身は LWA の client_id / client_secret。"""
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": env["PAAPI_ACCESS_KEY"],
        "client_secret": env["PAAPI_SECRET_KEY"],
        "scope": "creatorsapi::default",
    }).encode()
    # LWA の標準は form-urlencoded（公式移行docの curl 例は JSON だが実際は form が正）
    req = urllib.request.Request(
        TOKEN_URL, data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)["access_token"]


def get_items(token, partner_tag, asins):
    body = {
        "partnerTag": partner_tag,
        "partnerType": "Associates",
        "marketplace": MARKETPLACE,
        "itemIds": asins,
        "resources": RESOURCES,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "x-marketplace": MARKETPLACE,
        },
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def main():
    env = load_env()
    tag = env.get("PAAPI_PARTNER_TAG", "")
    print(f"partner_tag = {tag}")

    try:
        token = get_token(env)
    except Exception as e:  # noqa: BLE001
        print(f"[NG] トークン取得に失敗: {type(e).__name__}: {e}")
        print("     → 認証情報が失効しているか、値が壊れている可能性がある。")
        return 1
    print("[OK] トークン取得（認証情報は有効）")

    try:
        res = get_items(token, tag, [TEST_ASIN])
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        if e.code == 403 and "AssociateNotEligible" in detail:
            print("[保留] 403 AssociateNotEligible")
            print("     → 過去30日の適格販売が10件に届いていない。実装に着手しても通らない。")
            print("     → 売上が回復すれば発送完了から約2日で自動的に復活する。")
            return 2
        print(f"[NG] HTTP {e.code}: {detail[:500]}")
        return 1
    except Exception as e:  # noqa: BLE001
        print(f"[NG] {type(e).__name__}: {e}")
        return 1

    print("[OK] GetItems 成功（403は解けている＝実装を進められる）")
    print(json.dumps(res, ensure_ascii=False, indent=2)[:1200])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
