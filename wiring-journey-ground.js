/* ストーリー第5回「あちこち同時に点かない（アース）」の絵。図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。
   このストーリーだけの特徴＝【絵の向きが裏返っている】。第1〜4回…＋の道（行き）を上から下へたどる。
   アースは絵の一番下の記号。第5回…その【帰り道】だけを描く。＋の道は破線1本に畳んで「第1〜4回でたどった」と手放す。
   だから幹線は赤ではなく車体（ボディ）で、黄点は下から上（バッテリーの−へ戻る向き）に流れる。
   このストーリーはが入って初めて成立する。案Aが無いと車体が無条件のアース源になり、−端子が外れても「点く・回る」と誤答した＝ストーリーの山場（j-minus）がそもそも描けない。
   データ追加ゼロ＝既存のアース線5本（w11-08/09/10/11・w07-02）だけで全場面が解けている。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;
  /* 箱は左に寄せてある＝アース線（横）を長く取るため。 */
  var BX = 26, BW = 142, BR = BX + BW;     /* 部品の箱 */
  var XB = 250, BDX = 236, BDW = 28;       /* 車体（ボディ）の板＝このストーリーの幹線 */
  var BDY = 100, BDH = 290;
  var PLUS = '#d6a294';                    /* ＋（行き）の道＝畳んで薄い破線で示すだけ */
  var METAL = '#b9b2a1';

  /* 車体にぶら下がる4本のアース線。ここに並ぶ順＝絵の上から下の順。「何の帰り道か」は原典の結線から導いたもので、絵の都合で書いていない：ダイナモの−がチャージランプの帰り道になるのは、停止中のダイナモ内部で 51↔−がつながっているから（wiring-net.json の dynamo モデル・第1回の主題そのもの）。
     状態語（st）に部品名を繰り返さない＝2行目（of）がすぐ上で名乗っている。 */
  var ROWS = [
    { y: 116, wire: 'w11-11', thick: true, name: 'セルモーター（本体）', of: 'セルの電気の帰り道',
      st: function (sc, pos) { return pos.starter_sw === 'START' ? [sc.cellOn ? '回っている' : '回らない', sc.cellOn] : ['いまは使っていない', null]; } },
    { y: 184, wire: 'w11-09', thick: false, name: 'ダイナモ（−）', of: 'チャージランプの帰り道',
      st: function (sc) { return [sc.chargeOn ? '点いている' : '消えている', sc.chargeOn]; } },
    { y: 252, wire: 'w11-08', thick: false, name: 'レギュレータ（31）', of: 'この絵では電気が通らない',
      st: function () { return ['（下の注を参照）', null]; } },
    { y: 320, wire: 'w07-02', thick: false, name: '油圧センダ', of: '油圧警告灯の帰り道',
      st: function (sc) { return [sc.oilOn ? '点いている' : '消えている', sc.oilOn]; } }
  ];
  /* その線に「いま電気が流れているか」＝黄点を出すかどうか。線に色が付いている（アースまでつながっている）ことと、電気が流れていることは別物＝ここを混ぜない。 */
  function cur(sc, id) {
    if (id === 'w11-11') return sc.cellOn;
    if (id === 'w11-09') return sc.chargeOn;
    if (id === 'w07-02') return sc.oilOn;
    return false;                          /* w11-08＝レギュレータのアースはL1では電流が流れない */
  }

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    var keyOff = pos.ign_sw !== 'ON';
    var flowing = sc.cellOn || sc.chargeOn || sc.oilOn;

    /* 縦の線を1本外して描く（第3・4回と同じ作法）。接点ではなく「線が無い」状態 */
    function cutV(x, y1, y2, id, thick) {
      var mid = (y1 + y2) / 2, col = k.wcol(id, C.dim).col, w = thick ? 6.5 : 5;
      s.push('<path d="M' + x + ',' + y1 + ' L' + x + ',' + (mid - 8) + ' M' + x + ',' + (mid + 8) + ' L' + x + ',' + y2 + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>');
      s.push('<circle cx="' + x + '" cy="' + mid + '" r="6" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
    }
    /* 横のアース線。黄点は左→右（部品から車体へ帰る向き） */
    function hseg(x1, x2, y, id, thick, live) {
      var col = k.wcol(id, C.dim).col;
      s.push('<path d="M' + x1 + ',' + y + ' L' + x2 + ',' + y + '" stroke="' + col + '" stroke-width="' + (thick ? 6.5 : 5) + '" stroke-linecap="round"/>');
      if (live) k.dotsH(y, x1 + 8, x2 - 8, 'right');
    }
    function cutH(x1, x2, y, id, thick) {
      var mid = (x1 + x2) / 2, col = k.wcol(id, C.dim).col, w = thick ? 6.5 : 5;
      s.push('<path d="M' + x1 + ',' + y + ' L' + (mid - 8) + ',' + y + ' M' + (mid + 8) + ',' + y + ' L' + x2 + ',' + y + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>');
      s.push('<circle cx="' + mid + '" cy="' + y + '" r="6" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
    }

    /* ===== バッテリー。このストーリーの主役は右側の−端子 ===== */
    k.battery(223);

    /* ===== ＋（行き）の道＝畳む。ここを描き込むと帰り道の話が埋もれる ===== */
    s.push('<path d="M195,62 L195,84 L30,84" stroke="' + PLUS + '" stroke-width="3" stroke-dasharray="5 5" fill="none"/>');
    k.label(6, 96, '＋（行き）の道は第1〜4回でたどった', C.sub, null, 10);

    /* ===== −→車体の板。この1本が、車全体でただ1つの出口 ===== */
    if (mode.cut === 'w11-10') {
      cutV(XB, 62, BDY, 'w11-10', true);
      k.label(232, 80, '★ここが外れている', C.hi, 'end', 11);
    } else {
      k.seg(XB, 62, XB, BDY, 'w11-10', true);
      k.label(232, 80, 'NERO 黒・太', WC.NERO, 'end', 10.5);
    }

    /* ===== 車体（ボディ）＝4本の帰り道が合流する1枚の板 ===== 色は body.31 の端子状態そのもの。
       gnd＝アースにつながっている／post＝警告灯を通って 12Vが回ってきているだけで帰り道が無い（テスターには出るのに何も動かない）。 */
    var bst = k.r.node['body.31'];
    var bfill = bst === 'gnd' ? METAL : (bst === 'post' ? '#e6cfc6' : '#e8e2d3');
    var bstroke = bst === 'gnd' ? C.deep : (bst === 'post' ? C.hi : C.sub);
    s.push('<rect x="' + BDX + '" y="' + BDY + '" width="' + BDW + '" height="' + BDH + '" rx="6" fill="' + bfill + '" stroke="' + bstroke + '" stroke-width="2.5"'
      + (bst === 'gnd' ? '' : ' stroke-dasharray="6 5"') + '/>');
    /* 板の名前は【板の右外】に縦書きで置く＝板の中に置くと黄点の列と重なる（第3回の教訓と同じ、濃い所に文字を乗せない）。
       x=268〜300 の余白に収める。 */
    s.push('<text x="278" y="' + (BDY + 34) + '" font-size="11" fill="' + (bst === 'gnd' ? C.deep : C.hi)
      + '" transform="rotate(90 278 ' + (BDY + 34) + ')">車体（ボディ）＝1枚の板</text>');
    /* 板の中を上向きに流れる黄点＝一番下の「働いているアース線」から上へ */
    if (flowing && bst === 'gnd') {
      var low = BDY + 16;
      for (var i = 0; i < ROWS.length; i++) if (cur(sc, ROWS[i].wire) && mode.cut !== ROWS[i].wire) low = Math.max(low, ROWS[i].y + 24);
      k.dots(XB, BDY + 10, low - 6, true);
    }

    /* ===== 4つの落とし先 ===== */
    ROWS.forEach(function (r) {
      var yy = r.y + 24, w = r.st(sc, pos), live = cur(sc, r.wire) && mode.cut !== r.wire;
      s.push('<rect x="' + BX + '" y="' + r.y + '" width="' + BW + '" height="48" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
      s.push('<text x="' + (BX + 10) + '" y="' + (r.y + 18) + '" font-size="11.5" fill="#fffdf8">' + r.name + '</text>');
      s.push('<text x="' + (BX + 10) + '" y="' + (r.y + 31) + '" font-size="10" fill="' + C.in_ + '">' + r.of + '</text>');
      /* 状態の語＝濃い箱の上なので明るい色で書く（第3回の教訓）。キーOFFは異常ではないので中立色 */
      var col = (keyOff || w[1] === null) ? C.in_ : (w[1] ? '#7fd6a0' : '#ff8a70');
      s.push('<text x="' + (BX + 10) + '" y="' + (r.y + 44) + '" font-size="10.5" font-weight="700" fill="' + col + '">' + w[0] + '</text>');
      if (mode.cut === r.wire) {
        cutH(BR, BDX, yy, r.wire, r.thick);
        k.label(BDX - 4, r.y + 62, '↑この線が外れている', C.hi, 'end', 10.5);
      } else {
        hseg(BR, BDX, yy, r.wire, r.thick, live);
      }
    });

    /* ===== 板の下＝行き止まり。ここに何も無いことが、このストーリーの言いたいこと ===== */
    k.label(6, 408, '⬆ 車体（ボディ）＝4本の帰り道が合流する1枚の板。', C.deep, null, 11);
    k.label(6, 424, '出口は上の「バッテリー −」ただ1本しかない。', C.deep, null, 11);

    if (mode.minus) {
      /* 板は post＝警告灯を通って12Vが回ってきている。テスターには出るのに何も動かない */
      k.probe(BDX, 200, '12V', -34, -18);
      k.label(6, 446, '⚠️車体にテスターを当てると12Vが出る（警告灯を通って回ってくる）。', C.hi, null, 10.5);
      k.label(6, 462, 'それでも警告灯は点かず、セルも回らない＝帰り道が無いから。', C.hi, null, 10.5);
      return 476;
    }
    if (mode.cut) {
      k.label(6, 446, '⚠️外れたのは1本だけ。だから、そこを通る電気だけが止まっている。', C.sub, null, 10.5);
      return 460;
    }
    return 440;
  }

  /* ---- トグル（キーON ↔スターターレバーを引く） ---- どちらも「正常な操作」。
     このストーリーは故障を場面（下の絵）で見せるので、トグルは「帰り道を使う電気が入れ替わる」ことだけを見せる。 */
  var CAPS = {
    KEY: '<b>キーON＝2つの警告灯が点いている。</b>その電気は、ダイナモのマイナス端子と油圧センダの2か所から車体に落ち、車体を伝ってバッテリーのマイナス端子へ帰っています。黄色い点が上向きなのは「帰っている」からです。',
    CRANK: '<b>レバーを引く＝セルが回る。</b>セルの帰り道（一番上の太い線）にも黄色い点が流れ出しました。行きの道は部品ごとにばらばらでも、<b>帰り道は全部この1枚の板に集まります</b>。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function get(sc, id) { for (var i = 0; i < sc.r.loads.length; i++) if (sc.r.loads[i].id === id) return sc.r.loads[i].on; return false; }
  function chg(sc) { return get(sc, 'quadro.warn_charge'); }
  function cel(sc) { return get(sc, 'starter'); }
  var LW = ['点く', '点かない'], CW = ['回る', '回らない'];
  var ON = { key: 'ON', engine: 'STOP' };
  var PULL = { key: 'ON', engine: 'STOP', starter: 'START' };
  function cut(id) { return [{ op: 'removeWire', id: id }]; }
  var CHECKS = [
    { label: 'キーON・停止中（正常）＝油圧警告灯', s: { inputs: ON }, expect: true, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: ON }, expect: true, read: chg, words: LW },
    { label: 'レバーを引く（正常）＝セル', s: { inputs: PULL }, expect: true, read: cel, words: CW },
    /* 1本外れると1つだけ死ぬ＝このストーリーの絞り込みの根拠 */
    { label: '油圧センダのアース（w07-02）が外れた＝油圧警告灯', s: { inputs: ON, ops: cut('w07-02') }, expect: false, words: LW },
    { label: '↑同じ場面のチャージランプ（無実）', s: { inputs: ON, ops: cut('w07-02') }, expect: true, read: chg, words: LW },
    { label: 'ダイナモのマイナス端子（w11-09）が外れた＝チャージランプ', s: { inputs: ON, ops: cut('w11-09') }, expect: false, read: chg, words: LW },
    { label: '↑同じ場面の油圧警告灯（無実）', s: { inputs: ON, ops: cut('w11-09') }, expect: true, words: LW },
    { label: 'セルのアース（w11-11）が外れた＝セル', s: { inputs: PULL, ops: cut('w11-11') }, expect: false, read: cel, words: CW },
    { label: '↑同じ場面の油圧警告灯（無実）', s: { inputs: PULL, ops: cut('w11-11') }, expect: true, words: LW },
    /* レギュレータのアースはL1では何も起こさない＝下の「この絵が持っていないもの」の裏づけ */
    { label: 'レギュレータのアース（w11-08）が外れた＝油圧警告灯', s: { inputs: ON, ops: cut('w11-08') }, expect: true, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: ON, ops: cut('w11-08') }, expect: true, read: chg, words: LW },
    /* 山場＝−端子が外れると全部死ぬ。案Aを入れて初めて正しく答えられるようになった場面 */
    { label: 'バッテリーのマイナス端子（w11-10）が外れた＝油圧警告灯', s: { inputs: ON, ops: cut('w11-10') }, expect: false, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: ON, ops: cut('w11-10') }, expect: false, read: chg, words: LW },
    { label: '↑同じ場面のセル（レバーを引く）', s: { inputs: PULL, ops: cut('w11-10') }, expect: false, read: cel, words: CW },
    /* 車体側の落とし先が全部外れても、−が生きていれば…という誤解を潰す */
    { label: 'アース線を5本とも外した＝油圧警告灯', s: { inputs: ON, ops: [{ op: 'removeWire', id: ['w11-08', 'w11-09', 'w11-10', 'w11-11', 'w07-02'] }] }, expect: false, words: LW },
    { label: 'キーOFF（正常＝消えている）', s: { inputs: { key: 'OFF', engine: 'STOP' } }, expect: false, words: LW },
    { label: 'オルタネーター換装車・キーON停止中', s: { alt: true, inputs: ON }, expect: true, words: LW }
  ];

  Journey.boot({
    lampId: 'quadro.warn_oil',
    lampName: '油圧警告灯',
    alt: false,
    mainInit: 'KEY',
    mainInputs: function (v) { return v === 'CRANK' ? PULL : ON; },
    extra: function (sc) { sc.chargeOn = chg(sc); sc.oilOn = get(sc, 'quadro.warn_oil'); sc.cellOn = cel(sc); },
    /* 幹線（w11-10）は帰り道＝黄点は上向き。何か1つでも働いていれば流れている */
    flow: function (sc, id) {
      if (id === 'w11-10') return (sc.cellOn || sc.chargeOn || sc.oilOn) ? 'up' : null;
      return null;
    },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* ①1本だけ外れる＝1つだけ死ぬ。油圧センダは第2回の主役＝話がつながる */
        { id: 'j-one', sc: scenario({ inputs: ON, ops: cut('w07-02') }), mode: { cut: 'w07-02' } },
        /* ②セルのアース＝第3回「セルが回らない」の容疑者の1人。レバーを引いた場面で見る */
        { id: 'j-cell', sc: scenario({ inputs: PULL, ops: cut('w11-11') }), mode: { cut: 'w11-11' } },
        /* ★③−端子が外れる＝全部死ぬ。しかも車体には12Vが回ってくる（post）。案Aを入れて初めて正しく描けるようになった場面＝このストーリーの山場 */
        { id: 'j-minus', sc: scenario({ inputs: PULL, ops: cut('w11-10') }), mode: { cut: 'w11-10', minus: true } },
        { id: 'j-fixed', sc: scenario({ inputs: PULL }), mode: {} }
      ];
    },
    /* 車体そのものは「点」ではない＝印を打たない（図の全体が車体）。凡例で言葉にする。
       落とし先が車の後ろに集まっていること、バッテリーだけが前にあることが、この地図の要点。 */
    carmap: function () {
      return {
        viewBox: '0 -140 3020 1640',
        scale: 4,
        marks: [{ id: 'battery', color: '#b8442e', label: 'バッテリー', anchor: 'start' },
                { id: 'oil_sender', color: '#2c3a31', label: '油圧センダ' },
                { id: 'starter', color: '#2c3a31', label: 'セルモーター' },
                { id: 'regulator', color: '#2c3a31', label: 'レギュレータ' }],
        legend: '<text x="40" y="1430" font-size="96" fill="#a49b87">←車の前方（トランク）</text>' +
                '<text x="2980" y="1430" font-size="96" fill="#a49b87" text-anchor="end">車の後ろ（エンジン）→</text>' +
                /* 「車体そのものが図の全体」という断りは HTML の説明文が持つ。 */
                '<text x="1510" y="-32" font-size="96" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
