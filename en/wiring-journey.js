/*! * * 図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。
   * （例外＝。 */
(function (global) {
  'use strict';

  /* 被覆色（原典の色名→画面の色）。案C＝線は被覆色・通電は黄点の動き・無電は薄く */
  /* BIANCO（白）を足すときの落とし穴＝紙色の地に白い線を引くと消える。線そのものを灰色にごまかすと「原典の白」ではなくなるので、白は白のまま引いて【縁取りで浮かせる】（配線図ビューアのL型図で白線を「白塗り＋縁灰色」で描いたのと同じ作法）。
     縁取りは seg が自動で敷く。GIALLO E NERO（黄／黒）は原典の色名がそのまま color に入る＝キーにスペースを含む。 */
  /* 線の中に破線を描き分けると、この縮尺ではただ汚れて見えるため。だから本文では必ず正しい色名（「灰／赤」等）で呼ぶこと。 */
  var WC = { ROSSO: '#c0392b', AZZURRO: '#4a9fd8', VERDE: '#2f7d4f', MARRONE: '#6f4a2a', NERO: '#33302b', GRIGIO: '#8d8574',
             BIANCO: '#fbf7ee', GIALLO: '#dfae21', 'GIALLO E NERO': '#dfae21',
             /* で追加。 */
             'GRIGIO-ROSSO': '#8d8574', 'GRIGIO E NERO': '#8d8574', 'VERDE E NERO': '#2f7d4f', ROSA: '#cf7f9b',
             /* VIOLA＝原典 F/L のヒューズ F1 負荷側（ホーン・ルームランプ）。D型は BIANCO で、当会F図は D の色を引き写している（その122）。 */
             VIOLA: '#7a5296', 'AZZURRO-NERO': '#3a5f9e', 'AZZURRO E NERO': '#3a5f9e', 'BIANCO-NERO': '#cfc7b0', 'BIANCO E NERO': '#cfc7b0',
             /* AZZURRO E BIANCO＝原典 F/L/R のワイパースイッチ C →モーター F（D型だけ BIANCO・その129⑤）。
                青／白なので AZZURRO より淡く取る＝紙色の地でも沈まない（BIANCO 単色のような縁取りは要らない）。 */
             'AZZURRO-BIANCO': '#8ecbe8', 'AZZURRO E BIANCO': '#8ecbe8' };
  var C = { deep: '#2c3a31', body: '#3f5347', in_: '#e6e0d0', sub: '#8d8574', hi: '#b8442e', dim: '#ddd5c4', out: '#c9c2b1', ok: '#2f7d4f' };

  var NET = null, PATCHES = null;

  /* ================= 場面 ================= */
  /* controls を通して部品位置を決め、必要なら故障を直接上書きして solve する。
     「controls に無い状態」（ベルト切れ相当・センダ固着など）は override で作る＝ netlist を故障のために膨らませない。
     どのストーリーも同じ作法。 */
  function makeScenario(cfg) {
    return function (o) {
      o = o || {};
      var alt = ('alt' in o) ? o.alt : cfg.alt;
      var net = NET;
      if (alt) net = WiringSim.applyPatches(NET, PATCHES.patches, { generator: 'オルタネーター' }, 'F');
      /* 線そのものを外す・足す場面（断線・端子を抜く）は position では表せない＝ netlist に op を当てる。 */
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

  /* wire id →状態つきの色。off（＝どこにも通じない）だけ薄くする。post（負荷の先＝電圧は出るが流れない）は被覆色のまま＝黄点が無いことで「流れていない」を言う。 */
  Kit.prototype.wcol = function (id, fallback) {
    var r = this.r, w = null;
    for (var i = 0; i < r.wires.length; i++) if (r.wires[i].id === id) w = r.wires[i];
    var col = w && w.color ? WC[w.color] : (fallback || C.sub);
    var st = r.wire[id], dead = (st === 'off' || st === undefined);
    /* raw＝状態を無視した被覆の色。白い線の縁取り（outline）が「薄くなった白」も見分けられるように残す＝縁が消えると、白線だけ【線ごと無くなった】ように見える。 */
    return { col: dead ? C.dim : col, live: (st === 'hot' || st === 'gnd'), raw: col, dead: dead };
  };
  /* 粒の内側寄せ＝【進む先には 22px より広い余白を残す】。粒は CSS で 1秒に 22px 進むので（@keyframes flowdown 他）、
     終端の余白が 8px しか無いと、最後の粒が線の端から 14px 先まで出ていく＝線の無いところを電気が走って見える。
     入り口側は 6px（角の団子を避ける最小）、出口側は 26px（22＋4）。seg() の縦線が最初からこの比で打っているのと同じ規則。 */
  var HEAD = 6, TAIL = 26;
  Kit.prototype.dots = function (x, y1, y2, up) {          /* 縦線に流れる黄点（CSSで縦に動く） */
    for (var y = y1; y <= y2; y += 22)
      this.s.push('<circle class="' + (up ? 'dot up' : 'dot') + '" cx="' + x + '" cy="' + y + '" r="4.6"/>');
  };
  Kit.prototype.dotsH = function (y, x1, x2, dir) {          /* 横線に流れる黄点（dir='right'|'left'） */
    for (var x = x1; x <= x2; x += 22)
      this.s.push('<circle class="dot ' + dir + '" cx="' + x + '" cy="' + y + '" r="4.6"/>');
  };
  /* 【折れ線に沿って黄点を流す】 seg() は【縦線にしか】黄点を打たない作りで（x1===x2 の条件）、横線と、path() で直に描いた折れ線の区間は、通電していても粒が1つも出ていなかった。
     第8回のハイビーム（レバーから左右へ直行する長い折れ線）が全区間まるごと空になり、「電気がどこを通ったのか」が絵から読めなくなっていた。
     点列は【電源側→負荷側】の順に渡す＝その並びがそのまま流れの向きになる。斜めの区間には打たない（CSSは上下左右の4方向しか持っていない＝斜めは向きを表せない）。
     短い区間（20px未満）も飛ばす＝角に粒が団子になるだけで、流れには見えない。
     粒を出すかどうかは flow() に従う＝【線に電位が来ていること（live）だけでは流れていることにならない】。
     スイッチを切っても電源側の線は live のまま＝そこで粒を流すと「切ったのに電気が走っている」絵になる。 */
  Kit.prototype.dotsPoly = function (pts, id) {
    if (!this.flow(id, pts[0][0], pts[0][1], pts[pts.length - 1][1])) return;
    for (var i = 0; i < pts.length - 1; i++) {
      var ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      if (ax === bx && ay !== by) {
        var lo = Math.min(ay, by), hi = Math.max(ay, by), up = by < ay;
        if (hi - lo >= HEAD + TAIL) this.dots(ax, lo + (up ? TAIL : HEAD), hi - (up ? HEAD : TAIL), up);
      } else if (ay === by && ax !== bx) {
        var l = Math.min(ax, bx), r = Math.max(ax, bx), right = bx > ax;
        if (r - l >= HEAD + TAIL) this.dotsH(ay, l + (right ? HEAD : TAIL), r - (right ? TAIL : HEAD), right ? 'right' : 'left');
      }
    }
  };
  /* 流れの向きの規則。既定＝灯が点いていれば下向き（放電の向き）。ストーリーごとに別の流れ（充電の戻りなど）があれば cfg.flow で上書きする。 */
  Kit.prototype.flow = function (id, x, y1, y2) {
    if (this.cfg.flow) { var d = this.cfg.flow(this.sc, id, x, y1, y2); if (d !== undefined) return d; }
    return this.sc.lampOn ? 'down' : null;
  };
  /* 白い線は紙色の地に沈むので、下に一回り太い縁を敷いてから白を重ねる。無電で薄くなっている（C.dim）ときは縁を敷かない＝薄いことが見えなくなる。 */
  Kit.prototype.outline = function (x1, y1, x2, y2, raw, w, dead) {
    if (raw !== WC.BIANCO) return;
    this.s.push('<path d="M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2 + '" stroke="' + (dead ? '#cfc7b6' : '#a89f8b') + '" stroke-width="' + (w + 3) + '" fill="none" stroke-linecap="round"/>');
  };
  Kit.prototype.seg = function (x1, y1, x2, y2, id, thick, fallback) {
    var c = this.wcol(id, fallback);
    this.outline(x1, y1, x2, y2, c.raw, thick ? 6.5 : 5, c.dead);
    this.s.push('<path d="M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2 + '" stroke="' + c.col + '" stroke-width="' + (thick ? 6.5 : 5) + '" fill="none" stroke-linecap="round"/>');
    if (x1 === x2 && c.live) {
      var dir = this.flow(id, x1, y1, y2);
      if (dir === 'down') this.dots(x1, Math.min(y1, y2) + 6, Math.max(y1, y2) - 26, false);
      else if (dir === 'up') this.dots(x1, Math.min(y1, y2) + 26, Math.max(y1, y2) - 6, true);
    }
  };
  /* 横に走る線＝seg と同じだが、通電していれば【横向きの黄点】も流す。seg は `x1 === x2` の条件で【縦線にしか】粒を打たない＝横線は各回が dotsH を手で呼んで補う決まりだったが、呼び忘れた回（oil・key・ignition・horn・tail）で流れが途切れて見えていた。
     新しく作る回の横線はこれを使う。引数は【電源側→負荷側】の順（x1 が電源側）＝その並びが流れの向きになる。
     既存の回を機械的に置き換えない＝dotsH を手で呼んでいる回（charge・starter・ground・ room・brake）では粒が二重になる。 */
  Kit.prototype.segH = function (x1, y, x2, id, thick, fallback) {
    this.seg(x1, y, x2, y, id, thick, fallback);
    var c = this.wcol(id, fallback);
    /* 縦線（seg）と同じ条件で判じる＝live だけでは流さない。flow() が向きを返したときだけ粒を出す。 */
    if (c.live && this.flow(id, x1, y, y) && Math.abs(x2 - x1) >= HEAD + TAIL) {
      var right = x2 > x1, l = Math.min(x1, x2), r = Math.max(x1, x2);
      this.dotsH(y, l + (right ? HEAD : TAIL), r - (right ? TAIL : HEAD), right ? 'right' : 'left');
    }
  };
  /* 絵の中の極性記号（＋・−）は細くて沈むので、太字にして拾いやすくする。本文（HTML）側では「プラス端子／マイナス端子」と日本語で書く決まり。
     絵の中だけは幅が無いので記号のまま残し、代わりにここで太くしている。サイズは変えない＝変えると隣のラベルと重なるため（重なりは getBBox で数値判定する作法） */
  function pole(t) {
    return String(t).replace(/[−＋]/g, '<tspan font-weight="700">$&</tspan>');
  }
  Kit.prototype.label = function (x, y, t, col, anchor, size) {
    this.s.push('<text x="' + x + '" y="' + y + '" font-size="' + (size || 13) + '" fill="' + (col || C.sub) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + pole(t) + '</text>');
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
  /* 容疑区間の囲み（ストーリーごとに範囲が違うので座標は呼ぶ側が渡す） */
  /* quiet＝囲いを一段引く。同じ絵に「切れている場所」が描いてあるとき、囲いと切断が同じ強さの赤で争って、どこを見ればいいのか分からなくなる＝赤の序列を作る。
     既定は false＝他のストーリーの囲いは1px も変わらない。 */
  Kit.prototype.suspect = function (x, y, w, h, textY, t, quiet) {
    this.s.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12" fill="none" stroke="' + C.hi + '" stroke-width="' + (quiet ? 2 : 2.5) + '" stroke-dasharray="7 6"' + (quiet ? ' opacity="0.45"' : '') + '/>');
    this.s.push('<text x="' + (x + 6) + '" y="' + textY + '" font-size="13" fill="' + C.hi + '" font-weight="700"' + (quiet ? ' opacity="0.7"' : '') + '>' + (t || 'Suspect area') + '</text>');
  };
  Kit.prototype.dashOut = function (x1, y, x2) {              /* このストーリーは通らない枝＝薄い破線 */
    this.s.push('<path d="M' + x1 + ',' + y + ' L' + x2 + ',' + y + '" stroke="' + C.out + '" stroke-width="3" stroke-dasharray="5 5"/>');
  };
  Kit.prototype.node = function (x, y) {
    this.s.push('<circle cx="' + x + '" cy="' + y + '" r="4.5" fill="' + C.deep + '"/>');
  };
  /* 端子バッジ＝原典に番号のある端子を、線が着く場所に【同じ形で】出す。これは「どこにテスターを当てるか」を図と本文で1対1に対応させるための道具。
     原典に番号がある端子にだけ使う。ただの分岐点は端子ではないので k.node のまま（番号を持たないものにバッジを付けると、実車に無い端子を探させることになる）。
     1つの図の中で、付ける所と付けない所を混ぜない＝混ぜると「番号が無い＝端子ではない」と読めなくなる（第4回のやり直しの原因がこれ）。
     side: 'l'＝線の左／'r'＝右。hero＝このストーリーで実際に測る端子（濃く反転）。 */
  Kit.prototype.term = function (x, y, t, side, hero) {
    var w = t.length * (hero ? 6.6 : 6.0) + 11, h = hero ? 17 : 15, gap = 9;
    var bx = (side === 'l') ? (x - gap - w) : (x + gap), by = y - h / 2;
    this.s.push('<path d="M' + (side === 'l' ? bx + w : x) + ',' + y + ' L' + (side === 'l' ? x : bx) + ',' + y + '" stroke="' + C.sub + '" stroke-width="1.2"/>');
    this.s.push('<rect x="' + bx + '" y="' + by + '" width="' + w + '" height="' + h + '" rx="' + (h / 2) + '" fill="' + (hero ? C.deep : '#fbf7ee') + '" stroke="' + (hero ? C.deep : C.sub) + '" stroke-width="1.2"/>');
    this.s.push('<text x="' + (bx + w / 2) + '" y="' + (y + (hero ? 4 : 3.6)) + '" font-size="' + (hero ? 10.5 : 9.5) + '" font-weight="700" fill="' + (hero ? '#fffdf8' : C.deep) + '" text-anchor="middle">' + t + '</text>');
    return bx;                                   /* 左端＝隣に文字を置くときの手がかり */
  };

  /* ---- どのストーリーにも出てくる部品 ---- */
  /* バッテリー（端子とセルキャップのある形）。上端 y=18・下端 y=62 */
  Kit.prototype.battery = function (x) {
    var s = this.s;
    s.push('<rect x="' + (x - 45) + '" y="18" width="90" height="44" rx="6" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<rect x="' + (x - 45) + '" y="18" width="90" height="10" rx="5" fill="' + C.deep + '"/>');
    s.push('<rect x="' + (x - 34) + '" y="8" width="13" height="14" rx="2.5" fill="' + C.hi + '"/>');       /* ＋端子 */
    s.push('<rect x="' + (x + 21) + '" y="8" width="13" height="14" rx="2.5" fill="#5c5a56"/>');            /* −端子 */
    s.push('<text x="' + (x - 46) + '" y="17" font-size="16" font-weight="700" fill="' + C.hi + '" text-anchor="end">+</text>');
    s.push('<text x="' + (x + 48) + '" y="17" font-size="18" font-weight="700" fill="' + C.deep + '">−</text>');
    s.push('<g fill="' + C.in_ + '" opacity=".85"><circle cx="' + (x - 20) + '" cy="40" r="4"/><circle cx="' + x + '" cy="40" r="4"/><circle cx="' + (x + 20) + '" cy="40" r="4"/></g>');
    s.push('<text x="' + x + '" y="56" font-size="12" fill="#fffdf8" text-anchor="middle">Battery</text>');
  };
  /* キースイッチ（箱の中の接点が、キーを回すと橋を架ける）。top=箱の上端・高さ48 */
  /* labelX＝部品名を書き出す x（省略時は従来どおり x+56）。 */
  /* opts.hero＝そのストーリーの主役の部品として浮き上がらせる。既定は false＝主役でないストーリー（第3回・第6回…）の絵は1px も変わらない。
     浮かせるのに赤は使わない＝赤は「切れている場所」ただ1つに取ってある。 */
  Kit.prototype.keySwitch = function (x, top, on, labelX, opts) {
    var s = this.s, hero = !!(opts && opts.hero);
    if (hero) s.push('<rect x="' + (x - 57) + '" y="' + (top - 7) + '" width="114" height="62" rx="14" fill="none" stroke="' + C.deep + '" stroke-width="8" opacity="0.15"/>');
    s.push('<rect x="' + (x - 50) + '" y="' + top + '" width="100" height="48" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="' + (hero ? 3.5 : 2.5) + '"/>');
    /* 鍵の絵（左側・ONで回る） */
    s.push('<circle cx="' + (x - 28) + '" cy="' + (top + 24) + '" r="12" fill="' + C.in_ + '"/>');
    s.push('<rect x="' + (x - 30) + '" y="' + (top + 10) + '" width="4" height="14" rx="1.5" fill="' + C.deep + '" transform="rotate(' + (on ? 42 : 0) + ' ' + (x - 28) + ' ' + (top + 24) + ')"/>');
    /* 接点（上下2点＋橋）：ONで縦につながる */
    s.push('<circle cx="' + x + '" cy="' + (top + 10) + '" r="3.8" fill="' + C.in_ + '"/>');
    s.push('<circle cx="' + x + '" cy="' + (top + 38) + '" r="3.8" fill="' + C.in_ + '"/>');
    if (on) s.push('<path d="M' + x + ',' + (top + 10) + ' L' + x + ',' + (top + 38) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    else s.push('<path d="M' + x + ',' + (top + 10) + ' L' + (x + 13) + ',' + (top + 32) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<text x="' + (x + 28) + '" y="' + (top + 28) + '" font-size="10.5" fill="' + C.in_ + '" text-anchor="middle">' + (on ? 'Closed' : 'Open') + '</text>');
    var lx = (labelX == null) ? x + 56 : labelX;
    this.label(lx, top + 18, 'Ignition switch', C.deep, null, 12);
    this.label(lx, top + 34, on ? 'Key ON' : 'Key OFF', on ? C.deep : C.sub, null, 12);
  };
  /* ヒューズを【縦に通す】絵（500のヒューズは筒型＝上下に金属キャップ）。第4回（キー）はヒューズを「幹線の横にぶら下がる枝」として描いた＝キーへの線がヒューズの電源側から分かれるため。
     ヒューズの【先】の系統（ホーン・ルームランプ…）をストーリーするときは本線がヒューズを通るので、この縦向きが要る。
     同じ部品がストーリーによって違う向きで出てくるので、ページ本文で必ず「向きが違う」と断ること。
     top＝箱の上端。上の端子 y=top・下の端子 y=top+62（＝この2点に線を継ぐ）。 */
  Kit.prototype.fuseV = function (x, top, blown, name) {
    var s = this.s, tubeTop = top + 11, tubeH = 40;
    s.push('<path d="M' + x + ',' + top + ' L' + x + ',' + tubeTop + ' M' + x + ',' + (tubeTop + tubeH) + ' L' + x + ',' + (top + 62) + '" stroke="' + C.deep + '" stroke-width="3.5"/>');
    s.push('<rect x="' + (x - 15) + '" y="' + tubeTop + '" width="30" height="' + tubeH + '" rx="4" fill="#efe9da" stroke="' + C.deep + '" stroke-width="2"/>');
    s.push('<rect x="' + (x - 15) + '" y="' + tubeTop + '" width="30" height="7" rx="3" fill="#b9b1a0"/>');
    s.push('<rect x="' + (x - 15) + '" y="' + (tubeTop + tubeH - 7) + '" width="30" height="7" rx="3" fill="#b9b1a0"/>');
    if (blown) {
      /* 切れたヒューズ＝エレメントが中央で分かれる。×印は付けない（電球切れの記号と紛れる） */
      s.push('<path d="M' + x + ',' + (tubeTop + 7) + ' L' + x + ',' + (tubeTop + 15) + ' M' + x + ',' + (tubeTop + 25) + ' L' + x + ',' + (tubeTop + 33) + '" stroke="' + C.hi + '" stroke-width="2.5" stroke-linecap="round"/>');
      s.push('<circle cx="' + x + '" cy="' + (tubeTop + 20) + '" r="6" fill="none" stroke="' + C.hi + '" stroke-width="2.5"/>');
    } else {
      s.push('<path d="M' + x + ',' + (tubeTop + 7) + ' L' + x + ',' + (tubeTop + 33) + '" stroke="' + C.sub + '" stroke-width="2.5"/>');
    }
    if (name) {
      this.label(x + 24, top + 26, name, C.deep, null, 12);
      s.push('<text x="' + (x + 24) + '" y="' + (top + 42) + '" font-size="11.5" font-weight="700" fill="'
        + (blown ? C.hi : C.ok) + '">' + (blown ? 'blown' : 'good') + '</text>');
    }
  };
  /* 警告灯＝メーターの小窓と同じ顔。top=小窓の上端・高さ28。labels を渡すと右に2行そえる */
  /* 警告灯の小窓。【。点滅（ちかちか）させない：実車の警告灯は点滅しないので「断続的に点いたり消えたりする不具合」に読める＝この症状（点きっぱなし）と食い違う。
     ゆっくりした明滅の .lampglow だけ（prefers-reduced-motion では自動的に静止した赤になる）。 */
  Kit.prototype.lampWindow = function (x, top, text, lit, labels, labelX) {
    var s = this.s, cy = top + 14;
    if (lit) {
      /* にじみ＝メーター側 #lampg と同じ配色。id はページ内の全場面で同一で構わない（どのSVGでも中身が同じため。
         中身を変えるときは id も変えること） */
      /* にじみは2枚重ね。1枚だと薄く広がるだけで、明るいPC画面では点いているのが分からなかった＝外側の広いにじみ＋内側の濃い芯、で密度を上げる */
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
        /* レンズのすぐ外を回る細いコロナ＝広いにじみより「光っている」が伝わる。右のラベル（labelX）に触れない幅に収めること */
        + '<rect x="' + (x - 43) + '" y="' + (top - 6) + '" width="86" height="44" rx="10" fill="none" stroke="#ff5a3c" stroke-width="3" opacity=".7"/>'
        + '<rect x="' + (x - 49) + '" y="' + (top - 12) + '" width="98" height="56" rx="14" fill="none" stroke="#ff5a3c" stroke-width="2" opacity=".28"/></g>');
    }
    /* 点灯時のレンズは平らな赤ではなく縦のグラデーション＝自分で光っているように見える。
       小窓は点灯時だけ一回り大きい＝小さい画面でも「そこが光っている」が分かる */
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
  /* 車SVGの <style> は文書のどこに置いても全体に効き、CSSはインライン属性に勝つ。 */
  function scopeCarStyles(inner, root) {
    root = root || '#carcrop';
    return inner.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, function (_, attrs, css) {
      var scoped = css.replace(/(^|\})([^{}@]+)\{/g, function (_, brace, sel) {
        var s = sel.split(',').map(function (x) {
          x = x.trim();
          if (!x) return x;
          return x.indexOf(root) === 0 ? x : root + ' ' + x;
        }).join(',');
        return brace + ' ' + s + '{';
      });
      return '<style' + attrs + '>' + scoped + '</style>';
    });
  }
  /* opts: {viewBox, marks:[{id,color,label,anchor}], legend, scale} —座標は wiring-layout.json の実測値（1 SVG unit = 1mm・m=車の前後・lat=左右。
     オーナー実測＝こちらの推定値はゼロ） scale は「viewBox をどれだけ引いたか」の補正（既定 1＝engine ルームに寄った第1・2回のまま）。
     車の全長を1枚に収めるストーリー（セルのストーリー＝前のバッテリーから後ろのセルまで）では viewBox が 4倍以上広くなり、印と文字が既定の大きさでは読めなくなる。 */
  function carMap(elId, carSvgText, layout, opts) {
    var e = document.getElementById(elId); if (!e) return;
    var inner = carSvgText.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    inner = scopeCarStyles(inner);
    function pt(id) { var p = layout.parts[id]; return { x: 25 + p.m * 1000, y: 683.15 - p.lat * 1000 }; }
    var z = opts.scale || 1;
    var html = '<g id="carcrop" style="color:#cbc4b3">' + inner + '</g>';
    (opts.marks || []).forEach(function (m) {
      var p = pt(m.id), start = (m.anchor === 'start'), below = (m.anchor === 'below');
      html += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (16 * z) + '" fill="' + m.color + '"/>';
      /* anchor:'below' ＝ラベルを点の【真下】に置く。印は実測値で動かせないので、印と隣の部品名がぶつかるときは、名前の方を下の段へ降ろして横並びを解く（第3回＝スターターレバーの印が「セルモーター」の文字に接していた）。 */
      var tx = below ? p.x : (start ? p.x + 26 * z : p.x - 26 * z);
      var ty = below ? p.y + 68 * z : p.y + 8 * z;
      var ta = below ? ' text-anchor="middle"' : (start ? '' : ' text-anchor="end"');
      html += '<text x="' + tx + '" y="' + ty + '" font-size="' + (34 * z) + '" fill="' + m.color + '"' + ta + ' font-weight="700">' + m.label + '</text>';
    });
    html += (opts.legend || '');
    e.setAttribute('viewBox', opts.viewBox);
    e.innerHTML = html;
  }

  /* 症状の絵の下敷きに、実車の輪郭をそのまま敷く（第10回）。carMap とは用途が別＝
     部品を指す印を打たないので wiring-layout.json の実測値に依存しない（灯の位置は原典の座標ではない）。
     ⚠️灯とラベルは HTML 側に静的に書いてあり、ここで足すのは【輪郭だけ】＝先頭に挿入して他の要素の下へ敷く。
     JS が動かなくても灯とラベルは読める。opts: {id, transform} */
  function carArt(opts) {
    var e = document.getElementById(opts.id); if (!e) return;
    var inner = CAR_SVG.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    e.innerHTML = '<g id="carart" style="color:#cbc4b3"' + (opts.transform ? ' transform="' + opts.transform + '"' : '') + '>'
      + scopeCarStyles(inner, '#carart') + '</g>' + e.innerHTML;
  }
  var CAR_SVG = '';

  /* ================= 起動 ================= */
  /* cfg: lampId …このストーリーの主役の負荷ID（例 'quadro.warn_oil'・'starter'）。
     「灯」とは限らない＝ランプでもモーターでも、solve() が返す負荷ならよい alt …既定でパッチ（オルタ換装）を当てるか extra …場面にストーリー固有の判定を足す（例 charging） flow …黄点の流れの向きの上書き draw … function(kit, mode) →図の高さ。
     kit.s に SVG を積む caps … {STOP:…, RUN:…} トグルの説明文（キーは HTML の data-v と揃える） mainInputs …トグルの値→ solve に渡す inputs（既定＝{key:'ON', engine:v}） mainAxes を使う旅では、引数は値ではなく【軸ごとの状態オブジェクト】になる mainInit …トグルの初期値（既定 'STOP'） mainAxes …独立して動かせるトグルが【2組以上】ある旅だけが使う（第8回＝ライトスイッチ×コラムレバー）。
     [{ key:'lights', init:'ON' }, { key:'beam', init:'LOW' }] の形。
     HTML 側のボタンに data-axis="lights" を付けると、その軸のボタンだけが排他になる。
     これを持たない旅は従来どおり【全ボタンが1つの排他グループ】＝挙動は1バイトも変わらない。
     スイッチが1つしかない旅に足さない（押しても何も起きないボタンが増えるだけ）。checks …検算の配列 [{label, s:{alt,inputs,override}, expect}] scenes … function(scenario) → [{id, sc, mode}] carmap … function(layout, alt) → carMap の opts carfig … {id, transform} ＝症状の絵の下敷きに実車の輪郭を敷く（carArt）。印を打たない＝実測値に依存しない絵に使う lampName …検算表の見出しに使う灯の呼び名（HTML側と揃える必要はない） */
  function boot(cfg) {
    var scenario = makeScenario(cfg);

    function put(id, sc, mode) {
      var e = document.getElementById(id); if (!e) return;
      var kit = new Kit(sc, mode, cfg);
      var h = cfg.draw(kit, mode || {});
      var d = wrap(kit.s, h);
      e.setAttribute('viewBox', d.vb); e.innerHTML = d.body;
    }

    /* トグルは1ページに複数置ける（第6回は主図の上と従図の上の2組）＝だから id ではなく .toggle を拾う。
       押された方だけでなく【全部の組】の on を付け替えること。 */
    /* トグルが動かすもの＝ストーリーごとに違う。既定は「エンジン停止↔回転」（第1・2回）。
       セルのストーリーは動かすのがスターターレバーなので cfg.mainInputs / cfg.mainInit で差し替える。 */
    function mainInputs(v) { return cfg.mainInputs ? cfg.mainInputs(v) : { key: 'ON', engine: v }; }
    /* 2軸以上の旅＝軸ごとに現在値を持つ。単軸の旅では axes が null で、従来の1値のまま動く。 */
    var axes = cfg.mainAxes || null, st = null;
    if (axes) { st = {}; for (var ai = 0; ai < axes.length; ai++) st[axes[ai].key] = axes[ai].init; }
    function capOf(cur) { return typeof cfg.caps === 'function' ? cfg.caps(cur) : cfg.caps[cur]; }
    /* 押したボタンが画面上の同じ位置に留まるように補正する。 */
    function setMain(v, anchor, axis) {
      var y0 = anchor ? anchor.getBoundingClientRect().top : null;
      var btns = document.querySelectorAll('.toggle button');
      if (axes) {
        /* 軸ごとの排他＝押した軸のボタンだけ付け替える（他の軸の選択を落とさない） */
        if (axis) st[axis] = v;
        for (var i = 0; i < btns.length; i++) {
          var bax = btns[i].getAttribute('data-axis');
          if (!bax) continue;
          btns[i].className = (st[bax] === btns[i].getAttribute('data-v')) ? 'on' : '';
        }
      } else {
        for (var j = 0; j < btns.length; j++) btns[j].className = btns[j].getAttribute('data-v') === v ? 'on' : '';
      }
      var cur = axes ? st : v;
      /* main:true ＝【この呼び出しだけが主図】の目印。図の側は、絵の中の押せる場所（data-set）をこれが立っているときだけ描く＝紙芝居のコマに押せそうな見た目が出ないようにするため。
         見ていない旅では無視されるだけなので、既存の旅に影響はない。 */
      put('j-main', scenario({ inputs: mainInputs(cur) }), { main: true });
      var cap = document.getElementById('mainCap'); if (cap) cap.innerHTML = capOf(cur);
      if (y0 !== null) { var y1 = anchor.getBoundingClientRect().top; if (Math.abs(y1 - y0) > 0.5) window.scrollBy(0, y1 - y0); }
    }

    /* 検算＝期待値は原典・実車から先に書いたもので、計算結果を写していない。1件でも✗なら足したデータの側が誤っている。 */
    function runChecks() {
      var tb = document.getElementById('checks'); if (!tb) return;
      for (var i = 0; i < cfg.checks.length; i++) {
        var c = cfg.checks[i], sc = scenario(c.s), got = c.read ? c.read(sc) : sc.lampOn, ok = (got === c.expect);
        var word = c.words || ['lit', 'out'];
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + c.label + '</td><td>' + (got ? word[0] : word[1]) + '</td><td>' + (c.expect ? word[0] : word[1]) + '</td>' +
                       '<td class="' + (ok ? 'check-ok' : 'check-ng') + '">' + (ok ? '✓' : '✗ mismatch') + '</td>';
        tb.appendChild(tr);
      }
    }

    Promise.all([
      fetch('/wiring-net.json').then(function (r) { return r.json(); }),
      fetch('/wiring-patches.json').then(function (r) { return r.json(); }),
      fetch('/wiring-img/car-top-v9.svg').then(function (r) { return r.text(); })
    ]).then(function (a) {
      NET = a[0]; PATCHES = a[1]; CAR_SVG = a[2];
      if (cfg.carfig) carArt(cfg.carfig);
      fetch('/wiring-layout.json').then(function (r) { return r.json(); }).then(function (L) {
        if (cfg.carmap) carMap('carmap', a[2], L, cfg.carmap(L, cfg.alt));
      });

      var vers = document.getElementById('vers');
      if (vers) vers.textContent =
        'wiring-net.json NET_VERSION ' + NET.NET_VERSION + ' / wiring-patches.json PATCH_VERSION ' + PATCHES.PATCH_VERSION;

      setMain(cfg.mainInit || 'STOP');
      var btns = document.querySelectorAll('.toggle button');
      for (var i = 0; i < btns.length; i++) btns[i].addEventListener('click', function () {
        setMain(this.getAttribute('data-v'), this, this.getAttribute('data-axis'));
      });

      /* 【絵の中のスイッチを直接押せるようにする】図の側が押せる場所に data-set="軸=値"（単軸の旅なら data-set="値"）を書いておくと、ここが拾って欄外のトグルと同じ setMain を呼ぶ。
         主図は押すたびに innerHTML ごと差し替わる＝要素ごとに listener を付けると消える。
         だから【器の #j-main に1回だけ】付けて、中身は毎回そこから探す（イベント委譲）。
         anchor は押した図形ではなく器を渡す＝押した図形は再描画で別物になり、押した後に位置を測れない。
         data-set を書いていない旅では、この listener は何も拾わないので従来どおり。 */
      var stage = document.getElementById('j-main');
      if (stage) stage.addEventListener('click', function (ev) {
        var n = ev.target, set = null;
        /* SVGElement にも closest はあるが、この系の旧端末を考えて素朴に親を辿る */
        while (n && n !== stage) {
          if (n.getAttribute) { set = n.getAttribute('data-set'); if (set) break; }
          n = n.parentNode;
        }
        if (!set) return;
        var eq = set.indexOf('=');
        if (eq < 0) setMain(set, stage, null);
        else setMain(set.slice(eq + 1), stage, set.slice(0, eq));
      });

      (cfg.scenes ? cfg.scenes(scenario) : []).forEach(function (s) { put(s.id, s.sc, s.mode); });
      runChecks();
    });
  }

  global.Journey = { WC: WC, C: C, Kit: Kit, boot: boot, wrap: wrap, carMap: carMap, makeScenario: makeScenario };
})(typeof window !== 'undefined' ? window : globalThis);
