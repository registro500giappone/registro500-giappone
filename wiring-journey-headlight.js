/* ストーリー第8回「ヘッドライトが点かない」の絵。図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。
   このストーリーだけの特徴が4つある。①【キースイッチの中で枝が分かれる】＝電源はイグニッションSWの 30/4。
   ⚠️⚠️【2026-09-02 訂正】旧版はこれを「常時電源＝キーを抜いても点く」としていたが誤り。実車のキーは 0/1/2 の3位置で、
   30/4 は【位置1（運転）と位置2（駐車灯）で生き、位置0では死ぬ】。位置2でもキーは抜けるので「キーを抜いても点く」
   という現象自体は実在するが、原因は「キーと無関係」ではなく「位置2に入っていた」。
   根拠＝ジャルディニエラ取説 印刷p6 の脚注(**)「キーを位置1または2にすると通電する回路：車幅灯／ハイビーム／
   ロービーム／パッシング／ナンバー灯」・D取説 印刷p10 の脚注(*)・D整備書 p268-269・オーナーの実車確認（D型）。
   ⛔「キーが関係ない灯」と書かない＝本当にキーと無関係なのはホーンとルームランプ（F1の先）だけ。
   ②【スイッチが2段】＝ダッシュの外部照明SW（消灯／車幅灯／前照灯）と、コラムレバー（ロー／ハイ）。
   原典の凡例でも 24=Interruttore（入か切か）・14=Commutatore（行き先を選ぶ）と役割が分かれている。
   ③【ロービームだけ左右別のヒューズ】＝コミュテータから出た 56b が1本でヒューズ箱に入り、箱の【中】で F3（右）・F4（左）に分かれる。
   だから「片目だけロービームが消える」。いっぽうハイ側はコミュテータから直接ヘッドライトへ行く。
   ⚠️ただし【ハイビームがヒューズに守られていない】わけではない＝コミュテータのハイ側の電源が F5・F6 の先だから。
   純正取説の「ヒューズが守る回路」の表（500D/L/R の3冊とも同内容）に、F5=左ハイ＋表示灯・右前と左後の車幅灯／
   F6=右ハイ・左前と右後の車幅灯・ナンバー灯 と書かれている。⛔「ハイはヒューズを通らない」と書かない。
   ④【1つの電球に2本のフィラメント】＝ロー・ハイでアースは共通。だからアースが落ちると上も下も消える。
   この絵は「C（BIANCO）がロー／ハイの共通電源」という、回路として成立する唯一の形を採っている。
   だから 30/2・30/3（F5/F6 から来る2本）は端子で止めてあり、「F5・F6 が切れたらヘッドライトはどうなるか」をこの絵に答えさせない。
   レイアウトの決まり・縦のチャンネルは4本＝ハイが最外（HX_L/HX_R）、ローが内側（FX_L/FX_R）。
   ・線の交差は【右ハイの横振りがロー本線を跨ぐ1箇所だけ】。そこに node を打たない＝繋がって見せない。
   ・ヒューズの札は F4 が外向き・F3 が内向き＝対称ではないが、外向きに揃えるとハイの縦線を貫く。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;

  var XC = 150;                     /* 中央の幹線（バッテリー〜キー〜ライトスイッチ〜コラムレバー） */
  var KT = 196, KH = 80;            /* キースイッチの箱。下段に説明の1行を入れるぶん背が高い */
  var SW = 316, SH = 76;            /* 外部照明SWの箱 */
  var CM = 470, CH = 88;            /* コラムレバーの箱。幅は XC±86 */
  var P_LO = 216, P_HI = 110;       /* ↑箱の中の接点。ロー＝右／ハイ＝左 */
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
    var lightPos = pos.light_sw;                       /* OFF / ON＝入／切の2位置（取説 500L p9-5） */
    var high = pos.commut === 'HIGH';
    var beamPos = pos.commut;                          /* POS(I 車幅灯) / LOW(II) / HIGH(III)＝3段はこちら */
    var on = sc.on;                                    /* 全負荷の点灯（cfg.extra で入れている） */
    var m = mode || {};

    function seg(a, b, c, d, e, f) { k.seg(a, b, c, d, e, f); }
    function label(x, y, t, col, anchor, size) { k.label(x, y, t, col, anchor, size); }
    function path(d, col, w) {
      s.push('<path d="' + d + '" stroke="' + col + '" stroke-width="' + (w || 5) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
    }
    /* 折れ線＝線を引いて、通電していれば黄点も流す。点は【電源側→負荷側】の順に並べる＝その並びがそのまま流れの向きになる。
       path() を直に呼ぶのは「粒を流したくない線」だけにする（この回では交差の演出など無い＝全部 poly）。 */
    function poly(pts, c, w) {
      var d = 'M' + pts[0][0] + ',' + pts[0][1];
      for (var i = 1; i < pts.length; i++) d += ' L' + pts[i][0] + ',' + pts[i][1];
      path(d, c.col, w);
      if (c.live) k.dotsPoly(pts);
    }

    /* ---- 切断の印。赤は「切れている場所」ただ1つに取ってある（シリーズ共通の決まり） ---- */
    function xmark(cx, cy) {
      s.push('<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#fbf7ee" stroke="' + C.hi + '" stroke-width="3"/>');
      s.push('<path d="M' + (cx - 5.5) + ',' + (cy - 5.5) + ' L' + (cx + 5.5) + ',' + (cy + 5.5)
        + ' M' + (cx + 5.5) + ',' + (cy - 5.5) + ' L' + (cx - 5.5) + ',' + (cy + 5.5)
        + '" stroke="' + C.hi + '" stroke-width="3" stroke-linecap="round"/>');
    }
    /* 縦線を切る（すき間13＋×）。 */
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
    label(XC + 12, 116, 'スターターレバー・セルへ', C.sub, null, 11);

    seg(XC, 100, XC, 144, 'w11-03', true);
    label(XC + 12, 134, 'MARRONE 茶・太', WC.MARRONE);
    k.node(XC, 144);
    k.dashOut(XC, 144, XC + 74);
    label(XC + 12, 160, '発電系へ', C.sub, null, 11);

    seg(XC, 144, XC, KT, 'w10-01');
    label(XC + 12, 182, 'ROSSO 赤', WC.ROSSO);

    /* ================= キースイッチ＝この回の第1の芯 ================= 共通の k.keySwitch は接点を1組しか描かない。
       この回は【キーで開閉する側】と【常につながったままの側】を並べて見せたいので、この絵だけ専用に描く。 */
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
      /* 右の接点＝外部照明へ行く枝（30/4）。これがこの回の入口。
         ⚠️【2026-09-02 訂正】旧版はここを無条件に閉じて描いていた（＝常時電源という誤った読み）。
         実車は位置1と位置2で閉じ、位置0では開く。L1 は2位置モデルなので keyOn で分岐させる。 */
      s.push('<circle cx="' + cx + '" cy="' + (KT + 26) + '" r="3.6" fill="' + C.in_ + '"/>');
      s.push('<circle cx="' + cx + '" cy="' + (KT + 56) + '" r="3.6" fill="' + C.in_ + '"/>');
      if (keyOn) path('M' + cx + ',' + (KT + 26) + ' L' + cx + ',' + (KT + 56), C.in_, 3.5);
      else path('M' + cx + ',' + (KT + 26) + ' L' + (cx + 12) + ',' + (KT + 50), C.in_, 3.5);
      /* 中で上どうしがつながっている＝どちらの接点も同じ 30（バッテリー）から出ている */
      path('M' + kx + ',' + (KT + 26) + ' L' + cx + ',' + (KT + 26), C.in_, 2.5);
      /* この1行は箱の【中】に入れる。 */
      s.push('<text x="' + XC + '" y="' + (KT + 72) + '" font-size="11" font-weight="700" fill="#fffdf8" text-anchor="middle">⭐右は位置1と2で閉じる</text>');
    })();

    /* キーで開く側＝このストーリーは通らない枝。札は箱の左上へ逃がす（NEROの説明と離すため） */
    k.term(XC - 68, KT + 56, '15/54', 'l');
    k.dashOut(XC - 110, KT + 56, 16);
    label(4, KT - 22, '点火・警告灯・F2 へ', C.sub, null, 11);
    label(4, KT - 8, '（通らない枝）', C.sub, null, 11);

    /* 30/4 →外部照明SW。ここから先はキー位置1・2で生きている（⚠️位置0では死ぬ＝2026-09-02 訂正） */
    k.term(XC + 68, KT + 56, '30/4', 'r', true);
    seg(XC + 44, KT + KH, XC + 44, SW - 8, 'w02-01');
    var nc = k.wcol('w02-01', C.dim);
    poly([[XC + 44, SW - 8], [XC, SW - 8], [XC, SW]], nc);
    label(4, SW - 38, 'NERO 黒＝', nc.dead ? C.dim : WC.NERO, null, 12);
    label(4, SW - 22, '位置1・位置2で生きる線', nc.dead ? C.dim : WC.NERO, null, 12);

    /* ================= ライトスイッチ（ダッシュ） ================= */
    (function lightSwitch() {
      var bx = XC - 80, bw = 160;
      s.push('<rect x="' + bx + '" y="' + SW + '" width="' + bw + '" height="' + SH + '" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
      s.push('<text x="' + XC + '" y="' + (SW + 19) + '" font-size="12" fill="#fffdf8" text-anchor="middle">ライトスイッチ</text>');
      s.push('<text x="' + XC + '" y="' + (SW + 33) + '" font-size="10.5" fill="' + C.in_ + '" text-anchor="middle">ダッシュ・入／切（部品24）</text>');
      /* 入／切の2位置。 */
      var STEP = [['OFF', '切'], ['ON', '入']];
      for (var i = 0; i < 2; i++) {
        var sx = bx + 45 + i * 70, cur = (lightPos === STEP[i][0]);
        s.push('<rect x="' + (sx - 24) + '" y="' + (SW + 42) + '" width="48" height="24" rx="5" fill="' + (cur ? C.in_ : 'none') + '" stroke="' + C.in_ + '" stroke-width="1.6"/>');
        s.push('<text x="' + sx + '" y="' + (SW + 58) + '" font-size="11" font-weight="' + (cur ? '700' : '400') + '" fill="' + (cur ? C.deep : C.in_) + '" text-anchor="middle">' + STEP[i][1] + '</text>');
      }
    })();

    /* ライトスイッチ→ヒューズ F5・F6（車幅灯側）＝このストーリーの本線ではないので枝として描く */
    var vc = k.wcol('w02-02', C.dim);
    poly([[XC - 62, SW + SH], [XC - 62, SW + SH + 18], [XC - 106, SW + SH + 18]], vc);
    s.push('<rect x="' + (XC - 126) + '" y="' + (SW + SH + 8) + '" width="20" height="20" rx="3" fill="none" stroke="' + (vc.dead ? C.dim : C.deep) + '" stroke-width="2.5"/>');
    label(4, SW + SH + 46, 'VERDE 緑 → ヒューズ F5・F6', vc.dead ? C.dim : WC.VERDE, null, 11);
    label(4, SW + SH + 60, '→ 車幅灯・ナンバー灯', C.sub, null, 11);
    label(4, SW + SH + 74, '（入れれば点く）', C.sub, null, 11);

    /* ライトスイッチ→コラムレバー（BIANCO）。ライトスイッチが【入】なら常に生きている＝ここから先の行き先を選ぶのはコラムレバー */
    if (m.cutC) cutV(XC, SW + SH, CM, 'w02-06');
    else seg(XC, SW + SH, XC, CM, 'w02-06');
    label(XC + 12, SW + SH + 30, 'BIANCO 白', C.deep, null, 12);

    /* ================= コラムレバー（コミュテータ） ================= */
    (function commutator() {
      var bx = XC - 86, bw = 172;
      s.push('<rect x="' + bx + '" y="' + CM + '" width="' + bw + '" height="' + CH + '" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
      s.push('<text x="' + XC + '" y="' + (CM + 19) + '" font-size="12" fill="#fffdf8" text-anchor="middle">コラムレバー</text>');
      s.push('<text x="' + XC + '" y="' + (CM + 33) + '" font-size="10.5" fill="' + C.in_ + '" text-anchor="middle">3段で行き先を選ぶ（部品14）</text>');
      /* 可動接触子＝C から、ハイ側（左）／ロー側（右）／どちらでもない中立（＝I の位置）の3つ。
         。以前はライトスイッチの側を3段に描いていたが逆だった。内部の接点は原典に読めないので「どちらへ倒れているか」だけを描く＝形は推定であることを本文と footer で断る。
         中央（I）に接点の丸を打たない＝そこに端子は無い。 */
      var py = CM + 44, ty = CM + 70;
      var tipX = (beamPos === 'HIGH') ? P_HI : (beamPos === 'LOW') ? P_LO : XC;
      s.push('<circle cx="' + XC + '" cy="' + py + '" r="4.2" fill="' + C.in_ + '"/>');
      s.push('<circle cx="' + P_HI + '" cy="' + ty + '" r="4.2" fill="' + C.in_ + '"/>');
      s.push('<circle cx="' + P_LO + '" cy="' + ty + '" r="4.2" fill="' + C.in_ + '"/>');
      path('M' + XC + ',' + py + ' L' + tipX + ',' + ty, C.in_, 3.5);
      s.push('<text x="' + P_HI + '" y="' + (ty + 15) + '" font-size="10.5" font-weight="' + (beamPos === 'HIGH' ? '700' : '400') + '" fill="' + C.in_ + '" text-anchor="middle">ハイ</text>');
      s.push('<text x="' + XC + '" y="' + (ty + 15) + '" font-size="10.5" font-weight="' + (beamPos === 'POS' ? '700' : '400') + '" fill="' + C.in_ + '" text-anchor="middle">車幅灯</text>');
      s.push('<text x="' + P_LO + '" y="' + (ty + 15) + '" font-size="10.5" font-weight="' + (beamPos === 'LOW' ? '700' : '400') + '" fill="' + C.in_ + '" text-anchor="middle">ロー</text>');
    })();
    k.term(XC, CM - 2, 'C', 'l');

    /* F5/F6 から来ている2本＝この絵では端子で止める（コミュテータの内部が読めないため） */
    k.dashOut(XC - 86, CM + 26, XC - 118);
    label(4, CM + 22, 'F6 から', C.sub, null, 10.5);
    k.dashOut(XC + 86, CM + 26, XC + 118);
    s.push('<text x="296" y="' + (CM + 22) + '" font-size="10.5" fill="' + C.sub + '" text-anchor="end">F5 から</text>');

    /* ================= ハイビーム＝コラムレバーから直接（この先にヒューズは無い＝守りは手前の F5・F6） ================= */
    var hlc = k.wcol('w02-11', C.dim), hrc = k.wcol('w02-12', C.dim);
    /* 右ハイ：箱を出て右の外へ。ここだけロー本線を跨ぐ＝図の中で唯一の交差（node は打たない） */
    poly([[P_HI, CM + CH], [P_HI, YHR], [HX_R, YHR], [HX_R, YHI], [XR + HRD, YHI], [XR + HRD, HD - 10]], hrc);
    /* 左ハイ：箱を出て左の外へ */
    if (m.cutHiL) {
      var my = (YHL + YHI) / 2;
      poly([[P_HI, CM + CH], [P_HI, YHL], [HX_L, YHL], [HX_L, my - 13]], hlc);
      poly([[HX_L, my + 13], [HX_L, YHI], [XL - HRD, YHI], [XL - HRD, HD - 10]], hlc);
      xmark(HX_L, my);
    } else {
      poly([[P_HI, CM + CH], [P_HI, YHL], [HX_L, YHL], [HX_L, YHI], [XL - HRD, YHI], [XL - HRD, HD - 10]], hlc);
    }
    k.term(P_HI, CM + CH + 12, '56/a1', 'l');

    /* ハイビーム表示灯＝左ハイの線から分かれる */
    (function highIndicator() {
      var lit = !!on['hi_ind'], ix = 60;
      k.node(HX_L, IND_Y);
      poly([[HX_L, IND_Y], [ix - 22, IND_Y]], k.wcol('w02-13', C.dim), 4);
      s.push('<rect x="' + (ix - 22) + '" y="' + (IND_Y - 13) + '" width="44" height="26" rx="5" fill="' + (lit ? '#3f7fd0' : '#eae4d5') + '" stroke="' + (lit ? '#8fc0ff' : '#c3bba6') + '" stroke-width="2"/>');
      s.push('<text x="' + ix + '" y="' + (IND_Y + 4.5) + '" font-size="11" font-weight="700" fill="' + (lit ? '#fffdf8' : '#a89f8b') + '" text-anchor="middle">ハイ</text>');
      /* 「表示灯」の3文字だけでは何の物か分からない＝名前の下に、実車で何が光るのかを添える。
         右はローの縦線（P_LO=216）まで 128px あるので、6文字の2行なら収まる。 */
      s.push('<text x="' + (ix + 28) + '" y="' + (IND_Y - 1) + '" font-size="10.5" fill="' + (lit ? C.deep : C.sub) + '">表示灯</text>');
      s.push('<text x="' + (ix + 28) + '" y="' + (IND_Y + 12) + '" font-size="9.5" fill="' + C.sub + '">メーターの青</text>');
      /* 表示灯のアース。⚠️⚠️長さは 32px 以上を必ず取る＝seg() の粒は両端に 6px と 26px の余白を取るので、
         31px 以下の縦線には粒が1つも打てない（＝通電しているのに「流れていない」ように見える）。
         下へ伸ばしてもヒューズ箱の囲い（x=100〜240）とは横に離れているので貫かない。 */
      seg(ix, IND_Y + 13, ix, IND_Y + 47, 'w02-16');
      k.ground(ix, IND_Y + 47);
    })();

    /* ================= ロービーム＝コラムレバー→ヒューズ箱→左右 ================= */
    /* 56b が1本だけ下りて、ヒューズ箱の中で左右に分かれる */
    if (m.cut56b) cutV(P_LO, CM + CH, YBR, 'w02-07');
    else seg(P_LO, CM + CH, P_LO, YBR, 'w02-07');
    k.term(P_LO, CM + CH + 12, '56b', 'r');
    /* 色札は【右端を P_LO の内側で止める】＝左詰めにすると必ずロー本線の縦線を文字が貫く */
    label(P_LO - 10, IND_Y + 34, 'GRIGIO-ROSSO 灰／赤',
      k.wcol('w02-07', C.dim).dead ? C.dim : WC.GRIGIO, 'end', 10.5);

    /* ヒューズ箱＝1本で入って、箱の中で F3・F4 に分かれる */
    s.push('<rect x="100" y="' + BOX_T + '" width="140" height="' + (BOX_B - BOX_T) + '" rx="10" fill="none" stroke="' + C.out + '" stroke-width="2" stroke-dasharray="6 5"/>');
    label(106, BOX_T + 24, 'ヒューズ箱の中', C.sub, null, 11);
    var c8 = k.wcol('w02-08', C.dim);
    poly([[FX_R, YBR], [FX_L, YBR], [FX_L, FZ]], c8);
    poly([[FX_R, YBR], [FX_R, FZ]], c8);
    k.node(FX_R, YBR);
    k.fuseV(FX_L, FZ, pos.f4 === 'BLOWN');
    k.fuseV(FX_R, FZ, pos.f3 === 'BLOWN');
    /* 札はそれぞれの管の【外側】へ置く＝2本のあいだに置くと、どちらの札か読めない。
       F3 の右は HX_R（ハイの縦チャンネル）まで 64px しかないので、はみ出していないか図で見る。 */
    s.push('<text x="102" y="' + (FZ + 22) + '" font-size="12" fill="' + C.deep + '" text-anchor="end">F4（左）</text>');
    s.push('<text x="102" y="' + (FZ + 38) + '" font-size="11.5" font-weight="700" text-anchor="end" fill="'
      + (pos.f4 === 'BLOWN' ? C.hi : C.ok) + '">' + (pos.f4 === 'BLOWN' ? '切れている' : '生きている') + '</text>');
    /* F3 の札はヒューズ箱の破線の囲いを跨ぐ＝地色で縁取って、線の上でも読めるようにする。 */
    var EDGE = ' paint-order="stroke" stroke="#fffdf8" stroke-width="3.5" stroke-linejoin="round"';
    s.push('<text x="230" y="' + (FZ + 22) + '" font-size="12" fill="' + C.deep + '"' + EDGE + '>F3（右）</text>');
    s.push('<text x="230" y="' + (FZ + 38) + '" font-size="11" font-weight="700" fill="'
      + (pos.f3 === 'BLOWN' ? C.hi : C.ok) + '"' + EDGE + '>' + (pos.f3 === 'BLOWN' ? '切れている' : '生きている') + '</text>');

    /* ヒューズ→左右のロービーム（横振りは短い＝ハイの縦線と交差させないため） */
    poly([[FX_L, FZ + 62], [FX_L, YLO], [XL + HRD, YLO], [XL + HRD, HD - 10]], k.wcol('w02-10', C.dim));
    poly([[FX_R, FZ + 62], [FX_R, YLO], [XR - HRD, YLO], [XR - HRD, HD - 10]], k.wcol('w02-09', C.dim));

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
      /* 中の2本のフィラメント＝【上がロー・下がハイ】＝実物の R2（Bilux）電球と同じ並び。
         ハイは反射鏡の焦点＝ランプの中心、ローは焦点の前かつ光軸より上で、その下をシェードが覆う。
         だからローの光は反射鏡の【上半分】にしか当たらず、下向きの配光になる（対向車をくらませない）。
         左右に並べ替えない＝以前は「線の着き方と同じ並び」で外＝ハイ・内＝ローに置いていたが、読者が実車の電球を覗くと上下に並んでいて合わなかった（第3回のセル接点と同型の誤り）。
         端子から粒へ引き込み線を引かない＝一度描いたが、左右の端子から中央の粒へ集まる2本がV字に見えて「線が交差している」と誤読させた。
         どちらの端子がどちらのフィラメントかは円の左右に出ている端子名（56a＝ハイ／56b＝ロー）と、上流の線の色で追える。 */
      var YLOF = HD - 10, YHIF = HD + 11;
      /* シェード＝ローの粒の下を覆う金属のカップ。実車では「カップが付いている方がロー」で見分けられる */
      s.push('<path d="M' + (cx - 9) + ',' + (YLOF + 6) + 'A9,5 0 0 0 ' + (cx + 9) + ',' + (YLOF + 6) + '" fill="none" stroke="#8d846f" stroke-width="2"/>');
      s.push('<circle cx="' + cx + '" cy="' + YLOF + '" r="5.5" fill="' + (loOn ? '#e0a921' : '#cfc7b4') + '"/>');
      s.push('<circle cx="' + cx + '" cy="' + YHIF + '" r="5.5" fill="' + (hiOn ? '#e0a921' : '#cfc7b4') + '"/>');
      /* 名前はレンズの真上（線の来ない場所） */
      s.push('<text x="' + cx + '" y="' + (HD - HRD - 12) + '" font-size="12" font-weight="700" fill="' + C.deep + '" text-anchor="middle">' + name + '</text>');
      k.term(cx - HRD - 2, HD, side === 'l' ? '56a' : '56b', 'l');
      k.term(cx + HRD + 2, HD, side === 'l' ? '56b' : '56a', 'r');
    }
    lens(XL, on['head_l.lo'], on['head_l.hi'], '左', 'l');
    lens(XR, on['head_r.lo'], on['head_r.hi'], '右', 'r');
    /* この註は【2行に割る】＝1行にすると左右のアース線（XL・XR の縦線）を文字が貫く */
    s.push('<text x="' + XC + '" y="' + (HD + HRD + 20) + '" font-size="10.5" fill="' + C.sub + '" text-anchor="middle">上の粒＝ロー（下がシェード）</text>');
    s.push('<text x="' + XC + '" y="' + (HD + HRD + 34) + '" font-size="10.5" fill="' + C.sub + '" text-anchor="middle">下の粒＝ハイ</text>');

    /* ================= アース ================= */
    if (m.cutGndL) cutV(XL, HD + HRD, GY, 'w02-14');
    else seg(XL, HD + HRD, XL, GY, 'w02-14');
    seg(XR, HD + HRD, XR, GY, 'w02-15');
    k.ground(XL, GY);
    k.ground(XR, GY);
    s.push('<text x="' + XC + '" y="' + (GY + 4) + '" font-size="11" fill="' + C.sub + '" text-anchor="middle">ロー・ハイは</text>');
    s.push('<text x="' + XC + '" y="' + (GY + 18) + '" font-size="11" fill="' + C.sub + '" text-anchor="middle">同じ1本のアースへ</text>');

    label(4, GY + 40, '左ハイ＝VERDE E NERO 緑／黒・右ハイ＝VERDE 緑', hlc.dead ? C.dim : WC.VERDE, null, 10.5);

    /* ================= 絵の中のスイッチを直接押せるようにする ================= 欄外のトグルと同じ操作を、絵の中の【そのスイッチ】の上でもできるようにする。
       透明な当たり判定の板をいちばん上に重ねるだけ＝絵の見た目は1ピクセルも変えない。
       最後に push する＝上に重ねないと、箱の中の文字や接触子がクリックを先に取る。
       指で押せる大きさに広げてある（箱の中で隣と重ならない範囲いっぱい）。主図のときだけ描く＝紙芝居のコマに押せる板を置くと、押しても何も起きず読者を惑わす。 */
    if (m.main) {
      function hit(x, y, w, h, set, tip) {
        s.push('<rect class="hit" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h
          + '" rx="6" fill="transparent" data-set="' + set + '"><title>' + tip + '</title></rect>');
      }
      /* ライトスイッチの「切」「入」。座標は上の lightSwitch() と対（sx = bx+45+i*70）。
         この絵が唯一の操作面なので、箱の見出し帯より下は【箱の幅いっぱい・下端まで】を当たり判定にする
         ＝ボタンの絵（48×24）だけを当たり判定にすると、押したのに反応しない帯ができる。 */
      hit(70, SW + 38, 80, SH - 38, 'lights=OFF', 'ライトスイッチを切る');
      hit(150, SW + 38, 80, SH - 38, 'lights=ON', 'ライトスイッチを入れる');
      /* コラムレバーの3段。端子の間隔が狭い（ハイ110・中央150・ロー216）ので、隣との中点で割って箱の幅いっぱいまで広げている。 */
      hit(64, CM + 38, 66, CH - 38, 'beam=HIGH', 'コラムレバーを III（ハイビーム）へ');
      hit(130, CM + 38, 53, CH - 38, 'beam=POS', 'コラムレバーを I（車幅灯）へ');
      hit(183, CM + 38, 53, CH - 38, 'beam=LOW', 'コラムレバーを II（ロービーム）へ');
    }

    return GY + 54;
  }

  /* ---- トグル（唯一の操作＝ロー↔ハイ） ---- */
  /* トグルは2軸＝ダッシュのライトスイッチ（切／入）×コラムレバー（I／II／III）。
     6通りのうち【絵が変わるのは4通り】で、ライトスイッチが切の3通りはどれも真っ暗になる。
     その「押しても変わらない」こそがこの回の主張（スイッチを2つ通らないと点かない）なので、黙って何も起きないままにせず、必ずキャプションで言葉にする。 */
  var CAPS_OFF = {
    POS: '<b>ライトスイッチが切。</b>コラムレバーは I（車幅灯）の位置ですが、'
       + '<b>スイッチから先へは電気が出ていきません</b>。ヘッドライトまでの道が、どこも光っていないのが見えます。',
    LOW: '<b>ライトスイッチが切のまま、コラムレバーをロー側へ倒しました。</b>——<b>何も変わりません。</b>'
       + '⭐この回路は<b>スイッチを2つ通らないと点かない</b>ので、<b>手前のひとつが切れている間、コラムレバーがどこにあるかは関係がない</b>のです。',
    HIGH: '<b>ライトスイッチが切のまま、いちばん下（ハイ）まで倒しました。</b>——<b>やはり何も起きません。</b>'
       + '⭐犯人がライトスイッチより手前にいるとき、<b>コラムレバーをいくら動かしても症状は1ミリも変わりません</b>。'
       + 'これが「コラムレバーを動かして変化が無いなら、見に行くのはダッシュの裏」と言える理由です。'
  };
  var CAPS_ON = {
    POS: '<b>ライトスイッチを入れました。コラムレバーはまだ I。</b>スイッチの箱は「入」に変わりましたが、'
       + '<b>黄色い点はヘッドライトへ進みません</b>——<b>コラムレバーが電気をロー側にもハイ側にも渡していない</b>からです。'
       + '（車幅灯とナンバー灯はこの位置でもう点いています。この絵は F5・F6 の先を端子で止めてあるので、そこは描かれていません。）'
       + '⭐<b>車幅灯は点いているのに前だけ暗い</b>なら、犯人はコラムレバーから先です。',
    LOW: '<b>ロービーム。</b>コラムレバーが「ロー」側に倒れています。黄色い点が、'
       + '<b>ヒューズ箱の中で左右に分かれて</b>2つの電球へ届いているのが見えます。<b>表示灯は消えたまま</b>です。',
    HIGH: '<b>ハイビーム。</b>コラムレバーが「ハイ」側に倒れました。こんどは<b>この先でヒューズに寄らず</b>'
       + '左右へ直行します（⭐ハイ側を守っているのは、<b>その手前の F5・F6</b> です）。左の線からは<b>表示灯</b>も分かれていて、これが計器盤で青く光ります。'
  };
  function capFor(st) { return (st.lights === 'OFF' ? CAPS_OFF : CAPS_ON)[st.beam]; }

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function rd(id) { return function (sc) { return !!sc.on[id]; }; }
  var HEAD_LOW = { key: 'ON', lights: 'ON', beam: 'LOW' }, HEAD_HIGH = { key: 'ON', lights: 'ON', beam: 'HIGH' };
  var CHECKS = [
    { label: 'ライトスイッチが切',                                   s: { inputs: { key: 'ON', lights: 'OFF' } },  expect: false },
    { label: '⭐ライトスイッチが切ならコラムレバーを III に倒しても点かない', s: { inputs: { key: 'ON', lights: 'OFF', beam: 'HIGH' } }, expect: false, read: rd('head_l.hi') },
    { label: 'コラムレバーが I（車幅灯）＝ヘッドライトはまだ点かない', s: { inputs: { key: 'ON', lights: 'ON', beam: 'POS' } }, expect: false },
    { label: 'ライトスイッチが前照灯・ロー（キーは位置1）',  s: { inputs: HEAD_LOW },                      expect: true },
    /* ⭐【2026-09-02 訂正】旧版はここを「キーはOFFのままでも点く／ONにしても変わらない」としていた＝誤り。
       30/4 はキー位置1か位置2でしか生きない（原典3点＋オーナーの実車確認で決着）。位置0では点かない。 */
    { label: '⭐同じ場面でキーを位置0（切）に戻すと点かない', s: { inputs: { key: 'OFF', lights: 'ON', beam: 'LOW' } }, expect: false },
    { label: 'ロー・F4（左）が切れた／左を見る',           s: { inputs: { key: 'ON', lights: 'ON', beam: 'LOW', f4: 'BLOWN' } }, expect: false },
    { label: '同じ場面で右を見る（右は点いている）',        s: { inputs: { key: 'ON', lights: 'ON', beam: 'LOW', f4: 'BLOWN' } }, expect: true,  read: rd('head_r.lo') },
    { label: 'ロー・F3（右）が切れた／右を見る',           s: { inputs: { key: 'ON', lights: 'ON', beam: 'LOW', f3: 'BLOWN' } }, expect: false, read: rd('head_r.lo') },
    { label: '⭐ハイのとき F4 が切れていても左は点く',      s: { inputs: { key: 'ON', lights: 'ON', beam: 'HIGH', f4: 'BLOWN' } }, expect: true,  read: rd('head_l.hi') },
    { label: '⭐ハイのとき F3 が切れていても右は点く',      s: { inputs: { key: 'ON', lights: 'ON', beam: 'HIGH', f3: 'BLOWN' } }, expect: true,  read: rd('head_r.hi') },
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
    { label: '⭐30/4 の線が切れた＝キーをONにしても点かない', s: { inputs: { key: 'ON', lights: 'ON', beam: 'LOW' }, ops: [{ op: 'removeWire', id: 'w02-01' }] }, expect: false }
  ];

  Journey.boot({
    lampId: 'head_l.lo',
    alt: false,
    draw: draw,
    caps: capFor,
    checks: CHECKS,
    mainInit: 'LOW',
    /* 2軸トグル＝この回だけがスイッチを2つ直列に通る（他の回はスイッチが1つなので単軸のまま） */
    mainAxes: [{ key: 'lights', init: 'ON' }, { key: 'beam', init: 'LOW' }],
    /* このストーリーのトグルが動かすのは【コラムレバー】＝キーでもエンジンでもない。キーは既定の OFF のまま＝「キーは関係ない」がトグルを触っても崩れないようにする。 */
    mainInputs: function (st) { return { key: 'ON', lights: st.lights, beam: st.beam }; },
    /* 全負荷の点灯を絵から読めるようにする（ロー・ハイ・表示灯の5つを同時に見るため） */
    extra: function (sc) {
      sc.on = {};
      for (var i = 0; i < sc.r.loads.length; i++) sc.on[sc.r.loads[i].id] = sc.r.loads[i].on;
    },
    /* 黄点の向き＝どれかの灯が点いていれば下向き（電源から灯へ） */
    /* ⚠️アース（w02-14/15）と表示灯のアース（w02-16）は【常に電位がある】＝
       どれか1つでも点いていれば流す、では消えている側にも粒が出てしまう。id ごとに判じる。 */
    flow: function (sc, id) {
      var o = sc.on || {};
      var L = o['head_l.lo'] || o['head_l.hi'];
      var R = o['head_r.lo'] || o['head_r.hi'];
      if (id === 'w02-14') return L ? 'down' : null;
      if (id === 'w02-15') return R ? 'down' : null;
      if (id === 'w02-16') return o['hi_ind'] ? 'down' : null;
      return (L || R) ? 'down' : null;
    },
    scenes: function (scenario) {
      return [
        { id: 'j-f4',    sc: scenario({ inputs: { key: 'ON', lights: 'ON', beam: 'LOW', f4: 'BLOWN' } }), mode: {} },
        { id: 'j-f4hi',  sc: scenario({ inputs: { key: 'ON', lights: 'ON', beam: 'HIGH', f4: 'BLOWN' } }), mode: {} },
        { id: 'j-gndl',  sc: scenario({ inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-14' }] }), mode: { cutGndL: true } },
        { id: 'j-hicut', sc: scenario({ inputs: HEAD_HIGH, ops: [{ op: 'removeWire', id: 'w02-11' }] }), mode: { cutHiL: true } },
        { id: 'j-cutc',  sc: scenario({ inputs: HEAD_LOW, ops: [{ op: 'removeWire', id: 'w02-06' }] }), mode: { cutC: true } },
        { id: 'j-pos',   sc: scenario({ inputs: { key: 'ON', lights: 'ON', beam: 'POS' } }), mode: {} },
        { id: 'j-fixed', sc: scenario({ inputs: HEAD_LOW }), mode: {} }
      ];
    }
  });
})();
