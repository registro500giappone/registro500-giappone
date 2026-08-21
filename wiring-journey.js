/*! wiring-journey.js — 旅ページ共通ランタイム（1症状=1ページ=1URLの「旅の絵」）
 *
 *  設計の正本: wiring-simulator/HANDOFF.md §0（旅の絵方式）／ SCHEMA.md
 *
 *  ここに置くのは「どの旅でも同じもの」だけ:
 *    - 場面の作り方（controls → positions → 故障の直接上書き → solve）
 *    - 描画プリミティブ（線・黄点・ラベル・アース・テスターのプローブ）
 *    - どの旅にも出てくる部品の絵（バッテリー・キースイッチ・警告灯の小窓）
 *    - 実車上面図の切り出し・検算表・トグル・起動
 *  旅ごとに違うのは「絵の中身（部品の並び）・文言・検算・実車で指す部品」の4つだけ。
 *
 *  ⚠️図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。
 *  ⚠️第1号（チャージランプ）はユーザー確定済み＝このファイルへの切り出しで見た目を1文字も変えないこと。
 *    （例外＝2026-08-21 のユーザー指示による警告灯の光らせ方の変更。以後もここを変えるのは指示があったときだけ）
 */
(function (global) {
  'use strict';

  /* 被覆色（原典の色名 → 画面の色）。案C＝線は被覆色・通電は黄点の動き・無電は薄く */
  var WC = { ROSSO: '#c0392b', AZZURRO: '#4a9fd8', VERDE: '#2f7d4f', MARRONE: '#6f4a2a', NERO: '#33302b', GRIGIO: '#8d8574' };
  var C = { deep: '#2c3a31', body: '#3f5347', in_: '#e6e0d0', sub: '#8d8574', hi: '#b8442e', dim: '#ddd5c4', out: '#c9c2b1', ok: '#2f7d4f' };

  var NET = null, PATCHES = null;

  /* ================= 場面 ================= */
  /* controls を通して部品位置を決め、必要なら故障を直接上書きして solve する。
     「controls に無い状態」（ベルト切れ相当・センダ固着など）は override で作る＝
     netlist を故障のために膨らませない。どの旅も同じ作法。 */
  function makeScenario(cfg) {
    return function (o) {
      o = o || {};
      var alt = ('alt' in o) ? o.alt : cfg.alt;
      var net = NET;
      if (alt) net = WiringSim.applyPatches(NET, PATCHES.patches, { generator: 'オルタネーター' }, 'F');
      /* 線そのものを外す・足す場面（断線・端子を抜く）は position では表せない＝
         netlist に op を当てる。applyPatchOps は仕様パッチと同じ仕組みで、ここでは
         「その1本が無い netlist」を作るためだけに使う（L2 故障注入の先取り）。 */
      if (o.ops) net = WiringSim.applyPatchOps(net, o.ops);
      var pos = WiringSim.positionsFrom(net, o.inputs || {}, 'F');
      if (o.override) for (var k in o.override) pos[k] = o.override[k];
      var r = WiringSim.solve(net, { type: 'F', positions: pos });
      var lamp = null;
      for (var i = 0; i < r.loads.length; i++) if (r.loads[i].id === cfg.lampId) lamp = r.loads[i];
      var sc = { r: r, pos: pos, lampOn: lamp ? lamp.on : false, alt: alt };
      if (cfg.extra) cfg.extra(sc);
      return sc;
    };
  }

  /* ================= 描画キット ================= */
  function Kit(sc, mode, cfg) {
    this.sc = sc; this.mode = mode || {}; this.cfg = cfg || {};
    this.r = sc.r; this.pos = sc.pos; this.s = [];
  }
  Kit.prototype.push = function (x) { this.s.push(x); };

  /* wire id → 状態つきの色。off（＝どこにも通じない）だけ薄くする。
     post（負荷の先＝電圧は出るが流れない）は被覆色のまま＝黄点が無いことで「流れていない」を言う。 */
  Kit.prototype.wcol = function (id, fallback) {
    var r = this.r, w = null;
    for (var i = 0; i < r.wires.length; i++) if (r.wires[i].id === id) w = r.wires[i];
    var col = w && w.color ? WC[w.color] : (fallback || C.sub);
    var st = r.wire[id];
    return { col: (st === 'off' || st === undefined) ? C.dim : col, live: (st === 'hot' || st === 'gnd') };
  };
  Kit.prototype.dots = function (x, y1, y2, up) {          /* 縦線に流れる黄点（CSSで縦に動く） */
    for (var y = y1; y <= y2; y += 22)
      this.s.push('<circle class="' + (up ? 'dot up' : 'dot') + '" cx="' + x + '" cy="' + y + '" r="4.6"/>');
  };
  Kit.prototype.dotsH = function (y, x1, x2, dir) {          /* 横線に流れる黄点（dir='right'|'left'） */
    for (var x = x1; x <= x2; x += 22)
      this.s.push('<circle class="dot ' + dir + '" cx="' + x + '" cy="' + y + '" r="4.6"/>');
  };
  /* 流れの向きの規則。既定＝灯が点いていれば下向き（放電の向き）。
     旅ごとに別の流れ（充電の戻りなど）があれば cfg.flow で上書きする。 */
  Kit.prototype.flow = function (id, x, y1, y2) {
    if (this.cfg.flow) { var d = this.cfg.flow(this.sc, id, x, y1, y2); if (d !== undefined) return d; }
    return this.sc.lampOn ? 'down' : null;
  };
  Kit.prototype.seg = function (x1, y1, x2, y2, id, thick, fallback) {
    var c = this.wcol(id, fallback);
    this.s.push('<path d="M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2 + '" stroke="' + c.col + '" stroke-width="' + (thick ? 6.5 : 5) + '" fill="none" stroke-linecap="round"/>');
    if (x1 === x2 && c.live) {
      var dir = this.flow(id, x1, y1, y2);
      if (dir === 'down') this.dots(x1, Math.min(y1, y2) + 6, Math.max(y1, y2) - 26, false);
      else if (dir === 'up') this.dots(x1, Math.min(y1, y2) + 26, Math.max(y1, y2) - 6, true);
    }
  };
  Kit.prototype.label = function (x, y, t, col, anchor, size) {
    this.s.push('<text x="' + x + '" y="' + y + '" font-size="' + (size || 13) + '" fill="' + (col || C.sub) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + t + '</text>');
  };
  Kit.prototype.ground = function (x, y, name) {
    this.s.push('<path d="M' + (x - 16) + ',' + y + ' L' + (x + 16) + ',' + y + ' M' + (x - 10) + ',' + (y + 7) + ' L' + (x + 10) + ',' + (y + 7) + ' M' + (x - 4) + ',' + (y + 14) + ' L' + (x + 4) + ',' + (y + 14) + '" stroke="' + C.deep + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>');
    if (name) this.label(x + 24, y + 12, name, C.deep);
  };
  Kit.prototype.probe = function (x, y, t, dx, dy) {          /* テスターのプローブ */
    this.s.push('<path d="M' + (x + dx) + ',' + (y + dy) + ' L' + x + ',' + y + '" stroke="' + C.hi + '" stroke-width="3.5" stroke-linecap="round"/>');
    this.s.push('<circle cx="' + (x + dx) + '" cy="' + (y + dy - 4) + '" r="11" fill="' + C.hi + '"/>');
    this.s.push('<text x="' + (x + dx) + '" y="' + (y + dy) + '" font-size="12" fill="#fffdf8" text-anchor="middle">' + t + '</text>');
  };
  /* 容疑区間の囲み（旅ごとに範囲が違うので座標は呼ぶ側が渡す） */
  Kit.prototype.suspect = function (x, y, w, h, textY, t) {
    this.s.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12" fill="none" stroke="' + C.hi + '" stroke-width="2.5" stroke-dasharray="7 6"/>');
    this.s.push('<text x="' + (x + 6) + '" y="' + textY + '" font-size="13" fill="' + C.hi + '" font-weight="700">' + (t || '容疑者はこの中だけ') + '</text>');
  };
  Kit.prototype.dashOut = function (x1, y, x2) {              /* この旅は通らない枝＝薄い破線 */
    this.s.push('<path d="M' + x1 + ',' + y + ' L' + x2 + ',' + y + '" stroke="' + C.out + '" stroke-width="3" stroke-dasharray="5 5"/>');
  };
  Kit.prototype.node = function (x, y) {
    this.s.push('<circle cx="' + x + '" cy="' + y + '" r="4.5" fill="' + C.deep + '"/>');
  };

  /* ---- どの旅にも出てくる部品 ---- */
  /* バッテリー（端子とセルキャップのある形）。上端 y=18・下端 y=62 */
  Kit.prototype.battery = function (x) {
    var s = this.s;
    s.push('<rect x="' + (x - 45) + '" y="18" width="90" height="44" rx="6" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<rect x="' + (x - 45) + '" y="18" width="90" height="10" rx="5" fill="' + C.deep + '"/>');
    s.push('<rect x="' + (x - 34) + '" y="8" width="13" height="14" rx="2.5" fill="' + C.hi + '"/>');       /* ＋端子 */
    s.push('<rect x="' + (x + 21) + '" y="8" width="13" height="14" rx="2.5" fill="#5c5a56"/>');            /* −端子 */
    s.push('<text x="' + (x - 46) + '" y="16" font-size="13" font-weight="700" fill="' + C.hi + '" text-anchor="end">+</text>');
    s.push('<text x="' + (x + 48) + '" y="16" font-size="14" font-weight="700" fill="#5c5a56">−</text>');
    s.push('<g fill="' + C.in_ + '" opacity=".85"><circle cx="' + (x - 20) + '" cy="40" r="4"/><circle cx="' + x + '" cy="40" r="4"/><circle cx="' + (x + 20) + '" cy="40" r="4"/></g>');
    s.push('<text x="' + x + '" y="56" font-size="12" fill="#fffdf8" text-anchor="middle">バッテリー</text>');
  };
  /* キースイッチ（箱の中の接点が、キーを回すと橋を架ける）。top=箱の上端・高さ48 */
  Kit.prototype.keySwitch = function (x, top, on) {
    var s = this.s;
    s.push('<rect x="' + (x - 50) + '" y="' + top + '" width="100" height="48" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    /* 鍵の絵（左側・ONで回る） */
    s.push('<circle cx="' + (x - 28) + '" cy="' + (top + 24) + '" r="12" fill="' + C.in_ + '"/>');
    s.push('<rect x="' + (x - 30) + '" y="' + (top + 10) + '" width="4" height="14" rx="1.5" fill="' + C.deep + '" transform="rotate(' + (on ? 42 : 0) + ' ' + (x - 28) + ' ' + (top + 24) + ')"/>');
    /* 接点（上下2点＋橋）：ONで縦につながる */
    s.push('<circle cx="' + x + '" cy="' + (top + 10) + '" r="3.8" fill="' + C.in_ + '"/>');
    s.push('<circle cx="' + x + '" cy="' + (top + 38) + '" r="3.8" fill="' + C.in_ + '"/>');
    if (on) s.push('<path d="M' + x + ',' + (top + 10) + ' L' + x + ',' + (top + 38) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    else s.push('<path d="M' + x + ',' + (top + 10) + ' L' + (x + 13) + ',' + (top + 32) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<text x="' + (x + 28) + '" y="' + (top + 28) + '" font-size="10.5" fill="' + C.in_ + '" text-anchor="middle">' + (on ? '接点 閉' : '接点 開') + '</text>');
    this.label(x + 56, top + 18, 'キースイッチ', C.deep, null, 12);
    this.label(x + 56, top + 34, on ? 'キーON' : 'キーOFF', on ? C.deep : C.sub, null, 12);
  };
  /* 警告灯＝メーターの小窓と同じ顔。top=小窓の上端・高さ28。labels を渡すと右に2行そえる */
  /* 警告灯の小窓。【2026-08-21 FB】旅の絵の中で「点いているか消えているか」がぱっと見で
     分からなかった＝ページ冒頭の実物メーターと同じ光り方に寄せた（赤い芯＋光のにじみ）。
     ⛔隣に電球アイコンを足す案は採らない：症状の表示が2箇所に分かれて「どっちを見るのか」に
       なる（第1号で電球のバツ印を廃止したのと同じ理由）。
     ⛔点滅（ちかちか）させない：実車の警告灯は点滅しないので「断続的に点いたり消えたりする
       不具合」に読める＝この症状（点きっぱなし）と食い違う。ゆっくりした明滅の .lampglow だけ
       （prefers-reduced-motion では自動的に静止した赤になる）。 */
  Kit.prototype.lampWindow = function (x, top, text, lit, labels, labelX) {
    var s = this.s, cy = top + 14;
    if (lit) {
      /* にじみ＝メーター側 #lampg と同じ配色。id はページ内の全場面で同一で構わない
         （どのSVGでも中身が同じため。⚠️中身を変えるときは id も変えること） */
      /* ⚠️にじみは2枚重ね（2026-08-21 その2）。1枚だと薄く広がるだけで、明るいPC画面では
         点いているのが分からなかった＝外側の広いにじみ＋内側の濃い芯、で密度を上げる */
      s.push('<defs>'
        + '<radialGradient id="jlampg">'
        + '<stop offset="0%" stop-color="#ff5a3c" stop-opacity=".95"/>'
        + '<stop offset="42%" stop-color="#ff3a20" stop-opacity=".5"/>'
        + '<stop offset="100%" stop-color="#ff3a20" stop-opacity="0"/></radialGradient>'
        + '<linearGradient id="jlampf" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0%" stop-color="#ff6a4a"/><stop offset="55%" stop-color="#ef4526"/>'
        + '<stop offset="100%" stop-color="#c9301a"/></linearGradient></defs>');
      s.push('<g class="lampglow">'
        + '<ellipse cx="' + x + '" cy="' + cy + '" rx="86" ry="56" fill="url(#jlampg)" opacity=".5"/>'
        + '<ellipse cx="' + x + '" cy="' + cy + '" rx="58" ry="34" fill="url(#jlampg)"/>'
        /* レンズのすぐ外を回る細いコロナ＝広いにじみより「光っている」が伝わる。
           ⚠️右のラベル（labelX）に触れない幅に収めること */
        + '<rect x="' + (x - 43) + '" y="' + (top - 6) + '" width="86" height="44" rx="10" fill="none" stroke="#ff5a3c" stroke-width="3" opacity=".7"/>'
        + '<rect x="' + (x - 49) + '" y="' + (top - 12) + '" width="98" height="56" rx="14" fill="none" stroke="#ff5a3c" stroke-width="2" opacity=".28"/></g>');
    }
    /* 点灯時のレンズは平らな赤ではなく縦のグラデーション＝自分で光っているように見える。
       小窓は点灯時だけ一回り大きい＝小さい画面でも「そこが光っている」が分かる（2026-08-21 その3） */
    var hw = lit ? 40 : 36, hh = lit ? 32 : 28;
    s.push('<rect x="' + (x - hw) + '" y="' + top + '" width="' + (hw * 2) + '" height="' + hh + '" rx="6" fill="' + (lit ? 'url(#jlampf)' : '#eae4d5') + '" stroke="' + (lit ? '#ffc7b4' : '#c3bba6') + '" stroke-width="' + (lit ? 3 : 2) + '"/>');
    /* 点灯時だけ、レンズの上側に光の照り返しを1枚（＝ガラスが光って見える） */
    if (lit) s.push('<rect x="' + (x - 35) + '" y="' + (top + 3) + '" width="70" height="10" rx="4" fill="#fff" opacity=".32"/>');
    s.push('<text x="' + x + '" y="' + (top + (lit ? 21 : 19)) + '" font-size="' + (lit ? 12.5 : 11.5) + '" font-weight="700" fill="' + (lit ? '#fffdf8' : '#a89f8b') + '" text-anchor="middle">' + text + '</text>');
    if (labels) {
      this.label(labelX, top + 10, labels[0], lit ? C.hi : C.sub, null, 12);
      /* 状態の語（点いている／消えている）は太字＝文字でも一目で分かるように */
      s.push('<text x="' + labelX + '" y="' + (top + 26) + '" font-size="12.5" font-weight="700" fill="'
        + (lit ? C.hi : C.ok) + '">' + (lit ? labels[1] : labels[2]) + '</text>');
    }
  };

  function wrap(parts, h) { return { vb: '0 0 300 ' + h, body: parts.join('') }; }

  /* ================= 実車上面図 ================= */
  /* ⚠️車SVGの <style> は文書のどこに置いても全体に効き、CSSはインライン属性に勝つ。
     全セレクタを漏れなく #carcrop 配下に書き換えてから挿入する（過去に旅の絵とC1メーターの
     パスを stroke:currentColor が全部乗っ取った実績あり）。 */
  function scopeCarStyles(inner) {
    return inner.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, function (_, attrs, css) {
      var scoped = css.replace(/(^|\})([^{}@]+)\{/g, function (_, brace, sel) {
        var s = sel.split(',').map(function (x) {
          x = x.trim();
          if (!x) return x;
          return x.indexOf('#carcrop') === 0 ? x : '#carcrop ' + x;
        }).join(',');
        return brace + ' ' + s + '{';
      });
      return '<style' + attrs + '>' + scoped + '</style>';
    });
  }
  /* opts: {viewBox, marks:[{id,color,label,anchor}], legend} — 座標は wiring-layout.json の実測値
     （1 SVG unit = 1mm・m=車の前後・lat=左右。オーナー実測＝こちらの推定値はゼロ） */
  function carMap(elId, carSvgText, layout, opts) {
    var e = document.getElementById(elId); if (!e) return;
    var inner = carSvgText.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    inner = scopeCarStyles(inner);
    function pt(id) { var p = layout.parts[id]; return { x: 25 + p.m * 1000, y: 683.15 - p.lat * 1000 }; }
    var html = '<g id="carcrop" style="color:#cbc4b3">' + inner + '</g>';
    (opts.marks || []).forEach(function (m) {
      var p = pt(m.id), start = (m.anchor === 'start');
      html += '<circle cx="' + p.x + '" cy="' + p.y + '" r="16" fill="' + m.color + '"/>';
      html += '<text x="' + (start ? p.x + 26 : p.x - 26) + '" y="' + (p.y + 8) + '" font-size="34" fill="' + m.color + '"' + (start ? '' : ' text-anchor="end"') + ' font-weight="700">' + m.label + '</text>';
    });
    html += (opts.legend || '');
    e.setAttribute('viewBox', opts.viewBox);
    e.innerHTML = html;
  }

  /* ================= 起動 ================= */
  /* cfg:
       lampId   … この旅の主役の負荷ID（例 'quadro.warn_oil'）
       alt      … 既定でパッチ（オルタ換装）を当てるか
       extra    … 場面に旅固有の判定を足す（例 charging）
       flow     … 黄点の流れの向きの上書き
       draw     … function(kit, mode) → 図の高さ。kit.s に SVG を積む
       caps     … {STOP:…, RUN:…} トグルの説明文
       checks   … 検算の配列 [{label, s:{alt,inputs,override}, expect}]
       scenes   … function(scenario) → [{id, sc, mode}]
       carmap   … function(layout, alt) → carMap の opts
       lampName … 検算表の見出しに使う灯の呼び名（HTML側と揃える必要はない） */
  function boot(cfg) {
    var scenario = makeScenario(cfg);

    function put(id, sc, mode) {
      var e = document.getElementById(id); if (!e) return;
      var kit = new Kit(sc, mode, cfg);
      var h = cfg.draw(kit, mode || {});
      var d = wrap(kit.s, h);
      e.setAttribute('viewBox', d.vb); e.innerHTML = d.body;
    }

    function setMain(v) {
      var btns = document.querySelectorAll('#tg button');
      for (var i = 0; i < btns.length; i++) btns[i].className = btns[i].getAttribute('data-v') === v ? 'on' : '';
      put('j-main', scenario({ inputs: { key: 'ON', engine: v } }), {});
      var cap = document.getElementById('mainCap'); if (cap) cap.innerHTML = cfg.caps[v];
    }

    /* 検算＝期待値は原典・実車から先に書いたもので、計算結果を写していない。
       1件でも✗なら足したデータの側が誤っている。 */
    function runChecks() {
      var tb = document.getElementById('checks'); if (!tb) return;
      for (var i = 0; i < cfg.checks.length; i++) {
        var c = cfg.checks[i], sc = scenario(c.s), got = c.read ? c.read(sc) : sc.lampOn, ok = (got === c.expect);
        var word = c.words || ['点く', '消える'];
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + c.label + '</td><td>' + (got ? word[0] : word[1]) + '</td><td>' + (c.expect ? word[0] : word[1]) + '</td>' +
                       '<td class="' + (ok ? 'check-ok' : 'check-ng') + '">' + (ok ? '✓' : '✗ 不一致') + '</td>';
        tb.appendChild(tr);
      }
    }

    Promise.all([
      fetch('/wiring-net.json').then(function (r) { return r.json(); }),
      fetch('/wiring-patches.json').then(function (r) { return r.json(); }),
      fetch('/wiring-img/car-top-v9.svg').then(function (r) { return r.text(); })
    ]).then(function (a) {
      NET = a[0]; PATCHES = a[1];
      fetch('/wiring-layout.json').then(function (r) { return r.json(); }).then(function (L) {
        if (cfg.carmap) carMap('carmap', a[2], L, cfg.carmap(L, cfg.alt));
      });

      var vers = document.getElementById('vers');
      if (vers) vers.textContent =
        'wiring-net.json NET_VERSION ' + NET.NET_VERSION + ' / wiring-patches.json PATCH_VERSION ' + PATCHES.PATCH_VERSION;

      setMain('STOP');
      var btns = document.querySelectorAll('#tg button');
      for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', function () { setMain(this.getAttribute('data-v')); });

      (cfg.scenes ? cfg.scenes(scenario) : []).forEach(function (s) { put(s.id, s.sc, s.mode); });
      runChecks();
    });
  }

  global.Journey = { WC: WC, C: C, Kit: Kit, boot: boot, wrap: wrap, carMap: carMap, makeScenario: makeScenario };
})(typeof window !== 'undefined' ? window : globalThis);
