/* ストーリー第9回「スモールランプが点かない」の絵。図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。
   このストーリーだけの特徴が3つある。①【ライトスイッチひとつで、前の車幅灯・後ろのテール・ナンバー灯・メーターの緑が同時に点く】。
   コラムレバー（ロー／ハイ）はいっさい関係しない＝根拠は純正取説 500L p9-5 「con interruttore inserito si accendono le luci di posizione, la luce targa」。
   ②【ヒューズ2本がたすき掛け】＝F5 は〈右前＋左後〉、F6 は〈左前＋右後＋ナンバー灯＋緑の表示灯〉。
   前2つ・後ろ2つではない。だから「右の前と左の後ろが同時に消える」という、実車で見ると意味の分からない消え方をする。
   この絵で線が2回すれ違うのは実車がそうだから。③【メーターの緑の表示灯が F6 側にしか無い】＝緑が点いたまま片側だけ消えていれば F5。
   緑ごと消えていれば F6 か、もっと手前（ライトスイッチ）。切り分けの手がかりが運転席にある。
   F5・F6 からコミュテータへ入る枝（30/2・30/3）は、コミュテータの内部接点が原典で読めないのでこの絵には出さない（第8回その67⑥と同じ扱い）。
   ⭐ただし【その枝が何を守っているか】は判明している＝純正取説の表「CIRCUITI PROTETTI DALLE VALVOLE」で F5＝左ハイビーム＋その表示灯／F6＝右ハイビーム（D・L・R の3型式とも同内容・HANDOFF その108）。
   ⛔「その先は原典から読めない」とは書かない＝読めないのはコミュテータ内部の接点だけ。本文の列挙・切り分けの表・footer② はこの表で受けてある。
   「F5 が切れたらヘッドライトはどうなるか」をこの絵に答えさせない。外側から右前(260)／右後(228)／中央(118)／左後(72)／左前(40)。
   【外側へ行く枝ほど上で分岐する】と決めると、すれ違いが2箇所で済む（順序を変えると4箇所になる）。
   ・すれ違いは2箇所＝F6→右後が F5 の縦線を跨ぐ／F5→左後が中央の縦線を跨ぐ。
   そこに node を打たない＝繋がって見せない。・灯は前の列（y=690）と後ろの列（y=800）の2段。
   実車の前後と同じ並びにしてある。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;

  var XC = 150;                     /* 中央の幹線（バッテリー〜キー〜ライトスイッチ） */
  var KT = 196, KH = 80;            /* キースイッチの箱 */
  var SW = 320, SH = 76;            /* 外部照明SWの箱 */
  var BOX_T = 440, BOX_B = 546;     /* ヒューズ箱の囲い */
  var YBR = 452;                    /* 箱の中の渡り（F6の入り⇔ F5の入り） */
  var FZ = 470;                     /* ヒューズ管。上端 FZ・下端 FZ+62 */
  var FX6 = 96, FX5 = 204;          /* F6（左）・F5（右） */
  var FB = FZ + 62;                 /* ヒューズの下端＝ここから枝が出る */
  /* 枝の高さ。外側へ行く枝ほど上（この順序がすれ違いの数を決める） */
  var Y_RF = 566, Y_RR = 584, Y_LF = 602, Y_MID = 620, Y_LR = 638;
  var XLF = 40, XLR = 72, XMD = 104, XRR = 228, XRF = 260;  /* 5本の縦チャンネル */
  /* XMD は【ナンバー灯の箱（XC±42＝108〜192）の外】に置く。118 にすると線が箱に飲まれて消える。 */
  var LF_T = 690, LR_T = 800, LH = 44;   /* 前の列・後ろの列の灯（上端と高さ） */
  var GF = 752, GR = 862;                /* アース記号の高さ（前の列・後ろの列） */

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    var lightOn = pos.light_sw === 'ON';
    var b5 = pos.f5 === 'BLOWN', b6 = pos.f6 === 'BLOWN';
    var m = mode || {};
    var on = sc.on || {};

    function seg(a, b, c, d, e, f) { k.seg(a, b, c, d, e, f); }
    /* 横線は segH＝線を引いて、通電していれば横向きの黄点も流す。引数は【電源側→負荷側】の順（x1 が電源側）＝その並びが流れの向きになる。 */
    function segH(x1, y, x2, id, thick, fallback) { k.segH(x1, y, x2, id, thick, fallback); }
    function label(x, y, t, col, anchor, size) { k.label(x, y, t, col, anchor, size); }

    /* 赤地に白抜きの札（第4回の道具）。1つの絵に1枚まで。 */
    function chip(x, y, t) {
      var w = t.length * 12 + 14, h = 22;
      s.push('<rect x="' + x + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="5" fill="' + C.hi + '"/>');
      s.push('<text x="' + (x + 7) + '" y="' + (y + 4.5) + '" font-size="12" font-weight="700" fill="#fffdf8">' + t + '</text>');
    }

    /* 同じ後コンビランプの中の別のフィラメントなので、色まで同じにすると読者が同じ球だと思う。 */
    function smallLamp(cx, top, name, lit, w) {
      var hw = (w || 48) / 2;
      if (lit) {
        s.push('<g class="lampglow"><ellipse cx="' + cx + '" cy="' + (top + LH / 2) + '" rx="' + (hw + 18) + '" ry="34" fill="url(#jsmg)"/></g>');
      }
      s.push('<rect x="' + (cx - hw) + '" y="' + top + '" width="' + (hw * 2) + '" height="' + LH + '" rx="9" fill="' + (lit ? '#e8912a' : '#6b5c46') + '" stroke="' + (lit ? '#ffe0b4' : '#8d8574') + '" stroke-width="' + (lit ? 3 : 2) + '"/>');
      if (lit) s.push('<rect x="' + (cx - hw + 6) + '" y="' + (top + 5) + '" width="' + (hw * 2 - 12) + '" height="8" rx="4" fill="#fff" opacity=".32"/>');
      s.push('<text x="' + cx + '" y="' + (top + 28) + '" font-size="11.5" font-weight="700" fill="' + (lit ? '#fffdf8' : '#cdc7b8') + '" text-anchor="middle">' + name + '</text>');
    }
    /* 灯の下に「点いている／点かない」を置く。前の列は下に後ろの列が控えているのでアース記号との間に入れる＝高さを固定せず、呼ぶ側が渡す。 */
    function state(cx, y, lit, anchor) {
      s.push('<text x="' + cx + '" y="' + y + '" font-size="11" font-weight="700" fill="'
        + (lit ? '#2f7d4f' : C.hi) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + (lit ? '点いている' : '点かない') + '</text>');
    }

    /* ===== メーターの中の【緑の】表示灯 ===== 共通の lampWindow は赤（警告灯）専用＝この灯は警告ではなく【点いていることの確認】なので緑で描く。
       電球アイコンも点滅も足さない（既存の警告灯と同じ流儀）。 */
    function greenInd(cx, top, lit) {
      var hw = lit ? 30 : 27, hh = lit ? 30 : 26;
      if (lit) {
        s.push('<defs><radialGradient id="jposg">'
          + '<stop offset="0%" stop-color="#5fd48a" stop-opacity=".95"/>'
          + '<stop offset="45%" stop-color="#2f7d4f" stop-opacity=".45"/>'
          + '<stop offset="100%" stop-color="#2f7d4f" stop-opacity="0"/></radialGradient></defs>');
        s.push('<g class="lampglow"><ellipse cx="' + cx + '" cy="' + (top + 14) + '" rx="52" ry="34" fill="url(#jposg)"/></g>');
      }
      s.push('<rect x="' + (cx - hw) + '" y="' + top + '" width="' + (hw * 2) + '" height="' + hh + '" rx="6" fill="' + (lit ? '#2f9d5f' : '#eae4d5') + '" stroke="' + (lit ? '#b8f0cd' : '#c3bba6') + '" stroke-width="' + (lit ? 3 : 2) + '"/>');
      if (lit) s.push('<rect x="' + (cx - hw + 5) + '" y="' + (top + 3) + '" width="' + (hw * 2 - 10) + '" height="8" rx="4" fill="#fff" opacity=".3"/>');
      s.push('<text x="' + cx + '" y="' + (top + (lit ? 21 : 19)) + '" font-size="11.5" font-weight="700" fill="' + (lit ? '#fffdf8' : '#a89f8b') + '" text-anchor="middle">緑</text>');
    }

    if (on.pos_l || on.pos_r || on.tail_l || on.tail_r || on.plate) {
      s.push('<defs><radialGradient id="jsmg">'
        + '<stop offset="0%" stop-color="#ffb14a" stop-opacity=".85"/>'
        + '<stop offset="45%" stop-color="#ff9020" stop-opacity=".38"/>'
        + '<stop offset="100%" stop-color="#ff9020" stop-opacity="0"/></radialGradient></defs>');
    }

    /* ===== バッテリー〜キースイッチ＝第8回と同じ道（キーの【外側】から取る） ===== */
    k.battery(XC);
    k.term(XC, 74, '+', 'l');
    seg(XC, 62, XC, KT, 'w11-01', true);
    label(XC + 28, 120, 'バッテリーから', C.sub, null, 11);
    label(XC + 28, 136, 'ヒューズ箱を経て', C.sub, null, 11);

    k.keySwitch(XC, KT, pos.ign_sw === 'ON', XC + 62);
    k.term(XC, KT + 10, '30', 'l');
    k.term(XC, KT + 62, '30/4', 'l');
    /* 30/4＝キーの位置に関係なく常に電気が来ている端子。ここが第8回と共通の入口。
       説明の2行はここに置かない＝幹線（x=XC）と重なる。 */
    /* ⚠️線は【箱の底】KT+48 から出す（共通 k.keySwitch の箱は高さ48）。
       端子バッジは KT+62 のままでよいが、線の始点を 62 にすると箱と線の間が14px空いて
       「キースイッチの下で線が切れている」ように見える（2026-08-31 ユーザー指摘）。 */
    seg(XC, KT + 48, XC, SW, 'w02-01');
    label(XC + 14, KT + 100, 'NERO 黒', C.sub, null, 11);

    /* ===== ライトスイッチ ===== */
    /* ダッシュのトグル（入／切の2位置）。第8回と同じ部品なので、同じ形・同じ座標で描く。
       この絵の「切」「入」が、この回で唯一の操作面＝押せるようにする透明な板は draw の最後に重ねる。 */
    (function lightSwitch() {
      var bx = XC - 80, bw = 160;
      s.push('<rect x="' + bx + '" y="' + SW + '" width="' + bw + '" height="' + SH + '" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
      s.push('<text x="' + XC + '" y="' + (SW + 19) + '" font-size="12" fill="#fffdf8" text-anchor="middle">ライトスイッチ</text>');
      s.push('<text x="' + XC + '" y="' + (SW + 33) + '" font-size="10.5" fill="' + C.in_ + '" text-anchor="middle">ダッシュ・入／切（部品24）</text>');
      var STEP = [['OFF', '切'], ['ON', '入']];
      for (var i = 0; i < 2; i++) {
        var sx = bx + 45 + i * 70, cur = (lightOn === (STEP[i][0] === 'ON'));
        s.push('<rect x="' + (sx - 24) + '" y="' + (SW + 42) + '" width="48" height="24" rx="5" fill="' + (cur ? C.in_ : 'none') + '" stroke="' + C.in_ + '" stroke-width="1.6"/>');
        s.push('<text x="' + sx + '" y="' + (SW + 58) + '" font-size="11" font-weight="' + (cur ? '700' : '400') + '" fill="' + (cur ? C.deep : C.in_) + '" text-anchor="middle">' + STEP[i][1] + '</text>');
      }
    })();

    seg(XC, SW + SH, XC, BOX_T, 'w02-02');
    label(XC + 14, SW + SH + 22, 'VERDE 緑', C.sub, null, 11);

    /* ===== ヒューズ箱＝入り側は箱の中でつながっている ===== */
    /* 囲いは図幅いっぱい（4〜296）にする。FX6-46 から始めると F6 の札が置けず、札を内側に寄せると F6 の縦線を文字が貫く。 */
    s.push('<rect x="4" y="' + BOX_T + '" width="292" height="' + (BOX_B - BOX_T) + '" rx="10" fill="none" stroke="' + C.sub + '" stroke-width="1.6" stroke-dasharray="6 5"/>');
    label(8, BOX_T - 5, 'ヒューズ箱の中', C.sub, null, 11);
    /* 箱の中の渡り（F6の入り⇔ F5の入り）＝VERDE は1本しか来ない */
    /* 中央から左右へ分かれる＝1本の横線では向きを表せないので、XC を起点に2本へ分ける */
    segH(XC, YBR, FX6, 'w02-03');
    segH(XC, YBR, FX5, 'w02-03');
    seg(XC, BOX_T, XC, YBR, 'w02-02');
    k.node(XC, YBR);
    seg(FX6, YBR, FX6, FZ, 'w02-03');
    seg(FX5, YBR, FX5, FZ, 'w02-03');
    k.fuseV(FX6, FZ, b6, null);
    k.fuseV(FX5, FZ, b5, null);
    /* ヒューズの札。F6 は内向き・F5 は外向き＝外向きに揃えると左の縦チャンネルを貫く */
    label(10, FZ + 22, 'F6', C.deep, null, 12);
    s.push('<text x="10" y="' + (FZ + 38) + '" font-size="11" font-weight="700" fill="' + (b6 ? C.hi : C.ok) + '">' + (b6 ? '切れている' : '生きている') + '</text>');
    label(FX5 + 22, FZ + 22, 'F5', C.deep, null, 12);
    s.push('<text x="' + (FX5 + 22) + '" y="' + (FZ + 38) + '" font-size="11" font-weight="700" fill="' + (b5 ? C.hi : C.ok) + '">' + (b5 ? '切れている' : '生きている') + '</text>');

    /* ===== ここから下がたすき掛け ===== 外側へ行く枝ほど上で分岐する（この順序でだけ、すれ違いが2箇所で済む）。 */
    /* F5 の縦線（下端は左後への枝まで）／F6 の縦線（下端は中央への枝まで） */
    seg(FX5, FB, FX5, Y_LR, 'w03-05');
    seg(FX6, FB, FX6, Y_MID, 'w03-01');

    /* ① F5 →右前の車幅灯（外側＝いちばん上） */
    segH(FX5, Y_RF, XRF, 'w03-05');
    seg(XRF, Y_RF, XRF, LF_T, 'w03-05');
    k.node(FX5, Y_RF);
    /* ② F6 →右後のテール（ここで F5 の縦線とすれ違う＝node を打たない） */
    segH(FX6, Y_RR, XRR, 'w03-02');
    seg(XRR, Y_RR, XRR, LR_T, 'w03-02');
    k.node(FX6, Y_RR);
    /* ③ F6 →左前の車幅灯 */
    segH(FX6, Y_LF, XLF, 'w03-01');
    seg(XLF, Y_LF, XLF, LF_T, 'w03-01');
    k.node(FX6, Y_LF);
    /* ④ F6 →中央（メーターの緑とナンバー灯） */
    segH(FX6, Y_MID, XMD, 'w03-03');
    seg(XMD, Y_MID, XMD, LR_T + 14, 'w03-04');
    seg(XMD, Y_MID, XMD, 660, 'w03-03');
    k.node(XMD, 660);
    segH(XMD, 660, XC, 'w03-03');
    seg(XC, 660, XC, LF_T, 'w03-03');
    segH(XMD, LR_T + 14, XC - 24, 'w03-04');
    /* ⑤ F5 →左後のテール（ここで中央の縦線とすれ違う＝node を打たない） */
    segH(FX5, Y_LR, XLR, 'w03-06');
    seg(XLR, Y_LR, XLR, LR_T, 'w03-06');

    /* 色ラベルを横線の上に置くのは【この回では成立しない】＝5本の縦チャンネルを必ず貫く。
       そのうえ GIALLO と GIALLO E NERO は WC で同じ色（二色線の黒い破線は描き分けない流儀）なので、線の色でも区別できない。
       だから【どちらのヒューズの先か】を縦線の脇に書き、色名は図の外（下）へ出した。 */
    function fzTag(x, t, anchor) { label(x, 672, t, C.sub, anchor, 9.5); }
    fzTag(XLF + 7, 'F6');
    fzTag(XLR + 7, 'F5');
    fzTag(XMD + 7, 'F6');
    fzTag(XRR - 7, 'F6', 'end');
    fzTag(XRF - 7, 'F5', 'end');

    /* ===== 灯（前の列） ===== */
    smallLamp(XLF, LF_T, '左前', !!on.pos_l);
    smallLamp(XRF, LF_T, '右前', !!on.pos_r);
    greenInd(XC, LF_T, !!on.warn_pos);
    state(XLF, GF - 8, !!on.pos_l, 'middle');
    state(XRF, GF - 8, !!on.pos_r, 'middle');
    label(XC + 16, LF_T + 46, 'メーターの中', C.sub, 'middle', 10.5);  /* 中央へ寄せると XMD の縦線に重なる */
    k.ground(XLF, GF + 6, null);
    k.ground(XRF, GF + 6, null);
    /* ===== 灯（後ろの列） ===== */
    smallLamp(XLR, LR_T, '左後', !!on.tail_l);
    smallLamp(XRR, LR_T, '右後', !!on.tail_r);
    smallLamp(XC, LR_T, 'ナンバー灯', !!on.plate, 84);
    state(XLR, GR - 8, !!on.tail_l, 'middle');
    state(XRR, GR - 8, !!on.tail_r, 'middle');
    state(XC, GR - 8, !!on.plate, 'middle');
    k.ground(XLR, GR + 6, null);
    k.ground(XRR, GR + 6, null);
    k.ground(XC, GR + 6, null);

    /* 色の凡例＝線と重ならない図の外（アースの下）に置く */
    label(4, 894, 'F6 の先＝GIALLO E NERO（黄／黒）', C.sub, null, 10);
    label(4, 908, 'F5 の先＝GIALLO（黄）', C.sub, null, 10);

    /* 場面ごとの札。1つの絵に1枚まで */
    /* 札はヒューズ箱の【上】の同じ場所に出す＝どちらが切れたかは札の文字と、管の中の切れた印で読む。
       F5 の側（右）に置くと図幅（300）からはみ出し、内側へ寄せると F5 の縦線を貫く。 */
    if (m.f5) chip(4, BOX_T - 26, 'F5 が切れた');
    else if (m.f6) chip(4, BOX_T - 26, 'F6 が切れた');
    else if (m.off) chip(XC - 80, SW - 14, 'ライトスイッチが切');

    /* 絵の中のスイッチを直接押せるようにする＝透明な当たり判定の板を、いちばん最後に（＝いちばん上に）重ねる。
       fill="transparent" にする（"none" だとクリックが素通りする）。主図のときだけ描く＝紙芝居のコマに押せる板を置くと、押しても何も起きず読者を惑わす。
       箱の見出しの帯より下は、ボタンの絵（48×24）だけでなく【箱の幅いっぱい・下端まで】を当たり判定にする＝押したのに反応しない帯を作らない。 */
    if (m.main) {
      var hit = function (x, y, w, h, set, tip) {
        s.push('<rect class="hit" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h
          + '" rx="6" fill="transparent" data-set="' + set + '"><title>' + tip + '</title></rect>');
      };
      hit(70, SW + 38, 80, SH - 38, 'OFF', 'ライトスイッチを切る');
      hit(150, SW + 38, 80, SH - 38, 'ON', 'ライトスイッチを入れる');
    }

    return 920;
  }

  /* ---- トグル（ライトスイッチ切↔入）＝キーはOFFのまま＝これがこの回の最初の驚き ---- */
  var CAPS = {
    OFF: '<b>ダッシュのライトスイッチが切。</b>ヒューズ箱までは電気が来ていません。前も後ろもナンバー灯も、メーターの緑も、すべて消えたままです。<b>キーは抜いてあります</b>が、この回路にはもともと関係がありません。',
    ON: '<b>ライトスイッチを入れました。</b>キーは抜いたままです。緑の線がヒューズ箱に入り、箱の中で<b>2本のヒューズ（F5・F6）に分かれます</b>。そこから先が問題で、<b>F5 は〈右前と左後〉、F6 は〈左前と右後とナンバー灯と緑の表示灯〉</b>——前後ではなく<b>たすき掛け</b>に分かれています。⭐<b>ハイビームもこの2本の先にいます</b>（左が F5・右が F6）が、この絵には出していません。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function get(sc, id) { for (var i = 0; i < sc.r.loads.length; i++) if (sc.r.loads[i].id === id) return sc.r.loads[i].on; return false; }
  function posR(sc) { return get(sc, 'pos_r'); }
  function tailL(sc) { return get(sc, 'tail_l'); }
  function tailR(sc) { return get(sc, 'tail_r'); }
  function plate(sc) { return get(sc, 'plate'); }
  function green(sc) { return get(sc, 'quadro.warn_pos'); }
  /* ヘッドライトは1つの電球に2本のフィラメント＝負荷は head_l.lo / head_l.hi の2つ（第8回）。
     `head_l` という負荷は存在しないので、必ずどちらかを指定する。 */
  function headL(sc) { return get(sc, 'head_l.lo'); }
  function horn(sc) { return get(sc, 'horn'); }
  var LW = ['点く', '点かない'], GW = ['点く', '消える'], HW = ['鳴る', '鳴らない'];
  var ON = { lights: 'ON' };
  function cut(id) { return [{ op: 'removeWire', id: id }]; }
  var CHECKS = [
    /* この回のいちばんの主張＝キーを抜いたままでも点く */
    { label: 'キーOFF・ライトスイッチを入れる（左前）', s: { inputs: ON }, expect: true, words: LW },
    { label: '↑同じ場面の右前', s: { inputs: ON }, expect: true, read: posR, words: LW },
    { label: '↑同じ場面の左後', s: { inputs: ON }, expect: true, read: tailL, words: LW },
    { label: '↑同じ場面の右後', s: { inputs: ON }, expect: true, read: tailR, words: LW },
    { label: '↑同じ場面のナンバー灯', s: { inputs: ON }, expect: true, read: plate, words: LW },
    { label: '↑同じ場面のメーターの緑', s: { inputs: ON }, expect: true, read: green, words: GW },
    { label: 'ライトスイッチが切（左前）', s: { inputs: { lights: 'OFF' } }, expect: false, words: LW },
    { label: '↑同じ場面のメーターの緑', s: { inputs: { lights: 'OFF' } }, expect: false, read: green, words: GW },
    /* たすき掛け＝F5 が切れると【右前と左後】だけが消える */
    { label: 'F5 が切れた（左前は無事）', s: { inputs: { lights: 'ON', f5: 'BLOWN' } }, expect: true, words: LW },
    { label: '↑同じ場面の右前（消える）', s: { inputs: { lights: 'ON', f5: 'BLOWN' } }, expect: false, read: posR, words: LW },
    { label: '↑同じ場面の左後（消える）', s: { inputs: { lights: 'ON', f5: 'BLOWN' } }, expect: false, read: tailL, words: LW },
    { label: '↑同じ場面の右後（無事）', s: { inputs: { lights: 'ON', f5: 'BLOWN' } }, expect: true, read: tailR, words: LW },
    { label: '↑同じ場面のナンバー灯（無事）', s: { inputs: { lights: 'ON', f5: 'BLOWN' } }, expect: true, read: plate, words: LW },
    { label: '↑同じ場面のメーターの緑（点いたまま＝手がかり）', s: { inputs: { lights: 'ON', f5: 'BLOWN' } }, expect: true, read: green, words: GW },
    /* F6 が切れると【左前・右後・ナンバー灯・緑】が消える */
    { label: 'F6 が切れた（左前は消える）', s: { inputs: { lights: 'ON', f6: 'BLOWN' } }, expect: false, words: LW },
    { label: '↑同じ場面の右前（無事）', s: { inputs: { lights: 'ON', f6: 'BLOWN' } }, expect: true, read: posR, words: LW },
    { label: '↑同じ場面の左後（無事）', s: { inputs: { lights: 'ON', f6: 'BLOWN' } }, expect: true, read: tailL, words: LW },
    { label: '↑同じ場面の右後（消える）', s: { inputs: { lights: 'ON', f6: 'BLOWN' } }, expect: false, read: tailR, words: LW },
    { label: '↑同じ場面のナンバー灯（消える）', s: { inputs: { lights: 'ON', f6: 'BLOWN' } }, expect: false, read: plate, words: LW },
    { label: '↑同じ場面のメーターの緑（消える）', s: { inputs: { lights: 'ON', f6: 'BLOWN' } }, expect: false, read: green, words: GW },
    /* 1灯だけの故障＝球切れやアース外れは、その灯だけが消える */
    { label: '左前のアース（w03-07）が外れた', s: { inputs: ON, ops: cut('w03-07') }, expect: false, words: LW },
    { label: '↑同じ場面の右前（無事）', s: { inputs: ON, ops: cut('w03-07') }, expect: true, read: posR, words: LW },
    { label: 'ナンバー灯への枝（w03-04）が外れた', s: { inputs: ON, ops: cut('w03-04') }, expect: false, read: plate, words: LW },
    { label: '↑同じ場面の左前（無事）', s: { inputs: ON, ops: cut('w03-04') }, expect: true, words: LW },
    /* ライトスイッチより手前で切れた＝全部消える */
    { label: 'ライトスイッチからヒューズ箱への緑線（w02-02）が外れた（左前）', s: { inputs: ON, ops: cut('w02-02') }, expect: false, words: LW },
    { label: '↑同じ場面の右前（同じく消える）', s: { inputs: ON, ops: cut('w02-02') }, expect: false, read: posR, words: LW },
    { label: '↑同じ場面のメーターの緑（同じく消える）', s: { inputs: ON, ops: cut('w02-02') }, expect: false, read: green, words: GW },
    /* ⭐ロービームはこの2本を通らない＝F3・F4 の先（第8回で確かめた道）。⚠️ハイビームのほうは F5・F6 の先にいる（その108）ので「ヘッドライトは通らない」とは書かない */
    { label: 'F5・F6 が両方切れてもヘッドライト（ロー）は点く', s: { inputs: { lights: 'ON', beam: 'LOW', f5: 'BLOWN', f6: 'BLOWN' } }, expect: true, read: headL, words: LW },
    { label: '↑同じ場面でホーンも鳴る（別のヒューズ）', s: { inputs: { lights: 'ON', f5: 'BLOWN', f6: 'BLOWN', horn_btn: 'PRESSED' } }, expect: true, read: horn, words: HW },
    { label: 'バッテリーのマイナス端子（w11-10）が外れた', s: { inputs: ON, ops: cut('w11-10') }, expect: false, words: LW },
    { label: 'オルタネーター換装車・ライトスイッチを入れる', s: { alt: true, inputs: ON }, expect: true, words: LW }
  ];

  Journey.boot({
    lampId: 'pos_l',
    lampName: '左前の車幅灯',
    alt: false,
    mainInit: 'ON',
    /* キーは OFF のまま＝この回路がキーの外側にいることを、トグルそのもので見せる */
    mainInputs: function (v) { return { key: 'OFF', lights: v }; },
    /* 主役以外の5灯も場面ごとに拾う */
    extra: function (sc) {
      sc.on = {
        pos_l: get(sc, 'pos_l'), pos_r: get(sc, 'pos_r'),
        tail_l: get(sc, 'tail_l'), tail_r: get(sc, 'tail_r'),
        plate: get(sc, 'plate'), warn_pos: get(sc, 'quadro.warn_pos')
      };
    },
    /* 黄点の向き。アースの線は【その灯が点いているときだけ】流れる */
    flow: function (sc, id) {
      var o = sc.on || {};
      if (id === 'w03-07') return o.pos_l ? 'down' : null;
      if (id === 'w03-08') return o.pos_r ? 'down' : null;
      if (id === 'w03-09') return o.tail_l ? 'down' : null;
      if (id === 'w03-10') return o.tail_r ? 'down' : null;
      if (id === 'w03-11') return o.plate ? 'down' : null;
      return (o.pos_l || o.pos_r || o.tail_l || o.tail_r || o.plate) ? 'down' : null;
    },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* ★①ライトスイッチが切＝これは故障ではない（最初に潰す迷い道） */
        { id: 'j-off', sc: scenario({ inputs: { key: 'OFF', lights: 'OFF' } }), mode: { off: true } },
        /* ★②F5 が切れた＝右前と左後だけが消える。緑は点いたまま */
        { id: 'j-f5', sc: scenario({ inputs: { key: 'OFF', lights: 'ON', f5: 'BLOWN' } }), mode: { f5: true } },
        /* ★③F6 が切れた＝左前・右後・ナンバー灯・緑が消える */
        { id: 'j-f6', sc: scenario({ inputs: { key: 'OFF', lights: 'ON', f6: 'BLOWN' } }), mode: { f6: true } },
        /* ★④1灯だけのアース外れ＝その灯だけが消える */
        { id: 'j-gnd', sc: scenario({ inputs: { key: 'OFF', lights: 'ON' }, ops: [{ op: 'removeWire', id: 'w03-07' }] }), mode: { cut: 'w03-07' } },
        { id: 'j-fixed', sc: scenario({ inputs: { key: 'OFF', lights: 'ON' } }), mode: {} }
      ];
    }
  });
})();
