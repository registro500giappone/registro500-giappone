# -*- coding: utf-8 -*-
"""上面図の閲覧ページ（リンクで見る用）を作る。
   PARTS/ZONES/較正値は wiring-simulator/ref/make_top_review.py を正本として読み込む。"""
import io, re, sys, runpy
import os

REPO = 'C:/Users/akayu/Documents/registro500-giappone/'
os.chdir(REPO)
sys.argv = ['make_top_review.py', '1320']
m = runpy.run_path(REPO + 'wiring-simulator/ref/make_top_review.py')  # 副作用は _top_review.html の再生成のみ
PARTS, ZONES = m['PARTS'], m['ZONES']
LANDMARKS, landmark_svg = m['LANDMARKS'], m['landmark_svg']
S, LAT, CY = m['S'], m['LAT'], m['CY']

X = lambda v: v * S
Y = lambda lat: CY - lat * LAT

def path_of(f):
    s = io.open(REPO + 'wiring-img/' + f, encoding='utf-8').read()
    return re.search(r'\sd="([^"]+)"', s).group(1)

VIEWS = [('v7s', '骨格',   'car-top-v7s.svg'),
         ('v7',  '詳細',   'car-top-v7.svg'),
         ('v6',  '前の版', 'car-top-v6.svg')]
DS = {k: path_of(f) for k, _, f in VIEWS}
MAIN = 'v7s'                      # 部品つきに使う版

car = lambda k: ('<path fill="none" stroke="var(--line)" stroke-width="var(--lw,0.8)" '
                 'stroke-linejoin="round" stroke-linecap="round" d="' + DS[k] + '"/>')

def svg_plain(k):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 459 215">' + car(k) + '</svg>'

def svg_parts():
    g = []
    for a, b, t in ZONES:
        g += ['<rect x="%.1f" y="-20" width="%.1f" height="243" fill="var(--zone)"/>' % (X(a), X(b - a)),
              '<line x1="%.1f" y1="-20" x2="%.1f" y2="224" stroke="var(--rule)" stroke-width=".7" stroke-dasharray="4 3"/>' % (X(b), X(b)),
              '<text x="%.1f" y="232" font-size="8" text-anchor="middle" fill="var(--muted)">%s</text>' % (X((a + b) / 2), t)]
    g.append('<line x1="0" y1="%.1f" x2="447" y2="%.1f" stroke="var(--axis)" stroke-width=".5" stroke-dasharray="6 4"/>' % (CY, CY))
    g.append('<g class="lm">' + landmark_svg('var(--ref)') + '</g>')
    g.append(car(MAIN))
    for mm, lat, t, k, dx, dy, lead in PARTS:
        x, y = X(mm), Y(lat)
        c = 'var(--ref)' if k == 'ref' else 'var(--pin)'
        r = 4 if k == 'ref' else 6
        if lead:
            g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width=".5" opacity=".65"/>'
                     % (x, y, x + dx * .78, y + dy * .68, c))
        g += ['<circle cx="%.1f" cy="%.1f" r="%.1f" fill="var(--surface)" stroke="%s" stroke-width="1.5"/>' % (x, y, r, c),
              '<text x="%.1f" y="%.1f" font-size="8.7" text-anchor="middle" fill="%s">%s</text>' % (x + dx, y + dy, c, t)]
    g += ['<text x="-32" y="4" font-size="9.8" fill="var(--muted)">&#9650; 車の右側</text>',
          '<text x="-32" y="208" font-size="9.8" fill="var(--muted)">&#9660; 車の左側</text>',
          '<text x="2" y="-16" font-size="9.8" fill="var(--muted)">&#9664; ノーズ</text>',
          '<text x="384" y="-16" font-size="9.8" fill="var(--muted)">エンジン &#9654;</text>']
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-38 -32 528 278">' + ''.join(g) + '</svg>'

rows = ''.join(
    '<tr><td>%s</td><td class="n">%.2f</td><td class="n">%s</td></tr>'
    % (t, mm, ('中央' if abs(lat) < .005 else ('右 %.2f' % lat if lat > 0 else '左 %.2f' % -lat)))
    for mm, lat, t, k, dx, dy, lead in PARTS)

CSS = """
:root{
  --ground:#f3f0e7; --surface:#fbf9f4; --ink:#26313a; --line:#38434c;
  --muted:#8b8878; --rule:#c3bdac; --axis:#c9a3a3; --zone:rgba(141,133,116,.055);
  --pin:#2f6f8f; --ref:#a9a294; --edge:rgba(38,49,58,.14);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --ground:#12171a; --surface:#1a2126; --ink:#dfe6e9; --line:#c3ced5;
    --muted:#8a978f; --rule:#3c4850; --axis:#6d4f4f; --zone:rgba(200,214,222,.05);
    --pin:#6fb3d2; --ref:#6d7a80; --edge:rgba(223,230,233,.16);
  }
}
:root[data-theme="dark"]{
  --ground:#12171a; --surface:#1a2126; --ink:#dfe6e9; --line:#c3ced5;
  --muted:#8a978f; --rule:#3c4850; --axis:#6d4f4f; --zone:rgba(200,214,222,.05);
  --pin:#6fb3d2; --ref:#6d7a80; --edge:rgba(223,230,233,.16);
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font:15px/1.7 system-ui,-apple-system,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:20px 16px 56px;display:flex;flex-direction:column;gap:18px}
header{display:flex;flex-direction:column;gap:4px;border-bottom:1px solid var(--edge);padding-bottom:14px}
h1{margin:0;font-size:20px;font-weight:600;letter-spacing:.02em;text-wrap:balance}
.sub{margin:0;color:var(--muted);font-size:13px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em}
.bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;
  background:var(--ground);padding:8px 0;border-bottom:1px solid var(--edge)}
.grp{display:flex;gap:6px;align-items:center;color:var(--muted);
  font-family:ui-monospace,monospace;font-size:12px}
.grp+.grp{margin-left:auto}
button{font:inherit;font-size:13px;color:var(--ink);background:var(--surface);
  border:1px solid var(--edge);border-radius:2px;padding:6px 12px;cursor:pointer}
button[aria-pressed="true"]{border-color:var(--pin);color:var(--pin);box-shadow:inset 0 0 0 1px var(--pin)}
button:focus-visible{outline:2px solid var(--pin);outline-offset:2px}
.stage{background:var(--surface);border:1px solid var(--edge);overflow-x:auto}
.stage svg{display:block;height:auto;width:var(--w,100%);min-width:100%}
table{border-collapse:collapse;font-size:13px;min-width:320px}
caption{text-align:left;color:var(--muted);font-size:12px;padding-bottom:6px;
  font-family:ui-monospace,monospace;letter-spacing:.04em}
th,td{padding:5px 14px 5px 0;border-bottom:1px solid var(--edge);text-align:left}
th{color:var(--muted);font-weight:500;font-size:12px;letter-spacing:.05em}
td.n{font-family:ui-monospace,monospace;font-variant-numeric:tabular-nums}
.note{color:var(--muted);font-size:13px;max-width:64ch}
.note b{color:var(--ink);font-weight:600}
.tablewrap{overflow-x:auto}
"""

JS = """
var stage=document.getElementById('stage');
function pick(attr,fn){document.querySelectorAll('['+attr+']').forEach(function(b){
  b.addEventListener('click',function(){fn(b.getAttribute(attr));
    document.querySelectorAll('['+attr+']').forEach(function(o){
      o.setAttribute('aria-pressed',String(o===b));});});});}
pick('data-view',function(v){
  document.querySelectorAll('.fig').forEach(function(f){f.hidden=(f.id!=='f-'+v);});});
pick('data-zoom',function(v){stage.style.setProperty('--w',v+'%');});
pick('data-lw',function(v){stage.style.setProperty('--lw',v);});
"""

figs = ''.join('<div class="fig" id="f-%s"%s>%s</div>' % (k, '' if k == 'v7s' else ' hidden', svg_plain(k))
               for k, _, _ in VIEWS)
figs += '<div class="fig" id="f-parts" hidden>' + svg_parts() + '</div>'
btns = ''.join('<button data-view="%s" aria-pressed="%s">%s</button>' % (k, str(k == 'v7s').lower(), label)
               for k, label, _ in VIEWS)

html = (
 '<meta charset="utf-8">\n<title>500F 部品配置マップ</title>\n<style>' + CSS + '</style>\n'
 '<div class="wrap">\n'
 '<header><h1>FIAT 500F 上面図 — 部品の実配置</h1>'
 '<p class="sub">150.5 px&#8260;m (前後) &#183; 153.4 px&#8260;m (左右) &#183; ノーズ左</p></header>\n'
 '<div class="bar">'
 '<span class="grp">線画 ' + btns +
 '<button data-view="parts" aria-pressed="false">部品つき</button></span>'
 '<span class="grp">拡大 '
 '<button data-zoom="100" aria-pressed="true">1&#215;</button>'
 '<button data-zoom="200" aria-pressed="false">2&#215;</button>'
 '<button data-zoom="400" aria-pressed="false">4&#215;</button></span>'
 '<span class="grp">太さ '
 '<button data-lw="0.6" aria-pressed="false">細</button>'
 '<button data-lw="0.8" aria-pressed="true">標準</button>'
 '<button data-lw="1.1" aria-pressed="false">太</button></span></div>\n'
 '<div class="stage" id="stage">' + figs + '</div>\n'
 '<p class="note">下敷きを<b>高解像度の元図（1536&#215;1024）に差し替えて引き直しました</b>。'
 '<b>骨格</b>＝長い線だけを残した版（部品つきはこれ）。<b>詳細</b>＝エンジンリッドのルーバーまで全部。'
 '<b>前の版</b>＝低解像度の元図から起こした従来のもの。'
 '仕上がりのカーブが元図の線から離れた量は、上半分の全長にわたって'
 '<b>平均1.1mm・95%が2.8mm以内・最大13.2mm</b>（実測）。'
 '中心線より上（車の右側）だけを採って鏡像で左を作っているので、左右は厳密に対称です。</p>\n'
 '<div class="tablewrap"><table><caption>部品の位置（前端からの距離／中心線からの左右）</caption>'
 '<tr><th>部品</th><th>前端から m</th><th>中心線から m</th></tr>' + rows + '</table></div>\n'
 '</div>\n<script>' + JS + '</script>\n')

io.open(REPO + '_top_view.html', 'w', encoding='utf-8').write(html)
print('ok', len(html))
