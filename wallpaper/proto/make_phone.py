# -*- coding: utf-8 -*-
"""段1e: スマホ待ち受け 1179x2556
- ハイライト = センター固定・2x2・囲み線なし
- 周りとの差は「濃度」だけ（段階を比較）
- 色順ロジックを body_color 辞書ベースへ作り直し
- アイコンは最後の写真として格子に並べる
"""
import os, json, math, colorsys
import requests
from PIL import Image, ImageDraw, ImageFont

FONT_R = "C:/Windows/Fonts/YuGothR.ttc"


def f(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "out")
MOCK = os.path.join(OUT, "phone")
os.makedirs(MOCK, exist_ok=True)

SUPABASE_URL = "https://ttlttclfovuzafvghvaq.supabase.co"
KEY = "sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt"

SHEET = Image.open(os.path.join(OUT, "sprite-v1.jpg")).convert("RGB")
MAN = json.load(open(os.path.join(OUT, "manifest-v1.json"), encoding="utf-8"))
TILE, COLS_S = MAN["tile"], MAN["cols"]
ITEMS = MAN["items"]
N = len(ITEMS)

# repo ルート（ロゴ画像の在り処）。proto/ 以外から実行するときは R500_ROOT を渡す
_R = os.environ.get("R500_ROOT", os.path.abspath(os.path.join(BASE, "..", ".."))) + os.sep


def flatten(path):
    """透過PNGを白地へ合成する（そのまま convert すると透過部が黒くなる）"""
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


# 126 が先、500 が後
ICONS = [flatten(_R + "logo_vertical126_512.png"), flatten(_R + "icon-512.png")]

W, H = 1179, 2556
SPAN = 2
HI = 96

# ---------------------------------------------------------------- 色の正規化
# グループの並び（3案を比較する）
SORTS = {
    # 案1: 無彩色を先頭にまとめ、そのまま色相環を一周する
    "s1": ["white", "gray", "cream", "yellow", "yellowgreen", "green",
           "cyan", "blue", "navy", "purple", "red", "orange", "black"],
    # 案2: 明るい色から暗い色へ降りる（色相より明度を優先）
    "s2": ["white", "cream", "yellow", "gray", "yellowgreen", "cyan",
           "green", "orange", "red", "blue", "purple", "navy", "black"],
    # 案3: 暖色から寒色へ（グレーはクリームの隣）
    "s3": ["white", "cream", "gray", "yellow", "orange", "red",
           "purple", "navy", "blue", "cyan", "green", "yellowgreen", "black"],
}
GROUPS = SORTS["s1"]
GI = {g: i for i, g in enumerate(GROUPS)}

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


def normalize(raw):
    """body_color の自由記述 → 色グループ。判定できなければ None"""
    if not raw:
        return None
    s = raw.strip().lower()
    # 「（黒→）黄」のような履歴表記は矢印の後ろ＝現在の色を採る
    if "→" in s:
        s = s.split("→")[-1]
    # 「グレー ／ 赤」「白／グリーンベルト」は先頭＝主色を採る
    for sep in ("／", "/", "・"):
        if sep in s:
            s = s.split(sep)[0]
    for g, words in RULES:
        for w in words:
            if w.lower() in s:
                return g
    return None


def guess_from_photo(i):
    """空欄用: タイルの中央帯（空と地面を外す）から最大クラスタの色を取り、グループへ"""
    t = tile_img(i)
    w, h = t.size
    band = t.crop((int(w * .18), int(h * .26), int(w * .82), int(h * .80)))
    q = band.quantize(colors=6, method=Image.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)      # [(画素数, index), ...]
    n_, idx = counts[0]
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


def tile_img(i):
    x, y = (i % COLS_S) * TILE, (i // COLS_S) * TILE
    return SHEET.crop((x, y, x + TILE, y + TILE))


# ------------------------------------------------------- body_color をマージ
def fetch_colors():
    r = requests.get(f"{SUPABASE_URL}/rest/v1/cars",
                     params={"select": "document_id,body_color", "limit": "1000"},
                     headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"}, timeout=30)
    r.raise_for_status()
    return {x["document_id"]: (x.get("body_color") or "") for x in r.json()}


COLORS = fetch_colors()
unknown, guessed = [], 0
for it in ITEMS:
    raw = COLORS.get(it["id"], "")
    g = normalize(raw)
    if g is None:
        g = guess_from_photo(it["i"])
        guessed += 1
        if raw.strip():
            unknown.append(raw.strip())
    it["grp"] = g
print(f"申告から判定 {N - guessed} 台 / 写真から推定 {guessed} 台")
if unknown:
    print("  辞書に無かった語:", unknown)


# ------------------------------------------------ 車体色の濃淡（淡→濃）
# 申告されたグループの色相域に入る画素だけを見る。写真全体の明るさ（背景）に
# 引っ張られないようにするため。
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


def body_tone(i, grp):
    """淡いほど大きい値を返す。L = V*(1-S/2) の平均"""
    t = tile_img(i)
    w, h = t.size
    band = t.crop((int(w * .15), int(h * .22), int(w * .85), int(h * .84))).resize((56, 56))
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
    if len(vals) < 56 * 56 * 0.03:          # 該当画素が乏しければ写真全体で代用
        return ITEMS[i]["hsv"][2]
    return sum(vals) / len(vals)


for it in ITEMS:
    it["tone"] = body_tone(it["i"], it["grp"])


def group_seq(kind, tone=True, serp=False):
    """グループ順に並べる。serp=True なら1グループおきに向きを反転し、
    境目が『濃と濃』『淡と淡』で接するようにする（ひと続きのグラデーション）。"""
    out, placed = [], 0
    for g in SORTS[kind]:
        members = [i for i in range(N) if ITEMS[i]["grp"] == g]
        if not members:
            continue
        key = (lambda i: -ITEMS[i]["tone"]) if tone else (lambda i: -ITEMS[i]["hsv"][2])
        members.sort(key=key)                      # 淡 → 濃
        if serp and placed % 2 == 1:
            members.reverse()                      # 濃 → 淡
        out.extend(members)
        placed += 1
    return out


def order(kind, tone=True, serp=False):
    if kind.startswith("s"):
        return group_seq(kind, tone, serp)
    return list(range(N))


# ------------------------------------------------------------------ レイアウト
def layout(need):
    for cols in range(5, 21):
        t = W // cols
        rows = max(math.ceil(need / cols), SPAN)
        if rows * t <= H:
            return cols, rows, t
    cols = 20; t = W // cols
    return cols, H // t, t


def sign(cv, T, oy, gh, ground, kind="text", mark=None):
    """格子の下の帯に署名を置く。kind: text / mark / none"""
    if kind == "none":
        return
    d = ImageDraw.Draw(cv, "RGBA")
    base = oy + gh
    band = H - base                     # 下帯の高さ
    fg = (150, 150, 152)
    if kind == "mark" and mark is not None:
        s = int(T * 0.62)
        cv.paste(mark.resize((s, s), Image.LANCZOS), ((W - s) // 2, base + (band - s) // 2))
        return
    fo = f(FONT_R, 30)
    t = "REGISTRO 500 GIAPPONE"
    tw = d.textlength(t, font=fo)
    d.text(((W - tw) // 2, base + band // 2 - 34), t, font=fo, fill=fg)
    fo2 = f(FONT_R, 25)
    t2 = f"{N} cars  ·  registro500giappone.com"
    tw2 = d.textlength(t2, font=fo2)
    d.text(((W - tw2) // 2, base + band // 2 + 8), t2, font=fo2, fill=(105, 105, 108))


def build(kind, hi, fade, fname, ground=(15, 15, 17), tone=True, serp=False,
          logo="plain", sig_kind="none", center_last=False, logo_pos="tail"):
    """hi: True/False   fade: 周りを地色へ寄せる割合 0〜1
    logo: plain=そのまま / fade=写真と同じだけ沈める / none=置かない"""
    seq = order(kind, tone, serp)
    # lead=格子の先頭に置くロゴ / trail=末尾に置くロゴ  （ICONS = [126, 500]）
    if logo == "none":
        lead, trail = [], []
    elif logo_pos == "head":
        lead, trail = ICONS, []
    elif logo_pos == "split":
        lead, trail = [ICONS[1]], [ICONS[0]]        # 500 で始め、126 で締める
    else:
        lead, trail = [], ICONS
    icons = lead + trail
    need = len(seq) + (SPAN * SPAN - 1 if hi else 0) + len(icons)
    cols, rows, T = layout(need)
    gw, gh = cols * T, rows * T
    ox, oy = (W - gw) // 2, (H - gh) // 2

    if hi:
        hr, hc = (rows - SPAN) // 2, (cols - SPAN) // 2
        blocked = {(hr + dr, hc + dc) for dr in range(SPAN) for dc in range(SPAN)}
    else:
        blocked = set()

    cv = Image.new("RGB", (W, H), ground)
    rest = [i for i in seq if i != HI] if hi else list(seq)
    cells = [(r, c) for r in range(rows) for c in range(cols) if (r, c) not in blocked]

    veil = Image.new("RGB", (T, T), ground)
    n_place = min(len(rest), len(cells))
    # 先頭のロゴが入るぶん、写真の枠を後ろへずらす
    nl = len(lead)
    photo_cells = list(range(nl, nl + n_place))
    logo_cells = list(range(nl)) + list(range(nl + n_place, nl + n_place + len(trail)))

    if center_last:
        # 最後の行だけ左詰めをやめ、埋まる枠を中央へ寄せる
        used = n_place + len(icons)
        last_r = cells[used - 1][0]
        head = [c for c in cells[:used] if c[0] != last_r]
        tail = [c for c in cells[:used] if c[0] == last_r]
        shift = (cols - len(tail)) // 2
        cells = head + [(r, c + shift) for r, c in tail] + cells[used:]
    for k, ci in enumerate(photo_cells):
        r, c = cells[ci]
        im = tile_img(rest[k]).resize((T, T), Image.LANCZOS)
        if hi and fade > 0:
            im = Image.blend(im, veil, fade)
        cv.paste(im, (ox + c * T, oy + r * T))

    # ロゴ = 1枚の写真として列に並べる（126・500）
    for j, ic in enumerate(icons):
        if logo_cells[j] < len(cells):
            r, c = cells[logo_cells[j]]
            im = ic.resize((T, T), Image.LANCZOS)
            # 沈めるのはハイライトがある時だけ。写真と同じ扱いにする
            if logo == "fade" and hi and fade > 0:
                im = Image.blend(im, veil, fade)
            cv.paste(im, (ox + c * T, oy + r * T))

    if hi:
        s = T * SPAN
        cv.paste(tile_img(HI).resize((s, s), Image.LANCZOS), (ox + hc * T, oy + hr * T))

    sign(cv, T, oy, gh, ground, sig_kind, ICONS[1])
    cv.save(os.path.join(MOCK, fname), quality=92)
    return cols, rows, T, len(cells) - n_place - len(icons)


# --- 色順ロジックの新旧比較（ハイライトなし）---
def build_old_color(fname):
    """旧: 写真の中央60%平均だけで並べたもの"""
    def k(i):
        h, s, v = ITEMS[i]["hsv"]
        return (0, -v) if s < 0.18 else (1, h)
    seq = sorted(range(N), key=k)
    cols, rows, T = layout(len(seq) + len(ICONS))
    gw, gh = cols * T, rows * T
    ox, oy = (W - gw) // 2, (H - gh) // 2
    cv = Image.new("RGB", (W, H), (15, 15, 17))
    for k2, i in enumerate(seq):
        r, c = k2 // cols, k2 % cols
        cv.paste(tile_img(i).resize((T, T), Image.LANCZOS), (ox + c * T, oy + r * T))
    for j, ic in enumerate(ICONS):
        p = len(seq) + j
        cv.paste(ic.resize((T, T), Image.LANCZOS), (ox + (p % cols) * T, oy + (p // cols) * T))
    cv.save(os.path.join(MOCK, fname), quality=92)


# --- 案3: 各グループ淡→濃 と、1つおき反転（ひと続き）---
info = build("s3", True, 0.22, "U1_各色ごとに淡から濃.jpg", serp=False)
build("s3", True, 0.22, "U2_1つおきに反転.jpg", serp=True)

# --- 署名（末尾のロゴ）の扱い 4案 ---
G = dict(kind="s3", hi=True, fade=0.22, serp=True)
build(fname="L1_現状.jpg", logo="plain", **G)
build(fname="L2_ロゴも沈める.jpg", logo="fade", **G)
build(fname="L3_下帯にテキスト.jpg", logo="none", sig_kind="text", **G)
build(fname="L4_署名なし.jpg", logo="none", sig_kind="none", **G)
build(fname="L5_沈める＋最終行を中央へ.jpg", logo="fade", center_last=True, **G)
build(fname="L6_署名なし＋最終行を中央へ.jpg", logo="none", center_last=True, **G)
build(fname="L7_ロゴを先頭へ.jpg", logo="fade", logo_pos="head", center_last=True, **G)
build(fname="L8_500で始め126で締める.jpg", logo="fade", logo_pos="split", center_last=True, **G)
build(fname="L9_同じく濃度そのまま.jpg", logo="plain", logo_pos="split", center_last=True, **G)

# --- 確定仕様での4通り（最終行は左詰め・500先頭/126末尾・ロゴも22%）---
F = dict(logo="fade", logo_pos="split", center_last=False, fade=0.22, serp=True)
build(kind="reg", hi=False, fname="V1_未ログイン_登録順.jpg", **F)
build(kind="s3",  hi=False, fname="V2_未ログイン_色順.jpg", **F)
build(kind="reg", hi=True,  fname="V3_ログイン_登録順.jpg", **F)
build(kind="s3",  hi=True,  fname="V4_ログイン_色順.jpg", **F)

# --- 境目の検証: 連続する数グループを1行に繋いで見る ---
def strip_span(groups, serp, fname, cell=96):
    """SORTS['s3'] の並びから groups の区間だけを取り出して1行に描く"""
    order_all = group_seq("s3", True, serp)
    keep = set(groups)
    members = [i for i in order_all if ITEMS[i]["grp"] in keep]
    im = Image.new("RGB", (cell * len(members), cell), (25, 25, 27))
    for k, i in enumerate(members):
        im.paste(tile_img(i).resize((cell, cell), Image.LANCZOS), (k * cell, 0))
    im.save(os.path.join(MOCK, fname), quality=92)
    return len(members)


n1 = strip_span(["cream", "gray", "yellow"], False, "j1_クリーム灰黄_個別.jpg")
strip_span(["cream", "gray", "yellow"], True, "j2_クリーム灰黄_反転.jpg")
n2 = strip_span(["navy", "blue", "cyan"], False, "j3_紺青水色_個別.jpg")
strip_span(["navy", "blue", "cyan"], True, "j4_紺青水色_反転.jpg")
print(f"境目検証: クリーム+灰+黄 {n1}台 / 紺+青+水色 {n2}台")

# 反転したときの各グループの向き
placed = 0
dirs = []
from collections import Counter
cnt = Counter(it["grp"] for it in ITEMS)
JP = {"white": "白", "cream": "クリーム", "gray": "グレー", "yellow": "黄", "orange": "橙",
      "red": "赤", "purple": "紫", "navy": "紺", "blue": "青", "cyan": "水色",
      "green": "緑", "yellowgreen": "黄緑", "black": "黒"}
for g in SORTS["s3"]:
    if cnt.get(g, 0) == 0:
        continue
    dirs.append(f"{JP[g]}{cnt[g]}:{'淡→濃' if placed % 2 == 0 else '濃→淡'}")
    placed += 1
print("格子:", info)
print("向き:", " / ".join(dirs))


# --- 検査用: U2 の並び順を書き出す ---
import json as _j
_seq = group_seq("s3", True, True)
_j.dump({"seq": _seq, "ids": [ITEMS[i]["id"] for i in _seq]},
        open(os.path.join(OUT, "seq_u2.json"), "w", encoding="utf-8"), ensure_ascii=False)
print("seq_u2.json", len(_seq))
