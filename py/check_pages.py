# -*- coding: utf-8 -*-
"""公開HTMLの <head> 検品（GA4タグ・canonical・og:image・noindex の消し忘れ）

なぜ要るか（2026-09-06）:
  マイ壁紙とスクリーンセーバーを公開した際、2本とも GA4 タグが入っておらず、
  公開後の訪問が1件も計測されていなかった。canonical と OGP は「公開する」という
  作業の一部として意識に上がるのに、GA4 タグだけは公開手順のどこにも現れないため
  そのまま抜けた。⭐指示や申し送りで塞ぐのではなく機械に数えさせる
  （連載の check_journeys.js --terms と同じ考え方）。

設計の要点:
  ⭐**除外リスト方式**＝走査対象のHTMLは全部が検査対象で、検査しないものだけを
    check_pages_ignore.json に列挙する。新しく作ったファイルは何もしなくても
    対象に入る。これが逆（検査するものを列挙する方式）だと、また同じ漏れ方をする。
  ⭐**GA4 タグは noindex のページにも要る**＝noindex は「検索に出さない」であって
    「人が来ない」ではない（edit.html のようにログイン後の主要画面もそちら側）。
    ⛔noindex を免除にすると、外し忘れたまま公開されたページを見逃す＝事故と同じ形。
    数えたくないページは noindex ではなく除外リストで外す（意思表示を明示に残す）。

判定:
  GA4 タグが無い・測定IDが違えば NG（終了コード1）。
  canonical・og:image の欠落は注意として出すだけで落とさない（無くても実害が小さく、
  意図的に付けないページもあるため）。noindex のページではこの2つを見送る。

実行:
  python py/check_pages.py            # 検品
  python py/check_pages.py --selftest # 検出そのものが壊れていないかの自己テスト
"""
import fnmatch
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IGNORE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "check_pages_ignore.json")

# 走査するディレクトリ（リポジトリ直下からの相対）。"" はリポジトリ直下。
# event/ など生成物のディレクトリは対象外＝雛形を直せば全ページに反映されるので、
# 雛形（event-pages.py 側）を見るのが筋であってページを1枚ずつ数える意味がない。
SCAN_DIRS = ["", "126", "en", "it"]

MEASUREMENT_ID = "G-27SHHC4JYH"  # 正本＝reference_ga4_property。他のIDが混ざっていたら誤り


# ───────────────────────── 検出（self-test の対象） ─────────────────────────
def find_ga4(text):
    """GA4 タグの測定IDを返す。タグが無ければ None。

    gtag.js の読み込み行だけを見る。config 側だけあってスクリプトの読み込みが無い、
    という壊れ方を「入っている」と数えないため。
    """
    m = re.search(r"googletagmanager\.com/gtag/js\?id=(G-[A-Z0-9]+)", text)
    return m.group(1) if m else None


def has_canonical(text):
    return re.search(r'<link[^>]+rel=["\']canonical["\']', text, re.I) is not None


def has_og_image(text):
    return re.search(r'<meta[^>]+property=["\']og:image["\']', text, re.I) is not None


def has_noindex(text):
    """robots メタに noindex があるか＝まだ公開していないページの目印。"""
    for m in re.finditer(r'<meta[^>]+name=["\']robots["\'][^>]*>', text, re.I):
        if "noindex" in m.group(0).lower():
            return True
    return False


def selftest():
    """検出器が壊れたまま静かに通ることを防ぐ。何も検出しない検品は無害に見える。"""
    ok = True
    cases = [
        ("GA4あり", find_ga4('<script src="https://www.googletagmanager.com/gtag/js?id=G-27SHHC4JYH">'), "G-27SHHC4JYH"),
        ("GA4なし", find_ga4("<head><title>x</title></head>"), None),
        ("config だけでは数えない", find_ga4("gtag('config', 'G-27SHHC4JYH');"), None),
        ("canonical あり", has_canonical('<link rel="canonical" href="https://x/">'), True),
        ("canonical なし", has_canonical('<link rel="stylesheet" href="a.css">'), False),
        ("og:image あり", has_og_image('<meta property="og:image" content="x.png">'), True),
        ("og:image なし", has_og_image('<meta property="og:title" content="x">'), False),
        ("noindex あり", has_noindex('<meta name="robots" content="noindex, nofollow">'), True),
        ("noindex なし", has_noindex('<meta name="robots" content="index, follow">'), False),
        ("robots 以外の noindex は拾わない", has_noindex('<meta name="description" content="noindex の話">'), False),
    ]
    for name, got, want in cases:
        if got != want:
            print(f"  NG selftest: {name} → {got!r}（期待 {want!r}）")
            ok = False
    print("自己テスト: " + ("OK" if ok else "NG"))
    return ok


# ───────────────────────── 走査 ─────────────────────────
def load_ignore():
    if not os.path.exists(IGNORE_FILE):
        return {}
    return json.load(open(IGNORE_FILE, encoding="utf-8")).get("ignore", {})


def targets():
    for d in SCAN_DIRS:
        full = os.path.join(BASE, d) if d else BASE
        if not os.path.isdir(full):
            continue
        for name in sorted(os.listdir(full)):
            if name.endswith(".html") and os.path.isfile(os.path.join(full, name)):
                yield (f"{d}/{name}" if d else name)


def main():
    ignore = load_ignore()
    ng, warn, skipped, draft, checked = [], [], [], [], 0

    for rel in targets():
        pat = next((p for p in ignore if fnmatch.fnmatch(rel, p)), None)
        if pat:
            skipped.append((rel, ignore[pat]))
            continue

        text = open(os.path.join(BASE, rel), encoding="utf-8", errors="replace").read()
        checked += 1

        # GA4 は noindex のページにも要る。noindex は「検索に出さない」であって
        # 「人が来ない」ではない（edit.html のようにログイン後の主要画面もこちら）。
        # ⭐noindex を免除にすると、外し忘れたまま公開されたページを見逃す＝
        #   まさに 2026-09-06 の事故の形なので、GA4 だけは一律に数える。
        gid = find_ga4(text)
        if not gid:
            ng.append((rel, "GA4タグが無い＝訪問が計測されない"))
        elif gid != MEASUREMENT_ID:
            ng.append((rel, f"GA4の測定IDが違う（{gid} ≠ {MEASUREMENT_ID}）"))

        if has_noindex(text):
            # 検索に出ないページに canonical と og:image を求めても意味がないので、
            # そこは見送る。仕上がって noindex を外したときに検査が始まる。
            draft.append(rel)
            continue
        if not has_canonical(text):
            warn.append((rel, "canonical が無い"))
        if not has_og_image(text):
            warn.append((rel, "og:image が無い＝SNSに貼っても絵が出ない"))

    print(f"HTML {checked} 本を検品（うち noindex {len(draft)} 本・除外 {len(skipped)} 本）")
    if draft:
        print("\n[noindex あり＝GA4だけ見て canonical/og:image は見送り]")
        for rel in draft:
            print("  -", rel)
    if warn:
        print("\n[注意]")
        for rel, msg in warn:
            print(f"  - {rel}: {msg}")
    if ng:
        print("\n[NG]")
        for rel, msg in ng:
            print(f"  ✗ {rel}: {msg}")
        print(f"\nNG {len(ng)} 件。公開ページには他ページと同じ gtag スニペットを "
              f"canonical の直後に置く（測定ID {MEASUREMENT_ID}）。")
        return 1
    print("\nNG なし。")
    return 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(0 if selftest() else 1)
    sys.exit(main())
