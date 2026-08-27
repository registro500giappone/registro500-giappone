/* ストーリー第8回「ヘッドライトが点かない」の絵。journey_id: headlight（URLと対＝変えない）
   共通の土台（場面の作り方・描画プリミティブ・共通部品・実車図・検算・起動）は /wiring-journey.js。
   ⚠️図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。

   このストーリーだけの特徴が4つある。
     ①⭐【キースイッチの外側にいる】＝電源はイグニッションSWの 30/4（常時電源）。
        だからキーを抜いてもヘッドライトは点く。シリーズで初めて「キーが関係ない灯」になる。
     ②⭐【元栓が2段】＝ダッシュの外部照明SW（消灯／車幅灯／前照灯）と、コラムレバー（ロー／ハイ）。
        原典の凡例でも 24=Interruttore（元栓）・14=Commutatore（行き先を選ぶ）と役割が分かれている。
     ③⭐⭐【ロービームだけ左右別のヒューズ】＝コミュテータから出た 56b が1本でヒューズ箱に入り、
        箱の【中】で F3（右）・F4（左）に分かれる。だから「片目だけロービームが消える」。
        いっぽう【ハイビームはヒューズを1つも通らない】。
     ④【1つの電球に2本のフィラメント】＝ロー・ハイでアースは共通。だからアースが落ちると上も下も消える。

   ⚠️系統2 を新設したストーリー＝NET_VERSION 8→9
     （部品 light_sw・commut・f3〜f6・head_l・head_r・hi_ind／電線 w02-01〜w02-16）。
   ⚠️⚠️コミュテータの内部接点は原典でも再作図物でも読めない（HANDOFF その67⑥）。
     この絵は「C（BIANCO）がロー／ハイの共通電源」という、回路として成立する唯一の形を採っている。
     ⛔だから 30/2・30/3（F5/F6 から来る2本）は端子で止めてあり、
       「F5・F6 が切れたらヘッドライトはどうなるか」をこの絵に答えさせない。

   ⚠️レイアウトの決まり（2026-08-28・bbox-check で文字の衝突ゼロを実測してから確定した）
     ・縦のチャンネルは4本＝ハイが最外（HX_L/HX_R）、ローが内側（FX_L/FX_R）。
       ⛔この内外を入れ替えると、ロー線とハイ線が必ずどこかで交差する（設計時に3案とも実際に破綻した）。
     ・線の交差は【右ハイの横振りがロー本線を跨ぐ1箇所だけ】。そこに node を打たない＝繋がって見せない。
     ・ヒューズの札は F4 が外向き・F3 が内向き＝対称ではないが、外向きに揃えるとハイの縦線を貫く。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;

  var XC = 150;                     /* 中央の幹線（バッテリー〜キー〜元栓〜コラムレバー） */
  var KT = 196, KH = 80;            /* キースイッチの箱。⚠️下段に説明の1行を入れるぶん背が高い */
  var SW = 316, SH = 76;            /* 外部照明SW（元栓）の箱 */
  var CM = 470, CH = 88;            /* コラムレバーの箱。幅は XC±86 */
  var P_LO = 216, P_HI = 110;       /*  ↑ 箱の中の接点。ロー＝右／ハイ＝左 */
  var YHR = 560, YHL = 568;         /* ハイの横振り（右・左） */
  var HX_L = 20, HX_R = 280;        /* ハイの縦チャンネル（最外） */
  var IND_Y = 590;                  /* ハイビーム表示灯 */
  var BOX_T = 644, BOX_B = 754;     /* ヒューズ箱の囲い */
  var YBR = 652;                    /* 箱の中の渡り（F3→F4） */
  var FZ = 680, FX_L = 124, FX_R = 216;  /* ヒューズ F4（左）・F3（右）。管は FZ+11〜FZ+51 */
  var YLO = 786, YHI = 800;         /* ライト直前の横振り（ロー・ハイ） */
  var HD = 820, HRD = 26;           /* ヘッドライトのレンズ */
  var XL = 76, XR = 224;            /* 左右のヘッドライトの中心 */
  var GY = 896;                     /* アース */

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    var keyOn = pos.ign_sw === 'ON';
    var lightPos = pos.light_sw;                       /* OFF / POS / HEAD */
    var high = pos.commut === 'HIGH';
    var on = sc.on;                                    /* 全負荷の点灯（cfg.extra で入れている） */
    var m = mode || {};

    function seg(a, b, c, d, e, f) { k.seg(a, b, c, d, e, f); }
    function label(x, y, t, col, anchor, size) { k.label(x, y, t, col, anchor, size); }
    function path(d, col, w) {
      s.push('<path d="' + d + '" stroke="' + col + '" stroke-width="' + (w || 5) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
    }

    /* ---- 切断の印。⚠️赤は「切れている場所」ただ1つに取ってある（シリーズ共通の決まり） ---- */
    function xmark(cx, cy) {
      s.push('<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#fbf7ee" stroke="' + C.hi + '" stroke-width="3"/>');
      s.push('<path d="M' + (cx - 5.5) + ',' + (cy - 5.5) + ' L' + (cx + 5.5) + ',' + (cy + 5.5)
        + ' M' + (cx + 5.5) + ',' + (cy - 5.5) + ' L' + (cx - 5.5) + ',' + (cy + 5.5)
        + '" stroke="' + C.hi + '" stroke-width="3" stroke-linecap="round"/>');
    }
    /* 縦線を切る（すき間13＋×）。⚠️絵の下半分は文字の逃げ場が無いので札は出さない
       ＝第7回（brake）で決着した作法をそのまま使う。 */
    function cutV(x, y1, y2, id) {
      var mid = (y1 + y2) / 2, col = k.wcol(id, C.dim).col;
      path('M' + x + ',' + y1 + ' L' + x + ',' + (mid - 13), col);
      path('M' + x + ',' + (mid + 13) + ' L' + x + ',' + y2, col);
      xmark(x, mid);
    }

    /* ================= バッテリー〜キースイッチ（第1・4回と同じ道） ================= */
    k.battery(XC);

    seg(XC, 62, XC, 100, 'w11-01', true);
    label(XC + 12, 88, 'ROSSO 赤・太', WC.ROSSO);
    k.node(XC, 100);
    k.dashOut(XC, 100, XC + 74);
    label(XC + 12, 116, '始動レバー・セルへ', C.sub, null, 11);

    seg(XC, 100, XC, 144, 'w11-03', true);
    label(XC + 12, 134, 'MARRONE 茶・太', WC.MARRONE);
    k.node(XC, 144);
    k.dashOut(XC, 144, XC + 74);
    label(XC + 12, 160, '発電系へ', C.sub, null, 11);

    seg(XC, 144, XC, KT, 'w10-01');
    label(XC + 12, 182, 'ROSSO 赤', WC.ROSSO);

    /* ================= ⭐キースイッチ＝この回の第1の芯 =================
       共通の k.keySwitch は接点を1組しか描かない。この回は【キーで開閉する側】と
       【常につながったままの側】を並べて見せたいので、この絵だけ専用に描く。
       ⚠️部品名は箱の【中】に入れる＝箱の上に置くと ROSSO の札と重なる（bbox-check で実測）。 */
    (function keySwitchTwo() {
      var bx = XC - 68, bw = 136, kx = XC - 12, cx = XC + 44;
      s.push('<rect x="' + bx + '" y="' + KT + '" width="' + bw + '" height="' + KH + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
      s.push('<text x="' + XC + '" y="' + (KT + 16) + '" font-size="12" fill="#fffdf8" text-anchor="middle">キースイッチ（' + (keyOn ? 'キーON' : 'キーOFF') + '）</text>');
      s.push('<circle cx="' + (bx + 20) + '" cy="' + (KT + 42) + '" r="11" fill="' + C.in_ + '"/>');
      s.push('<rect x="' + (bx + 18) + '" y="' + (KT + 29) + '" width="4" height="13" rx="1.5" fill="' + C.deep + '" transform="rotate(' + (keyOn ? 42 : 0) + ' ' + (bx + 20) + ' ' + (KT + 42) + ')"/>');
      /* 左の接点＝キーで開閉する側（15/54）。このストーリーは通らない枝 */
      s.push('<circle cx="' + kx + '" cy="' + (KT + 26) + '" r="3.6" fill="' + C.in_ + '"/>');
      s.push('<circle cx="' + kx + '" cy="' + (KT + 56) + '" r="3.6" fill="' + C.in_ + '"/>');
      if (keyOn) path('M' + kx + ',' + (KT + 26) + ' L' + kx + ',' + (KT + 56), C.in_, 3.5);
      else path('M' + kx + ',' + (KT + 26) + ' L' + (kx + 12) + ',' + (KT + 50), C.in_, 3.5);
      /* 右の接点＝常につながったまま（30/4）。⭐これがこの回の入口 */
      s.push('<circle cx="' + cx + '" cy="' + (KT + 26) + '" r="3.6" fill="' + C.in_ + '"/>');
      s.push('<circle cx="' + cx + '" cy="' + (KT + 56) + '" r="3.6" fill="' + C.in_ + '"/>');
      path('M' + cx + ',' + (KT + 26) + ' L' + cx + ',' + (KT + 56), C.in_, 3.5);
      /* 中で上どうしがつながっている＝どちらの接点も同じ 30（バッテリー）から出ている */
      path('M' + kx + ',' + (KT + 26) + ' L' + cx + ',' + (KT + 26), C.in_, 2.5);
      /* ⭐この1行は箱の【中】に入れる。箱の外（右横・下）は ROSSO の札・30/4 のバッジ・
         NERO の説明に三方を塞がれていて、4案とも実測で重なった。 */
      s.push('<text x="' + XC + '" y="' + (KT + 72) + '" font-size="11" font-weight="700" fill="#fffdf8" text-anchor="middle">⭐右はいつも閉じている</text>');
    })();

    /* キーで開く側＝このストーリーは通らない枝。⚠️札は箱の左上へ逃がす（NEROの説明と離すため） */
    k.term(XC - 68, KT + 56, '15/54', 'l');
    k.dashOut(XC - 110, KT + 56, 16);
    label(4, KT - 22, '点火・警告灯・F2 へ', C.sub, null, 11);
    label(4, KT - 8, '（通らない枝）', C.sub, null, 11);

    /* ⭐30/4 → 外部照明SW。ここから先はキーの位置と無関係に生きている */
    k.term(XC + 68, KT + 56, '30/4', 'r', true);
    seg(XC + 44, KT + KH, XC + 44, SW - 8, 'w02-01');
    var nc = k.wcol('w02-01', C.dim);
    path('M' + (XC + 44) + ',' + (SW - 8) + ' L' + XC + ',' + (SW - 8) + ' L' + XC + ',' + SW, nc.col);
    label(4, SW - 38, 'NERO 黒＝', nc.dead ? C.dim : WC.NERO, null, 12);
    label(4, SW - 22, 'キーを抜いても生きている線', nc.dead ? C.dim : WC.NERO, null, 12);

    /* ================= ⭐外部照明スイッチ（元栓・ダッシュ） ================= */
    (function lightSwitch() {
      var bx = XC - 80, bw = 160;
      s.push('<rect x="' + bx + '" y="' + SW + '" width="' + bw + '" height="' + SH + '" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
      s.push('<text x="' + XC + '" y="' + (SW + 19) + '" font-size="12" fill="#fffdf8" text-anchor="middle">外部照明スイッチ</text>');
      s.push('<text x="' + XC + '" y="' + (SW + 33) + '" font-size="10.5" fill="' + C.in_ + '" text-anchor="middle">ダッシュの元栓（部品24）</text>');
      var STEP = [['OFF', '消灯'], ['POS', '車幅灯'], ['HEAD', '前照灯']];
      for (var i = 0; i < 3; i++) {
        var sx = bx + 27 + i * 53, cur = (lightPos === STEP[i][0]);
        s.push('<rect x="' + (sx - 24) + '" y="' + (SW + 42) + '" width="48" height="24" rx="5" fill="' + (cur ? C.in_ : 'none') + '" stroke="' + C.in_ + '" stroke-width="1.6"/>');
        s.push('<text x="' + sx + '" y="' + (SW + 58) + '" font-size="11" font-weight="' + (cur ? '700' : '400') + '" fill="' + (cur ? C.deep : C.in_) + '" text-anchor="middle">' + STEP[i][1] + '</text>');
      }
    })();

    /* 元栓 → ヒューズ F5・F6（車幅灯側）＝このストーリーの本線ではないので枝として描く */
    var vc = k.wcol('w02-02', C.dim);
    path('M' + (XC - 62) + ',' + (SW + SH) + ' L' + (XC - 62) + ',' + (SW + SH + 18) + ' L' + (XC - 106) + ',' + (SW + SH + 18), vc.col);
    s.push('<rect x="' + (XC - 126) + '" y="' + (SW + SH + 8) + '" width="20" height="20" rx="3" fill="none" stroke="' + (vc.dead ? C.dim : C.deep) + '" stroke-width="2.5"/>');
    label(4, SW + SH + 46, 'VERDE 緑 → ヒューズ F5・F6', vc.dead ? C.dim : WC.VERDE, null, 11);
    label(4, SW + SH + 60, '→ 車幅灯・ナンバー灯へ', C.sub, null, 11);
    label(4, SW + SH + 74, '（別のストーリー）', C.sub, null, 11);

    /* ⭐元栓 → コラムレバー（BIANCO）。前照灯の段でだけ生きる */
    if (m.cutC) cutV(XC, SW + SH, CM, 'w02-06');
    else seg(XC, SW + SH, XC, CM, 'w02-06');
    label(XC + 12, SW + SH + 30, 'BIANCO 白', C.deep, null, 12);

    /* ================= コラムレバー（コミュテータ） ================= */
    (function commutator() {
      var bx = XC - 86, bw = 172;
      s.push('<rect x="' + bx + '" y="' + CM + '" width="' + bw + '" height="' + CH + '" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
      s.push('<text x="' + XC + '" y="' + (CM + 19) + '" font-size="12" fill="#fffdf8" text-anchor="middle">コラムレバー</text>');
      s.push('<text x="' + XC + '" y="' + (CM + 33) + '" font-size="10.5" fill="' + C.in_ + '" text-anchor="middle">行き先を選ぶ（部品14）</text>');
      /* 可動接触子＝C から、ハイ側（左）かロー側（右）かへ倒れる。⚠️内部の接点は原典に読めないので
         「どちらへ倒れているか」だけを描く＝形は推定であることを本文と footer で断る。 */
      var py = CM + 44, ty = CM + 70;
      s.push('<circle cx="' + XC + '" cy="' + py + '" r="4.2" fill="' + C.in_ + '"/>');
      s.push('<circle cx="' + P_HI + '" cy="' + ty + '" r="4.2" fill="' + C.in_ + '"/>');
      s.push('<circle cx="' + P_LO + '" cy="' + ty + '" r="4.2" fill="' + C.in_ + '"/>');
      path('M' + XC + ',' + py + ' L' + (high ? P_HI : P_LO) + ',' + ty, C.in_, 3.5);
      s.push('<text x="' + P_HI + '" y="' + (ty + 15) + '" font-size="10.5" font-weight="' + (high ? '700' : '400') + '" fill="' + C.in_ + '" text-anchor="middle">ハイ</text>');
      s.push('<text x="' + P_LO + '" y="' + (ty + 15) + '" font-size="10.5" font-weight="' + (high ? '400' : '700') + '" fill="' + C.in_ + '" text-anchor="middle">ロー</text>');
    })();
    k.term(XC, CM - 2, 'C', 'l');

    /* F5/F6 から来ている2本＝この絵では端子で止める（コミュテータの内部が読めないため） */
    k.dashOut(XC - 86, CM + 26, XC - 118);
    label(4, CM + 22, 'F6 から', C.sub, null, 10.5);
    k.dashOut(XC + 86, CM + 26, XC + 118);
    s.push('<text x="296" y="' + (CM + 22) + '" font-size="10.5" fill="' + C.sub + '" text-anchor="end">F5 から</text>');

    /* ================= ハイビーム＝コラムレバーから直接（ヒューズを通らない） ================= */
    var hlc = k.wcol('w02-11', C.dim), hrc = k.wcol('w02-12', C.dim);
    /* 右ハイ：箱を出て右の外へ。⚠️ここだけロー本線を跨ぐ＝図の中で唯一の交差（node は打たない） */
    path('M' + P_HI + ',' + (CM + CH) + ' L' + P_HI + ',' + YHR + ' L' + HX_R + ',' + YHR
      + ' L' + HX_R + ',' + YHI + ' L' + (XR + HRD) + ',' + YHI + ' L' + (XR + HRD) + ',' + (HD - 10), hrc.col);
    /* 左ハイ：箱を出て左の外へ */
    if (m.cutHiL) {
      var my = (YHL + YHI) / 2;
      path('M' + P_HI + ',' + (CM + CH) + ' L' + P_HI + ',' + YHL + ' L' + HX_L + ',' + YHL + ' L' + HX_L + ',' + (my - 13), hlc.col);
      path('M' + HX_L + ',' + (my + 13) + ' L' + HX_L + ',' + YHI + ' L' + (XL - HRD) + ',' + YHI + ' L' + (XL - HRD) + ',' + (HD - 10), hlc.col);
      xmark(HX_L, my);
    } else {
      path('M' + P_HI + ',' + (CM + CH) + ' L' + P_HI + ',' + YHL + ' L' + HX_L + ',' + YHL
        + ' L' + HX_L + ',' + YHI + ' L' + (XL - HRD) + ',' + YHI + ' L' + (XL - HRD) + ',' + (HD - 10), hlc.col);
    }
    k.term(P_HI, CM + CH + 12, '56/a1', 'l');

    /* ハイビーム表示灯＝左ハイの線から分かれる */
    (function highIndicator() {
      var lit = !!on['hi_ind'], ix = 60;
      k.node(HX_L, IND_Y);
      path('M' + HX_L + ',' + IND_Y + ' L' + (ix - 22) + ',' + IND_Y, k.wcol('w02-13', C.dim).col, 4);
      s.push('<rect x="' + (ix - 22) + '" y="' + (IND_Y - 13) + '" width="44" height="26" rx="5" fill="' + (lit ? '#3f7fd0' : '#eae4d5') + '" stroke="' + (lit ? '#8fc0ff' : '#c3bba6') + '" stroke-width="2"/>');
      s.push('<text x="' + ix + '" y="' + (IND_Y + 4.5) + '" font-size="11" font-weight="700" fill="' + (lit ? '#fffdf8' : '#a89f8b') + '" text-anchor="middle">ハイ</text>');
      s.push('<text x="' + (ix + 28) + '" y="' + (IND_Y + 4.5) + '" font-size="10.5" fill="' + (lit ? C.deep : C.sub) + '">表示灯</text>');
      /* 表示灯のアースは短く落とす＝下まで引くとヒューズ箱の囲いを貫く */
      seg(ix, IND_Y + 13, ix, IND_Y + 26, 'w02-16');
      k.ground(ix, IND_Y + 26);
    })();

    /* ================= ロービーム＝コラムレバー→ヒューズ箱→左右 ================= */
    /* 56b が1本だけ下りて、ヒューズ箱の中で左右に分かれる */
    if (m.cut56b) cutV(P_LO, CM + CH, YBR, 'w02-07');
    else seg(P_LO, CM + CH, P_LO, YBR, 'w02-07');
    k.term(P_LO, CM + CH + 12, '56b', 'r');
    /* ⚠️色札は【右端を P_LO の内側で止める】＝左詰めにすると必ずロー本線の縦線を文字が貫く */
    label(P_LO - 10, IND_Y + 34, 'GRIGIO-ROSSO 灰／赤',
      k.wcol('w02-07', C.dim).dead ? C.dim : WC.GRIGIO, 'end', 10.5);

    /* ヒューズ箱＝1本で入って、箱の中で F3・F4 に分かれる */
    s.push('<rect x="100" y="' + BOX_T + '" width="140" height="' + (BOX_B - BOX_T) + '" rx="10" fill="none" stroke="' + C.out + '" stroke-width="2" stroke-dasharray="6 5"/>');
    label(106, BOX_T + 24, 'ヒューズ箱の中', C.sub, null, 11);
    var c8 = k.wcol('w02-08', C.dim);
    path('M' + FX_R + ',' + YBR + ' L' + FX_L + ',' + YBR + ' L' + FX_L + ',' + FZ
      + ' M' + FX_R + ',' + YBR + ' L' + FX_R + ',' + FZ, c8.col);
    k.node(FX_R, YBR);
    k.fuseV(FX_L, FZ, pos.f4 === 'BLOWN');
    k.fuseV(FX_R, FZ, pos.f3 === 'BLOWN');
    /* ⚠️ヒューズの札は F4 が外向き・F3 が内向き＝外向きに揃えるとハイの縦線を貫く */
    s.push('<text x="102" y="' + (FZ + 22) + '" font-size="12" fill="' + C.deep + '" text-anchor="end">F4（左）</text>');
    s.push('<text x="102" y="' + (FZ + 38) + '" font-size="11.5" font-weight="700" text-anchor="end" fill="'
      + (pos.f4 === 'BLOWN' ? C.hi : C.ok) + '">' + (pos.f4 === 'BLOWN' ? '切れている' : '生きている') + '</text>');
    s.push('<text x="194" y="' + (FZ + 22) + '" font-size="12" fill="' + C.deep + '" text-anchor="end">F3（右）</text>');
    s.push('<text x="194" y="' + (FZ + 38) + '" font-size="11.5" font-weight="700" text-anchor="end" fill="'
      + (pos.f3 === 'BLOWN' ? C.hi : C.ok) + '">' + (pos.f3 === 'BLOWN' ? '切れている' : '生きている') + '</text>');

    /* ヒューズ → 左右のロービーム（横振りは短い＝ハイの縦線と交差させないため） */
    path('M' + FX_L + ',' + (FZ + 62) + ' L' + FX_L + ',' + YLO + ' L' + (XL + HRD) + ',' + YLO
      + ' L' + (XL + HRD) + ',' + (HD - 10), k.wcol('w02-10', C.dim).col);
    path('M' + FX_R + ',' + (FZ + 62) + ' L' + FX_R + ',' + YLO + ' L' + (XR - HRD) + ',' + YLO
      + ' L' + (XR - HRD) + ',' + (HD - 10), k.wcol('w02-09', C.dim).col);

    /* ================= ヘッドライト（1つの電球に2本のフィラメント） ================= */
    function lens(cx, loOn, hiOn, name, side) {
      var lit = loOn || hiOn;
      if (lit) {
        s.push('<defs><radialGradient id="hlg' + cx + '">'
          + '<stop offset="0%" stop-color="#fff3c4" stop-opacity=".95"/>'
          + '<stop offset="45%" stop-color="#ffd766" stop-opacity=".45"/>'
          + '<stop offset="100%" stop-color="#ffd766" stop-opacity="0"/></radialGradient></defs>');
        s.push('<circle cx="' + cx + '" cy="' + HD + '" r="' + (HRD + 24) + '" fill="url(#hlg' + cx + ')"/>');
      }
      s.push('<circle cx="' + cx + '" cy="' + HD + '" r="' + HRD + '" fill="' + (lit ? '#f6e6a8' : '#eae4d5') + '" stroke="' + (lit ? '#c9a83c' : '#c3bba6') + '" stroke-width="2.5"/>');
      /* 中の2本のフィラメント＝外側寄りがハイ・内側寄りがロー（線の着き方と同じ並び） */
      var dx = (side === 'l') ? -10 : 10;
      s.push('<circle cx="' + (cx + dx) + '" cy="' + HD + '" r="5.5" fill="' + (hiOn ? '#e0a921' : '#cfc7b4') + '"/>');
      s.push('<circle cx="' + (cx - dx) + '" cy="' + HD + '" r="5.5" fill="' + (loOn ? '#e0a921' : '#cfc7b4') + '"/>');
      /* 名前はレンズの真上（線の来ない場所） */
      s.push('<text x="' + cx + '" y="' + (HD - HRD - 12) + '" font-size="12" font-weight="700" fill="' + C.deep + '" text-anchor="middle">' + name + '</text>');
      k.term(cx - HRD - 2, HD, side === 'l' ? '56a' : '56b', 'l');
      k.term(cx + HRD + 2, HD, side === 'l' ? '56b' : '56a', 'r');
    }
    lens(XL, on['head_l.lo'], on['head_l.hi'], '左', 'l');
    lens(XR, on['head_r.lo'], on['head_r.hi'], '右', 'r');
    /* ⚠️この註は【2行に割る】＝1行にすると左右のアース線（XL・XR の縦線）を文字が貫く */
    s.push('<text x="' + XC + '" y="' + (HD + HRD + 20) + '" font-size="10.5" fill="' + C.sub + '" text-anchor="middle">外側の粒＝ハイ</text>');
    s.push('<text x="' + XC + '" y="' + (HD + HRD + 34) + '" font-size="10.5" fill="' + C.sub + '" text-anchor="middle">内側の粒＝ロー</text>');

    /* ================= アース ================= */
    if (m.cutGndL) cutV(XL, HD + HRD, GY, 'w02-14');
    else seg(XL, HD + HRD, XL, GY, 'w02-14');
    seg(XR, HD + HRD, XR, GY, 'w02-15');
    k.ground(XL, GY);
    k.ground(XR, GY);
    s.push('<text x="' + XC + '" y="' + (GY + 4) + '" font-size="11" fill="' + C.sub + '" text-anchor="middle">ロー・ハイは</text>');
    s.push('<text x="' + XC + '" y="' + (GY + 18) + '" font-size="11" fill="' + C.sub + '" text-anchor="middle">同じ1本のアースへ</text>');

    /* ⚠️ハイの2本は色札を【1つにまとめて最下段に置く】＝線の傍らに置く場所が無い（56b のバッジ・
       箱の中の「ロー」・ロー本線・表示灯のアース記号に塞がれ、逃がし先を4案とも実測して全滅した）。 */
    label(4, GY + 40, '左ハイ＝VERDE E NERO 緑／黒・右ハイ＝VERDE 緑', hlc.dead ? C.dim : WC.VERDE, null, 10.5);

    return GY + 54;
  }

  /* ---- トグル（唯一の操作＝ロー↔ハイ） ---- */
  var CAPS = {
    LOW: '<b>ロービーム。</b>コラムレバーが「ロー」側に倒れています。黄色い点が、'
       + '<b>ヒューズ箱の中で左右に分かれて</b>2つの電球へ届いているのが見えます。<b>表示灯は消えたまま</b>です。',
    HIGH: '<b>ハイビーム。</b>レバーが「ハイ」側に倒れました。こんどは<b>ヒューズをひとつも通らずに</b>'
       + '左右へ直行します。左の線からは<b>表示灯</b>も分かれていて、これが計器盤で青く光ります。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function rd(id) { return function (sc) { return !!sc.on[id]; }; }
  var HEAD_LOW = { lights: 'HEAD', beam: 'LOW' }, HEAD_HIGH = { lights: 'HEAD', beam: 'HIGH' };
  var CHECKS = [
    { label: '元栓が消灯（キーはON）',                     s: { inputs: { lights: 'OFF', key: 'ON' } },  expect: false },
    { label: '元栓が車幅灯＝ヘッドライトはまだ点かない',   s: { inputs: { lights: 'POS' } },             expect: false },
    { label: '⭐元栓が前照灯・ロー【キーはOFFのまま】',    s: { inputs: HEAD_LOW },                      expect: true },
    { label: '同じ場面でキーをONにしても変わらない',        s: { inputs: { lights: 'HEAD', beam: 'LOW', key: 'ON' } }, expect: true },
    { label: 'ロー・F4（左）が切れた／左を見る',           s: { inputs: { lights: 'HEAD', beam: 'LOW', f4: 'BLOWN' } }, expect: false },
    { label: '同じ場面で右を見る（右は点いている）',        s: { inputs: { lights: 'HEAD', beam: 'LOW', f4: 'BLOWN' } }, expect: true,  read: rd('head_r.lo') },
    { label: 'ロー・F3（右）が切れた／右を見る',           s: { inputs: { lights: 'HEAD', beam: 'LOW', f3: 'BLOWN' } }, expect: false, read: rd('head_r.lo') },
    { label: '⭐ハイのとき F4 が切れていても左は点く',      s: { inputs: { lights: 'HEAD', beam: 'HIGH', f4: 'BLOWN' } }, expect: true,  read: rd('head_l.hi') },
    { label: '⭐ハイのとき F3 が切れていても右は点く',      s: { inputs: { lights: 'HEAD', beam: 'HIGH', f3: 'BLOWN' } }, expect: true,  read: rd('head_r.hi') },
    { label: 'ハイのとき表示灯が点く',                     s: { inputs: HEAD_HIGH },                     expect: true,  read: rd('hi_ind') },
    { label: 'ローのとき表示灯は消えている',                s: { inputs: HEAD_LOW },                      expect: false, read: rd('hi_ind') },
    { label: '左のアースが落ちた・ロー（左が消える）',      s: { inputs: HEAD_LOW, ops: [{ op: 'removeWire', id: 'w02-14' }] }, expect: false },
    { label: '同じ断線でハイ＝左のハイも消える',            s: { inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-14' }] }, expect: false, read: rd('head_l.hi') },
    { label: '⭐同じ断線でも表示灯は点いたまま',            s: { inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-14' }] }, expect: true,  read: rd('hi_ind') },
    { label: '⭐左ハイの線が切れると表示灯も消える',        s: { inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-11' }] }, expect: false, read: rd('hi_ind') },
    { label: '同じ断線でも右のハイは点いている',            s: { inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-11' }] }, expect: true,  read: rd('head_r.hi') },
    { label: '白い線（C）が切れた・ロー＝左右とも消える',   s: { inputs: HEAD_LOW, ops: [{ op: 'removeWire', id: 'w02-06' }] }, expect: false },
    { label: '同じ断線で右も消える',                       s: { inputs: HEAD_LOW, ops: [{ op: 'removeWire', id: 'w02-06' }] }, expect: false, read: rd('head_r.lo') },
    { label: '同じ断線でハイも消える',                     s: { inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-06' }] }, expect: false, read: rd('head_l.hi') },
    { label: 'ロー本線（56b）が切れた＝ローだけ左右とも消える', s: { inputs: HEAD_LOW, ops: [{ op: 'removeWire', id: 'w02-07' }] }, expect: false },
    { label: '同じ断線でハイに切り替えると点く',            s: { inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-07' }] }, expect: true,  read: rd('head_l.hi') },
    { label: '⭐30/4 の線が切れた＝キーをONにしても点かない', s: { inputs: { lights: 'HEAD', beam: 'LOW', key: 'ON' }, ops: [{ op: 'removeWire', id: 'w02-01' }] }, expect: false }
  ];

  Journey.boot({
    lampId: 'head_l.lo',
    alt: false,
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    mainInit: 'LOW',
    /* ⚠️このストーリーのトグルが動かすのは【コラムレバー】＝キーでもエンジンでもない。
       キーは既定の OFF のまま＝「キーは関係ない」がトグルを触っても崩れないようにする。 */
    mainInputs: function (v) { return { lights: 'HEAD', beam: v }; },
    /* 全負荷の点灯を絵から読めるようにする（ロー・ハイ・表示灯の5つを同時に見るため） */
    extra: function (sc) {
      sc.on = {};
      for (var i = 0; i < sc.r.loads.length; i++) sc.on[sc.r.loads[i].id] = sc.r.loads[i].on;
    },
    /* 黄点の向き＝どれかの灯が点いていれば下向き（電源から灯へ） */
    flow: function (sc) { return (sc.on['head_l.lo'] || sc.on['head_l.hi'] || sc.on['head_r.lo'] || sc.on['head_r.hi']) ? 'down' : null; },
    scenes: function (scenario) {
      return [
        { id: 'j-f4',    sc: scenario({ inputs: { lights: 'HEAD', beam: 'LOW', f4: 'BLOWN' } }), mode: {} },
        { id: 'j-f4hi',  sc: scenario({ inputs: { lights: 'HEAD', beam: 'HIGH', f4: 'BLOWN' } }), mode: {} },
        { id: 'j-gndl',  sc: scenario({ inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-14' }] }), mode: { cutGndL: true } },
        { id: 'j-hicut', sc: scenario({ inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-11' }] }), mode: { cutHiL: true } },
        { id: 'j-cutc',  sc: scenario({ inputs: HEAD_LOW, ops: [{ op: 'removeWire', id: 'w02-06' }] }), mode: { cutC: true } },
        { id: 'j-pos',   sc: scenario({ inputs: { lights: 'POS' } }), mode: {} },
        { id: 'j-fixed', sc: scenario({ inputs: HEAD_LOW }), mode: {} }
      ];
    }
  });
})();
