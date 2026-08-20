# _top_color.html を、外部取得なしで動く1枚の写しに焼く（artifact 公開用）
# 使い方: repo直下で  python <このファイル>
import io, os
src = io.open('_top_color.html', encoding='utf-8').read()
assets = {
    'src-carsvg': ('text/plain', io.open('wiring-img/car-top-v9.svg', encoding='utf-8').read()),
    'src-layout': ('application/json', io.open('wiring-layout.json', encoding='utf-8').read()),
    'src-net':    ('application/json', io.open('wiring-net.json', encoding='utf-8').read()),
    'src-harn':   ('application/json', io.open('wiring-harness.json', encoding='utf-8').read()),
}
for k, (_, v) in assets.items():
    assert '</script' not in v, k

s = src.split('<head>', 1)[1].replace('</head>\n<body>\n', '', 1).rsplit('</body>', 1)[0]
s = s.replace('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n', '')
s = s.replace('<title>通電の色・3案くらべ（第2層の舞台）</title>', '<title>通電の色 3案くらべ</title>')

# 下敷きSVG＝関数にして、実行は末尾へ
s = s.replace("fetch('/wiring-img/car-top-v9.svg').then(function(r){return r.text();}).then(function(t){",
              "function loadCar(t){")
b = "  });\n\n  /* ---- 区画の帯 ---- */"
assert s.count(b) == 1
s = s.replace(b, "  }\n\n  /* ---- 区画の帯 ---- */")

# 3ファイルの取得＝末尾での直接代入へ
i = s.index('  Promise.all([')
j = s.index('  });', s.index('    apply(VB);\n', i)) + len('  });')
s = s[:i] + "  /* 起動はIIFEの末尾。⚠️ここで走らせると後段の var FAT / HIDDEN がまだ未代入で落ちる */" + s[j:]

tail = "\n  apply(VB);\n})();\n</script>"
assert s.count(tail) == 1
s = s.replace(tail,
    "\n  /* ---- 写し版の起動。取得の代わりに、ページに同梱したデータを直接渡す ---- */\n"
    "  function embedded(id){ return JSON.parse(document.getElementById(id).textContent); }\n"
    "  loadCar(document.getElementById('src-carsvg').textContent);\n"
    "  LAYOUT = embedded('src-layout'); NET = embedded('src-net'); HARN = embedded('src-harn');\n"
    "  drawWires(); drawParts(); drawGrounds(); power();\n"
    "\n  apply(VB);\n})();\n</script>")

sim = io.open('wiring-sim.js', encoding='utf-8').read()
assert '</script' not in sim
s = s.replace('<script src="/wiring-sim.js"></script>', '<script>\n' + sim + '\n</script>')

data = ''.join('<script type="%s" id="%s">%s</scr%s>\n' % (t, k, v, 'ipt')
               for k, (t, v) in assets.items())
s = s.replace('<script>\n', data + '<script>\n', 1)
s += ('\n<p class="note" style="margin-top:14px;border-top:1px solid var(--line);padding-top:10px">'
      'この頁はローカル作業ページ <code>_top_color.html</code> の写しです。'
      'データ（<code>wiring-layout.json</code>／<code>wiring-net.json</code>／<code>wiring-harness.json</code>／'
      '<code>car-top-v9.svg</code>）を同梱してあるので単独で動きます。'
      '⚠️こちらを直しても本体には反映されません＝直すのはローカル側です。</p>\n')

# 出力は repo 直下。⚠️gitignore の /_top_*.html に当てて追跡させない
out = '_top_color_share.html'
io.open(out, 'w', encoding='utf-8').write(s)
print('built', out, os.path.getsize(out))
