# -*- coding: utf-8 -*-
"""
メールの HTML 版を組み立てる（2026-11-07）

テキスト本文（textContent）はこれまでどおり作り、その書き方の決まりを読み取って
読みやすい HTML（htmlContent）に整える。テキスト版は HTML を出さないメールアプリ向けに一緒に送る。

読み取る決まり（send_digest.py / send_weekly.py の本文の書き方）:
  ■ 絵文字 見出し              → 見出し
  一覧：URL                    → 見出しの下の「一覧を見る →」
  ・項目名 ＋ 次の行が「　URL」 → 項目名そのものをリンクに（URL はむき出しにしない）
  　日時：…（全角空白で始まる）  → 項目の下の補足（灰色）
  【題名】                      → 太字の小見出し（お知らせ）
  -----（区切り線）以降          → フッター（小さく灰色）
写真は載せない（2026-11-07 ユーザー決定）。ヘッダーは 500・126 の縦型ロゴを横に並べる（同日 ユーザー指示）。
ロゴはメール用に縮めた mail/logo*-mail.png（約8KB）。画像を止めているアプリでは alt の文字が出る。
Gmail は <style> を落とすことがあるので、スタイルはすべてタグに直接書く。
"""
import html
import re

# サイト（index.html の :root）と同じ配色
C_BG = "#f5f0e6"
C_CARD = "#fffefb"
C_BORDER = "#d6c9b0"
C_TEXT = "#2e2a24"
C_SUB = "#7a705f"
C_ACCENT = "#1f5c3d"
C_ACCENT_SOFT = "#e7efe7"

FONT = ("-apple-system,BlinkMacSystemFont,'Hiragino Sans','Hiragino Kaku Gothic ProN',"
        "'Noto Sans JP',Meiryo,sans-serif")

URL_RE = re.compile(r'https?://[^\s<>"]+')
URL_ONLY_RE = re.compile(r'^[　 ]*(https?://[^\s<>"]+)\s*$')
DIVIDER_RE = re.compile(r'^-{10,}$')


def _linkify(s):
    """エスケープ済みでない生テキストを受け取り、エスケープしてから URL をリンクにする。"""
    out, pos = [], 0
    for m in URL_RE.finditer(s):
        out.append(html.escape(s[pos:m.start()], quote=False))
        u = m.group(0)
        out.append(f'<a href="{html.escape(u)}" style="color:{C_ACCENT};word-break:break-all;">'
                   f'{html.escape(u, quote=False)}</a>')
        pos = m.end()
    out.append(html.escape(s[pos:], quote=False))
    return "".join(out)


def _link(url, label, style=""):
    return (f'<a href="{html.escape(url)}" style="color:{C_ACCENT};text-decoration:none;{style}">'
            f'{label}</a>')


def _paragraph(lines):
    return (f'<p style="margin:0 0 14px;font-size:15px;line-height:1.8;color:{C_TEXT};">'
            + "<br>".join(_linkify(l) for l in lines) + "</p>")


SITE_URL = "https://www.registro500.com"
# ヘッダーのロゴ（左から）。(画像URL, alt, リンク先)
LOGOS = [
    (f"{SITE_URL}/mail/logo500-mail.png", "Registro500 Giappone", f"{SITE_URL}/"),
    (f"{SITE_URL}/mail/logo126-mail.png", "Registro126 Giappone", f"{SITE_URL}/126/"),
]
LOGO_W = 150   # 1つの表示幅（px）＝スマホでも2つ横に並ぶ


def _header(logos):
    cells = "".join(
        f'<td align="center" style="padding:0 8px;">'
        f'<a href="{html.escape(link)}" style="text-decoration:none;">'
        f'<img src="{html.escape(src)}" width="{LOGO_W}" alt="{html.escape(alt)}" '
        f'style="display:block;width:{LOGO_W}px;max-width:100%;height:auto;border:0;'
        f'font-size:14px;font-weight:bold;color:{C_ACCENT};"></a></td>'
        for src, alt, link in logos)
    return (f'<tr><td align="center" style="padding:4px 4px 16px;">'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>{cells}</tr></table>'
            f'</td></tr>')


def text_to_html(text, logos=None):
    lines = text.replace("\r\n", "\n").split("\n")
    body = []          # カード内の HTML
    footer = []        # 区切り線より後
    para = []          # まとめて1段落にする行
    in_footer = False
    i = 0

    def flush():
        if para:
            body.append(_paragraph(para))
            para.clear()

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        if in_footer:
            footer.append(line)
            i += 1
            continue
        if DIVIDER_RE.match(line.strip()):
            flush()
            in_footer = True
            i += 1
            continue
        if not line.strip():
            flush()
            i += 1
            continue

        # 見出し
        if line.startswith("■"):
            flush()
            h = line[1:].strip()
            list_url = None
            if i + 1 < len(lines) and lines[i + 1].startswith("一覧："):
                m = URL_RE.search(lines[i + 1])
                if m:
                    list_url = m.group(0)
                    i += 1
            body.append(
                f'<h2 style="margin:30px 0 12px;padding:0 0 8px;font-size:18px;line-height:1.5;'
                f'color:{C_TEXT};border-bottom:2px solid {C_ACCENT_SOFT};font-weight:bold;">'
                f'{html.escape(h, quote=False)}</h2>')
            if list_url:
                body.append(f'<p style="margin:-4px 0 12px;font-size:13px;text-align:right;">'
                            + _link(list_url, "一覧を見る →") + "</p>")
            i += 1
            continue

        # お知らせの題名
        if line.startswith("【") and line.endswith("】"):
            flush()
            body.append(f'<p style="margin:16px 0 6px;font-size:15px;font-weight:bold;color:{C_TEXT};">'
                        f'{html.escape(line, quote=False)}</p>')
            i += 1
            continue

        # 項目（・名前 → 続く全角空白の行が補足と URL）
        if line.startswith("・"):
            flush()
            label = line[1:].strip()
            subs, url = [], None
            j = i + 1
            while j < len(lines) and lines[j].startswith("　"):
                m = URL_ONLY_RE.match(lines[j])
                if m and url is None:
                    url = m.group(1)
                else:
                    subs.append(lines[j].strip())
                j += 1
            esc = html.escape(label, quote=False)
            if label.startswith("ほか") and not url and not subs:   # 「・ほか◯件」
                body.append(f'<p style="margin:0 0 10px;font-size:13px;color:{C_SUB};">{esc}</p>')
                i = j
                continue
            if not url and not subs:   # 個別のリンクが無い項目（工具など）＝枠に入れず箇条書き
                body.append(f'<p style="margin:0 0 6px;padding-left:1em;text-indent:-1em;font-size:14px;'
                            f'line-height:1.6;color:{C_TEXT};">・{esc}</p>')
                i = j
                continue
            title = _link(url, esc + " ›", "font-weight:bold;") if url else esc
            sub_html = "".join(
                f'<div style="margin-top:4px;font-size:13px;line-height:1.6;color:{C_SUB};">{_linkify(s)}</div>'
                for s in subs)
            body.append(
                f'<div style="margin:0 0 10px;padding:12px 14px;background:{C_BG};border-radius:8px;'
                f'border-left:4px solid {C_ACCENT};">'
                f'<div style="font-size:15px;line-height:1.6;color:{C_TEXT};">{title}</div>{sub_html}</div>')
            i = j
            continue

        # URL だけの行（項目の外）→ ボタン
        m = URL_ONLY_RE.match(line)
        if m:
            flush()
            u = m.group(1)
            if "/unsubscribe" in u:   # 配信停止はボタンにしない
                para.append(line.strip())
                i += 1
                continue
            body.append(f'<p style="margin:4px 0 16px;">'
                        f'<a href="{html.escape(u)}" style="display:inline-block;padding:10px 18px;'
                        f'background:{C_ACCENT};color:#ffffff;text-decoration:none;border-radius:6px;'
                        f'font-size:14px;font-weight:bold;">ページを開く</a></p>')
            i += 1
            continue

        para.append(line)
        i += 1
    flush()

    foot_lines = [l for l in footer]
    # 先頭と末尾の空行を落とす
    while foot_lines and not foot_lines[0].strip():
        foot_lines.pop(0)
    while foot_lines and not foot_lines[-1].strip():
        foot_lines.pop()
    foot_html = "<br>".join(_linkify(l) for l in foot_lines)

    return (
        '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
        f'</head><body style="margin:0;padding:0;background:{C_BG};">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="background:{C_BG};"><tr><td align="center" style="padding:20px 10px;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="max-width:600px;font-family:{FONT};">'
        + _header(logos or LOGOS)
        # 本文カード
        + f'<tr><td style="background:{C_CARD};border:1px solid {C_BORDER};border-radius:12px;'
        f'padding:26px 22px;">' + "".join(body) + '</td></tr>'
        # フッター
        + (f'<tr><td style="padding:18px 8px 8px;font-size:12px;line-height:1.7;color:{C_SUB};'
           f'text-align:center;">{foot_html}</td></tr>' if foot_html else "")
        + '</table></td></tr></table></body></html>'
    )
