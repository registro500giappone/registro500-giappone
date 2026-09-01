/* ストーリー第10回「ウインカーが点かない」の絵。図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。
   このストーリーだけの特徴が4つある。①【左右に分かれるのはレバーの中】＝フラッシャーからレバーまでは左右共通の1本で、
   ここが切れると左右とも死ぬ。②【前と横は1本、後ろは別の1本】＝サイドウインカーは前の灯のところで分かれる渡りで、
   後ろへはレバーから別に1本降りる。だから「前と横は消えたのに後ろだけ点く」「前は消えたのに横は点く」が起こる。
   ③【表示灯はフラッシャーの P ひとつだけ】＝左右どちらに倒しても同じ1個が光る＝表示灯では左右を切り分けられない。
   ④【F2 の先＝第7回のブレーキランプと同じヒューズ】＝「ブレーキランプもウインカーも死んだ」なら F2 一本で説明が付く。
   ⚠️⚠️この絵はレバーを倒すとフラッシャーが繋がるように描いてあるが、実物はそうではない（熱式＝電流が流れると自分で断続する）。
   L1 は断続の時間軸を持たないための近似で、正しく出るのは【点くか点かないか】まで。本文の「しくみ」で必ず断ること。
   ⛔`w04-02`（フラッシャー→レバー）を切る場面は【絵にしない】＝L1 では表示灯だけが点いたまま残るが、
   実物の熱式フラッシャーが負荷の切れた状態でどう振る舞うかは原典から断定できない（HANDOFF その124③）。検算表で灯だけを読む形にとどめる。
   ⭐後ろへ降りる線（x=26／274）は灯の列より【外側】を通す＝前の灯から横の灯への渡り（y=672・x=58..110）と交差しない。
   ⛔灯の隙間へ戻さない＝初版はそこを通していて渡りを跨いでいた（オーナー指摘・2026-09-01）。跨ぎは「繋がっている」と誤読される。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;

  var XC = 120;                       /* 幹線（バッテリー〜キー〜F2〜フラッシャー〜レバー） */
  var KT = 112;                       /* キースイッチの箱の上端（高さ48） */
  var FZ = 200;                       /* ヒューズ F2 の上端（下端は +62） */
  var Y_BR = 284;                     /* F2 の負荷側から出るブレーキランプへの枝 */
  var FL_T = 316, FL_B = 392;         /* フラッシャーの箱 */
  var FLX1 = 70, FLX2 = 170;
  var IND_X = 240, IND_T = 384;       /* 計器盤の中の表示灯 */
  var LV_T = 480, LV_B = 618;         /* ウインカーレバーの箱 */
  var LVX1 = 34, LVX2 = 206;
  var Y_BK = 640;                     /* 後ろの灯へ分かれる高さ（レバーの端子で分かれる） */
  var Y_CR = 672;                     /* 前の灯 →横の灯への渡り（前の灯の【直上】＝ここが分岐点） */
  /* 灯の列。前と横の渡りは 52px＝⭐32px 未満の線には黄点が1つも入らない（HANDOFF その111） */
  var XLS = 58, XLF = 110, XRF = 190, XRS = 242;   /* 左横・左前・右前・右横 */
  var XLR = 26, XRR = 274;                          /* 後ろへ降りる縦チャンネル＝灯の列の【外側】（冒頭のコメント） */
  var F_T = 700, LH = 42, GF = 778, SF = 806;       /* 前の列＝灯・アース記号・状態の語 */
  var R_T = 826, GR = 904, SR = 932;                /* 後ろの列 */

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    var keyOn = pos.ign_sw === 'ON';
    var blown = pos.f2 === 'BLOWN';
    var lever = pos.turn_sw;                        /* OFF / LEFT / RIGHT */
    var fl = pos.flasher;                           /* REST / WORK / DEAD */
    var m = mode || {};
    var on = sc.on || {};

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
    /* ×印だけを打つ小道具（第7回と同じ）。この絵の下半分は文字の逃げ場が無いので、
       「どこが外れているか」は図の下の注記行が言う。 */
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

    /* ===== 灯 ===== 前の灯（部品1）は車幅灯と同じケース・後ろ（部品34）は3球1ケース＝ケースの話は本文が持つ。
       レンズの色は書かない＝原典から断定できない（型式・年式で違う）。 */
    function turnLamp(cx, top, name, lit) {
      var hw = 21;
      if (lit) s.push('<g class="lampglow"><ellipse cx="' + cx + '" cy="' + (top + LH / 2) + '" rx="' + (hw + 17) + '" ry="32" fill="url(#jturng)"/></g>');
      s.push('<rect x="' + (cx - hw) + '" y="' + top + '" width="42" height="' + LH + '" rx="9" fill="' + (lit ? '#ff9a14' : '#6b5c46') + '" stroke="' + (lit ? '#ffd48a' : '#8d8574') + '" stroke-width="' + (lit ? 3 : 2) + '"/>');
      if (lit) s.push('<rect x="' + (cx - hw + 6) + '" y="' + (top + 5) + '" width="30" height="8" rx="4" fill="#fff" opacity=".32"/>');
      s.push('<text x="' + cx + '" y="' + (top + 27) + '" font-size="11.5" font-weight="700" fill="' + (lit ? '#fffdf8' : '#cdc7b8') + '" text-anchor="middle">' + name + '</text>');
    }
    /* 状態の語はアース記号の【下】に置く＝灯の下はアース線が通っている（第9回と同じ作法）。 */
    function state(cx, y, lit) {
      s.push('<text x="' + cx + '" y="' + y + '" font-size="10" font-weight="700" text-anchor="middle" fill="'
        + (lit ? '#2f7d4f' : C.hi) + '">' + (lit ? '点いている' : '点かない') + '</text>');
    }
    /* ===== 計器盤の中の【緑の】表示灯 ===== 共通の lampWindow は赤（警告灯）専用＝この灯は警告ではなく
       【出していることの確認】なので緑で描く（第9回の greenInd と同じ流儀）。電球アイコンも点滅も足さない。 */
    function greenInd(cx, top, lit) {
      var hw = lit ? 30 : 27, hh = lit ? 30 : 26;
      if (lit) {
        s.push('<defs><radialGradient id="jturnind">'
          + '<stop offset="0%" stop-color="#5fd48a" stop-opacity=".95"/>'
          + '<stop offset="45%" stop-color="#2f7d4f" stop-opacity=".45"/>'
          + '<stop offset="100%" stop-color="#2f7d4f" stop-opacity="0"/></radialGradient></defs>');
        s.push('<g class="lampglow"><ellipse cx="' + cx + '" cy="' + (top + 14) + '" rx="52" ry="34" fill="url(#jturnind)"/></g>');
      }
      s.push('<rect x="' + (cx - hw) + '" y="' + top + '" width="' + (hw * 2) + '" height="' + hh + '" rx="6" fill="' + (lit ? '#2f9d5f' : '#eae4d5') + '" stroke="' + (lit ? '#b8f0cd' : '#c3bba6') + '" stroke-width="' + (lit ? 3 : 2) + '"/>');
      if (lit) s.push('<rect x="' + (cx - hw + 5) + '" y="' + (top + 3) + '" width="' + (hw * 2 - 10) + '" height="8" rx="4" fill="#fff" opacity=".3"/>');
      s.push('<text x="' + cx + '" y="' + (top + (lit ? 21 : 19)) + '" font-size="11.5" font-weight="700" fill="' + (lit ? '#fffdf8' : '#a89f8b') + '" text-anchor="middle">緑</text>');
    }

    if (on.fl || on.fr || on.sl || on.sr || on.rl || on.rr) {
      s.push('<defs><radialGradient id="jturng">'
        + '<stop offset="0%" stop-color="#ffc76a" stop-opacity=".92"/>'
        + '<stop offset="45%" stop-color="#ff9a14" stop-opacity=".44"/>'
        + '<stop offset="100%" stop-color="#ff9a14" stop-opacity="0"/></radialGradient></defs>');
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
    /* ⚠️線は【箱の底】KT+48 から出す（共通 k.keySwitch の箱は高さ48）。端子バッジは KT+62 のままでよい。 */
    seg(XC, KT + 48, XC, FZ, 'w06-01');
    label(XC + 14, 186, 'AZZURRO 青', WC.AZZURRO, null, 11);

    /* ===== ヒューズ F2＝キーONのときだけ生きる（第7回と同じ1本） ===== */
    k.fuseV(XC, FZ, blown, 'ヒューズ F2');
    s.push('<text x="' + (XC + 24) + '" y="' + (FZ + 58) + '" font-size="10" fill="' + C.sub + '">キーONのときだけ生きる</text>');

    /* ===== F2 の負荷側＝ここから2方向 ===== フラッシャーへ／ブレーキランプへ（第7回の道）。
       枝を実線で描くのは、F2 が切れたときに枝も一緒に死ぬのが見えるため。 */
    seg(XC, FZ + 62, XC, FL_T, 'w04-01');
    k.node(XC, Y_BR);
    segH(XC, Y_BR, 196, 'w06-02');
    label(134, Y_BR - 9, '→ ブレーキランプ（第7回）', C.sub, null, 10);
    /* ⚠️x は 150 から＝XC+14 だと「+」の端子バッジ（129..146）に乗る（bbox-check で 6.6×11.4 の重なり） */
    label(150, 310, 'AZZURRO E NERO 青／黒', WC['AZZURRO E NERO'], null, 10.5);

    /* ===== フラッシャー ===== 中に接点の絵を描かない＝【レバーが接点を動かしている】と読めてしまう。
       実物は熱で自分から断続する部品なので、状態の語だけを置く。 */
    s.push('<rect x="' + FLX1 + '" y="' + FL_T + '" width="' + (FLX2 - FLX1) + '" height="' + (FL_B - FL_T) + '" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="' + XC + '" y="' + (FL_T + 20) + '" font-size="12" fill="#fffdf8" text-anchor="middle">フラッシャー</text>');
    s.push('<text x="' + XC + '" y="' + (FL_T + 34) + '" font-size="10" fill="' + C.in_ + '" text-anchor="middle">（部品8）</text>');
    var flw = (fl === 'WORK'), fld = (fl === 'DEAD');
    /* ⚠️⚠️レバーの位置だけで状態語を決めると【F2 が切れた場面でも「点滅を作っている」】と書いてしまう＝絵が嘘をつく。
       電気が来ているか（w04-01 が生きているか）も併せて見る。⛔赤は「切れている場所」ただ1つ（ここでは F2 の管）に取ってあるので、
       電気が来ていないときの状態語は赤にしない。 */
    var flPow = k.wcol('w04-01').live;
    var flTxt = fld ? '働かない' : (!flPow ? '電気が来ていない' : (flw ? '点滅を作っている' : '休んでいる'));
    s.push('<text x="' + XC + '" y="' + (FL_T + 60) + '" font-size="11.5" font-weight="700" text-anchor="middle" fill="'
      + (fld ? C.hi : (flw && flPow ? '#7fd6a0' : C.in_)) + '">' + flTxt + '</text>');
    k.term(XC, 304, '+', 'r');

    /* フラッシャー自身のアース。⚠️黄点は出さない＝L1 は部品の内部の導通を持たないので、
       この線について「流れている」とは言えない（線がつながっていることしか表せない）。 */
    segH(FLX1, 366, 26, 'w04-04');
    seg(26, 366, 26, 402, 'w04-04');
    k.term(26, 384, '31', 'r');
    k.ground(26, 402, null);

    /* フラッシャー →表示灯。⭐出口は P ひとつだけ＝左右どちらに倒しても同じ1個が光る。 */
    segH(FLX2, 348, IND_X, 'w04-03');
    seg(IND_X, 348, IND_X, IND_T, 'w04-03');
    k.term(IND_X, 366, 'P', 'l');
    greenInd(IND_X, IND_T, !!on.ind);
    /* ⚠️灯の【真下】に置くとアース線（x=IND_X）が文字を貫く＝bbox-check は文字どうししか見ないので出ない。左へ寄せる。 */
    label(206, IND_T + 44, '計器盤の中', C.sub, 'end', 10.5);
    seg(IND_X, IND_T + 30, IND_X, 450, 'w04-05');
    k.ground(IND_X, 450, null);
    state(IND_X, 478, !!on.ind);

    /* ===== フラッシャー →ウインカーレバー ===== ⭐左右共通の1本。ここが切れると左右とも死ぬ。 */
    seg(XC, FL_B, XC, LV_T, 'w04-02');
    k.term(XC, 406, 'L', 'r');
    k.term(XC, 468, 'L', 'l');
    label(4, 438, 'BIANCO E NERO 白／黒', C.sub, null, 10.5);

    /* ===== ウインカーレバー ===== ⭐実車の動く向きと画面の並びを合わせる＝上が「上へ倒す＝右」。 */
    s.push('<rect x="' + LVX1 + '" y="' + LV_T + '" width="' + (LVX2 - LVX1) + '" height="' + (LV_B - LV_T) + '" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="' + XC + '" y="' + (LV_T + 19) + '" font-size="12" fill="#fffdf8" text-anchor="middle">ウインカーレバー</text>');
    s.push('<text x="' + XC + '" y="' + (LV_T + 33) + '" font-size="10" fill="' + C.in_ + '" text-anchor="middle">（部品12・3つの位置）</text>');
    var STEP = [['RIGHT', '上へ＝右', '上へ倒す＝右'], ['OFF', '中立', '戻す（中立）'], ['LEFT', '下へ＝左', '下へ倒す＝左']];
    /* ⭐ボタンの列ではなく【レバーそのもの】を描く＝支点から棒が上・中立・下へ倒れる（第8回のコラムレバーと同じ流儀）。
       ⛔箱の中に接点の丸を打たない＝レバーの中の接点は原典に描かれていない（連携用の chain でも v:inf にしてある）。 */
    /* ⭐軸は右・レバーは【左へ】出る＝実車どおり（ステアリングコラムから左へ生えている。2026-09-01 オーナー指摘） */
    var PVX = LVX2 - 26, PVY = LV_T + 92, TIPX = LVX2 - 104, TILT = 30;
    var tipY = PVY + (lever === 'RIGHT' ? -TILT : lever === 'LEFT' ? TILT : 0);
    for (var i = 0; i < 3; i++) {
      var gy = PVY + (i - 1) * TILT, cur = (lever === STEP[i][0]);
      /* 倒せる先の目印は薄い輪郭だけ＝⛔押せる場所を常時光らせない（押せることは本文の一言で断る） */
      if (!cur) s.push('<circle cx="' + TIPX + '" cy="' + gy + '" r="6" fill="none" stroke="' + C.in_ + '" stroke-width="1.4" opacity=".45"/>');
      s.push('<text x="' + (LVX1 + 10) + '" y="' + (gy + 4) + '" font-size="10.5" font-weight="' + (cur ? '700' : '400') + '" fill="' + C.in_ + '" text-anchor="start"' + (cur ? '' : ' opacity=".55"') + '>' + STEP[i][1] + '</text>');
    }
    s.push('<path d="M' + PVX + ',' + PVY + ' L' + TIPX + ',' + tipY + '" stroke="' + C.in_ + '" stroke-width="5" stroke-linecap="round"/>');
    s.push('<circle cx="' + PVX + '" cy="' + PVY + '" r="7" fill="' + C.deep + '" stroke="' + C.in_ + '" stroke-width="2"/>');
    s.push('<circle cx="' + TIPX + '" cy="' + tipY + '" r="7.5" fill="' + C.in_ + '"/>');

    /* ===== 左回路（端子2）===== 前へ1本・後ろへ1本。横は【前の灯のところで分かれる渡り】。 */
    if (m.cut === 'w04-06') { seg(XLF, LV_B, XLF, Y_BK, 'w04-06'); cutV(XLF, Y_BK, Y_CR, 'w04-06'); seg(XLF, Y_CR, XLF, F_T, 'w04-06'); }
    else seg(XLF, LV_B, XLF, F_T, 'w04-06');
    k.term(XLF, 630, '2', 'l');
    k.node(XLF, Y_BK);
    segH(XLF, Y_BK, XLR, 'w04-08');
    seg(XLR, Y_BK, XLR, R_T, 'w04-08');
    k.node(XLF, Y_CR);
    segH(XLF, Y_CR, XLS, 'w04-07');
    seg(XLS, Y_CR, XLS, F_T, 'w04-07');

    /* ===== 右回路（端子5）===== 左と同じ作り。 */
    seg(XRF, LV_B, XRF, F_T, 'w04-09');
    k.term(XRF, 630, '5', 'r');
    k.node(XRF, Y_BK);
    segH(XRF, Y_BK, XRR, 'w04-11');
    seg(XRR, Y_BK, XRR, R_T, 'w04-11');
    k.node(XRF, Y_CR);
    segH(XRF, Y_CR, XRS, 'w04-10');
    seg(XRS, Y_CR, XRS, F_T, 'w04-10');

    /* ===== 前の列と横の列 ===== */
    turnLamp(XLS, F_T, '左横', !!on.sl);
    turnLamp(XLF, F_T, '左前', !!on.fl);
    turnLamp(XRF, F_T, '右前', !!on.fr);
    turnLamp(XRS, F_T, '右横', !!on.sr);
    if (m.cut === 'w04-12') cutV(XLF, F_T + LH, GF, 'w04-12'); else seg(XLF, F_T + LH, XLF, GF, 'w04-12');
    seg(XLS, F_T + LH, XLS, GF, 'w04-13');
    seg(XRF, F_T + LH, XRF, GF, 'w04-15');
    seg(XRS, F_T + LH, XRS, GF, 'w04-16');
    k.ground(XLS, GF, null); k.ground(XLF, GF, null); k.ground(XRF, GF, null); k.ground(XRS, GF, null);
    state(XLS, SF, !!on.sl); state(XLF, SF, !!on.fl); state(XRF, SF, !!on.fr); state(XRS, SF, !!on.sr);

    /* ===== 後ろの列 ===== */
    turnLamp(XLR, R_T, '左後', !!on.rl);
    turnLamp(XRR, R_T, '右後', !!on.rr);
    seg(XLR, R_T + LH, XLR, GR, 'w04-14');
    seg(XRR, R_T + LH, XRR, GR, 'w04-17');
    k.ground(XLR, GR, null); k.ground(XRR, GR, null);
    state(XLR, SR, !!on.rl); state(XRR, SR, !!on.rr);

    /* 色の凡例＝線と重ならない図の外（アースの下）に置く。左右で色が違うのは原典どおり。 */
    label(4, 954, '左へ行く線＝AZZURRO E NERO（青／黒）', C.sub, null, 10);
    label(4, 968, '右へ行く線＝AZZURRO（青）／アースは NERO（黒）', C.sub, null, 10);

    /* 場面ごとの札。1つの絵に1枚まで＝上半分の空きに出す。 */
    /* ⚠️F2 の札は【左の余白】へ＝ヒューズの名札（144..216）と「切れている」に乗る。
       ⛔フラッシャーが働かない場面には札を出さない＝文言が図幅300 に入らない（146px）うえ、
       箱の中の状態語がすでに赤で「働かない」と言っている。 */
    /* ⛔中立の場面に札を出さない＝赤は「切れている場所」ただ1つに取ってある。中立は故障ではないうえ、
       レバーが水平に描かれ、箱の中の「中立」も太字になるので札は要らない（2026-09-01・レバーを絵にしたときに削除）。 */
    if (m.f2) chip(4, FZ + 26, 'F2 が切れた');

    /* 絵の中のレバーを直接押せるようにする＝透明な当たり判定の板を、いちばん最後に（＝いちばん上に）重ねる。
       fill="transparent" にする（"none" だとクリックが素通りする）。主図のときだけ描く＝紙芝居のコマに押せる板を置くと、押しても何も起きず読者を惑わす。 */
    if (m.main) {
      for (var j = 0; j < 3; j++) {
        s.push('<rect class="hit" x="' + (LVX1 + 4) + '" y="' + (PVY + (j - 1) * TILT - 15) + '" width="' + (LVX2 - LVX1 - 8)
          + '" height="30" rx="6" fill="transparent" data-set="' + STEP[j][0] + '"><title>ウインカーレバーを' + STEP[j][2] + '</title></rect>');
      }
    }

    function warn(a, b) {
      k.label(4, 990, a, C.hi, null, 10.5);
      if (b) k.label(4, 1004, b, C.hi, null, 10.5);
      return b ? 1016 : 1002;
    }
    if (m.cut === 'w04-06') return warn('⚠️レバーから【左の前】へ行く1本が外れている。前も横も消えて、', '　 後ろだけが残る＝横へは前の灯のところで分かれているから。');
    if (m.cut === 'w04-12') return warn('⚠️左前の灯の【アース】だけが外れている。横も後ろも点いたまま。');
    if (m.f2) return warn('⚠️F2 が切れると、ウインカーもブレーキランプも同時に死ぬ。');
    if (m.dead) return warn('⚠️フラッシャーが働かないと、レバーを倒しても6つとも点かない。', '　 表示灯（緑）も点かない。');
    if (m.off) return warn('⚠️レバーが中立＝これは故障ではない。');
    return 980;
  }

  /* ---- トグル（レバー 上＝右／中立／下＝左）＝キーはONで固定（F2 の先だから） ---- */
  var CAPS = {
    RIGHT: '<b>ウインカーレバーを上へ倒しました＝右。</b>右の前・右の横・右の後ろ——<b>3つが一組で光ります</b>。左の3つは消えたまま。計器盤の緑も点いていますが、<b>この緑は左に倒しても同じように点きます</b>（あとで効いてきます）。',
    /* ⚠️「レバーの中で切れている」と書かない＝この絵は近似のため【フラッシャーのところで切れている】ように描かれる（本文の注記で断ってある）。 */
    OFF: '<b>ウインカーレバーは戻したまま（中立）。</b>ヒューズ F2 からフラッシャーまでは電気が来ていますが、<b>その先へは渡っていません</b>。<b>6つとも消えているのが正常</b>です。ハンドルを戻すと、ウインカーレバーはここへ自分で帰ってきます。',
    LEFT: '<b>ウインカーレバーを下へ倒しました＝左。</b>左の前・左の横・左の後ろの3つと、計器盤の緑が点きます。⭐<b>左右に分かれているのはレバーの中だけ</b>——それより上（フラッシャーまで）は<b>左右共通の1本</b>です。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function get(sc, id) { for (var i = 0; i < sc.r.loads.length; i++) if (sc.r.loads[i].id === id) return sc.r.loads[i].on; return false; }
  function fr(sc) { return get(sc, 'turn_fr'); }
  function sl(sc) { return get(sc, 'side_l'); }
  function sr(sc) { return get(sc, 'side_r'); }
  function rl(sc) { return get(sc, 'turn_rl'); }
  function rr(sc) { return get(sc, 'turn_rr'); }
  function ind(sc) { return get(sc, 'turn_ind'); }
  function stopL(sc) { return get(sc, 'stop_l'); }
  function hornOn(sc) { return get(sc, 'horn'); }
  var LW = ['点く', '点かない'], GW = ['点く', '消える'], HW = ['鳴る', '鳴らない'];
  var L = { key: 'ON', turn: 'LEFT' }, R = { key: 'ON', turn: 'RIGHT' };
  function cut(id) { return [{ op: 'removeWire', id: id }]; }
  var CHECKS = [
    /* 左右が分かれるのはレバーの中＝倒した側の3つだけが点く */
    { label: 'キーON・ウインカーレバーを下へ倒す＝左（左前）', s: { inputs: L }, expect: true, words: LW },
    { label: '↑同じ場面の左横', s: { inputs: L }, expect: true, read: sl, words: LW },
    { label: '↑同じ場面の左後', s: { inputs: L }, expect: true, read: rl, words: LW },
    { label: '↑同じ場面の右前（消えたまま）', s: { inputs: L }, expect: false, read: fr, words: LW },
    { label: '↑同じ場面の表示灯（緑）', s: { inputs: L }, expect: true, read: ind, words: GW },
    { label: 'ウインカーレバーを上へ倒す＝右（右前）', s: { inputs: R }, expect: true, read: fr, words: LW },
    { label: '↑同じ場面の右後', s: { inputs: R }, expect: true, read: rr, words: LW },
    { label: '↑同じ場面の左前（消えたまま）', s: { inputs: R }, expect: false, words: LW },
    { label: '↑同じ場面の表示灯（左と同じ1個が点く）', s: { inputs: R }, expect: true, read: ind, words: GW },
    { label: 'ウインカーレバーが中立（左前）', s: { inputs: { key: 'ON', turn: 'OFF' } }, expect: false, words: LW },
    /* キーOFF＝ヒューズ F2 の先だから点かない（第7回のブレーキランプと同じ） */
    { label: 'キーOFFでウインカーレバーを倒す（左前）', s: { inputs: { key: 'OFF', turn: 'LEFT' } }, expect: false, words: LW },
    { label: '↑同じ場面の表示灯', s: { inputs: { key: 'OFF', turn: 'LEFT' } }, expect: false, read: ind, words: GW },
    /* F2＝ブレーキランプと同じヒューズ */
    { label: 'F2 が切れた（左前）', s: { inputs: { key: 'ON', turn: 'LEFT', f2: 'BLOWN' } }, expect: false, words: LW },
    { label: '↑同じ場面の表示灯', s: { inputs: { key: 'ON', turn: 'LEFT', f2: 'BLOWN' } }, expect: false, read: ind, words: GW },
    { label: '↑同じ場面でブレーキを踏む（ブレーキランプも死ぬ）', s: { inputs: { key: 'ON', turn: 'LEFT', f2: 'BLOWN', brake: 'PRESSED' } }, expect: false, read: stopL, words: LW },
    { label: '↑同じ場面でホーンは鳴る（別のヒューズ F1）', s: { inputs: { key: 'ON', turn: 'LEFT', f2: 'BLOWN', horn_btn: 'PRESSED' } }, expect: true, read: hornOn, words: HW },
    /* フラッシャーが働かない＝左右とも、表示灯まで死ぬ */
    { label: 'フラッシャーが働かない（左前）', s: { inputs: L, override: { flasher: 'DEAD' } }, expect: false, words: LW },
    { label: '↑同じ場面の表示灯', s: { inputs: L, override: { flasher: 'DEAD' } }, expect: false, read: ind, words: GW },
    /* ⭐左右共通の1本＝ここが切れると左右とも死ぬ（絵にはしない＝この場面では表示灯だけが残り、実物の振る舞いを断定できない） */
    { label: 'フラッシャーからウインカーレバーへの1本（w04-02）が外れた（左前）', s: { inputs: L, ops: cut('w04-02') }, expect: false, words: LW },
    { label: '↑同じ場面で右へ倒しても右前は点かない', s: { inputs: R, ops: cut('w04-02') }, expect: false, read: fr, words: LW },
    /* ⭐前と横は1本・後ろは別の1本 */
    { label: 'ウインカーレバーから左前への1本（w04-06）が外れた（左前）', s: { inputs: L, ops: cut('w04-06') }, expect: false, words: LW },
    { label: '↑同じ場面の左横（前で分かれているので一緒に消える）', s: { inputs: L, ops: cut('w04-06') }, expect: false, read: sl, words: LW },
    { label: '↑同じ場面の左後（別の1本なので残る）', s: { inputs: L, ops: cut('w04-06') }, expect: true, read: rl, words: LW },
    { label: 'ウインカーレバーから左後への1本（w04-08）が外れた（左後）', s: { inputs: L, ops: cut('w04-08') }, expect: false, read: rl, words: LW },
    { label: '↑同じ場面の左前（残る）', s: { inputs: L, ops: cut('w04-08') }, expect: true, words: LW },
    /* ⭐1灯だけのアース外れ＝その灯だけが消える */
    { label: '左前のアース（w04-12）が外れた（左前）', s: { inputs: L, ops: cut('w04-12') }, expect: false, words: LW },
    { label: '↑同じ場面の左横（点いたまま）', s: { inputs: L, ops: cut('w04-12') }, expect: true, read: sl, words: LW },
    { label: '左横のアース（w04-13）が外れた（左横）', s: { inputs: L, ops: cut('w04-13') }, expect: false, read: sl, words: LW },
    { label: '↑同じ場面の左前（点いたまま）', s: { inputs: L, ops: cut('w04-13') }, expect: true, words: LW },
    /* 表示灯への1本だけが外れた＝外の6つは点いたまま */
    { label: '表示灯への1本（w04-03）が外れた（表示灯）', s: { inputs: L, ops: cut('w04-03') }, expect: false, read: ind, words: GW },
    { label: '↑同じ場面の左前（点いたまま）', s: { inputs: L, ops: cut('w04-03') }, expect: true, words: LW },
    /* 右も対称であること＝結線に左右差が無いことの裏取り */
    { label: '右前のアース（w04-15）が外れた（右前）', s: { inputs: R, ops: cut('w04-15') }, expect: false, read: fr, words: LW },
    { label: '↑同じ場面の右横（点いたまま）', s: { inputs: R, ops: cut('w04-15') }, expect: true, read: sr, words: LW },
    /* 全体が落ちる場面 */
    { label: 'バッテリーのマイナス端子（w11-10）が外れた（左前）', s: { inputs: L, ops: cut('w11-10') }, expect: false, words: LW },
    { label: 'オルタネーター換装車・ウインカーレバーを下へ倒す（左前）', s: { alt: true, inputs: L }, expect: true, words: LW }
  ];

  Journey.boot({
    /* 症状の絵（アイキャッチ）の下敷き＝実車の上面線図をそのまま敷く。前が上・画面左が車の左になるよう90度回す。
       ⚠️灯とラベルは HTML 側に静的に置いてある＝ここで足すのは輪郭だけ（JS が動かなくても灯は読める）。
       ⛔この図に部品の印（carmap の marks）は打たない＝灯の位置は wiring-layout.json の実測値ではない。 */
    carfig: { id: 'carfig', transform: 'translate(1366.3,0) rotate(90)' },
    lampId: 'turn_fl',
    lampName: '左前のウインカー',
    alt: false,
    mainInit: 'LEFT',
    /* キーは ON のまま＝この回路が F2 の先にいることは、キーOFFの検算と本文で受ける */
    mainInputs: function (v) { return { key: 'ON', turn: v }; },
    /* 主役以外の6つも場面ごとに拾う */
    extra: function (sc) {
      sc.on = {
        fl: get(sc, 'turn_fl'), fr: get(sc, 'turn_fr'),
        sl: get(sc, 'side_l'), sr: get(sc, 'side_r'),
        rl: get(sc, 'turn_rl'), rr: get(sc, 'turn_rr'),
        ind: get(sc, 'turn_ind')
      };
    },
    /* 黄点の向き。⚠️既定（主役1灯だけを見る）では【右へ倒した場面】で嘘になるので、線ごとに書く。 */
    flow: function (sc, id) {
      var o = sc.on || {};
      var any = o.fl || o.fr || o.sl || o.sr || o.rl || o.rr;
      /* 灯ごとのアース＝その灯が点いているときだけ流れる */
      if (id === 'w04-12') return o.fl ? 'down' : null;
      if (id === 'w04-13') return o.sl ? 'down' : null;
      if (id === 'w04-14') return o.rl ? 'down' : null;
      if (id === 'w04-15') return o.fr ? 'down' : null;
      if (id === 'w04-16') return o.sr ? 'down' : null;
      if (id === 'w04-17') return o.rr ? 'down' : null;
      if (id === 'w04-05') return o.ind ? 'down' : null;
      /* ⚠️フラッシャー自身のアースには流れを出さない＝L1 は部品の内部の導通を持たないので、
         この線について「流れている」とは言えない（つながっていることしか表せない）。 */
      if (id === 'w04-04') return null;
      /* ⚠️ブレーキランプへの枝は【踏んでいない】＝電位は来ているが流れていない */
      if (id === 'w06-02') return null;
      if (id === 'w04-03') return o.ind ? 'down' : null;
      if (id === 'w04-06') return (o.fl || o.sl) ? 'down' : null;
      if (id === 'w04-07') return o.sl ? 'down' : null;
      if (id === 'w04-08') return o.rl ? 'down' : null;
      if (id === 'w04-09') return (o.fr || o.sr) ? 'down' : null;
      if (id === 'w04-10') return o.sr ? 'down' : null;
      if (id === 'w04-11') return o.rr ? 'down' : null;
      /* フラッシャー →レバーの1本は表示灯を通らない＝外の灯だけで判じる */
      if (id === 'w04-02') return any ? 'down' : null;
      /* 幹線（バッテリー〜F2〜フラッシャー）は表示灯も含めて判じる */
      return (any || o.ind) ? 'down' : null;
    },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* ★①レバーが中立＝これは故障ではない（最初に潰す迷い道） */
        { id: 'j-off', sc: scenario({ inputs: { key: 'ON', turn: 'OFF' } }), mode: { off: true } },
        /* ★②F2 が切れた＝ウインカーもブレーキランプも死ぬ */
        { id: 'j-f2', sc: scenario({ inputs: { key: 'ON', turn: 'LEFT', f2: 'BLOWN' } }), mode: { f2: true } },
        /* ★③フラッシャーが働かない＝左右とも、表示灯まで点かない */
        { id: 'j-dead', sc: scenario({ inputs: { key: 'ON', turn: 'LEFT' }, override: { flasher: 'DEAD' } }), mode: { dead: true } },
        /* ★④レバーから左前への1本が外れた＝前と横が消えて、後ろだけ残る */
        { id: 'j-cut6', sc: scenario({ inputs: { key: 'ON', turn: 'LEFT' }, ops: [{ op: 'removeWire', id: 'w04-06' }] }), mode: { cut: 'w04-06' } },
        /* ★⑤左前のアースだけが外れた＝その灯だけが消える */
        { id: 'j-gnd', sc: scenario({ inputs: { key: 'ON', turn: 'LEFT' }, ops: [{ op: 'removeWire', id: 'w04-12' }] }), mode: { cut: 'w04-12' } },
        { id: 'j-fixed', sc: scenario({ inputs: { key: 'ON', turn: 'LEFT' } }), mode: {} }
      ];
    }
  });
})();
