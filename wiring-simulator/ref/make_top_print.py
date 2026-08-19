# -*- coding: utf-8 -*-
"""手書き記入用の上面図（A4横・印刷用）を作る。
   ユーザーが部品の位置と配線の這わせ方をこの紙に書き込み、それを台帳に起こす。

   ⚠️位置を読み取れることがこの紙の目的なので、方眼と目盛りが主役。車体線は薄くする。
   ⚠️印刷の拡大率がずれても、目盛りを読めば位置は正しく取れる（縮尺に依存しない）。
   出力: _top_print.html（repo直下・git管理外の作業ファイル）→ ブラウザで Ctrl+P → A4横
"""
import re, io

SRC = 'wiring-img/car-top-v9.svg'
DST = '_top_print.html'
X0, CY = 25.0, 683.15           # 前端の x、中心線の y（1 unit = 1mm）

src = io.open(SRC, encoding='utf-8').read()
PATHS = re.findall(r'<path class="(\w+)" d="([^"]+)"', src)


def X(m):   return X0 + m * 1000
def Y(lat): return CY - lat * 1000


def car(op_detail=0.35):
    w = {'outline': 2.6, 'panel': 2.2, 'trim': 1.6, 'detail': 1.2}
    out = []
    for k, d in PATHS:
        out.append('<path d="%s" fill="none" stroke="#8a8a8a" stroke-width="%.1f" '
                   'stroke-linecap="round" stroke-linejoin="round" opacity="%.2f"/>'
                   % (d, w[k], op_detail if k == 'detail' else .8))
    return ''.join(out)


def grid(m0, m1, lat0, lat1, fs):
    """0.1m方眼。0.5mごとに濃くして数字を振る。数字は図の外（上と左）に置く。"""
    g = []
    i = int(round(m0 * 10))
    while i <= int(round(m1 * 10)):
        m = i / 10.0
        major = (i % 5 == 0)
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"/>'
                 % (X(m), Y(lat1), X(m), Y(lat0), '#a8a8a8' if major else '#d8d8d8', 3 if major else 1.6))
        if major:
            g.append('<text x="%.1f" y="%.1f" font-size="%.0f" text-anchor="middle" fill="#777">%.1f</text>'
                     % (X(m), Y(lat1) - fs * .5, fs, m))
            g.append('<text x="%.1f" y="%.1f" font-size="%.0f" text-anchor="middle" fill="#777">%.1f</text>'
                     % (X(m), Y(lat0) + fs * 1.3, fs, m))
        i += 1
    j = int(round(lat0 * 10))
    while j <= int(round(lat1 * 10)):
        lat = j / 10.0
        major = (j % 5 == 0)
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"/>'
                 % (X(m0), Y(lat), X(m1), Y(lat), '#a8a8a8' if major else '#d8d8d8', 3 if major else 1.6))
        if major:
            lab = '0' if j == 0 else ('%+.1f' % lat)
            for xx, anc in ((X(m0) - fs * .4, 'end'), (X(m1) + fs * .4, 'start')):
                g.append('<text x="%.1f" y="%.1f" font-size="%.0f" text-anchor="%s" fill="#777">%s</text>'
                         % (xx, Y(lat) + fs * .35, fs, anc, lab))
        j += 1
    # 中心線。左右の符号を取り違えないよう車の右／左をここに書く
    g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#c88" stroke-width="4" '
             'stroke-dasharray="26 18"/>' % (X(m0), CY, X(m1), CY))
    return ''.join(g)


def zones(m0, m1, lat0, lat1, fs):
    g = []
    for a, b, t in [(0, 1.02, '前トランク'), (1.02, 2.05, '室内'), (2.05, 2.97, 'エンジンルーム')]:
        if b < m0 or a > m1:
            continue
        if a > m0:
            g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#c8b48a" '
                     'stroke-width="4" stroke-dasharray="14 10"/>' % (X(a), Y(lat1), X(a), Y(-lat1)))
        g.append('<text x="%.1f" y="%.1f" font-size="%.0f" text-anchor="middle" fill="#b9a67e">%s</text>'
                 % (X((max(a, m0) + min(b, m1)) / 2), Y(lat1) - fs * 2.0, fs, t))
    return ''.join(g)


def sheet(title, sub, m0, m1, lat0, lat1, mm_w, memo=''):
    span = (m1 - m0) * 1000
    fs = span / 44.0                         # 用紙上でほぼ一定の文字の大きさになる
    padx, padt, padb = fs * 1.5, fs * 3.0, fs * 2.2   # 上は区画名、下は目盛りの数字が入る
    vb = (X(m0) - padx, Y(lat1) - padt, span + padx * 2, (lat1 - lat0) * 1000 + padt + padb)
    body = grid(m0, m1, lat0, lat1, fs) + zones(m0, m1, lat0, lat1, fs) + car()
    return ('<section class="sheet"><h2>%s<span>%s</span></h2>'
            '<svg width="%dmm" viewBox="%.1f %.1f %.1f %.1f">%s</svg>'
            '<p class="foot">方眼は0.1m。数字は前端からの距離(m)と中心線からの左右(m)。'
            '<b>+が車の右＝紙の上</b>／−が車の左＝紙の下。ノーズは左。</p>%s</section>'
            % (title, sub, mm_w, vb[0], vb[1], vb[2], vb[3], body, memo))


def memo_table(cols, rows=7):
    th = ''.join('<th>%s</th>' % c for c in cols)
    td = ''.join('<td></td>' for _ in cols)
    return ('<table class="memo"><tr>%s</tr>%s</table>'
            % (th, ('<tr>%s</tr>' % td) * rows))


P = ['部品名', '前端から(m)', '中心から(m)（+が車の右）', '高さ・備考']
W = ['配線（どこ→どこ）', '通る所（例: トンネル内・右サイド）', '備考']
sheets = [
    sheet('① 部品の位置', '記入用（全体）', -0.02, 3.00, -0.66, 0.66, 264, memo_table(P)),
    sheet('② 配線の這わせ方', '記入用（全体）', -0.02, 3.00, -0.66, 0.66, 264, memo_table(W)),
    sheet('③ 前まわり 0〜1.6m', '拡大・記入用', -0.02, 1.60, -0.66, 0.66, 264),
    sheet('④ 後ろまわり 1.4〜3.0m', '拡大・記入用', 1.40, 3.00, -0.66, 0.66, 264),
]

html = ('<!doctype html><html lang="ja"><head><meta charset="utf-8">'
        '<title>FIAT 500F 上面図 — 手書き記入用</title><style>'
        '@page{size:A4 landscape;margin:8mm}'
        '*{box-sizing:border-box}'
        'body{margin:0;background:#e9e6df;font:13px/1.6 system-ui,sans-serif;color:#333}'
        '.sheet{width:281mm;height:194mm;background:#fff;margin:10px auto;padding:6mm 8mm;'
        'display:flex;flex-direction:column;align-items:center;page-break-after:always}'
        '.sheet:last-child{page-break-after:auto}'
        'h2{font-size:13pt;margin:0 0 1mm;align-self:flex-start;font-weight:700}'
        'h2 span{font-weight:400;font-size:10pt;color:#888;margin-left:8px}'
        '.foot{font-size:8pt;color:#888;margin:1mm 0 0;align-self:flex-start}'
        'svg{display:block}'
        'table.memo{width:100%;border-collapse:collapse;margin-top:3mm;font-size:8.5pt}'
        'table.memo th{background:#f2efe8;color:#666;font-weight:600;text-align:left}'
        'table.memo th,table.memo td{border:.35mm solid #cfcabd;padding:1.6mm 2mm;height:8mm}'
        '@media print{body{background:#fff}.sheet{margin:0;width:auto;height:auto;padding:0}}'
        '</style></head><body>' + ''.join(sheets) + '</body></html>')
io.open(DST, 'w', encoding='utf-8').write(html)
print('%s (%d KB / %d 枚)' % (DST, len(html) / 1024, len(sheets)))
