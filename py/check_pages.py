# -*- coding: utf-8 -*-
"""公開HTMLの <head> 検品（GA4タグ・canonical・og:image・noindex の消し忘れ）
＋（2026-11-13）開発メモ名の混入・内部リンク切れ・esc の定義数・管理人アドレスの直書き数

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
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IGNORE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "check_pages_ignore.json")

# 走査するディレクトリ（リポジトリ直下からの相対）。"" はリポジトリ直下。
# event/ など生成物のディレクトリは対象外＝雛形を直せば全ページに反映されるので、
# 雛形（event-pages.py 側）を見るのが筋であってページを1枚ずつ数える意味がない。
# engine-simulator/ は生成物ではなく手で書いた画面なので入れる（2026-09-21 追加）。
# noindex のあるページは自動で見送られるため、公開の日に robots 行を外した時点で検査が効きはじめる。
SCAN_DIRS = ["", "126", "en", "it", "engine-simulator", "paint-notebook"]

MEASUREMENT_ID = "G-27SHHC4JYH"  # 正本＝reference_ga4_property。他のIDが混ざっていたら誤り

# ── 2026-11-13 追加（リファクタリング計画 S2-6＝以後の作業の安全網）──
# ① 開発メモの名前を公開ファイルに書かない（HTML/JS のコメント・JSON の note も View Source で読まれる＝4度再発）。
#    repo 自体が PUBLIC なので、走査は配信される全テキスト（py/・.github/ など配信しない所は除く）。
LEAK = re.compile(r"registro\d*-notes|MEMORY(?:_[\w-]+)?\.md|growth-strategy|plate-ledger")
LEAK_EXT = (".html", ".js", ".json", ".css", ".xml", ".txt", ".webmanifest")
LEAK_SKIP_DIRS = {".git", ".github", ".claude", "py", "node_modules", "functions"}
# ③④ は「増えていないか」を見る天井。減ったら下の数字を下げる（下げ忘れは注意で出す）。
#    共通部品（rg-util.js の RG.esc・管理人アドレスの1か所化）へ寄せるほど減る＝増えるのは逆行。
ESC_DEF = re.compile(r"function\s+esc(?:ape|apeHtml)?\s*\(|(?:const|let|var)\s+esc(?:ape|apeHtml)?\s*=")
ESC_MAX = 31
ADMIN_MAIL = "registro500giappone@gmail.com"
MAIL_MAX = 17
# ⑤ 公開キーの食い違い＝config.js 以外に直書きされた sb_publishable_ が config.js の値と違えば NG
#    （キーを替えたとき、直書きの残り（イベント雛形の生成物・wiring-journey-gate.js など）の直し忘れを止める）
PUB_KEY = re.compile(r"sb_publishable_[A-Za-z0-9_-]+")
# ⑥ supabase-js を CDN から読む <script> に integrity（SRI）が無ければ NG
SB_SCRIPT = re.compile(r"<script[^>]*supabase-js@[^>]*>", re.I)


def config_key():
    m = PUB_KEY.search(open(os.path.join(BASE, "config.js"), encoding="utf-8").read())
    return m.group(0) if m else None


def bad_keys(text, key):
    return sorted({k for k in PUB_KEY.findall(text) if k != key})


def sri_missing(text):
    return [s for s in SB_SCRIPT.findall(text) if "integrity=" not in s]
# ② 内部リンク切れ（SCAN_DIRS の HTML の href/src）。開き引用符と同じ引用符で閉じた値だけを見る＝
#    JS で文字列をつなぐ途中（l.href = '/wiring-img/' + x など＝閉じ引用符の後に + が続くもの）は拾わない。
LINK = re.compile(r"""(?:href|src)\s*=\s*(["'])([^"']*)\1(?!\s*\+)""")


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


def find_leak(text):
    m = LEAK.search(text)
    return m.group(0) if m else None


def link_target(u):
    """検査するリンクなら正規化した値、外部・動的・空なら None。"""
    u = u.split("#")[0].split("?")[0].strip()
    if not u or re.match(r"^[a-z][a-z0-9+.-]*:|^//", u, re.I):
        return None
    if any(c in u for c in "$({}+[<>`\\ ") or u.startswith(("/api/", "/cdn-cgi/")):
        return None
    return u


def load_redirects():
    p = os.path.join(BASE, "_redirects")
    if not os.path.exists(p):
        return []
    return [l.split()[0] for l in open(p, encoding="utf-8") if l.strip() and not l.lstrip().startswith("#")]


def link_ok(rel, u, redirects):
    base = os.path.dirname(rel)
    p = os.path.normpath(os.path.join(BASE, u.lstrip("/")) if u.startswith("/") else os.path.join(BASE, base, u))
    for c in (p, p + ".html", os.path.join(p, "index.html")):
        if os.path.isfile(c):
            return True
    path = "/" + os.path.relpath(p, BASE).replace(os.sep, "/")
    for r in redirects:
        if r == path or (r.endswith("*") and path.startswith(r[:-1])) or (r.endswith("/") and path + "/" == r):
            return True
    return False


def tracked_files():
    """git 管理下のファイル（.gitignore の手元専用ファイル＝indexsub.html などは配信されないので見ない）。git が無ければ None。"""
    try:
        out = subprocess.run(["git", "-C", BASE, "ls-files", "-z"], capture_output=True, check=True).stdout
        return set(out.decode("utf-8").split("\0"))
    except Exception:
        return None


def served_texts():
    """配信される全テキスト（① ③ ④ ⑤ ⑥ の走査対象）。"""
    tracked = tracked_files()
    for root, dirs, files in os.walk(BASE):
        dirs[:] = [d for d in dirs if not (os.path.relpath(os.path.join(root, d), BASE) in LEAK_SKIP_DIRS or d.startswith("."))]
        for n in files:
            if n.endswith(LEAK_EXT) or n == "_redirects" or n == "_headers":
                full = os.path.join(root, n)
                rel = os.path.relpath(full, BASE).replace(os.sep, "/")
                if tracked is None or rel in tracked:
                    yield rel, full


def selftest():
    """検出器が壊れたまま静かに通ることを防ぐ。何も検出しない検品は無害に見える。"""
    ok = True
    cases = [
        ("開発メモ名を拾う", find_leak("// 正本 registro500-notes/owner-backup/HANDOFF.md"), "registro500-notes"),
        ("台帳ファイル名を拾う", find_leak('"note": "MEMORY_watchlist.md を見る"'), "MEMORY_watchlist.md"),
        ("ふつうの文は拾わない", find_leak("<p>整備の記録</p>"), None),
        ("esc の定義を数える", len(ESC_DEF.findall("const esc = s => s; function escapeHtml(s){}")), 2),
        ("esc の呼び出しは数えない", len(ESC_DEF.findall("x = esc(a) + escapeHtml(b)")), 0),
        ("外部リンクは見ない", link_target("https://example.com/a"), None),
        ("JS でつなぐ値は見ない", link_target("/car/${id}"), None),
        ("内部リンクは見る", link_target("/tools?q=1#x"), "/tools"),
        ("あるページは通る", link_ok("index.html", "/tools", []), True),
        ("無いページは落ちる", link_ok("index.html", "/no-such-page-xyz", []), False),
        ("JS でつなぐ途中は拾わない", LINK.findall("l.href = '/wiring-img/' + t + '.webp';"), []),
        ("_redirects の * で通る", link_ok("index.html", "/car/12", ["/car/*"]), True),
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
        ("違う公開キーを拾う", bad_keys("k='sb_publishable_OLD1'; j='sb_publishable_NEW2'", "sb_publishable_NEW2"), ["sb_publishable_OLD1"]),
        ("同じ公開キーは通る", bad_keys("k='sb_publishable_NEW2'", "sb_publishable_NEW2"), []),
        ("SRI なしを拾う", len(sri_missing('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.0"></script>')), 1),
        ("SRI ありは通る", len(sri_missing('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.0" integrity="sha384-x" crossorigin="anonymous"></script>')), 0),
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
    redirects = load_redirects()
    ng, warn, skipped, draft, checked = [], [], [], [], 0

    # ① 開発メモの名前／③ esc の定義の数／④ 管理人アドレスの直書きの数（配信される全テキスト）
    n_esc = n_mail = 0
    key = config_key()
    if not key:
        ng.append(("config.js", "公開キー sb_publishable_ が読めない"))
    for rel, full in served_texts():
        t = open(full, encoding="utf-8", errors="replace").read()
        hit = find_leak(t)
        if hit:
            line = t[:t.index(hit)].count("\n") + 1
            ng.append((f"{rel}:{line}", f"開発メモの名前「{hit}」＝公開ファイルに書かない（コメントでも View Source で読まれる）"))
        # ⑤ 公開キーの食い違い／⑥ supabase-js の SRI
        if key:
            for k in bad_keys(t, key):
                ng.append((rel, f"公開キー「{k[:24]}…」が config.js と違う＝config.js の値にそろえる"))
        if rel.endswith(".html"):
            for s in sri_missing(t):
                ng.append((rel, "supabase-js の読み込みに integrity（SRI）が無い＝イベント雛形（py/gen_event_pages.py）と同じ integrity を付ける"))
        if rel.endswith((".html", ".js")):
            n_esc += len(ESC_DEF.findall(t))
        n_mail += t.count(ADMIN_MAIL)
    if n_esc > ESC_MAX:
        ng.append(("（全体）", f"esc の定義が {n_esc} か所（天井 {ESC_MAX}）＝新しく書かず共通の RG.esc を使う"))
    elif n_esc < ESC_MAX:
        warn.append(("（全体）", f"esc の定義が {n_esc} か所に減った＝check_pages.py の ESC_MAX を {n_esc} に下げる"))
    if n_mail > MAIL_MAX:
        ng.append(("（全体）", f"管理人アドレスの直書きが {n_mail} か所（天井 {MAIL_MAX}）＝増やさない"))
    elif n_mail < MAIL_MAX:
        warn.append(("（全体）", f"管理人アドレスの直書きが {n_mail} か所に減った＝MAIL_MAX を {n_mail} に下げる"))

    for rel in targets():
        pat = next((p for p in ignore if fnmatch.fnmatch(rel, p)), None)
        if pat:
            skipped.append((rel, ignore[pat]))
            continue

        text = open(os.path.join(BASE, rel), encoding="utf-8", errors="replace").read()
        checked += 1

        # ② 内部リンク切れ（noindex のページも見る＝リンク切れは公開前でも直す）
        seen = set()
        for _, raw in LINK.findall(text):
            u = link_target(raw)
            if u and u not in seen:
                seen.add(u)
                if not link_ok(rel, u, redirects):
                    ng.append((rel, f"内部リンク切れ「{raw}」"))

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
        print(f"\nNG {len(ng)} 件。GA4 の NG は、他ページと同じ gtag スニペットを "
              f"canonical の直後に置く（測定ID {MEASUREMENT_ID}）。")
        return 1
    print("\nNG なし。")
    return 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(0 if selftest() else 1)
    sys.exit(main())
