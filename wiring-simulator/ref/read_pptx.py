# -*- coding: utf-8 -*-
"""記入済みの PowerPoint から、部品の位置と配線のルートを数値で読み取る。

  使い方: python wiring-simulator/ref/read_pptx.py <返ってきた.pptx>

  ⚠️縮尺は「画像図形の実際の位置と大きさ」から毎回逆算する（対応表は画像の名前に
    CARVIEW|view|m0|m1|v0|v1 の形で埋めてある）＝図を動かされても拡大されても正しく読める。
  ⚠️部品の位置は【図形の中央】。パレット（図の外）に置きっぱなしの物は「未配置」として弾く。
  ⚠️配線はフリーフォームの折れ点を拾い、両端にいちばん近い部品名を当てる。
"""
import sys, json
from pptx import Presentation
from pptx.util import Emu

SRC = sys.argv[1] if len(sys.argv) > 1 else '_handwrite_FIAT500F.pptx'
NS = '{http://schemas.openxmlformats.org/drawingml/2006/main}'


def mm(v):
    return Emu(int(v)).mm


def mapper(pic):
    """画像図形から「スライド上のmm → 車の座標(m)」の換算関数を作る。"""
    _, view, m0, m1, v0, v1 = pic.name.split('|')
    m0, m1, v0, v1 = map(float, (m0, m1, v0, v1))
    L, T = mm(pic.left), mm(pic.top)
    W, H = mm(pic.width), mm(pic.height)

    def to_car(x, y):
        return (m0 + (x - L) / W * (m1 - m0), v0 + (y - T) / H * (v1 - v0))

    def inside(x, y, slack=3.0):
        return L - slack <= x <= L + W + slack and T - slack <= y <= T + H + slack
    return view, to_car, inside


def freeform_points(sp):
    """フリーフォームの折れ点をスライド上のmmで返す。custGeom を直接読む。"""
    el = sp._element
    g = el.find('.//' + NS + 'custGeom')
    if g is None:
        return []
    ext = el.find('.//' + NS + 'ext')
    off = el.find('.//' + NS + 'off')
    if ext is None or off is None:
        return []
    cx, cy = float(ext.get('cx')), float(ext.get('cy'))
    ox, oy = float(off.get('x')), float(off.get('y'))
    pts = []
    for path in g.iter(NS + 'path'):
        w, h = float(path.get('w') or 0), float(path.get('h') or 0)
        if w <= 0 or h <= 0:
            continue
        for node in path:
            for p in node.iter(NS + 'pt'):
                x = ox + float(p.get('x')) / w * cx
                y = oy + float(p.get('y')) / h * cy
                pts.append((mm(x), mm(y)))
    return pts


def nearest(parts, m, v):
    if not parts:
        return None, None
    d = [(((m - p['m']) ** 2 + (v - p['v']) ** 2) ** .5, p) for p in parts]
    d.sort(key=lambda t: t[0])
    return d[0][1], d[0][0]


prs = Presentation(SRC)
out = {'parts': {}, 'wires': []}
for n, sl in enumerate(prs.slides, 1):
    pic = next((s for s in sl.shapes if s.name.startswith('CARVIEW|')), None)
    if pic is None:
        continue
    view, to_car, inside = mapper(pic)
    placed, stray = [], []
    for s in sl.shapes:
        if not s.name.startswith('PART|'):
            continue
        cx, cy = mm(s.left) + mm(s.width) / 2, mm(s.top) + mm(s.height) / 2
        pid = s.name.split('|', 1)[1]
        lab = s.text_frame.text.strip() if s.has_text_frame else pid
        if not inside(cx, cy):
            stray.append(lab)
            continue
        m, v = to_car(cx, cy)
        rot = round(float(s.rotation or 0) % 360, 1)   # 向きを変えた部品（例: バッテリーの端子側）
        placed.append({'id': pid, 'label': lab, 'm': m, 'v': v, 'rot': rot})
        rec = out['parts'].setdefault(pid, {'label': lab})
        rec['label'] = lab
        if view == 'top':
            rec['m'], rec['lat'] = round(m, 3), round(v, 3)
            if rot:
                rec['rot_top'] = rot
        else:
            # 前後は上面図を正とし、側面図の値は食い違い検出のために別名で残す
            rec['h'], rec['m_side'] = round(v, 3), round(m, 3)
            if rot:
                rec['rot_side'] = rot

    print('── %d枚目（%s）' % (n, '上から' if view == 'top' else '横から'))
    if placed:
        key = '中心から(m)' if view == 'top' else '地面から(m)'
        print('   %-14s %10s %12s %8s' % ('部品', '前端から(m)', key, '回転'))
        for p in sorted(placed, key=lambda p: p['m']):
            print('   %-14s %10.3f %12.3f %8s'
                  % (p['label'], p['m'], p['v'], ('%.0f°' % p['rot']) if p['rot'] else '-'))
    if stray:
        print('   未配置（図の外に残っている）: ' + ' / '.join(stray))

    for s in sl.shapes:
        pts = freeform_points(s)
        if len(pts) < 2:
            continue
        car = [to_car(x, y) for x, y in pts]
        a, da = nearest(placed, *car[0])
        b, db = nearest(placed, *car[-1])
        w = {'view': view,
             'from': a['id'] if a else None, 'to': b['id'] if b else None,
             'from_gap_m': round(da, 3) if da is not None else None,
             'to_gap_m': round(db, 3) if db is not None else None,
             'points': [[round(m, 3), round(v, 3)] for m, v in car]}
        out['wires'].append(w)
        print('   配線: %s → %s（折れ点%d・端の離れ %.02f/%.02fm）'
              % (a['label'] if a else '?', b['label'] if b else '?',
                 len(car), da or 0, db or 0))

print()
print(json.dumps(out, ensure_ascii=False, indent=1))
