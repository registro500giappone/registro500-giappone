/* ストーリー第8号「ルームランプが点かない」の絵。journey_id: room_lamp_dark（URLと対＝変えない）
   共通の土台（場面の作り方・描画プリミティブ・共通部品・実車図・検算・起動）は /wiring-journey.js。
   ⚠️図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。

   このストーリーだけの特徴＝【帰り道が2本ある】。
     これまでのストーリーはどれも1本の輪だった。ルームランプは球の − から
     ①ミラーの内蔵スイッチ ②ドア柱スイッチ の2本に分かれ、どちらか一方でもアースに
     落ちれば点く。だから「ドアを開けても点かないが、スイッチを入れれば点く」（またはその逆）
     という切り分けが、部品を外さずにできる。
   ⭐第7号（ホーン）と同じ F1 の負荷側にいる2つ＝両方が死んだらヒューズ1本で説明が付く。

   ⚠️系統8 を新設したストーリー＝NET_VERSION 6→7（部品 room_lamp・room_sw・door_sw、電線 w08-01〜05）。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;
  var X = 76;                                   /* 幹線（バッテリー〜ヒューズ〜球）の縦軸 */
  var DX = 232;                                 /* ドア柱スイッチ側の縦軸 */
  var FZ = 208;                                 /* ヒューズ F1 の箱の上端（下端子は +62） */
  var LB = { x: 16, y: 332, w: 174, h: 118 };   /* ルームランプの箱（球＋内蔵スイッチ） */
  /* ⚠️高さ76＝状態の語（ドアは開いている／閉じている）を接点の下に十分離すため。
       62 にしたら文字が接点の斜め線に串刺しにされた（第4・6号と同じ穴・実測して直した）。 */
  var DB = { x: 178, y: 470, w: 112, h: 76 };   /* ドア柱スイッチの箱 */

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    var blown = pos.f1 === 'BLOWN', swOn = pos.room_sw === 'ON', doorOpen = pos.door_sw === 'DOOR_OPEN';

    function cutV(x, y1, y2, id) {
      var mid = (y1 + y2) / 2, col = k.wcol(id, C.dim).col;
      s.push('<path d="M' + x + ',' + y1 + ' L' + x + ',' + (mid - 8) + ' M' + x + ',' + (mid + 8) + ' L' + x + ',' + y2 + '" stroke="' + col + '" stroke-width="5" stroke-linecap="round"/>');
      s.push('<circle cx="' + x + '" cy="' + mid + '" r="6" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
      k.label(x - 14, mid + 4, 'ここが外れている', C.hi, 'end', 12);
    }

    /* ===== バッテリー〜ヒューズ箱の電源側＝第7号とまったく同じ道 ===== */
    k.battery(X);
    k.seg(X, 62, X, 106, 'w11-01', true);
    k.label(X + 12, 88, 'ROSSO 赤・太', WC.ROSSO, null, 11);
    k.node(X, 106);
    k.dashOut(X, 106, 190);
    k.label(184, 98, '始動レバー・セルへ', C.sub, null, 10.5);
    k.label(184, 111, '（第3号）', C.sub, null, 10.5);

    k.seg(X, 106, X, 152, 'w11-03', true);
    k.label(X + 12, 134, 'MARRONE 茶・太', WC.MARRONE, null, 11);
    k.node(X, 152);
    s.push('<rect x="4" y="130" width="76" height="44" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="42" y="149" font-size="11.5" fill="#fffdf8" text-anchor="middle">レギュレータ</text>');
    s.push('<text x="42" y="164" font-size="10" fill="' + C.in_ + '" text-anchor="middle">（車の後ろ）</text>');
    s.push('<path d="M80,152 L' + X + ',152" stroke="' + C.deep + '" stroke-width="3.5"/>');
    k.label(97, 146, '30', C.deep, 'end', 11);

    k.seg(X, 152, X, FZ, 'w11-04', true);
    k.label(X + 12, 184, 'ROSSO 赤・太', WC.ROSSO, null, 11);

    /* ===== ヒューズ F1＝第7号と同じ本線。⭐ここから先の2本がホーンとルームランプ ===== */
    k.node(X, FZ);
    k.dashOut(X, FZ, 146);
    k.label(150, FZ - 6, 'キースイッチへ', C.sub, null, 10);
    k.label(150, FZ + 7, '（第1・4・6号）', C.sub, null, 10);
    k.label(X - 12, FZ - 8, '30', C.deep, 'end', 11);
    k.fuseV(X, FZ, blown, 'ヒューズ F1');

    /* ヒューズの先で2手に分かれる＝もう1本はホーンへ（第7号のストーリー） */
    k.node(X, FZ + 62);
    k.dashOut(X, FZ + 62, 168);
    k.label(172, FZ + 58, 'ホーンへ', C.sub, null, 10);
    k.label(172, FZ + 71, '（第7号）', C.sub, null, 10);

    /* ===== F1の負荷側 → 球の ＋（BIANCO） ===== */
    if (mode.cut === 'w08-01') cutV(X, FZ + 62, LB.y, 'w08-01');
    else { k.seg(X, FZ + 62, X, LB.y, 'w08-01'); k.label(X + 14, 306, 'BIANCO 白', '#8a8272', null, 11); }

    /* ===== ルームランプの箱（球＋内蔵スイッチ＝原典では1つの部品） ===== */
    s.push('<rect x="' + LB.x + '" y="' + LB.y + '" width="' + LB.w + '" height="' + LB.h + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="100" y="' + (LB.y + 16) + '" font-size="11" fill="#fffdf8">ルームランプ</text>');
    s.push('<text x="100" y="' + (LB.y + 29) + '" font-size="9.5" fill="' + C.in_ + '">（ミラーの中）</text>');
    /* 球＝丸とフィラメント。点灯時は光のにじみを敷く（⛔点滅させない・⛔電球アイコンを足さない） */
    var BY = LB.y + 46;
    if (sc.lampOn) {
      s.push('<defs><radialGradient id="jroomg">'
        + '<stop offset="0%" stop-color="#ffe9a8" stop-opacity=".95"/>'
        + '<stop offset="45%" stop-color="#ffd25e" stop-opacity=".45"/>'
        + '<stop offset="100%" stop-color="#ffd25e" stop-opacity="0"/></radialGradient></defs>');
      /* ⚠️にじみの半径は 30 まで。40 にすると左の端子名「＋」を飲み込んで読めなくなった（実測） */
      s.push('<g class="lampglow"><circle cx="' + X + '" cy="' + BY + '" r="30" fill="url(#jroomg)"/></g>');
    }
    s.push('<circle cx="' + X + '" cy="' + BY + '" r="15" fill="' + (sc.lampOn ? '#ffe07a' : '#5d6f62') + '" stroke="' + (sc.lampOn ? '#fff3c9' : C.in_) + '" stroke-width="2.5"/>');
    s.push('<path d="M' + (X - 7) + ',' + (BY + 5) + ' q7,-14 14,0" fill="none" stroke="' + (sc.lampOn ? '#a8791f' : C.in_) + '" stroke-width="2.2"/>');
    s.push('<path d="M' + X + ',' + (LB.y + 2) + ' L' + X + ',' + (BY - 15) + ' M' + X + ',' + (BY + 15) + ' L' + X + ',' + (LB.y + 74) + '" stroke="' + C.in_ + '" stroke-width="3"/>');
    k.label(54, LB.y + 22, '＋', C.in_, 'end', 12);
    /* 内蔵スイッチ＝箱の中。接点はキースイッチ・ホーンボタンと同じ描き方に揃える */
    var SY = LB.y + 74;
    s.push('<circle cx="' + X + '" cy="' + SY + '" r="3.8" fill="' + C.in_ + '"/>');
    s.push('<circle cx="' + X + '" cy="' + (SY + 26) + '" r="3.8" fill="' + C.in_ + '"/>');
    if (swOn) s.push('<path d="M' + X + ',' + SY + ' L' + X + ',' + (SY + 26) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    else s.push('<path d="M' + X + ',' + SY + ' L' + (X + 13) + ',' + (SY + 20) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<text x="100" y="' + (SY + 8) + '" font-size="10" fill="' + C.in_ + '">内蔵スイッチ</text>');
    s.push('<text x="100" y="' + (SY + 24) + '" font-size="11" font-weight="700" fill="' + (swOn ? '#7fd6a0' : C.in_) + '">' + (swOn ? '入' : '切') + '</text>');
    if (sc.lampOn) k.dots(X, LB.y + 8, LB.y + 30, false);
    /* 状態の語は箱の外・右（第7号と同じ作法＝箱の中に置くと光のにじみに埋もれる）。
       ⚠️高さは球の真横（BY+5）ではなく箱の上寄り＝球の − から右へ出る線のラベル
         （「−」「NERO 黒」）と3つ重なった（実測して直した）。 */
    s.push('<text x="198" y="' + (LB.y + 24) + '" font-size="12" font-weight="700" fill="' + (sc.lampOn ? '#2f7d4f' : C.hi) + '">' + (sc.lampOn ? '点いている' : '点かない') + '</text>');

    /* ===== 帰り道①＝内蔵スイッチ → 車体アース ===== */
    if (mode.cut === 'w08-03') cutV(X, LB.y + LB.h, 522, 'w08-03');
    else { k.seg(X, LB.y + LB.h, X, 522, 'w08-03'); k.label(X - 14, 490, 'NERO 黒', WC.NERO, 'end', 11); }
    k.ground(X, 522, '');
    k.label(X - 34, 546, '帰り道①', C.deep, null, 11);

    /* ===== 帰り道②＝球の − → ドア柱スイッチ（横に分かれる） =====
       ⚠️分岐点は球の − ＝箱の中。箱の右辺に端子を出して、そこから横へ引く。 */
    var MY = LB.y + 64;
    s.push('<path d="M' + X + ',' + MY + ' L' + (LB.x + LB.w) + ',' + MY + '" stroke="' + C.in_ + '" stroke-width="3"/>');
    k.node(X, MY);
    k.label(194, MY - 8, '−', C.deep, null, 12);
    var c4 = k.wcol('w08-04', C.dim);
    s.push('<path d="M' + (LB.x + LB.w) + ',' + MY + ' L' + DX + ',' + MY + ' L' + DX + ',' + DB.y + '" fill="none" stroke="' + c4.col + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>');
    if (c4.live && sc.lampOn && doorOpen) { k.dotsH(MY, 200, DX - 8, 'right'); k.dots(DX, MY + 14, DB.y - 12, false); }
    k.label(206, MY + 20, 'NERO 黒', WC.NERO, null, 10.5);

    /* ===== ドア柱スイッチ ===== */
    s.push('<rect x="' + DB.x + '" y="' + DB.y + '" width="' + DB.w + '" height="' + DB.h + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="' + (DB.x + 8) + '" y="' + (DB.y + 16) + '" font-size="10" fill="#fffdf8">ドア柱スイッチ</text>');
    s.push('<circle cx="' + DX + '" cy="' + (DB.y + 26) + '" r="3.8" fill="' + C.in_ + '"/>');
    s.push('<circle cx="' + DX + '" cy="' + (DB.y + 48) + '" r="3.8" fill="' + C.in_ + '"/>');
    if (doorOpen) s.push('<path d="M' + DX + ',' + (DB.y + 26) + ' L' + DX + ',' + (DB.y + 48) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    else s.push('<path d="M' + DX + ',' + (DB.y + 26) + ' L' + (DX + 12) + ',' + (DB.y + 44) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<text x="' + (DB.x + 8) + '" y="' + (DB.y + 68) + '" font-size="10.5" font-weight="700" fill="' + (doorOpen ? '#7fd6a0' : C.in_) + '">ドアは' + (doorOpen ? '開いている' : '閉じている') + '</text>');

    if (mode.cut === 'w08-05') cutV(DX, DB.y + DB.h, 570, 'w08-05');
    else { k.seg(DX, DB.y + DB.h, DX, 570, 'w08-05'); k.label(DX + 12, 556, 'NERO 黒', WC.NERO, null, 10.5); }
    k.ground(DX, 570, '');
    k.label(DX - 34, 594, '帰り道②', C.deep, null, 11);

    k.label(6, 622, '⬆ どちらの帰り道も、車体からバッテリーの − へ戻る（第5号）。', C.sub, null, 10.5);
    if (mode.cut) { k.label(6, 642, '⚠️切れているのは片方の帰り道だけ＝もう片方は生きている。', C.hi, null, 10.5); return 654; }
    if (blown) { k.label(6, 642, '⚠️ヒューズが切れると、帰り道の2本とも意味を失う（電気が来ない）。', C.hi, null, 10.5); return 654; }
    return 634;
  }

  /* ---- トグル（ドア 閉 ↔ 開）＝内蔵スイッチは「切」のまま固定 ----
     ⭐主役の動き＝「スイッチを触っていないのに、ドアを開けると点く」。 */
  var CAPS = {
    CLOSED: '<b>ドアが閉じている＝柱のボタンが押し込まれて、接点は開いています。</b>球の ＋ には12Vが来ていて（白い線に色が付いています）、− 側にも電圧は届いています。それでも点かないのは<b>帰り道が両方とも切れているから</b>です。テスターを当てると、球の両側で12Vが読めます。',
    OPEN: '<b>ドアを開けた＝柱のボタンが戻って、接点が閉じました。</b>人の感覚と逆に見えますが、<b>ドアを「開ける」とスイッチは「入る」</b>のです。帰り道②がアースにつながり、球が点きます。内蔵スイッチは<b>「切」のまま触っていません</b>——それでも点くのが、帰り道が2本ある回路の姿です。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function get(sc, id) { for (var i = 0; i < sc.r.loads.length; i++) if (sc.r.loads[i].id === id) return sc.r.loads[i].on; return false; }
  function horn(sc) { return get(sc, 'horn'); }
  function chg(sc) { return get(sc, 'quadro.warn_charge'); }
  var LW = ['点く', '点かない'], HW = ['鳴る', '鳴らない'], CW = ['点く', '消える'];
  var OPEN = { door: 'OPEN', room_btn: 'OFF' };
  var SWON = { door: 'CLOSED', room_btn: 'ON' };
  function cut(id) { return [{ op: 'removeWire', id: id }]; }
  var CHECKS = [
    { label: 'ドアを閉じている・スイッチ切', s: { inputs: { door: 'CLOSED', room_btn: 'OFF' } }, expect: false, words: LW },
    { label: 'ドアを開けた・スイッチ切', s: { inputs: OPEN }, expect: true, words: LW },
    { label: 'ドアを閉じている・スイッチ入', s: { inputs: SWON }, expect: true, words: LW },
    { label: 'キーON・ドアを開けた（キーは無関係）', s: { inputs: { key: 'ON', engine: 'STOP', door: 'OPEN' } }, expect: true, words: LW },
    /* ⭐第7号と対＝同じ F1 の先にいる2つ */
    { label: 'ヒューズF1が切れている・ドアを開けた', s: { inputs: { door: 'OPEN', f1: 'BLOWN' } }, expect: false, words: LW },
    { label: '↑同じ場面でホーンを押す（道連れ）', s: { inputs: { door: 'OPEN', horn_btn: 'PRESSED', f1: 'BLOWN' } }, expect: false, read: horn, words: HW },
    { label: '↑同じ場面のチャージランプ（キーON・無実）', s: { inputs: { key: 'ON', engine: 'STOP', f1: 'BLOWN' } }, expect: true, read: chg, words: CW },
    /* 帰り道①だけが切れた＝ドアでは点くがスイッチでは点かない */
    { label: '内蔵スイッチのアース（w08-03）が外れた・スイッチ入', s: { inputs: SWON, ops: cut('w08-03') }, expect: false, words: LW },
    { label: '↑同じ故障のまま、ドアを開ける', s: { inputs: OPEN, ops: cut('w08-03') }, expect: true, words: LW },
    /* 帰り道②だけが切れた＝その逆になる。⭐この2組が「部品を外さない切り分け」の根拠 */
    { label: 'ドア柱スイッチのアース（w08-05）が外れた・ドアを開けた', s: { inputs: OPEN, ops: cut('w08-05') }, expect: false, words: LW },
    { label: '↑同じ故障のまま、内蔵スイッチを入れる', s: { inputs: SWON, ops: cut('w08-05') }, expect: true, words: LW },
    { label: 'ドアへの黒線（w08-04）が外れた・ドアを開けた', s: { inputs: OPEN, ops: cut('w08-04') }, expect: false, words: LW },
    /* 給電側が切れた＝どちらの帰り道でも点かない */
    { label: '白い線（w08-01）が外れた・ドアを開けた', s: { inputs: OPEN, ops: cut('w08-01') }, expect: false, words: LW },
    { label: '↑同じ場面で内蔵スイッチを入れる', s: { inputs: SWON, ops: cut('w08-01') }, expect: false, words: LW },
    { label: '↑同じ場面でホーンを押す（無実）', s: { inputs: { horn_btn: 'PRESSED' }, ops: cut('w08-01') }, expect: true, read: horn, words: HW },
    { label: 'バッテリー−（w11-10）が外れた・ドアを開けた', s: { inputs: OPEN, ops: cut('w11-10') }, expect: false, words: LW },
    { label: 'オルタネーター換装車・ドアを開けた', s: { alt: true, inputs: OPEN }, expect: true, words: LW }
  ];

  Journey.boot({
    lampId: 'room_lamp',
    lampName: 'ルームランプ',
    alt: false,
    mainInit: 'OPEN',
    mainInputs: function (v) { return { door: v, room_btn: 'OFF' }; },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* ★①ヒューズが切れた＝ホーンと道連れ（第7号と対） */
        { id: 'j-blown', sc: scenario({ inputs: { door: 'OPEN', f1: 'BLOWN' } }), mode: {} },
        /* ★②帰り道②だけが切れた＝ドアでは点かないのに、内蔵スイッチなら点く */
        { id: 'j-doorgnd', sc: scenario({ inputs: OPEN, ops: cut('w08-05') }), mode: { cut: 'w08-05' } },
        { id: 'j-doorgnd-sw', sc: scenario({ inputs: SWON, ops: cut('w08-05') }), mode: { cut: 'w08-05' } },
        { id: 'j-fixed', sc: scenario({ inputs: OPEN }), mode: {} }
      ];
    },
    /* ⛔ルームランプ・ドア柱スイッチには印を打たない＝wiring-layout.json はオーナーの実測値だけで
         できていて、こちらの推定値を1つも入れていない（この2部品はまだ実測が無い）。 */
    carmap: function () {
      return {
        viewBox: '0 -140 2000 1640',
        scale: 3,
        marks: [{ id: 'battery', color: '#8d8574', label: 'バッテリー', anchor: 'start' },
                { id: 'f1', color: '#b8442e', label: 'ヒューズ箱', anchor: 'start' }],
        legend: '<text x="40" y="1430" font-size="80" fill="#a49b87">←車の前方（トランク）</text>' +
                '<text x="1960" y="1430" font-size="80" fill="#a49b87" text-anchor="end">車の後ろ（エンジン）→</text>' +
                '<text x="1000" y="-40" font-size="80" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
