# -*- coding: utf-8 -*-
"""旅ページに UCM-1 の C1「チンクエ」文字盤を移植する。
移植元＝wiring-story.html の <g id="c1"> ブロック（実車写真から採寸した純正準拠の作図）と #c1{} のCSS変数。
巨大なパスの塊なので手写しせず、このスクリプトで抽出→対象HTMLのマーカー間に差し込む。
再実行可能：初回は <!--C1_METER--> / /*C1_CSS*/ プレースホルダを、以後は BEGIN/END マーカー間を置き換える。

旅ページ用の加工（絵の中身は一切変えない）:
  - 元の transform（wiring-story の舞台座標用）を外す＝gauge座標 0..200 のまま使う
  - 針をその症状が起きている瞬間の速度へ（走行中の症状なら約40km/h・停車中の症状なら 0）
  - その旅で点いている警告灯を点灯状態にする（class="hid" を外す）＝旅ごとに指定する
"""
import io, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'wiring-story.html')
NEEDLE_0 = 'rotate(-115.06 100 100)'   # 移植元の初期位置＝0 km/h
NEEDLE_40 = 'rotate(-38 100 100)'      # 約40km/h
# (対象HTML, 点灯させる警告灯のグループidの一覧, 針の位置) — 旅ページが増えたらここに足す
# ⚠️針は「その症状が起きている瞬間」に合わせる。セルの旅は止まっている車の話なので 0 km/h。
# ⚠️灯の一覧が空＝2つとも消えたまま。第4号（キーで何も点かない）・第5号（アース）は
#   「点かないこと」そのものが症状なので、これが正しい姿。
TARGETS = [(os.path.join(ROOT, 'wiring-journey-charge.html'),     ['lampGen'],            NEEDLE_40),
           (os.path.join(ROOT, 'wiring-journey-charge-alt.html'), ['lampGen'],            NEEDLE_40),
           (os.path.join(ROOT, 'wiring-journey-oil.html'),        ['lampOil'],            NEEDLE_40),
           (os.path.join(ROOT, 'wiring-journey-starter.html'),    ['lampGen', 'lampOil'], NEEDLE_0),
           (os.path.join(ROOT, 'wiring-journey-key.html'),        [],                     NEEDLE_0),
           (os.path.join(ROOT, 'wiring-journey-ground.html'),     [],                     NEEDLE_0),
           (os.path.join(ROOT, 'wiring-journey-ignition.html'),   ['lampGen', 'lampOil'], NEEDLE_0)]
# 文字盤のCSSは旅ページ共通なので1か所（共通CSS）だけに差し込む
CSS_TARGET = os.path.join(ROOT, 'wiring-journey.css')

src = io.open(SRC, encoding='utf-8').read()

m = re.search(r'#c1\{[\s\S]*?\}', src)
assert m, '#c1 CSS が見つからない'
css = m.group(0)

m = re.search(r'<g id="c1"[\s\S]*?</g>(?=\s*<!-- ラベルは)', src)
assert m, '<g id="c1"> ブロックが見つからない'
c1 = m.group(0)

assert 'transform="translate(234,34) scale(0.86)"' in c1
c1 = c1.replace(' transform="translate(234,34) scale(0.86)"', '', 1)
assert NEEDLE_0 in c1, '針の初期transformが見つからない'

CSS_BLOCK = '/*C1_CSS_BEGIN*/' + css + '/*C1_CSS_END*/'

for path, lamps, needle in TARGETS:
    if not os.path.exists(path):          # まだ書いていない旅は黙って飛ばす（実装の順番に左右されない）
        print('skip (未作成):', os.path.basename(path)); continue
    lit = c1.replace(NEEDLE_0, needle, 1)
    for lamp in lamps:
        tag = '<g id="%s" class="hid">' % lamp
        assert tag in lit, '警告灯 %s が移植元に見つからない' % lamp
        lit = lit.replace(tag, '<g id="%s">' % lamp, 1)
    METER_BLOCK = '<!--C1_METER_BEGIN-->' + lit + '<!--C1_METER_END-->'
    t = io.open(path, encoding='utf-8').read()
    if '<!--C1_METER_BEGIN-->' in t:
        t = re.sub(r'<!--C1_METER_BEGIN-->[\s\S]*?<!--C1_METER_END-->', lambda _: METER_BLOCK, t, count=1)
    else:
        assert '<!--C1_METER-->' in t, path + ' にプレースホルダが無い'
        t = t.replace('<!--C1_METER-->', METER_BLOCK, 1)
    io.open(path, 'w', encoding='utf-8', newline='\n').write(t)
    print('spliced:', os.path.basename(path), '+'.join(lamps), needle, len(lit), 'chars')

t = io.open(CSS_TARGET, encoding='utf-8').read()
if '/*C1_CSS_BEGIN*/' in t:
    t = re.sub(r'/\*C1_CSS_BEGIN\*/[\s\S]*?/\*C1_CSS_END\*/', lambda _: CSS_BLOCK, t, count=1)
else:
    assert '/*C1_CSS*/' in t, CSS_TARGET + ' にCSSプレースホルダが無い'
    t = t.replace('/*C1_CSS*/', CSS_BLOCK, 1)
io.open(CSS_TARGET, 'w', encoding='utf-8', newline='\n').write(t)
print('spliced:', os.path.basename(CSS_TARGET), len(css), 'chars')
