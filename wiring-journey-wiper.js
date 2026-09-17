/* ストーリー第11回「ワイパーが動かない」の絵。図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。
   このストーリーだけの特徴が3つある。①【切っていても、モーターには電気が来ている】＝ヒューズ F2 の負荷側から、
   スイッチを通らずにモーターの C 端子へ直接1本行っている（⚠️これは F・L・R型。D型はスイッチの C 端子経由＝その131④）。
   ②【症状が2つある】＝動かない／止まらない。後者はスイッチの固着で、絵の上でも作れる（第7回のブレーキランプと同じ形）。
   ③【F2 の3人目】＝ブレーキランプ（第7回）・ウインカー（第10回）と同じヒューズ＝この回で3つ揃う。
   ⚠️⚠️【切ったあと定位置まで戻る仕組み（オートストップ）は、この絵では作れない】＝モーターの中のカム接点は
   軸の回転位置で開閉する＝L1（到達性）の外。だから C と F の2本は【つながっていることしか表さない】＝
   黄点を流さない（第10回のフラッシャーのアースと同じ扱い）。⭐モーターの内部そのものは純正整備解説書に
   載っており（Abb.388＝HANDOFF その131）、本文に【静止の解説図2枚】として置いた＝⛔solve() には語らせない。
   ⚠️スイッチの中の接点も描かない＝原典は内部を描いてはいるが、原寸60px前後で9倍に拡大しても組み合わせは判別できない（その129⑫）。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;

  var XC = 110;                       /* 幹線（バッテリー〜キー〜F2〜ワイパースイッチ） */
  var XL = 26;                        /* F2 の負荷側 →モーター C ＝スイッチを通らない1本（左を降りる） */
  var XD = 274;                       /* スイッチ自身のアース（右へ逃がす） */
  var KT = 112;                       /* キースイッチの箱の上端（高さ48） */
  var FZ = 200;                       /* ヒューズ F2 の上端（下端は +62） */
  var Y_C = 286, Y_BR = 316, Y_TN = 344;   /* F2 の負荷側から分かれる3つの高さ */
  var SW_T = 372, SW_B = 452, SWX1 = 56, SWX2 = 214;   /* ワイパースイッチの箱 */
  var M_T = 540, M_B = 640, MX1 = 46, MX2 = 214;       /* ワイパーモーターの箱 */
  var XF = 86, XI = 158;              /* スイッチ →モーターの2本（C→F ／ H→INT） */
  var Y_MC = 590;                     /* モーターの C 端子の高さ */
  var GM = 700, SM = 728;             /* モーターのアース記号・状態の語 */

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    var keyOn = pos.ign_sw === 'ON';
    var blown = pos.f2 === 'BLOWN';
    var swOn = pos.wiper_sw === 'ON';
    var run = sc.lampOn;                            /* lampId:'wiper_motor' ＝回っているか */
    var m = mode || {};

    function seg(a, b, c, d, e, f) { k.seg(a, b, c, d, e, f); }
    /* 横線は segH＝線を引いて、通電していれば横向きの黄点も流す。引数は【電源側→負荷側】の順（x1 が電源側）。 */
    function segH(x1, y, x2, id, thick, fallback) { k.segH(x1, y, x2, id, thick, fallback); }
    function label(x, y, t, col, anchor, size) { k.label(x, y, t, col, anchor, size); }

    /* 赤地に白抜きの札（第4回の道具）。1つの絵に1枚まで。 */
    function chip(x, y, t) {
      var w = t.length * 12 + 14, h = 22;
      s.push('<rect x="' + x + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="5" fill="' + C.hi + '"/>');
      s.push('<text x="' + (x + 7) + '" y="' + (y + 4.5) + '" font-size="12" font-weight="700" fill="#fffdf8">' + t + '</text>');
    }
    /* ×印だけを打つ小道具（第7回と同じ）。「どこが外れているか」は図の下の注記行が言う。 */
    function xmark(cx, cy) {
      s.push('<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#fbf7ee" stroke="' + C.hi + '" stroke-width="3"/>');
      s.push('<path d="M' + (cx - 5.5) + ',' + (cy - 5.5) + ' L' + (cx + 5.5) + ',' + (cy + 5.5)
        + ' M' + (cx + 5.5) + ',' + (cy - 5.5) + ' L' + (cx - 5.5) + ',' + (cy + 5.5)
        + '" stroke="' + C.hi + '" stroke-width="3" stroke-linecap="round"/>');
    }
    /* 縦線を切る。線の色は wcol に従う＝切れた線の【電源側】は色が残り、負荷側は薄くなる。 */
    function cutV(x, y1, y2, id) {
      var mid = (y1 + y2) / 2, col = k.wcol(id, C.dim).col;
      s.push('<path d="M' + x + ',' + y1 + ' L' + x + ',' + (mid - 13) + '" stroke="' + col + '" stroke-width="5" stroke-linecap="round"/>');
      s.push('<path d="M' + x + ',' + (mid + 13) + ' L' + x + ',' + y2 + '" stroke="' + col + '" stroke-width="5" stroke-linecap="round"/>');
      xmark(x, mid);
    }

    /* ===== バッテリー〜キースイッチ ===== 途中のレギュレータ・ヒューズ F1 は第3・7回で描いた道＝ここでは1本にまとめる。 */
    k.battery(XC);
    k.term(XC, 74, '+', 'l');
    seg(XC, 62, XC, KT, 'w11-01', true);
    label(XC + 30, 84, 'バッテリーから', C.sub, null, 11);
    label(XC + 30, 100, 'レギュレータを経て', C.sub, null, 11);

    k.keySwitch(XC, KT, keyOn, XC + 58);
    k.term(XC, KT + 10, '30', 'l');
    k.term(XC, KT + 62, '15/54', 'l');
    /* ⚠️線は【箱の底】KT+48 から出す（共通 k.keySwitch の箱は高さ48）。 */
    seg(XC, KT + 48, XC, FZ, 'w06-01');
    label(XC + 14, 186, 'AZZURRO 青', WC.AZZURRO, null, 11);

    /* ===== ヒューズ F2＝キーONのときだけ生きる（第7回・第10回と同じ1本） ===== */
    k.fuseV(XC, FZ, blown, 'ヒューズ F2');
    s.push('<text x="' + (XC + 24) + '" y="' + (FZ + 58) + '" font-size="10" fill="' + C.sub + '">キーONのときだけ生きる</text>');

    /* ===== F2 の負荷側＝ここから3方向 =====
       ①スイッチを【通らずに】モーターの C へ（この回の骨）②ブレーキランプへ（第7回）③ウインカーへ（第10回）。
       枝を実線で描くのは、F2 が切れたときに3つとも一緒に死ぬのが見えるため。 */
    seg(XC, FZ + 62, XC, SW_T, 'w13-01');
    k.node(XC, Y_C);
    segH(XC, Y_C, XL, 'w13-02');
    seg(XL, Y_C, XL, Y_MC, 'w13-02');
    segH(XL, Y_MC, MX1, 'w13-02');
    k.node(XC, Y_BR);
    segH(XC, Y_BR, 244, 'w06-02');
    label(126, Y_BR - 9, '→ ブレーキランプ（第7回）', C.sub, null, 10);
    k.node(XC, Y_TN);
    segH(XC, Y_TN, 244, 'w04-01');
    label(126, Y_TN - 9, '→ ウインカー（第10回）', C.sub, null, 10);
    label(4, 268, 'AZZURRO E NERO 青／黒', WC['AZZURRO E NERO'], null, 10.5);
    /* ⭐この1本の説明は図の中で言う＝本文まで読まないと「なぜ2本あるのか」が分からない絵にしない。
       ⚠️y は箱の上端（SW_T）より上に置く＝364 で「L」の端子バッジ（106..120）とも重ならない。 */
    label(4, 362, 'スイッチを通らない1本', C.sub, null, 10);

    /* ===== ワイパースイッチ ===== ダッシュに並ぶトグル＝倒せる位置は2つだけ（第8回のライトスイッチと同じ部品の形）。
       ⛔箱の中に接点の絵を描かない＝原典は内部を描いてはいるが、どう組み変わるかは読み取れない（HANDOFF その129⑫）。 */
    k.term(XC, SW_T - 6, 'L', 'l');
    s.push('<rect x="' + SWX1 + '" y="' + SW_T + '" width="' + (SWX2 - SWX1) + '" height="' + (SW_B - SW_T) + '" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="' + XC + '" y="' + (SW_T + 19) + '" font-size="12" fill="#fffdf8" text-anchor="middle">ワイパースイッチ</text>');
    /* ⛔部品番号を絵に書かない＝この回だけは型式で4通りに割れる（モーター D=8・F/L/R=9／スイッチ D=19・F/R=26・L=27）。
       しかも D原典では 9＝パネル照明SW・26＝ルームランプ＝【まったく別の部品】に当たる。番号は footer の表で断る。 */
    s.push('<text x="' + XC + '" y="' + (SW_T + 33) + '" font-size="10.5" fill="' + C.in_ + '" text-anchor="middle">ダッシュ・入／切</text>');
    var STEP = [['OFF', '切'], ['ON', '入']];
    for (var i = 0; i < 2; i++) {
      var sx = SWX1 + 45 + i * 70, cur = (STEP[i][0] === (swOn ? 'ON' : 'OFF'));
      s.push('<rect x="' + (sx - 24) + '" y="' + (SW_T + 42) + '" width="48" height="24" rx="5" fill="' + (cur ? C.in_ : 'none') + '" stroke="' + C.in_ + '" stroke-width="1.6"/>');
      s.push('<text x="' + sx + '" y="' + (SW_T + 58) + '" font-size="11" font-weight="' + (cur ? '700' : '400') + '" fill="' + (cur ? C.deep : C.in_) + '" text-anchor="middle">' + STEP[i][1] + '</text>');
    }
    /* スイッチ自身のアース。⚠️黄点は出さない＝L1 は部品の内部の導通を持たないので、この線について「流れている」とは言えない。 */
    k.term(SWX2, SW_T + 52, 'D', 'r');
    segH(SWX2, SW_T + 52, XD, 'w13-05');
    seg(XD, SW_T + 52, XD, 470, 'w13-05');
    k.ground(XD, 470, null);

    /* ===== スイッチ →モーターの2本 ===== 左＝C→F（オートストップ側）／右＝H→INT（回すほうの1本）。 */
    k.term(XF, SW_B + 12, 'C', 'l');
    k.term(XI, SW_B + 12, 'H', 'r');
    seg(XF, SW_B, XF, M_T, 'w13-04');
    if (m.cut === 'w13-03') cutV(XI, SW_B, M_T, 'w13-03'); else seg(XI, SW_B, XI, M_T, 'w13-03');
    k.term(XF, M_T - 12, 'F', 'l');
    k.term(XI, M_T - 12, 'INT', 'r');
    label(4, 498, 'AZZURRO E BIANCO', WC['AZZURRO E BIANCO'], null, 10);
    label(4, 511, '青／白', WC['AZZURRO E BIANCO'], null, 10);
    label(296, 498, 'AZZURRO 青', WC.AZZURRO, 'end', 10);
    label(296, 511, 'これが回す1本', C.sub, 'end', 10);

    /* ===== ワイパーモーター ===== ⭐4端子。C には【切っていても電気が来ている】＝この回の骨。
       ⛔中にカム接点を描かない＝原典はモーターの内部を描いていない（4端子の箱のみ）。 */
    s.push('<rect x="' + MX1 + '" y="' + M_T + '" width="' + (MX2 - MX1) + '" height="' + (M_B - M_T) + '" rx="26" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="' + XC + '" y="' + (M_T + 26) + '" font-size="12" fill="#fffdf8" text-anchor="middle">ワイパーモーター</text>');
    /* ⛔ここにも部品番号を書かない（上の理由と同じ）。 */
    /* 中の巻線＝ここで電圧が落ちる（負荷エッジ）。導線ではないことをコイルの形で言う（第3回と同じ道具）。 */
    s.push('<path d="M' + XC + ',' + (M_T + 52) + ' q-9,4 0,8 q9,4 0,8 q-9,4 0,8" fill="none" stroke="' + C.in_ + '" stroke-width="3" stroke-linecap="round"/>');
    s.push('<text x="' + (XC - 14) + '" y="' + (M_T + 68) + '" font-size="10.5" fill="' + C.in_ + '" text-anchor="end">巻線</text>');
    k.term(MX1 - 14, Y_MC, 'C', 'l');
    /* 軸＝回っていれば回る（第3回のピニオンと同じ流儀）。箱の【右外】に置く＝濃い地に濃い字で沈むのを避ける。 */
    s.push('<g' + (run ? ' class="spin"' : '') + ' style="transform-origin:244px ' + (M_T + 50) + 'px">'
      + '<circle cx="244" cy="' + (M_T + 50) + '" r="13" fill="' + C.in_ + '" stroke="' + C.deep + '" stroke-width="2.5"/>'
      + '<path d="M244,' + (M_T + 37) + ' L244,' + (M_T + 63) + ' M231,' + (M_T + 50) + ' L257,' + (M_T + 50) + '" stroke="' + C.deep + '" stroke-width="2.5"/></g>');
    s.push('<text x="244" y="' + (M_T + 82) + '" font-size="10" fill="' + C.sub + '" text-anchor="middle">軸</text>');

    /* モーターのアース＝回っているときだけ黄点が流れる（帰り道） */
    k.term(XC, M_B + 8, '31', 'l');
    if (m.cut === 'w13-06') cutV(XC, M_B, GM, 'w13-06'); else seg(XC, M_B, XC, GM, 'w13-06');
    k.ground(XC, GM, null);
    s.push('<text x="' + XC + '" y="' + SM + '" font-size="11" font-weight="700" text-anchor="middle" fill="'
      + (run ? '#2f7d4f' : C.hi) + '">' + (run ? '動いている' : '動かない') + '</text>');

    /* 色の凡例＝線と重ならない図の外（アースの下）に置く。 */
    label(4, 754, 'アースは NERO（黒）。⚠️青／白の1本だけ、D型では', C.sub, null, 10);
    label(4, 768, 'BIANCO（白）。⚠️この絵は F・L・R型のつなぎ方です。', C.sub, null, 10);

    /* 場面ごとの札。1つの絵に1枚まで＝上半分の空きに出す。
       ⚠️F2 の札は【左の余白】へ＝ヒューズの名札に乗るため。 */
    if (m.f2) chip(4, FZ + 26, 'F2 が切れた');
    /* ⛔固着の場面に赤い札を出さない＝「→ ウインカー（第10回）」の枝ラベルに乗る（bbox-check はゼロでも、
       スクリーンショットで見ると重なっていた＝その97「画面の見え方は実機のスクショが正本」）。
       第7回のブレーキランプと同じ流儀で、スイッチの箱の【外・右】に短く置く。 */
    if (m.stuck) label(218, SW_T + 30, '⚠️固着', C.hi, null, 11.5);

    /* 絵の中のスイッチを直接押せるようにする＝透明な当たり判定の板を、いちばん最後に（＝いちばん上に）重ねる。
       fill="transparent" にする（"none" だとクリックが素通りする）。主図のときだけ描く。 */
    if (m.main) {
      for (var j = 0; j < 2; j++) {
        var hx = SWX1 + 45 + j * 70;
        s.push('<rect class="hit" x="' + (hx - 30) + '" y="' + (SW_T + 38) + '" width="60" height="32" rx="6" fill="transparent" data-set="'
          + STEP[j][0] + '"><title>ワイパースイッチを' + STEP[j][1] + 'にする</title></rect>');
      }
    }

    function warn(a, b) {
      k.label(4, 794, a, C.hi, null, 10.5);
      if (b) k.label(4, 808, b, C.hi, null, 10.5);
      return b ? 820 : 806;
    }
    if (m.cut === 'w13-03') return warn('⚠️スイッチからモーターへ行く1本が外れている。スイッチを', '　 入にしても、モーターへは電気が届かない。');
    if (m.cut === 'w13-06') return warn('⚠️モーターの【アース】が外れている。電気は来ているのに、', '　 帰り道が無いので回らない。');
    if (m.f2) return warn('⚠️F2 が切れると、ワイパーもブレーキランプもウインカーも', '　 同時に死ぬ。');
    if (m.off) return warn('⚠️キーがOFF＝これは故障ではない。');
    if (m.stuck) return warn('⚠️スイッチを切ったのに、接点が戻っていない。モーターは', '　 回り続ける。');
    return 784;
  }

  /* ---- トグル（入／切）＝キーはONで固定（F2 の先だから） ---- */
  var CAPS = {
    ON: '<b>ワイパースイッチを入にしました。</b>ヒューズ F2 →スイッチ →モーター →車体アース、と黄色い点が一周しています。⭐<b>スイッチの真下へは2本降りていますが、回しているのは右の1本（青）だけ</b>です。左の1本（青／白）は<b>切ったあとに使われる線</b>で、⚠️<b>この絵ではいつも薄いまま</b>です（下の注記）。',
    OFF: '<b>ワイパースイッチを切りました。</b>モーターは止まります。⭐<b>それでも、いちばん左を降りている1本（青／黒）の色が消えていないことに注目してください</b>——<b>キーが入っている間、モーターの端子には電気が来たまま</b>です。<b>スイッチを通らずに、ヒューズから直接つながっている1本</b>があるからです。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function get(sc, id) { for (var i = 0; i < sc.r.loads.length; i++) if (sc.r.loads[i].id === id) return sc.r.loads[i].on; return false; }
  function stopL(sc) { return get(sc, 'stop_l'); }
  function hornOn(sc) { return get(sc, 'horn'); }
  function turnFL(sc) { return get(sc, 'turn_fl'); }
  var MW = ['動く', '動かない'];      /* このストーリーの主役はモーター＝共通ランタイムの既定語（点く/消える）は使えない */
  var LW = ['点く', '点かない'], HW = ['鳴る', '鳴らない'];
  var ON = { key: 'ON', wiper: 'ON' };
  function cut(id) { return [{ op: 'removeWire', id: id }]; }
  var CHECKS = [
    { label: 'キーON・スイッチを入にする', s: { inputs: ON }, expect: true, words: MW },
    { label: 'キーON・スイッチは切', s: { inputs: { key: 'ON', wiper: 'OFF' } }, expect: false, words: MW },
    { label: 'キーOFFでスイッチを入にする', s: { inputs: { key: 'OFF', wiper: 'ON' } }, expect: false, words: MW },
    /* ⭐F2 の3人目＝ブレーキランプ・ウインカーと同じヒューズ */
    { label: 'F2 が切れた', s: { inputs: { key: 'ON', wiper: 'ON', f2: 'BLOWN' } }, expect: false, words: MW },
    { label: '↑同じ場面でブレーキを踏む（ブレーキランプも死ぬ）', s: { inputs: { key: 'ON', wiper: 'ON', f2: 'BLOWN', brake: 'PRESSED' } }, expect: false, read: stopL, words: LW },
    { label: '↑同じ場面でウインカーを倒す（ウインカーも死ぬ）', s: { inputs: { key: 'ON', wiper: 'ON', f2: 'BLOWN', turn: 'LEFT' } }, expect: false, read: turnFL, words: LW },
    { label: '↑同じ場面でホーンは鳴る（別のヒューズ F1）', s: { inputs: { key: 'ON', wiper: 'ON', f2: 'BLOWN', horn_btn: 'PRESSED' } }, expect: true, read: hornOn, words: HW },
    { label: 'F1 が切れてもワイパーは動く（ホーンだけ死ぬ）', s: { inputs: { key: 'ON', wiper: 'ON', f1: 'BLOWN' } }, expect: true, words: MW },
    /* 1本ずつ外す＝動く／動かないが分かれる4本 */
    { label: 'F2 からスイッチへの1本（w13-01）が外れた', s: { inputs: ON, ops: cut('w13-01') }, expect: false, words: MW },
    { label: 'スイッチからモーターへの1本（w13-03）が外れた', s: { inputs: ON, ops: cut('w13-03') }, expect: false, words: MW },
    { label: 'モーターのアース（w13-06）が外れた', s: { inputs: ON, ops: cut('w13-06') }, expect: false, words: MW },
    /* ⭐オートストップ側の3本＝【入にしている間は使われない】＝外れても動く */
    { label: 'F2 からモーター C への1本（w13-02）が外れた（入のあいだは動く）', s: { inputs: ON, ops: cut('w13-02') }, expect: true, words: MW },
    { label: 'スイッチからモーター F への1本（w13-04）が外れた（同上）', s: { inputs: ON, ops: cut('w13-04') }, expect: true, words: MW },
    { label: 'スイッチのアース（w13-05）が外れた（同上）', s: { inputs: ON, ops: cut('w13-05') }, expect: true, words: MW },
    /* ⭐もう一方の症状＝スイッチが固着して止まらない */
    { label: 'スイッチが固着・切にしている', s: { inputs: { key: 'ON', wiper: 'OFF' }, override: { wiper_sw: 'ON' } }, expect: true, words: MW },
    { label: '↑同じ固着のままキーを抜く（止まる）', s: { inputs: { key: 'OFF', wiper: 'OFF' }, override: { wiper_sw: 'ON' } }, expect: false, words: MW },
    /* 全体が落ちる場面 */
    { label: 'バッテリーのマイナス端子（w11-10）が外れた', s: { inputs: ON, ops: cut('w11-10') }, expect: false, words: MW },
    { label: 'オルタネーター換装車・スイッチを入にする', s: { alt: true, inputs: ON }, expect: true, words: MW }
  ];

  Journey.boot({
    /* 症状の絵（アイキャッチ）の下敷き＝実車の上面線図をそのまま敷く。前が上・画面左が車の左になるよう90度回す。
       ⚠️ワイパーと窓は HTML 側に静的に置いてある＝ここで足すのは輪郭だけ（JS が動かなくても絵は読める）。
       ⛔この図に部品の印（carmap の marks）は打たない＝ワイパーの位置は wiring-layout.json の実測値ではない。 */
    carfig: { id: 'carfig', transform: 'translate(1366.3,0) rotate(90)' },
    lampId: 'wiper_motor',
    lampName: 'ワイパーモーター',
    alt: false,
    mainInit: 'ON',
    /* キーは ON のまま＝この回路が F2 の先にいることは、キーOFFの検算と本文で受ける */
    mainInputs: function (v) { return { key: 'ON', wiper: v }; },
    /* 黄点の向き。⚠️既定（主役の負荷だけを見る）で足りるが、【流れない3本】は明示的に止める。 */
    flow: function (sc, id) {
      /* ⭐⭐切っていても電位は来ている1本＝ただしモーターの中へは入らない（内部のカム接点を持たないため）。
         💡「電位が来ている（live）」と「流れている（flow）」は別＝粒は後者でしか出さない（HANDOFF その93）。 */
      if (id === 'w13-02') return null;
      /* オートストップ側の1本＝つながっていることしか表せない */
      if (id === 'w13-04') return null;
      /* スイッチ自身のアース＝同上（第10回のフラッシャーのアースと同じ扱い） */
      if (id === 'w13-05') return null;
      /* ⚠️ブレーキランプへの枝は【踏んでいない】・ウインカーへの枝は【中立】＝電位は来ているが流れていない */
      if (id === 'w06-02' || id === 'w04-01') return null;
      return sc.lampOn ? 'down' : null;
    },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* ★①キーがOFF＝これは故障ではない（最初に潰す迷い道） */
        { id: 'j-off', sc: scenario({ inputs: { key: 'OFF', wiper: 'ON' } }), mode: { off: true } },
        /* ★②F2 が切れた＝ワイパーもブレーキランプもウインカーも死ぬ */
        { id: 'j-f2', sc: scenario({ inputs: { key: 'ON', wiper: 'ON', f2: 'BLOWN' } }), mode: { f2: true } },
        /* ★③スイッチからモーターへの1本が外れた */
        { id: 'j-cut3', sc: scenario({ inputs: ON, ops: [{ op: 'removeWire', id: 'w13-03' }] }), mode: { cut: 'w13-03' } },
        /* ★④モーターのアースが外れた＝電気は来ているのに回らない */
        { id: 'j-gnd', sc: scenario({ inputs: ON, ops: [{ op: 'removeWire', id: 'w13-06' }] }), mode: { cut: 'w13-06' } },
        /* ★⑤もう一方の症状＝スイッチが固着して止まらない */
        { id: 'j-stuck', sc: scenario({ inputs: { key: 'ON', wiper: 'OFF' }, override: { wiper_sw: 'ON' } }), mode: { stuck: true } },
        { id: 'j-fixed', sc: scenario({ inputs: ON }), mode: {} }
      ];
    }
  });
})();
