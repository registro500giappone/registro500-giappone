# -*- coding: utf-8 -*-
"""配信用の上面図 /wiring-img/car-top-v9.svg を作る。
   原本 ref/svg/fiat500f_top.svg（1 unit = 1mm）から、
     ・座標を 0.1mm へ丸める
     ・CSSで色と太さを変えられるよう stroke:currentColor にする
     ・ドアミラーを落とす（2026-08-20 ユーザー指示。下敷きに要らない）
   ⚠️ミラーは上面図で左右の向きを判定した唯一の目印だった。判定結果と根拠は
     ref/calibration.json の top.orientation_evidence に書いてあるので消しても分からなくならない。
"""
import re, io

SRC = 'wiring-simulator/ref/svg/fiat500f_top.svg'
DST = 'wiring-img/car-top-v9.svg'
# 落とす領域（mm）。ここに丸ごと収まるサブパスだけ捨てる＝長い車体線は残る
DROP = [((930, 1045), (1190, 1335), 'ドアミラー（車の左）')]


def subpaths(d):
    out = []
    for s in d.replace('Z', ' ').split('M'):
        s = s.strip()
        if s:
            out.append([[float(a) for a in q.split(',')] for q in s.split()])
    return out


def inside(sp):
    xs = [p[0] for p in sp]; ys = [p[1] for p in sp]
    for (x0, x1), (y0, y1), _ in DROP:
        if x0 <= min(xs) and max(xs) <= x1 and y0 <= min(ys) and max(ys) <= y1:
            return True
    return False


def num(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


src = io.open(SRC, encoding='utf-8').read()
P = {m.group(1): m.group(2) for m in re.finditer(r'<path class="(\w+)" d="([^"]+)"', src)}
body, dropped, kept = [], 0, 0
for k in ('outline', 'panel', 'trim', 'detail'):
    if k not in P:
        continue
    ds = []
    for sp in subpaths(P[k]):
        if inside(sp):
            dropped += len(sp); continue
        kept += len(sp)
        ds.append('M' + ' '.join(num(x) + ',' + num(y) for x, y in sp))
    if ds:
        body.append('<path class="%s" d="%s"/>' % (k, ''.join(ds)))

out = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3020 1366.3" width="3020" height="1366.3">'
       '<!-- FIAT 500F 上面図。1 unit = 1mm（前端 x=25 / 後端 x=2995 / 中心線 y=683.15 /'
       ' 車の右＝画像の上）。3Dモデル fiat500f_1965.glb の正射投影。権利フリーをユーザー確認済'
       '（2026-08-20）。ドアミラーは下敷きに要らないので落としてある。 -->'
       '<style>path{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;'
       'vector-effect:non-scaling-stroke}.outline{stroke-width:2.2}.panel{stroke-width:1.8}'
       '.trim{stroke-width:1.1}.detail{stroke-width:.8}</style><g id="car-top">'
       + ''.join(body) + '</g></svg>')
io.open(DST, 'w', encoding='utf-8').write(out)
print('%s: 残した点 %d / 落とした点 %d / %d bytes' % (DST, kept, dropped, len(out)))
