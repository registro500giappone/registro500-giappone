# -*- coding: utf-8 -*-
"""壁紙ジェネレータ（オールタイル）のスプライトシートを焼く。

出力（いずれも wallpaper/dist/ ＝ Cloudflare Pages が自ドメインで配信する）：
  sprite.webp    169台＋ロゴ2枚を 256px 角で敷き詰めた1枚
  manifest.json  ID一覧・色順・ロゴの位置・署名

⭐ 自ドメインから配る1枚に焼き込むのが CORS 回避の肝。
   Firebase Storage には Access-Control-Allow-Origin が無く、ブラウザから直接読むと
   canvas が汚染されて toBlob が SecurityError で落ちる（HANDOFF §6）。

⭐ 色順の並びはここで確定して manifest に焼き込む。
   色グループの辞書と濃淡の測定は画素を見る処理なので、ブラウザ側へ移植すると
   二重管理になって必ずズレる（HANDOFF §2 の正本はこのファイル）。

使い方:
  python build_wallpaper_sprite.py          # 対象に変化があれば焼き直す
  python build_wallpaper_sprite.py --force  # 変化が無くても焼く
  python build_wallpaper_sprite.py --check  # 焼かずに要否だけ見る（終了コード 0=不要 / 10=要）
"""
import os, sys, json, math, hashlib, colorsys
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

import requests
from PIL import Image, ImageOps

SUPABASE_URL = "https://ttlttclfovuzafvghvaq.supabase.co"
# 公開キー＝全訪問者に配られている値。RLS が効くので匿名で見えるものしか返らない。
SUPABASE_KEY = "sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt"

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, ".."))
DIST = os.path.join(ROOT, "wallpaper", "dist")
CACHE = os.path.join(BASE, ".wallpaper-cache")
ROT_FIX_PATH = os.path.join(ROOT, "wallpaper", "proto", "rotate-fix.json")

TILE = 256          # 1枠の画素数。実機は最大でも 1290/9列≒143px なので余裕がある
COLS = 13           # スプライトの列数（絵の格子とは無関係・ただの詰め方）
MANIFEST_VERSION = 1


# ---------------------------------------------------------------- 色の正規化
# ⛔ この並びは HANDOFF §2-1 で確定（案3）。勝手に変えない。
#    白→クリーム→グレー→黄→橙→赤→紫→紺→青→水色→緑→黄緑（黒は末尾）
GROUPS = ["white", "cream", "gray", "yellow", "orange", "red",
          "purple", "navy", "blue", "cyan", "green", "yellowgreen", "black"]

# 判定は上から順に当てる（長い語・複合語を先に置く）
RULES = [
    ("yellowgreen", ["黄色ちょっと緑", "イエローグリーン", "ライトグリーン", "ミントグリーン", "抹茶"]),
    ("green",  ["オリーブグリーン", "ダークグリーンメタリック", "グリーン", "green", "緑"]),
    ("cyan",   ["アズーロアクアマリーナ", "ターコイズ", "アクアグレー", "アズーロ", "azur",
                "水色", "空色", "ライトブルー"]),
    ("navy",   ["ネイビー", "紺", "blu scuro", "ダークブルー"]),
    ("blue",   ["ブルーヴォラーレ", "ミディアムブルー", "blu medio", "ブルー", "blue", "青"]),
    ("purple", ["ラベンダー", "パープル", "紫"]),
    ("orange", ["オレンジ", "orange"]),
    ("red",    ["朱か赤か", "ロッソ", "rosso", "red", "赤"]),
    ("yellow", ["クリームイエロー", "バニライエロー", "パルテルイエロー", "ポジターノイエロー",
                "ルノーカングーイエロー", "ジャッロ", "giallo", "イエロー", "yellow",
                "オムレツ色", "黄色系", "黄色", "黄"]),
    ("cream",  ["コットンアイボリー", "白系クリーム", "アイボリー", "クリーム", "ベージュ",
                "beige", "象牙色", "avorio"]),
    ("gray",   ["ライトグレー", "アゾーログリージョ", "grigio", "グレー", "シルバー", "silver", "灰"]),
    ("black",  ["ブラック", "black", "黒"]),
    ("white",  ["琺瑯ビアンコ", "ビアンコ", "bianco", "ホワイト", "white", "白"]),
]

# 濃淡を測るとき、その申告色の色相域に入る画素だけを見る（背景に引っ張られないため）
HUE = {
    "red":         [(338, 360), (0, 20)],
    "orange":      [(12, 46)],
    "yellow":      [(38, 72)],
    "yellowgreen": [(60, 100)],
    "green":       [(88, 168)],
    "cyan":        [(152, 208)],
    "blue":        [(195, 268)],
    "navy":        [(195, 272)],
    "purple":      [(252, 308)],
}


def normalize(raw):
    """body_color の自由記述 → 色グループ。判定できなければ None"""
    if not raw:
        return None
    s = raw.strip().lower()
    if "→" in s:                       # 「（黒→）黄」は矢印の後ろ＝現在の色
        s = s.split("→")[-1]
    for sep in ("／", "/", "・"):        # 「白／グリーンベルト」は先頭＝主色
        if sep in s:
            s = s.split(sep)[0]
    for g, words in RULES:
        for w in words:
            if w.lower() in s:
                return g
    return None


def guess_from_photo(tile):
    """申告が空欄のとき用。中央帯（空と地面を外す）の最大クラスタの色相で決める"""
    w, h = tile.size
    band = tile.crop((int(w * .18), int(h * .26), int(w * .82), int(h * .80)))
    q = band.quantize(colors=6, method=Image.MEDIANCUT)
    pal = q.getpalette()
    _, idx = sorted(q.getcolors(), reverse=True)[0]
    r, g, b = pal[idx * 3:idx * 3 + 3]
    hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if ss < 0.13:
        return "white" if vv > .72 else ("gray" if vv > .3 else "black")
    d = hh * 360
    if d < 16 or d >= 345: return "red"
    if d < 42:  return "orange"
    if d < 70:  return "yellow"
    if d < 95:  return "yellowgreen"
    if d < 160: return "green"
    if d < 200: return "cyan"
    if d < 235: return "blue" if vv > .45 else "navy"
    if d < 260: return "navy"
    if d < 300: return "purple"
    return "red"


def body_tone(tile, grp, fallback_v):
    """車体色の淡さ。淡いほど大きい。L = V*(1-S/2) の平均"""
    w, h = tile.size
    band = tile.crop((int(w * .15), int(h * .22), int(w * .85), int(h * .84))).resize((56, 56))
    px = band.load()
    vals = []
    for y in range(56):
        for x in range(56):
            r, g, b = px[x, y]
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            d = hh * 360
            if grp in ("white", "gray", "black"):
                ok = ss < 0.20
            elif grp == "cream":
                ok = ss < 0.48 and 10 <= d <= 82
            else:
                ok = ss >= 0.15 and any(a <= d <= b2 for a, b2 in HUE.get(grp, []))
            if ok:
                vals.append(vv * (1 - ss / 2))
    if len(vals) < 56 * 56 * 0.03:      # 該当画素が乏しければ写真全体で代用
        return fallback_v
    return sum(vals) / len(vals)


def color_order(items):
    """色順の並び（index の配列）。グループ順に並べ、1グループおきに向きを反転する。
    ⭐ 反転により境目が必ず『濃と濃』『淡と淡』で接し、全体がひと続きになる（HANDOFF §2-2）。"""
    out, placed = [], 0
    for g in GROUPS:
        members = [k for k, it in enumerate(items) if it["grp"] == g]
        if not members:
            continue
        members.sort(key=lambda k: -items[k]["tone"])   # 淡 → 濃
        if placed % 2 == 1:
            members.reverse()                           # 濃 → 淡
        out.extend(members)
        placed += 1
    return out


# ---------------------------------------------------------------- 取得と署名
def fetch_cars():
    """スプライトに入れる車。⛔ sns_share_optout の車は入れない（掟）"""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/cars",
        params={
            "select": "document_id,photo_main,body_color,updated_at",
            "photo_main": "not.is.null",
            "or": "(sns_share_optout.is.null,sns_share_optout.is.false)",
            "limit": "1000",
        },
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        timeout=30,
    )
    r.raise_for_status()
    rows = [x for x in r.json() if x.get("photo_main")]

    def keyf(x):                        # 登録順＝document_id の数値部分
        d = str(x.get("document_id") or "")
        num = "".join(ch for ch in d if ch.isdigit())
        return (int(num) if num else 10 ** 9, d)

    rows.sort(key=keyf)
    return rows


def signature(rows):
    """対象の集合が変わったかを見る署名。
    新規登録・削除・写真差し替え・色の書き換えのいずれでも変わる。"""
    h = hashlib.sha256()
    for x in rows:
        h.update("\x1f".join([
            str(x.get("document_id") or ""),
            str(x.get("photo_main") or ""),
            str(x.get("body_color") or ""),
            str(x.get("updated_at") or ""),
        ]).encode("utf-8"))
        h.update(b"\x1e")
    return h.hexdigest()


def load_prev_sig():
    p = os.path.join(DIST, "manifest.json")
    if not os.path.exists(p):
        return None
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f).get("sig")
    except Exception:
        return None


def download(row):
    did = row["document_id"]
    # ⚠️ キャッシュ名に「写真URL＋更新日時」を混ぜる。document_id だけで名付けると、
    #    オーナーが写真を差し替えても古い1枚を使い続ける（同じ置き場へ上書きされた場合も拾えない）。
    stamp = hashlib.md5(
        (str(row.get("photo_main") or "") + "\x1f" + str(row.get("updated_at") or "")).encode("utf-8")
    ).hexdigest()[:10]
    path = os.path.join(CACHE, f"{did}-{stamp}.jpg")
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return path
    try:
        r = requests.get(row["photo_main"], timeout=60)
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
        return path
    except Exception as e:
        print(f"  NG {did}: {e}", file=sys.stderr)
        return None


def flatten(path):
    """透過PNGを白地へ合成する（そのまま convert すると透過部が黒くなる）"""
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


# ------------------------------------------------------------------- 本体
def main():
    force = "--force" in sys.argv
    check_only = "--check" in sys.argv

    os.makedirs(CACHE, exist_ok=True)
    rows = fetch_cars()
    sig = signature(rows)
    prev = load_prev_sig()
    print(f"対象 {len(rows)} 台 / 署名 {sig[:12]} (前回 {str(prev)[:12]})")

    if sig == prev and not force:
        print("変化なし。焼き直さない。")
        return 0
    if check_only:
        print("要ビルド。")
        return 10

    rot_fix = {}
    if os.path.exists(ROT_FIX_PATH):
        with open(ROT_FIX_PATH, encoding="utf-8") as f:
            rot_fix = json.load(f)

    with ThreadPoolExecutor(max_workers=8) as ex:
        paths = list(ex.map(download, rows))

    tiles, items = [], []
    for row, p in zip(rows, paths):
        if not p:
            continue
        try:
            im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        except Exception as e:
            print(f"  破損 {row['document_id']}: {e}", file=sys.stderr)
            continue
        # ⚠️ EXIF が剥がれて横倒しのまま保存された写真の手当て（HANDOFF §6）
        deg = rot_fix.get(row["document_id"])
        if deg:
            im = im.rotate(deg, expand=True)
        tile = ImageOps.fit(im, (TILE, TILE), Image.LANCZOS, centering=(0.5, 0.5))

        grp = normalize(row.get("body_color"))
        guessed = grp is None
        if guessed:
            grp = guess_from_photo(tile)
        c = tile.crop((int(TILE * .2),) * 2 + (int(TILE * .8),) * 2).resize((1, 1), Image.LANCZOS)
        r_, g_, b_ = c.getpixel((0, 0))
        _, _, v_ = colorsys.rgb_to_hsv(r_ / 255, g_ / 255, b_ / 255)

        tiles.append(tile)
        items.append({
            "id": row["document_id"],
            "grp": grp,
            "guessed": guessed,
            "tone": body_tone(tile, grp, v_),
        })

    n = len(tiles)
    print(f"タイル {n} 枚（申告から {sum(1 for x in items if not x['guessed'])} / 写真から推定 "
          f"{sum(1 for x in items if x['guessed'])}）")

    # ロゴは「最後の2枚の写真」としてスプライトへ焼く。
    # ⭐ 別ファイルにすると canvas が2枚の読み込みを待つことになるので1枚に含める。
    logos = [
        ("r500", flatten(os.path.join(ROOT, "icon-512.png"))),
        ("r126", flatten(os.path.join(ROOT, "logo_vertical126_512.png"))),
    ]
    logo_index = {}
    for name, im in logos:
        logo_index[name] = len(tiles)
        tiles.append(ImageOps.fit(im, (TILE, TILE), Image.LANCZOS, centering=(0.5, 0.5)))

    total = len(tiles)
    sheet_rows = math.ceil(total / COLS)
    sheet = Image.new("RGB", (COLS * TILE, sheet_rows * TILE), (255, 255, 255))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % COLS) * TILE, (i // COLS) * TILE))

    os.makedirs(DIST, exist_ok=True)
    wp = os.path.join(DIST, "sprite.webp")
    sheet.save(wp, "WEBP", quality=82, method=6)

    manifest = {
        "v": MANIFEST_VERSION,
        "sig": sig,
        "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tile": TILE,
        "cols": COLS,
        "rows": sheet_rows,
        "count": n,                       # 車の枚数（ロゴを含まない）
        "logo": logo_index,               # スプライト内の位置
        "ids": [x["id"] for x in items],  # 登録順。添字がスプライト内の位置
        "order_color": color_order(items),
    }
    with open(os.path.join(DIST, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))

    mp = sheet.size[0] * sheet.size[1] / 1e6
    print(f"シート {sheet.size[0]}x{sheet.size[1]} = {mp:.1f} Mpx / "
          f"{os.path.getsize(wp) / 1024 / 1024:.2f} MB")
    if mp > 16.0:
        # ⚠️ iOS Safari の canvas 総画素の上限が約 16.7Mpx（HANDOFF §6）
        print("⚠️ スプライトが iOS の canvas 上限に近い。TILE を下げるか列数を見直すこと。",
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
