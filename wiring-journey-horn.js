/* ストーリー第12回「ホーンが鳴らない」の絵。図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。
   このストーリーだけの特徴＝【2つとも、これまでのストーリーとは逆】。①ヒューズが本線に入る。
   第1・4・6回はどれも「ヒューズは無実」だった（キー・コイルへの線はヒューズの電源側から分かれる）。
   ホーンは F1 の【負荷側】に着く＝ヒューズを疑うのが正しい数少ない症状。
   ⛔「ヒューズが犯人になる初めての回」ではない（F2 が犯人になる場面は第7回 brake・第10回 turn・第11回 wiper で既出）。
   初めてなのは【キーと無関係に生きている F1 が犯人になる】ほう＝2026-09-03 に第7回→第12回へ動かしたとき本文ごと直した。
   ②スイッチがアース側に入る。ホーンには常に12Vが来ていて、ボタンは【帰り道】をつなぐ。
   だからキーを抜いても鳴る。ホーン本体の「通電しても鳴らない・かすれる」（調整ねじ・内部接点の荒れ）は値の話＝この絵の外。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;
  /* 配置の決めごと（第4・6回で確立した作法をそのまま使う）：①部品の箱の中は【左＝端子名／中央 x=76 の縦軸＝内部の線／右＝文字】の3列に分ける。
     ②ヒューズは縦向き（k.fuseV）＝第4回の横向きと違う。本文でそのことを断ってある。 */
  var X = 76;
  var FZ = 208;                                /* ヒューズ F1 の箱の上端（下端子は +62） */
  var HB = { x: 16, y: 332, w: 174, h: 84 };   /* ホーンの箱 */
  var BB = { x: 16, y: 476, w: 174, h: 62 };   /* ホーンボタンの箱 */

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    var blown = pos.f1 === 'BLOWN', pressed = pos.horn_sw === 'PRESSED';

    /* 赤地に白抜きの札＝この絵でいちばん見てほしい所に1枚だけ置く（第4・6回と同じ道具）。
       札は1つの絵に1枚まで。2枚置くと、どちらを見ればいいのか分からなくなる。 */
    function chip(x, y, t) {
      var w = t.length * 12 + 14, h = 22;
      s.push('<rect x="' + x + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="5" fill="' + C.hi + '"/>');
      s.push('<text x="' + (x + 7) + '" y="' + (y + 4.5) + '" font-size="12" font-weight="700" fill="#fffdf8">' + t + '</text>');
    }
    /* 【赤の序列】切断はすき間13・×・ハロー・図幅いっぱいの境界破線・赤札1枚。赤はこの「切れている場所」ただ1つに取っておく。 */
    function cutV(y1, y2, id, thick, opt) {
      opt = opt || {};
      var mid = opt.mid || (y1 + y2) / 2, col = k.wcol(id, C.dim).col, g = 13, w = thick ? 6.5 : 5;
      s.push('<path d="M' + X + ',' + y1 + ' L' + X + ',' + (mid - g) + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>');
      s.push('<path d="M' + X + ',' + (mid + g) + ' L' + X + ',' + y2 + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>');
      s.push('<path d="M4,' + mid + ' L296,' + mid + '" stroke="' + C.hi + '" stroke-width="1.4" stroke-dasharray="4 6" opacity="0.4"/>');
      s.push('<circle cx="' + X + '" cy="' + mid + '" r="19" fill="' + C.hi + '" opacity="0.13"/>');
      s.push('<circle cx="' + X + '" cy="' + mid + '" r="11" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
      s.push('<path d="M' + (X - 5.5) + ',' + (mid - 5.5) + ' L' + (X + 5.5) + ',' + (mid + 5.5)
        + ' M' + (X + 5.5) + ',' + (mid - 5.5) + ' L' + (X - 5.5) + ',' + (mid + 5.5)
        + '" stroke="' + C.hi + '" stroke-width="3" stroke-linecap="round"/>');
      chip(150, mid, '外れている');
    }

    /* ===== バッテリー〜ヒューズ箱の電源側までは第1〜4回でたどった道 ===== */
    k.battery(X);
    /* 端子バッジ＝原典に番号のある端子にだけ付ける。この絵で付けるのは + / 30（レギュレータ）/ 30（ヒューズ箱の電源側）/ ホーンの + ・−の5か所。
       F1の負荷側とホーンボタンの接点には付けない＝原典に名前が無いから（絵の中で言い切ってある）。
       ホーンの +・−は原典の配線図に番号としては出てこないが、実車の端子には刻印があり、本文がそこへテスターを当てろと言っている＝図と本文を1対1にするために出す（第6回と同じ扱い）。 */
    k.term(X, 74, '+', 'l');
    k.seg(X, 62, X, 106, 'w11-01', true);
    k.label(X + 12, 88, 'ROSSO 赤・太', WC.ROSSO, null, 11);
    k.node(X, 106);
    k.dashOut(X, 106, 190);
    k.label(184, 98, 'スターターレバー・セルへ', C.sub, null, 10.5);
    k.label(184, 111, '（第3回）', C.sub, null, 10.5);

    k.seg(X, 106, X, 152, 'w11-03', true);
    k.label(X + 12, 134, 'MARRONE 茶・太', WC.MARRONE, null, 11);
    k.node(X, 152);
    s.push('<rect x="4" y="130" width="76" height="44" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="42" y="149" font-size="11.5" fill="#fffdf8" text-anchor="middle">レギュレータ</text>');
    s.push('<text x="42" y="164" font-size="10" fill="' + C.in_ + '" text-anchor="middle">（車の後ろ）</text>');
    s.push('<path d="M80,152 L' + X + ',152" stroke="' + C.deep + '" stroke-width="3.5"/>');
    k.term(X, 152, '30', 'r');

    k.seg(X, 152, X, FZ, 'w11-04', true);
    k.label(X + 12, 184, 'ROSSO 赤・太', WC.ROSSO, null, 11);

    /* ===== ヒューズ F1＝ここが本線。第4回ではこれを横の枝として描いた ===== */
    k.node(X, FZ);
    /* キー系への分岐＝ヒューズの【手前】から出る＝F1が切れてもキー系は無事。分岐の文字は箱（x+62=138まで）と重ならない位置＝x=150 以降に置く。 */
    k.dashOut(X, FZ, 146);
    k.label(150, FZ - 6, 'キースイッチへ', C.sub, null, 10);
    k.label(150, FZ + 7, '（第1・4・6回）', C.sub, null, 10);
    k.term(X, FZ - 10, '30', 'l');
    k.fuseV(X, FZ, blown, 'ヒューズ F1');
    /* 【線の上に切断が無い場面こそ印が要る】（第4回）が効くのは、**どの線も生きて見える** 場面＝ここは部品そのものが切れた姿で描かれているので、その条件に当たらない。 */
    /* F1の負荷側＝原典に端子名が無い（SCHEMA §G 持ち越し3）。絵の中で正直に書く */
    k.label(X - 12, FZ + 70, '（名前なし）', C.sub, 'end', 9.5);

    /* ===== F1の負荷側→ホーンの＋（VIOLA） ===== */
    if (mode.cut === 'w05-01') cutV(FZ + 62, HB.y, 'w05-01');
    else { k.seg(X, FZ + 62, X, HB.y, 'w05-01'); k.label(X + 14, 300, 'VIOLA 紫', '#7a5296', null, 11); }

    /* ===== ホーン（電磁石＝この絵で計算している負荷） ===== */
    s.push('<rect x="' + HB.x + '" y="' + HB.y + '" width="' + HB.w + '" height="' + HB.h + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="100" y="' + (HB.y + 17) + '" font-size="11" fill="#fffdf8">ホーン</text>');
    /* 内部＝電磁石の巻線（第6回のコイルと同じ描き方に揃える＝読者が同じ物として読める）。
       これは電線ではないので被覆色を付けない＝明るい内部線 */
    s.push('<path d="M' + X + ',' + (HB.y + 2) + ' L' + X + ',' + (HB.y + 24) + '" stroke="' + C.in_ + '" stroke-width="3"/>');
    s.push('<path d="M' + X + ',' + (HB.y + 24) + ' q16,7 0,14 q16,7 0,14 q16,7 0,14" fill="none" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<path d="M' + X + ',' + (HB.y + 66) + ' L' + X + ',' + (HB.y + 82) + '" stroke="' + C.in_ + '" stroke-width="3"/>');
    if (sc.lampOn) k.dots(X, HB.y + 8, HB.y + 74, false);
    /* ＋と−は本文の絞り込みで【実際にテスターを当てる】2つ＝hero（濃く反転）で出す。 */
    k.term(X, HB.y - 12, '+', 'l', true);
    k.term(X, HB.y + HB.h + 10, '−', 'l', true);
    /* 振動板＝箱の右側。鳴っているときだけ音の弧を出す（点滅させない）。状態の語（鳴っている／鳴らない）は箱の【外・右】に置く＝キースイッチと同じ作法。 */
    s.push('<path d="M118,' + (HB.y + 34) + ' L118,' + (HB.y + 66) + '" stroke="' + C.in_ + '" stroke-width="2.5"/>');
    if (sc.lampOn)
      for (var i = 0; i < 3; i++)
        s.push('<path d="M' + (126 + i * 12) + ',' + (HB.y + 36) + ' q9,14 0,28" fill="none" stroke="#7fd6a0" stroke-width="2.4" stroke-linecap="round" opacity="' + (0.9 - i * 0.22) + '"/>');
    s.push('<text x="198" y="' + (HB.y + 50) + '" font-size="12" font-weight="700" fill="' + (sc.lampOn ? '#2f7d4f' : C.hi) + '">' + (sc.lampOn ? '鳴っている' : '鳴らない') + '</text>');

    /* ===== ホーンの−→ステアリングコラムを通ってボタンへ ===== */
    if (mode.cut === 'w05-02') cutV(HB.y + HB.h, BB.y, 'w05-02');
    else {
      k.seg(X, HB.y + HB.h, X, BB.y, 'w05-02');
      k.label(X + 14, 438, 'GIALLO E NERO', WC.GIALLO, null, 11);
      k.label(X + 14, 451, '黄／黒', WC.GIALLO, null, 11);
      /* コラムのコネクタ＝原典にインラインコネクタ記号がある所（NL-D の記載）。コミュテータ（部品11）の接点は通らない＝束を共にするだけ、と本文で断る。 */
      s.push('<rect x="' + (X - 9) + '" y="446" width="18" height="10" rx="2.5" fill="#e8e1d0" stroke="' + C.deep + '" stroke-width="1.8"/>');
      k.label(X - 16, 455, 'コラムの', C.sub, 'end', 9.5);
      k.label(X - 16, 466, 'つなぎ目', C.sub, 'end', 9.5);
    }

    /* ===== ホーンボタン（接点はキースイッチ・ポイントと同じ描き方） ===== */
    s.push('<rect x="' + BB.x + '" y="' + BB.y + '" width="' + BB.w + '" height="' + BB.h + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="100" y="' + (BB.y + 17) + '" font-size="11" fill="#fffdf8">ホーンボタン</text>');
    s.push('<circle cx="' + X + '" cy="' + (BB.y + 16) + '" r="3.8" fill="' + C.in_ + '"/>');
    s.push('<circle cx="' + X + '" cy="' + (BB.y + 44) + '" r="3.8" fill="' + C.in_ + '"/>');
    if (pressed) s.push('<path d="M' + X + ',' + (BB.y + 16) + ' L' + X + ',' + (BB.y + 44) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    else s.push('<path d="M' + X + ',' + (BB.y + 16) + ' L' + (X + 13) + ',' + (BB.y + 38) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<text x="100" y="' + (BB.y + 50) + '" font-size="11" font-weight="700" fill="' + (pressed ? '#7fd6a0' : C.in_) + '">' + (pressed ? '押している' : '離している') + '</text>');

    /* ===== ボタン→車体アース ===== */
    if (mode.cut === 'w05-03') cutV(BB.y + BB.h, 634, 'w05-03');
    else { k.seg(X, BB.y + BB.h, X, 634, 'w05-03'); k.label(X + 14, 600, 'NERO 黒', WC.NERO, null, 11); }
    k.ground(X, 634, '車体アース');
    k.label(6, 664, '⬆ 車体からバッテリーの − へ帰って、輪が閉じる（第5回）。', C.sub, null, 10.5);

    if (mode.cut) { k.label(6, 686, '⚠️ここが切れている間、ボタンを押しても輪は閉じない。', C.hi, null, 10.5); return 698; }
    if (blown) { k.label(6, 686, '⚠️ヒューズが切れている＝ホーンとルームランプだけが道を失う。', C.hi, null, 10.5); return 698; }
    return 678;
  }

  /* トグルの inputs で key を OFF に固定してある。 */
  var CAPS = {
    PRESSED: '<b>ボタンを押している＝帰り道がつながって、ホーンが鳴っています。</b>注目してほしいのは<b>キーが OFF のまま</b>だということです。ホーンには常に12Vが来ていて、ボタンは電気を「送る」のではなく<b>アースへ落として輪を閉じている</b>だけ。だから鍵を抜いた車でもホーンは鳴ります。',
    OFF: '<b>ボタンを離した＝帰り道が切れました。</b>ホーンのプラス端子にはこの瞬間も12Vが来ています（線の色が付いたままなのはそのためです）。<b>電圧は来ているのに鳴らない</b>——これが正常な状態です。テスターを当てると、ホーンの両方の端子で12Vが読めます。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function get(sc, id) { for (var i = 0; i < sc.r.loads.length; i++) if (sc.r.loads[i].id === id) return sc.r.loads[i].on; return false; }
  function chg(sc) { return get(sc, 'quadro.warn_charge'); }
  function coil(sc) { return get(sc, 'coil'); }
  var HW = ['鳴る', '鳴らない'], LW = ['点く', '消える'], PW = ['流れる', '流れない'];
  var PRESS = { key: 'OFF', horn_btn: 'PRESSED' };
  var PRESS_ON = { key: 'ON', engine: 'STOP', horn_btn: 'PRESSED' };
  function cut(id) { return [{ op: 'removeWire', id: id }]; }
  var CHECKS = [
    /* 実車で誰でも確かめられる挙動＝キーを抜いたままホーンが鳴る */
    { label: 'キーOFF・ボタンを押す', s: { inputs: PRESS }, expect: true, words: HW },
    { label: 'キーOFF・ボタンを離す', s: { inputs: { key: 'OFF', horn_btn: 'OFF' } }, expect: false, words: HW },
    { label: 'キーON・ボタンを押す', s: { inputs: PRESS_ON }, expect: true, words: HW },
    /* このストーリーの山場＝キーと無関係な F1 が犯人になる（⛔「ヒューズが犯人になる初めての回」ではない） */
    { label: 'ヒューズF1が切れている・押す', s: { inputs: { key: 'OFF', horn_btn: 'PRESSED', f1: 'BLOWN' } }, expect: false, words: HW },
    { label: '↑同じ場面のチャージランプ（キーON・無実）', s: { inputs: { key: 'ON', engine: 'STOP', f1: 'BLOWN' } }, expect: true, read: chg, words: LW },
    { label: '↑同じ場面の点火の一次（キーON・無実）', s: { inputs: { key: 'ON', engine: 'STOP', f1: 'BLOWN' } }, expect: true, read: coil, words: PW },
    /* 逆に、キー系が死んでもホーンは生きる＝第4回との対 */
    { label: 'キーへの赤線（w10-01）が外れた・押す', s: { inputs: PRESS, ops: cut('w10-01') }, expect: true, words: HW },
    { label: '↑同じ場面のチャージランプ（キーON）', s: { inputs: { key: 'ON', engine: 'STOP' }, ops: cut('w10-01') }, expect: false, read: chg, words: LW },
    /* 輪を1本ずつ切る＝3か所とも「鳴らない」 */
    { label: '紫の線（w05-01）が外れた・押す', s: { inputs: PRESS, ops: cut('w05-01') }, expect: false, words: HW },
    { label: 'コラムへの黄／黒線（w05-02）が外れた・押す', s: { inputs: PRESS, ops: cut('w05-02') }, expect: false, words: HW },
    { label: 'ボタンのアース（w05-03）が外れた・押す', s: { inputs: PRESS, ops: cut('w05-03') }, expect: false, words: HW },
    /* アースの帰り道（第5回）が切れるとホーンも死ぬ */
    { label: 'バッテリーのマイナス端子（w11-10）が外れた・押す', s: { inputs: PRESS, ops: cut('w11-10') }, expect: false, words: HW },
    { label: 'オルタネーター換装車・キーOFFで押す', s: { alt: true, inputs: PRESS }, expect: true, words: HW }
  ];

  Journey.boot({
    lampId: 'horn',
    lampName: 'ホーン',
    alt: false,
    mainInit: 'PRESSED',
    mainInputs: function (v) { return { key: 'OFF', horn_btn: v }; },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* ★①ヒューズが切れた＝この絵の山場。同時にルームランプも点かなくなる（第13回と対） */
        { id: 'j-blown', sc: scenario({ inputs: { key: 'OFF', horn_btn: 'PRESSED', f1: 'BLOWN' } }), mode: {} },
        /* ②ボタンのアースが外れた＝両端に12Vが出るのに鳴らない（第6回の異常②と同じ形） */
        { id: 'j-noearth', sc: scenario({ inputs: PRESS, ops: cut('w05-03') }), mode: { cut: 'w05-03' } },
        { id: 'j-fixed', sc: scenario({ inputs: PRESS }), mode: {} }
      ];
    },
    /* ホーンとホーンボタンには印を打たない＝wiring-layout.json はオーナーの実測値だけでできていて、こちらの推定値を1つも入れていない（この2部品はまだ実測が無い）。
       指すのは実測済みの3点＝バッテリー・ヒューズ箱・キー（＝ボタンはキーのすぐ横のコラム）。 */
    carmap: function () {
      return {
        viewBox: '0 -140 2000 1640',
        scale: 3,
        marks: [{ id: 'horn', color: '#2c3a31', label: 'ホーン', anchor: 'start' },
                { id: 'battery', color: '#8d8574', label: 'バッテリー', anchor: 'start' },
                { id: 'f1', color: '#b8442e', label: 'ヒューズ箱', anchor: 'start' },
                { id: 'ign_sw', color: '#8d8574', label: 'キー（コラム）', anchor: 'start' },
                { id: 'horn_sw', color: '#2c3a31', label: 'ホーンボタン', anchor: 'start' }],
        legend: '<text x="40" y="1430" font-size="80" fill="#a49b87">←車の前方（トランク）</text>' +
                '<text x="1960" y="1430" font-size="80" fill="#a49b87" text-anchor="end">車の後ろ（エンジン）→</text>' +
                '<text x="1000" y="-40" font-size="80" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
