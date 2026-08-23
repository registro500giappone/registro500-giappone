/* 旅ページ第4号「キーを回しても何も点かない」の絵。journey_id: key_no_power（URLと対＝変えない）
   共通の土台（場面の作り方・描画プリミティブ・共通部品・実車図・検算・起動）は /wiring-journey.js。
   ⚠️図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。

   第3号（セルが回らない）との関係＝この旅は【第3号の対】:
     第3号 … 灯は点くのにセルが回らない → 容疑者は始動レバーの節点より【下】
     第4号 … 灯が点かない              → 容疑者は節点より【上】か、節点から計器盤までの1本道
     どちらの絵にも「始動レバーの節点」が出てくる。そこが電気の分かれ道だから。

   この旅だけの特徴＝【主役が1つの灯ではなく「2つの灯が揃って消えていること」】。
     原典では計器盤の警告灯はどれも AZZURRO 1本（INTER）で受けている＝落とし先だけが違う。
     だから「2つとも消える」なら犯人は共通部分にしかいない。これがこのページの絞り込みそのもの。
   ⚠️データ追加ゼロ＝既存の系統11・10・7だけで全場面が解けている（NET_VERSION は据え置き）。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;
  var X = 100;                       /* 幹線（バッテリー→計器盤）の縦軸 */
  var LG = 56, LO = 184;             /* 計器盤の中の2灯（GENERAT. と OLIO）の中心 */

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    function seg(a, b, c, d, e, f, g) { k.seg(a, b, c, d, e, f, g); }
    function label(x, y, t, col, anchor, size) { k.label(x, y, t, col, anchor, size); }
    /* 線が1本外れている場面の描き方（第3号と同じ作法）。
       ⚠️これは接点の位置ではなく「線が無い」状態＝netlist から外して解いている。 */
    function cutSeg(y1, y2, id, thick) {
      var mid = (y1 + y2) / 2, col = k.wcol(id, C.dim).col;
      s.push('<path d="M' + X + ',' + y1 + ' L' + X + ',' + (mid - 8) + '" stroke="' + col + '" stroke-width="' + (thick ? 6.5 : 5) + '" stroke-linecap="round"/>');
      s.push('<path d="M' + X + ',' + (mid + 8) + ' L' + X + ',' + y2 + '" stroke="' + col + '" stroke-width="' + (thick ? 6.5 : 5) + '" stroke-linecap="round"/>');
      s.push('<circle cx="' + X + '" cy="' + mid + '" r="6" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
      label(X + 14, mid + 4, 'ここが外れている', C.hi, null, 12);
    }

    /* ===== バッテリー ===== */
    k.battery(X);

    /* ===== ＋の太線 → 始動レバーの節点。ここで第3号の旅（セル）と分かれる ===== */
    seg(X, 62, X, 106, 'w11-01', true);
    label(X + 12, 88, 'ROSSO 赤', WC.ROSSO);
    k.node(X, 106);
    /* ⚠️この枝ラベルは容疑の囲い（x=4..192）の【外】に置く＝中に入ると「セルも容疑者」に読める。
       囲いを右へ広げた分、開始 x も 184→198 へ逃がした（2026-08-23 実測）。 */
    k.dashOut(X, 106, 194);
    label(198, 98, 'セルモーターへ', C.sub, null, 10.5);
    label(198, 111, '（第3号の旅）', C.sub, null, 10.5);

    /* ===== 節点 → レギュレータの端子30（車の後ろ）=====
       ⚠️ここが 500 の意外なところ＝キーに来る電気は、いったん車の【後ろ】まで行って
         前へ戻ってくる。原典の 30 系はレギュレータの端子で1つに集まっている。 */
    if (mode.cut === 'w11-03') cutSeg(106, 152, 'w11-03', true);
    /* ⚠️色ラベルは容疑の囲い（右端192）の内側に収める＝破線に文字を貫かれる。
       MARRONE と AZZURRO は既定サイズだと右端が 190/199 まで伸びたので 10.5/10 に落とした（実測）。 */
    else { seg(X, 106, X, 152, 'w11-03', true); label(X + 12, 134, 'MARRONE 茶', WC.MARRONE, null, 10.5); }
    k.node(X, 152);
    /* ⚠️端子名は箱の【外】に置く＝濃い箱の上に濃い字を置くと沈んで読めない（第3号の教訓）。
       箱の右端 80 と節点 100 のあいだの隙間に収める。 */
    s.push('<rect x="4" y="130" width="76" height="44" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="42" y="149" font-size="11.5" fill="#fffdf8" text-anchor="middle">レギュレータ</text>');
    s.push('<text x="42" y="164" font-size="10" fill="' + C.in_ + '" text-anchor="middle">（車の後ろ）</text>');
    s.push('<path d="M80,152 L' + X + ',152" stroke="' + C.deep + '" stroke-width="3.5"/>');
    label(97, 146, '30', C.deep, 'end', 11);

    /* ===== レギュレータ30 → ヒューズ箱の【電源側】（車の前へ戻る） ===== */
    if (mode.cut === 'w11-04') cutSeg(152, 208, 'w11-04', true);
    else { seg(X, 152, X, 208, 'w11-04', true); label(X + 12, 184, 'ROSSO 赤', WC.ROSSO); }
    k.node(X, 208);
    /* ヒューズ F1＝幹線にぶら下がる枝。⚠️キースイッチへの赤線は【ヒューズの電源側】から出る
       ＝F1が切れても灯は点く（第1号で先回りして潰したのと同じ迷い道）。 */
    s.push('<path d="M' + X + ',208 L196,208" stroke="' + C.deep + '" stroke-width="3.5"/>');
    s.push('<rect x="196" y="188" width="94" height="40" rx="8" fill="none" stroke="' + C.out + '" stroke-width="2.5"/>');
    s.push('<text x="243" y="204" font-size="11" fill="' + C.sub + '" text-anchor="middle">ヒューズ F1</text>');
    var blown = pos.f1 === 'BLOWN';
    s.push(blown
      ? '<path d="M224,216 L238,216 M252,216 L262,216" stroke="' + C.hi + '" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="M224,216 L262,216" stroke="' + C.sub + '" stroke-width="3" stroke-linecap="round"/>');
    /* ⚠️この2行はキースイッチのラベル（y=280/296・x=156〜）と横に重なる位置にある。
       枝の破線を短くして、文字を y=248/261 まで上げてある。下げると衝突する。 */
    s.push('<path d="M243,228 L243,240" stroke="' + C.out + '" stroke-width="3" stroke-dasharray="5 5"/>');
    /* ⚠️この枝は【無実】＝容疑の囲い（右端192）の中に文字を入れない。右揃えで外へ逃がす
       （左揃えだと図の右端300を越える。size 9.5 で左端196＝囲いの外・実測 2026-08-23） */
    label(296, 250, 'ホーン・ルームランプへ', C.sub, 'end', 9.5);
    label(296, 263, '（この旅は通らない）', C.sub, 'end', 9.5);
    label(X + 12, 202, '30', C.deep, null, 11);

    /* ===== ヒューズ箱の電源側 → キースイッチ 30 ===== */
    if (mode.cut === 'w10-01') cutSeg(208, 262, 'w10-01');
    else { seg(X, 208, X, 262, 'w10-01'); label(X + 12, 240, 'ROSSO 赤', WC.ROSSO); }

    /* ===== キースイッチ（30 ↔ 15/54） ===== */
    /* ⚠️部品名は x=198 から＝容疑の囲い（右端192）の外。既定の x+56=156 だと破線が文字を貫く（実測） */
    k.keySwitch(X, 262, pos.ign_sw === 'ON', 198);

    /* ===== キー → 計器盤の INTER ===== */
    if (mode.cut === 'w10-02') cutSeg(310, 372, 'w10-02');
    else { seg(X, 310, X, 372, 'w10-02'); label(X + 12, 344, 'AZZURRO 水色', WC.AZZURRO, null, 10); }

    /* ===== 計器盤の中＝1本の給電レール（INTER）が2つの灯を養っている =====
       ⚠️計器盤の内部結線は原典の図から読み切れていない（v:inf）。だから細い内部線として
         描き、電線の被覆色は付けない＝「原典に書いてあること」と見分けが付くようにする。 */
    s.push('<rect x="12" y="372" width="276" height="140" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    /* ⚠️見出しは短く＝x=100 の内部線を横切らない長さに収める（12文字だと線に串刺しになった） */
    s.push('<text x="20" y="388" font-size="10.5" fill="' + C.in_ + '">計器盤の中</text>');
    k.node(X, 372);
    s.push('<path d="M' + X + ',372 L' + X + ',400 M' + LG + ',400 L' + LO + ',400" stroke="' + C.in_ + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>');
    s.push('<path d="M' + LG + ',400 L' + LG + ',418 M' + LO + ',400 L' + LO + ',418" stroke="' + C.in_ + '" stroke-width="3.5" stroke-linecap="round"/>');
    s.push('<circle cx="' + LG + '" cy="400" r="4" fill="' + C.in_ + '"/><circle cx="' + LO + '" cy="400" r="4" fill="' + C.in_ + '"/>');
    label(192, 394, 'INTER＝給電レール', C.in_, null, 10);

    k.lampWindow(LG, 418, 'GENERAT.', sc.chargeOn, null, 0);
    k.lampWindow(LO, 418, 'OLIO', sc.oilOn, null, 0);

    /* 2つまとめて言う＝この旅の主役は「1つの灯」ではなく「2つが揃っているか」。
       ⚠️点灯時のにじみは中心 y=432・ry=56＝下端 488 まで広がる。状態語はその外（y=496）に置く
         （488 より上に置くと赤い光に埋もれて読めなくなった。実測で確認済み）。 */
    var both = sc.chargeOn && sc.oilOn, none = !sc.chargeOn && !sc.oilOn;
    var word = both ? '2つとも点いている' : (none ? '2つとも消えている' : '片方だけ点いている');
    var wcol = (pos.ign_sw !== 'ON') ? C.in_ : (both ? '#7fd6a0' : '#ff8a70');
    s.push('<text x="120" y="497" font-size="12" font-weight="700" fill="' + wcol + '" text-anchor="middle">' + word + '</text>');

    /* 灯から下＝落とし先。ここから先はそれぞれ別の旅なので、色だけ見せて手放す。
       ⚠️端子名（51・0）は箱の中なので明るい色で書く＝濃い地に濃い字にしない */
    s.push('<path d="M' + LG + ',452 L' + LG + ',512 M' + LO + ',452 L' + LO + ',512" stroke="' + C.in_ + '" stroke-width="2.5" stroke-dasharray="3 4"/>');
    label(LG - 8, 476, '51', C.in_, 'end', 10.5);
    label(LO - 8, 476, '0', C.in_, 'end', 10.5);
    k.node(LG, 512); k.node(LO, 512);
    seg(LG, 512, LG, 546, 'w11-07');
    seg(LO, 512, LO, 546, 'w07-01');
    label(LG + 10, 532, 'VERDE 緑', WC.VERDE, null, 11);
    label(LO + 10, 532, 'GRIGIO 灰', WC.GRIGIO, null, 11);
    s.push('<path d="M' + LG + ',546 L' + LG + ',564 M' + LO + ',546 L' + LO + ',564" stroke="' + C.out + '" stroke-width="3" stroke-dasharray="5 5"/>');
    label(6, 582, '緑→レギュレータ51（第1号）／灰→油圧センダ（第2号）', C.sub, null, 10.5);

    /* ⚠️容疑の囲いは計器盤の手前で止める＝2つの電球が同時に切れることは、まず無い。
       囲いを警告灯まで広げると「電球も疑え」に読めて、絞り込みが1段ゆるくなる。
       ⚠️【2026-08-23】囲いのラベルは「容疑者はこの中」だけにした＝以前の
         「（セルが回るなら）」まで入れると右へ伸びて ROSSO のラベルと重なる（実測）。
         条件のほうは本文（cap）が「①でセルが回った場合」と言う。 */
    if (mode.suspect) {
      k.suspect(4, 96, 188, 270, 92, '容疑者はこの中');
      label(6, 600, '⚠️計器盤の中（給電レールと電球）が最後の容疑者', C.sub, null, 10.5);
      return 614;
    }
    if (mode.minus) {
      label(6, 600, '⚠️12Vは来ている。それでも警告灯は点かない。', C.hi, null, 10.5);
      label(6, 616, 'バッテリーの − 端子が外れ、帰り道が無い（→第5号）。', C.hi, null, 10.5);
      return 628;
    }
    return 596;
  }

  /* ---- トグル（唯一の操作＝キーOFF ↔ キーON） ----
     ⚠️キャプションは「いまこの絵で起きていること」だけ。しくみは下の箇条書きが持つ。 */
  var CAPS = {
    OFF: '<b>キーOFF＝2つとも消えている。これが正常です。</b>キースイッチの接点が開いていて、計器盤へ行く水色の線に電気が来ていません。',
    ON: '<b>キーON＝2つとも点く。</b>黄色い点が、バッテリーから車の後ろのレギュレータを回って前へ戻り、キーを通って計器盤まで来ています。警告灯が点くのは「そこまで電気が届いた」という合図です。'
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
    { label: 'キーOFF（正常）', s: { inputs: { key: 'OFF', engine: 'STOP' } }, expect: false, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: { key: 'OFF', engine: 'STOP' } }, expect: false, read: chg, words: LW },
    { label: 'キーON・停止中（正常）', s: { inputs: ON }, expect: true, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: ON }, expect: true, read: chg, words: LW },
    /* エンジンが掛かっていれば消えているのが正常＝「点かない」が症状とは限らない */
    { label: 'エンジン回転中（正常＝消えている）', s: { inputs: { key: 'ON', engine: 'RUN' } }, expect: false, words: LW },
    /* ヒューズは通らない＝この症状でヒューズを疑わせないための検算 */
    { label: 'ヒューズF1が切れている・キーON', s: { inputs: { key: 'ON', engine: 'STOP', f1: 'BLOWN' } }, expect: true, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: { key: 'ON', engine: 'STOP', f1: 'BLOWN' } }, expect: true, read: chg, words: LW },
    /* 幹線が1本切れると、2つとも消える。しかもセルは回る＝上下が割れる */
    { label: '後ろへの太線（茶 w11-03）が外れた・キーON', s: { inputs: ON, ops: cut('w11-03') }, expect: false, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: ON, ops: cut('w11-03') }, expect: false, read: chg, words: LW },
    { label: '↑同じ場面のセル（レバーを引く）', s: { inputs: PULL, ops: cut('w11-03') }, expect: true, read: cel, words: CW },
    { label: 'キーへの赤線（w10-01）が外れた・キーON', s: { inputs: ON, ops: cut('w10-01') }, expect: false, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: ON, ops: cut('w10-01') }, expect: false, read: chg, words: LW },
    { label: '計器盤への水色線（w10-02）が外れた・キーON', s: { inputs: ON, ops: cut('w10-02') }, expect: false, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: ON, ops: cut('w10-02') }, expect: false, read: chg, words: LW },
    /* ＋側が外れた＝灯もセルも死ぬ（第3号の異常②と同じ場面） */
    { label: 'バッテリー＋の太線（w11-01）が外れた・キーON', s: { inputs: ON, ops: cut('w11-01') }, expect: false, words: LW },
    { label: '↑同じ場面のセル（レバーを引く）', s: { inputs: PULL, ops: cut('w11-01') }, expect: false, read: cel, words: CW },
    /* −側が外れた＝帰り道が無い。⚠️2026-08-21 の案A（アースの基準をバッテリー − へ）で
       初めて正しく答えられるようになった場面。この2件は以前は「点く・回る」と誤答していた。 */
    { label: 'バッテリー−の線（w11-10）が外れた・キーON', s: { inputs: ON, ops: cut('w11-10') }, expect: false, words: LW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: ON, ops: cut('w11-10') }, expect: false, read: chg, words: LW },
    { label: '↑同じ場面のセル（レバーを引く）', s: { inputs: PULL, ops: cut('w11-10') }, expect: false, read: cel, words: CW },
    /* 片方だけ消えるなら共通部分は無実＝この旅の絞り込みの裏づけ */
    { label: '灰色線（w07-01）だけ外れた・キーON→油圧警告灯', s: { inputs: ON, ops: cut('w07-01') }, expect: false, words: LW },
    { label: '↑同じ場面のチャージランプ（こちらは点いたまま）', s: { inputs: ON, ops: cut('w07-01') }, expect: true, read: chg, words: LW },
    { label: 'オルタネーター換装車・キーON停止中', s: { alt: true, inputs: ON }, expect: true, words: LW }
  ];

  Journey.boot({
    lampId: 'quadro.warn_oil',
    lampName: '油圧警告灯',
    alt: false,
    mainInit: 'OFF',
    mainInputs: function (v) { return { key: v, engine: 'STOP' }; },
    /* この旅は2つの灯を同時に読む＝どちらも場面に持たせる */
    extra: function (sc) { sc.chargeOn = chg(sc); sc.oilOn = get(sc, 'quadro.warn_oil'); },
    /* 幹線は「どちらかの灯が点いていれば」電気が流れている。落とし先の2本は各自の灯で決まる */
    flow: function (sc, id) {
      if (id === 'w11-07') return sc.chargeOn ? 'down' : null;
      if (id === 'w07-01') return sc.oilOn ? 'down' : null;
      return (sc.chargeOn || sc.oilOn) ? 'down' : null;
    },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* 異常①＝行きの道が1本切れた。絵はキーへの赤線が外れた例。2つとも消え、セルは回る */
        { id: 'j-fault', sc: scenario({ inputs: ON, ops: cut('w10-01') }), mode: { suspect: true, cut: 'w10-01' } },
        /* 異常②＝帰り道（アース）が切れた。⚠️絵じゅうに色は付いたままで、灯だけが消える＝
           「12Vは来ているのに動かない」の見本。案Aを入れて初めて正しく描けるようになった場面。 */
        { id: 'j-minus', sc: scenario({ inputs: ON, ops: cut('w11-10') }), mode: { minus: true } },
        /* 片方だけ消える＝共通部分は無実。この1枚が絞り込みの根拠 */
        { id: 'j-one', sc: scenario({ inputs: ON, ops: cut('w07-01') }), mode: {} },
        { id: 'j-fixed', sc: scenario({ inputs: ON }), mode: {} }
      ];
    },
    /* ⚠️この旅も車の全長が要る＝キーに来る電気がいったん車の後ろまで行って戻るため。
       第3号と同じ scale 4（viewBox が広いので印も文字も拡大しないと読めない）。 */
    carmap: function () {
      return {
        viewBox: '0 -140 3020 1640',
        scale: 4,
        marks: [{ id: 'battery', color: '#b8442e', label: 'バッテリー', anchor: 'start' },
                { id: 'quadro', color: '#b8442e', label: 'メーター' },
                { id: 'ign_sw', color: '#2c3a31', label: 'キー', anchor: 'start' },
                { id: 'f1', color: '#8d8574', label: 'ヒューズ箱', anchor: 'start' },
                { id: 'regulator', color: '#b8442e', label: 'レギュレータ' }],
        legend: '<text x="40" y="1430" font-size="96" fill="#a49b87">←車の前方（トランク）</text>' +
                '<text x="2980" y="1430" font-size="96" fill="#a49b87" text-anchor="end">車の後ろ（エンジン）→</text>' +
                '<text x="1510" y="-40" font-size="96" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
