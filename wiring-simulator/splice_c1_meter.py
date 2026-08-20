# -*- coding: utf-8 -*-
"""旅ページに UCM-1 の C1「チンクエ」文字盤を移植する。
移植元＝wiring-story.html の <g id="c1"> ブロック（実車写真から採寸した純正準拠の作図）と #c1{} のCSS変数。
巨大なパスの塊なので手写しせず、このスクリプトで抽出→対象HTMLのマーカー間に差し込む。
再実行可能：初回は <!--C1_METER--> / /*C1_CSS*/ プレースホルダを、以後は BEGIN/END マーカー間を置き換える。

旅ページ用の加工（絵の中身は一切変えない）:
  - 元の transform（wiring-story の舞台座標用）を外す＝gauge座標 0..200 のまま使う
  - 針を約40km/h の位置へ（症状＝「走っているのに点いている」を言うため）
  - GENERAT. 警告灯（lampGen）を点灯状態にする（class="hid" を外す）
"""
import io, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'wiring-story.html')
TARGETS = [os.path.join(ROOT, 'wiring-journey-charge.html'),
           os.path.join(ROOT, 'wiring-journey-charge-alt.html')]

src = io.open(SRC, encoding='utf-8').read()

m = re.search(r'#c1\{[\s\S]*?\}', src)
assert m, '#c1 CSS が見つからない'
css = m.group(0)

m = re.search(r'<g id="c1"[\s\S]*?</g>(?=\s*<!-- ラベルは)', src)
assert m, '<g id="c1"> ブロックが見つからない'
c1 = m.group(0)

assert 'transform="translate(234,34) scale(0.86)"' in c1
c1 = c1.replace(' transform="translate(234,34) scale(0.86)"', '', 1)
assert 'rotate(-115.06 100 100)' in c1, '針の初期transformが見つからない'
c1 = c1.replace('rotate(-115.06 100 100)', 'rotate(-38 100 100)', 1)  # 約40km/h
assert '<g id="lampGen" class="hid">' in c1
c1 = c1.replace('<g id="lampGen" class="hid">', '<g id="lampGen">', 1)

METER_BLOCK = '<!--C1_METER_BEGIN-->' + c1 + '<!--C1_METER_END-->'
CSS_BLOCK = '/*C1_CSS_BEGIN*/' + css + '/*C1_CSS_END*/'

for path in TARGETS:
    t = io.open(path, encoding='utf-8').read()
    if '<!--C1_METER_BEGIN-->' in t:
        t = re.sub(r'<!--C1_METER_BEGIN-->[\s\S]*?<!--C1_METER_END-->', lambda _: METER_BLOCK, t, count=1)
    else:
        assert '<!--C1_METER-->' in t, path + ' にプレースホルダが無い'
        t = t.replace('<!--C1_METER-->', METER_BLOCK, 1)
    if '/*C1_CSS_BEGIN*/' in t:
        t = re.sub(r'/\*C1_CSS_BEGIN\*/[\s\S]*?/\*C1_CSS_END\*/', lambda _: CSS_BLOCK, t, count=1)
    else:
        assert '/*C1_CSS*/' in t, path + ' にCSSプレースホルダが無い'
        t = t.replace('/*C1_CSS*/', CSS_BLOCK, 1)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(t)
    print('spliced:', os.path.basename(path), len(c1), 'chars')
