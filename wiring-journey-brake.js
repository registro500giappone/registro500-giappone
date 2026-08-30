/* ストーリー第7回「ブレーキランプが点かない」の絵。図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。
   このストーリーだけの特徴が3つある。①【キーONのときだけ生きるヒューズ F2】がシリーズで初めて本線に立つ。
   F1（常時30系）のストーリー＝第7・8回と対になる形で、「キーを回さないと点かない」が絵に出る。
   ②【ランプが2つあって、片方からもう片方へ渡る】＝原典の実配線が「SW→左マージンを降りて左後灯→車体の底を横断→右後灯」。
   左のランプのソケットのところで分かれるので、「右だけ点かない」と「左右とも点かない」で容疑者の範囲がはっきり分かれる。
   ③【症状が2つある】＝点かない／点きっぱなし。後者はスイッチの固着で、絵の上でも作れる。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;
  var X = 76;                                   /* 幹線（バッテリー〜キー〜F2〜SW〜左のランプ）の縦軸 */
  var RX = 196;                                 /* 右のブレーキランプの縦軸 */
  var KT = 232;                                 /* キースイッチの箱の上端（高さ48） */
  var FZ = 330;                                 /* ヒューズ F2 の箱の上端（下端子は +62） */
  var SB = { x: 16, y: 440, w: 174, h: 76 };    /* ストップスイッチの箱 */
  /* 高さ76＝箱の中の3要素（部品名・はたらき・接点の状態）を縦にずらして置くため。 */
  var CR = 558;                                 /* 左のランプ→右のランプへ渡る横線の高さ */
  var LT = 574, LH = 50;                        /* ブレーキランプの箱の上端と高さ */
  var GY = 668;                                 /* アース記号の高さ */

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    var blown = pos.f2 === 'BLOWN', keyOn = pos.ign_sw === 'ON', pressed = pos.brake_sw === 'PRESSED';
    var onL = sc.lampOn, onR = sc.rOn;

    /* 断線の印。絵の下半分（ランプのまわり）は文字の置き場が無い＝○印だけを打ち、「どこが外れているか」は絵の下の注記行が言う。
       第7・8回と同じ病気（箱の近くには文字の逃げ場が無い）。 */
    /* 赤地に白抜きの札（第4回の道具）。1つの絵に1枚まで。 */
    function chip(x, y, t) {
      var w = t.length * 12 + 14, h = 22;
      s.push('<rect x="' + x + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="5" fill="' + C.hi + '"/>');
      s.push('<text x="' + (x + 7) + '" y="' + (y + 4.5) + '" font-size="12" font-weight="700" fill="#fffdf8">' + t + '</text>');
    }
    /* ×印だけを打つ小道具＝すき間を広げ、赤い×を重ねる。【。言葉は本文の cap と図の下の注記が持つ。
       第4回でも図幅に収まらない切断では札を出さずに×だけにした＝同じ判断の型。 */
    function xmark(cx, cy) {
      s.push('<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#fbf7ee" stroke="' + C.hi + '" stroke-width="3"/>');
      s.push('<path d="M' + (cx - 5.5) + ',' + (cy - 5.5) + ' L' + (cx + 5.5) + ',' + (cy + 5.5)
        + ' M' + (cx + 5.5) + ',' + (cy - 5.5) + ' L' + (cx - 5.5) + ',' + (cy + 5.5)
        + '" stroke="' + C.hi + '" stroke-width="3" stroke-linecap="round"/>');
    }
    /* full=true でハロー・境界破線・札まで出す（絵の上半分だけ＝下半分は入らない）。 */
    function cutV(x, y1, y2, id, full) {
      var mid = (y1 + y2) / 2, col = k.wcol(id, C.dim).col;
      s.push('<path d="M' + x + ',' + y1 + ' L' + x + ',' + (mid - 13) + '" stroke="' + col + '" stroke-width="5" stroke-linecap="round"/>');
      s.push('<path d="M' + x + ',' + (mid + 13) + ' L' + x + ',' + y2 + '" stroke="' + col + '" stroke-width="5" stroke-linecap="round"/>');
      if (full) {
        s.push('<path d="M4,' + mid + ' L296,' + mid + '" stroke="' + C.hi + '" stroke-width="1.4" stroke-dasharray="4 6" opacity="0.4"/>');
        s.push('<circle cx="' + x + '" cy="' + mid + '" r="19" fill="' + C.hi + '" opacity="0.13"/>');
      }
      xmark(x, mid);
      if (full) chip(150, mid, '外れている');
    }
    /* 横線（左のランプ→右のランプの渡り）の断線。○印だけ＝この高さには「ROSSO 赤」と「車体の底を横断」のラベルが既にいる。 */
    function cutH(y, x1, x2, id) {
      var mid = (x1 + x2) / 2, col = k.wcol(id, C.dim).col;
      s.push('<path d="M' + x1 + ',' + y + ' L' + (mid - 13) + ',' + y + '" stroke="' + col + '" stroke-width="5" stroke-linecap="round"/>');
      s.push('<path d="M' + (mid + 13) + ',' + y + ' L' + x2 + ',' + y + '" stroke="' + col + '" stroke-width="5" stroke-linecap="round"/>');
      xmark(mid, y);
    }
    /* 後コンビランプの中のブレーキランプ。点灯時は赤いにじみを敷く（点滅させない）。 */
    function stopLamp(cx, name, lit, cut) {
      if (lit) {
        s.push('<g class="lampglow"><ellipse cx="' + cx + '" cy="' + (LT + LH / 2) + '" rx="46" ry="40" fill="url(#jbrakeg)"/></g>');
      }
      s.push('<rect x="' + (cx - 28) + '" y="' + LT + '" width="56" height="' + LH + '" rx="10" fill="' + (lit ? '#e8412a' : '#6e4a44') + '" stroke="' + (lit ? '#ffc7b4' : '#8d8574') + '" stroke-width="' + (lit ? 3 : 2) + '"/>');
      if (lit) s.push('<rect x="' + (cx - 21) + '" y="' + (LT + 5) + '" width="42" height="9" rx="4" fill="#fff" opacity=".3"/>');
      s.push('<text x="' + cx + '" y="' + (LT + 33) + '" font-size="13" font-weight="700" fill="' + (lit ? '#fffdf8' : '#cdc7b8') + '" text-anchor="middle">' + name + '</text>');
      /* そのランプのアースを切る場面だけ、状態語を右へ逃がす＝×印（r=11）に触れるため。
         固定値で寄せると平時に空きすぎる。 */
      s.push('<text x="' + (cx + (cut ? 22 : 14)) + '" y="' + (LT + 72) + '" font-size="11.5" font-weight="700" fill="' + (lit ? '#2f7d4f' : C.hi) + '">' + (lit ? '点いている' : '点かない') + '</text>');
    }

    if (onL || onR) {
      s.push('<defs><radialGradient id="jbrakeg">'
        + '<stop offset="0%" stop-color="#ff6a4a" stop-opacity=".9"/>'
        + '<stop offset="45%" stop-color="#ff3a20" stop-opacity=".42"/>'
        + '<stop offset="100%" stop-color="#ff3a20" stop-opacity="0"/></radialGradient></defs>');
    }

    /* ===== バッテリー〜キースイッチ＝第4回（キー）と同じ道 ===== */
    k.battery(X);
    /* 端子バッジ＝原典に番号のある端子にだけ付ける（第4回の作法／第6〜8回で全号展開）。
       この絵で付けるのは + / 30（レギュレータ）/ 30・15/54（キースイッチ）の4か所。
       ブレーキランプの口金には付けない＝実車の口金に「＋」と刻まれた端子は無く、付けると【実車に無い端子を探させる】ことになる（ルールの原文どおり）。
       本文も「左のランプの＋から分かれる」→「左のランプのソケットのところで分かれる」に直した＝【ソケットは実車で指せるが、＋は指せない】。
       ストップスイッチの2本にも付けない＝原典に端子名が無い。 */
    k.term(X, 74, '+', 'l');
    k.seg(X, 62, X, 100, 'w11-01', true);
    k.label(X + 12, 84, 'ROSSO 赤・太', WC.ROSSO, null, 11);
    k.node(X, 100);
    k.dashOut(X, 100, 190);
    k.label(184, 93, 'スターターレバー・セルへ', C.sub, null, 10.5);
    k.label(184, 106, '（第3回）', C.sub, null, 10.5);

    k.seg(X, 100, X, 140, 'w11-03', true);
    k.label(X + 12, 126, 'MARRONE 茶・太', WC.MARRONE, null, 11);
    k.node(X, 140);
    s.push('<rect x="4" y="118" width="76" height="44" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="42" y="137" font-size="11.5" fill="#fffdf8" text-anchor="middle">レギュレータ</text>');
    s.push('<text x="42" y="152" font-size="10" fill="' + C.in_ + '" text-anchor="middle">（車の後ろ）</text>');
    s.push('<path d="M80,140 L' + X + ',140" stroke="' + C.deep + '" stroke-width="3.5"/>');
    k.term(X, 140, '30', 'r');

    k.seg(X, 140, X, 186, 'w11-04', true);
    k.label(X + 12, 172, 'ROSSO 赤・太', WC.ROSSO, null, 11);
    /* ヒューズ F1 は【このストーリーの本線ではない】＝常時30系の枝。第7・8回のストーリーがこの先にある。 */
    k.node(X, 186);
    k.dashOut(X, 186, 168);
    k.label(172, 179, 'ヒューズ F1 →ホーン・', C.sub, null, 10);
    k.label(172, 192, 'ルームランプ（第7・8回）', C.sub, null, 10);

    k.seg(X, 186, X, KT, 'w10-01', true);
    k.label(X + 12, 218, 'ROSSO 赤・太', WC.ROSSO, null, 11);
    k.term(X, KT - 12, '30', 'l');
    k.keySwitch(X, KT, keyOn);
    k.term(X, KT + 60, '15/54', 'l');

    /* ===== キーの先＝15/54 の節点。ここで3方向に分かれるのがこのストーリーの要 ===== */
    k.seg(X, KT + 48, X, FZ, 'w06-01');
    k.label(X + 12, 322, 'AZZURRO 青', WC.AZZURRO, null, 11);
    k.node(X, 306);
    k.dashOut(X, 306, 160);
    k.label(164, 299, 'コイル・警告灯へ', C.sub, null, 10);
    k.label(164, 312, '（第1・2・6回）', C.sub, null, 10);

    /* ===== ヒューズ F2（15/54＝キーONのときだけ生きる） ===== */
    k.fuseV(X, FZ, blown, 'ヒューズ F2');
    s.push('<text x="' + (X + 24) + '" y="' + (FZ + 58) + '" font-size="10" fill="' + C.sub + '">キーONのときだけ生きる</text>');

    /* ===== F2の負荷側→ストップスイッチ ===== */
    if (mode.cut === 'w06-02') cutV(X, FZ + 62, SB.y, 'w06-02', true);
    else { k.seg(X, FZ + 62, X, SB.y, 'w06-02'); k.label(X + 12, 424, 'GIALLO E NERO 黄／黒', WC['GIALLO E NERO'], null, 11); }

    /* ===== ストップスイッチ（ブレーキ配管の油圧で閉じる） ===== */
    s.push('<rect x="' + SB.x + '" y="' + SB.y + '" width="' + SB.w + '" height="' + SB.h + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="100" y="' + (SB.y + 17) + '" font-size="11" fill="#fffdf8">ストップスイッチ</text>');
    s.push('<text x="100" y="' + (SB.y + 31) + '" font-size="9.5" fill="' + C.in_ + '">ブレーキ配管の油圧で</text>');
    var SY = SB.y + 24;
    s.push('<circle cx="' + X + '" cy="' + SY + '" r="3.8" fill="' + C.in_ + '"/>');
    s.push('<circle cx="' + X + '" cy="' + (SY + 26) + '" r="3.8" fill="' + C.in_ + '"/>');
    if (pressed) s.push('<path d="M' + X + ',' + SY + ' L' + X + ',' + (SY + 26) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    else s.push('<path d="M' + X + ',' + SY + ' L' + (X + 13) + ',' + (SY + 20) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<text x="100" y="' + (SB.y + 68) + '" font-size="11" font-weight="700" fill="' + (pressed ? '#7fd6a0' : C.in_) + '">接点 ' + (pressed ? '閉' : '開') + '</text>');
    /* 状態の語は箱の外・右（第7・8回と同じ作法＝箱の中に置くと内部の線と重なる）。「固着」の場面では【ペダルを離しているのに閉じている】＝そう書かないと絵が嘘になる。 */
    s.push('<text x="198" y="' + (SB.y + 30) + '" font-size="12" font-weight="700" fill="' + (pressed ? C.deep : C.sub) + '">'
      + (mode.stuck ? 'ペダルは' : 'ブレーキを') + '</text>');
    s.push('<text x="198" y="' + (SB.y + 46) + '" font-size="12" font-weight="700" fill="' + (pressed ? C.deep : C.sub) + '">'
      + (mode.stuck ? '離している' : (pressed ? '踏んでいる' : '離している')) + '</text>');
    if (mode.stuck) k.label(198, SB.y + 66, '⚠️固着', C.hi, null, 11.5);

    /* ===== ROSSO＝車の左マージンを降りて、左のブレーキランプへ ===== */
    if (mode.cut === 'w06-03') cutV(X, SB.y + SB.h, CR, 'w06-03', true);
    else { k.seg(X, SB.y + SB.h, X, CR, 'w06-03'); k.label(X + 12, 534, 'ROSSO 赤', WC.ROSSO, null, 11); }
    k.node(X, CR);

    /* ===== 渡り＝左のランプのソケットから車体の底を横断して右のランプへ ===== */
    var c4 = k.wcol('w06-04', C.dim);
    if (mode.cut === 'w06-04') cutH(CR, X, RX, 'w06-04');
    else {
      k.outline(X, CR, RX, CR, c4.raw, 5, c4.dead);
      s.push('<path d="M' + X + ',' + CR + ' L' + RX + ',' + CR + '" stroke="' + c4.col + '" stroke-width="5" fill="none" stroke-linecap="round"/>');
      if (onR) k.dotsH(CR, X + 12, RX - 8, 'right');
    }
    if (mode.cut !== 'w06-04') k.label(104, CR - 9, '車体の底を横断', C.sub, null, 10);
    s.push('<path d="M' + RX + ',' + CR + ' L' + RX + ',' + LT + '" stroke="' + c4.col + '" stroke-width="5" stroke-linecap="round"/>');
    s.push('<path d="M' + X + ',' + CR + ' L' + X + ',' + LT + '" stroke="' + k.wcol('w06-03', C.dim).col + '" stroke-width="5" stroke-linecap="round"/>');

    stopLamp(X, '左', onL, mode.cut === 'w06-05');
    stopLamp(RX, '右', onR, mode.cut === 'w06-06');

    /* ===== 帰り道＝それぞれのアース ===== */
    if (mode.cut === 'w06-05') cutV(X, LT + LH, GY, 'w06-05');
    else { k.seg(X, LT + LH, X, GY, 'w06-05'); k.label(X - 12, 652, 'NERO 黒', WC.NERO, 'end', 10.5); }
    k.ground(X, GY, '');
    if (mode.cut === 'w06-06') cutV(RX, LT + LH, GY, 'w06-06');
    else k.seg(RX, LT + LH, RX, GY, 'w06-06');
    k.ground(RX, GY, '');

    /* 注記は必ず2行に割る＝図の幅は 300 しかなく、font 10.5 の日本語は【1行22文字】で右端に届く。 */
    k.label(6, 698, '⬆ 後ろの2つのブレーキランプ。原典の配線は左のランプまで', C.sub, null, 10.5);
    k.label(6, 712, '　 1本で下り、そこから右へ渡る。', C.sub, null, 10.5);
    function warn(a, b) {
      k.label(6, 732, a, C.hi, null, 10.5);
      if (b) k.label(6, 746, b, C.hi, null, 10.5);
      return b ? 758 : 744;
    }
    if (mode.cut) return warn('⚠️×印の1本だけが外れている。どのランプが消えたかで、', '　 切れた場所が言い当てられる。');
    if (blown) return warn('⚠️F2 が切れると、ブレーキを踏んでも接点の', '　 先に電気が来ない。');
    if (!keyOn) return warn('⚠️キーがOFF＝ヒューズ F2 から先はすべて死んで', '　 いる。これが 500 の正常な姿。');
    if (mode.stuck) return warn('⚠️ペダルを離しても接点が戻らない＝点きっぱなし。');
    return 724;
  }

  /* ---- トグル（ブレーキ離す↔踏む）＝キーはONで固定 ---- 主役の動き＝「踏むと点く」。
     キーOFFの場面は下の「異常のとき」で別に出す。 */
  var CAPS = {
    UP: '<b>ブレーキを離しているとき。</b>キーはONなので、ヒューズ F2 を通って<b>スイッチの手前までは12Vが来ています</b>（黄／黒の線に色が付いています）。接点が開いているので、そこで止まったまま。<b>この状態で点かないのが正常</b>です。',
    PRESSED: '<b>ブレーキを踏んだ＝配管の油圧がスイッチの接点を閉じました。</b>足が接点を押しているのではありません。電気は赤い線で車の左後ろまで下って<b>左のブレーキランプ</b>を点け、そこから<b>車体の底を横断して右のランプへ渡ります</b>。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function get(sc, id) { for (var i = 0; i < sc.r.loads.length; i++) if (sc.r.loads[i].id === id) return sc.r.loads[i].on; return false; }
  function right(sc) { return get(sc, 'stop_r'); }
  function coil(sc) { return get(sc, 'coil'); }
  function chg(sc) { return get(sc, 'quadro.warn_charge'); }
  function horn(sc) { return get(sc, 'horn'); }
  var LW = ['点く', '点かない'], CW = ['点く', '消える'], HW = ['鳴る', '鳴らない'], IW = ['流れる', '流れない'];
  var ON = { key: 'ON', brake: 'PRESSED' };
  function cut(id) { return [{ op: 'removeWire', id: id }]; }
  var CHECKS = [
    { label: 'キーON・ブレーキを離している', s: { inputs: { key: 'ON', brake: 'UP' } }, expect: false, words: LW },
    { label: 'キーON・ブレーキを踏む（左）', s: { inputs: ON }, expect: true, words: LW },
    { label: '↑同じ場面の右のランプ', s: { inputs: ON }, expect: true, read: right, words: LW },
    /* 500の正常な姿＝キーOFFではブレーキランプも点かない（F2 がキーの先にいるため） */
    { label: 'キーOFF・ブレーキを踏む', s: { inputs: { brake: 'PRESSED' } }, expect: false, words: LW },
    { label: '↑同じ場面でホーンを押す（常時電源は生きている）', s: { inputs: { brake: 'PRESSED', horn_btn: 'PRESSED' } }, expect: true, read: horn, words: HW },
    /* F2 が切れた＝このストーリーで初めて「ヒューズが本当の犯人」になる本線 */
    { label: 'ヒューズF2が切れた・踏む（左）', s: { inputs: { key: 'ON', brake: 'PRESSED', f2: 'BLOWN' } }, expect: false, words: LW },
    { label: '↑同じ場面の右のランプ', s: { inputs: { key: 'ON', brake: 'PRESSED', f2: 'BLOWN' } }, expect: false, read: right, words: LW },
    { label: '↑同じ場面のチャージランプ（無実の証人）', s: { inputs: { key: 'ON', engine: 'STOP', f2: 'BLOWN' } }, expect: true, read: chg, words: CW },
    { label: '↑同じ場面のコイル一次（点火は生きる）', s: { inputs: { key: 'ON', f2: 'BLOWN' } }, expect: true, read: coil, words: IW },
    { label: 'ヒューズF1が切れた・踏む（F1は無実）', s: { inputs: { key: 'ON', brake: 'PRESSED', f1: 'BLOWN' } }, expect: true, words: LW },
    /* 渡りの線が切れた＝左は点いて右だけ消える。この2行が「絞り込み」の表そのもの */
    { label: '渡りの赤線（w06-04）が外れた・踏む（左）', s: { inputs: ON, ops: cut('w06-04') }, expect: true, words: LW },
    { label: '↑同じ場面の右のランプ', s: { inputs: ON, ops: cut('w06-04') }, expect: false, read: right, words: LW },
    /* 片側のアースが落ちた＝そのランプだけが消える */
    { label: '左のランプのアース（w06-05）が外れた・踏む（左）', s: { inputs: ON, ops: cut('w06-05') }, expect: false, words: LW },
    { label: '↑同じ場面の右のランプ', s: { inputs: ON, ops: cut('w06-05') }, expect: true, read: right, words: LW },
    /* 渡りの手前が切れた＝左右とも消える */
    { label: 'スイッチから下る赤線（w06-03）が外れた・踏む（左）', s: { inputs: ON, ops: cut('w06-03') }, expect: false, words: LW },
    { label: '↑同じ場面の右のランプ', s: { inputs: ON, ops: cut('w06-03') }, expect: false, read: right, words: LW },
    { label: 'ヒューズからの黄／黒線（w06-02）が外れた・踏む', s: { inputs: ON, ops: cut('w06-02') }, expect: false, words: LW },
    { label: 'キーからヒューズへの青線（w06-01）が外れた・踏む', s: { inputs: ON, ops: cut('w06-01') }, expect: false, words: LW },
    { label: '↑同じ場面のチャージランプ（キーの端子で分かれるので無事）', s: { inputs: { key: 'ON', engine: 'STOP' }, ops: cut('w06-01') }, expect: true, read: chg, words: CW },
    /* もう一方の症状＝点きっぱなし */
    { label: 'スイッチが固着・ブレーキを離している', s: { inputs: { key: 'ON', brake: 'UP' }, override: { brake_sw: 'PRESSED' } }, expect: true, words: LW },
    { label: '↑同じ固着のままキーを抜く（消える）', s: { inputs: { brake: 'UP' }, override: { brake_sw: 'PRESSED' } }, expect: false, words: LW },
    { label: 'バッテリーのマイナス端子（w11-10）が外れた・踏む', s: { inputs: ON, ops: cut('w11-10') }, expect: false, words: LW },
    { label: 'オルタネーター換装車・踏む', s: { alt: true, inputs: ON }, expect: true, words: LW }
  ];

  Journey.boot({
    lampId: 'stop_l',
    lampName: '左のブレーキランプ',
    alt: false,
    mainInit: 'PRESSED',
    mainInputs: function (v) { return { key: 'ON', brake: v }; },
    /* 右のランプは主役ではないが絵に出る＝場面ごとに拾っておく */
    extra: function (sc) { sc.rOn = get(sc, 'stop_r'); },
    /* 黄点の向き。左右のアースは【そのランプが点いているときだけ】流れる＝アースにつながってさえいれば線は live になるので、ここで区間ごとに分ける。 */
    flow: function (sc, id) {
      if (id === 'w06-05') return sc.lampOn ? 'down' : null;
      if (id === 'w06-06') return sc.rOn ? 'down' : null;
      return (sc.lampOn || sc.rOn) ? 'down' : null;
    },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* ★①キーOFF＝踏んでも点かない。これは故障ではない（最初に潰す迷い道） */
        { id: 'j-keyoff', sc: scenario({ inputs: { brake: 'PRESSED' } }), mode: {} },
        /* ★②ヒューズ F2 が切れた＝ブレーキランプもウインカーもワイパーも死ぬ */
        { id: 'j-blown', sc: scenario({ inputs: { key: 'ON', brake: 'PRESSED', f2: 'BLOWN' } }), mode: {} },
        /* ★③渡りが外れた＝左は点くのに右だけ消える（このストーリーの山場） */
        { id: 'j-cross', sc: scenario({ inputs: { key: 'ON', brake: 'PRESSED' }, ops: [{ op: 'removeWire', id: 'w06-04' }] }), mode: { cut: 'w06-04' } },
        /* ★④左のアースが落ちた＝逆に左だけ消える */
        { id: 'j-gndl', sc: scenario({ inputs: { key: 'ON', brake: 'PRESSED' }, ops: [{ op: 'removeWire', id: 'w06-05' }] }), mode: { cut: 'w06-05' } },
        /* ★⑤もう一方の症状＝スイッチが固着して点きっぱなし */
        { id: 'j-stuck', sc: scenario({ inputs: { key: 'ON', brake: 'UP' }, override: { brake_sw: 'PRESSED' } }), mode: { stuck: true } },
        { id: 'j-fixed', sc: scenario({ inputs: { key: 'ON', brake: 'PRESSED' } }), mode: {} }
      ];
    },
    /* ストップスイッチと後コンビランプには印を打たない＝wiring-layout.json はオーナーの実測値だけでできていて、こちらの推定値を1つも入れていない（この2部品はまだ実測が無い）。
       代わりに車の全長を出す＝このストーリーは「ダッシュのキー→前のヒューズ箱→車の最後尾」まで行く長い旅なので、第3回（セル）と同じ広さの viewBox が要る。 */
    carmap: function () {
      return {
        viewBox: '0 -140 3020 1640',
        scale: 4,
        marks: [{ id: 'battery', color: '#8d8574', label: 'バッテリー', anchor: 'start' },
                { id: 'f1', color: '#b8442e', label: 'ヒューズ箱', anchor: 'start' },
                { id: 'ign_sw', color: '#2c3a31', label: 'キースイッチ' },
                { id: 'stop_r', color: '#2c3a31', label: '後コンビランプ（右）' },
                { id: 'stop_l', color: '#2c3a31', label: '後コンビランプ（左）' }],
        legend: '<text x="40" y="1430" font-size="96" fill="#a49b87">←車の前方（トランク）</text>' +
                '<text x="2980" y="1430" font-size="96" fill="#a49b87" text-anchor="end">車の後ろ（エンジン）→</text>' +
                '<text x="1510" y="-32" font-size="96" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
