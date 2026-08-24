/* ストーリー第4号「キーを回しても何も点かない」の絵。journey_id: key_no_power（URLと対＝変えない）
   共通の土台（場面の作り方・描画プリミティブ・共通部品・実車図・検算・起動）は /wiring-journey.js。
   ⚠️図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。

   第3号（セルが回らない）との関係＝このストーリーは【第3号の対】:
     第3号 … 灯は点くのにセルが回らない → 容疑者は始動レバーの節点より【下】
     第4号 … 灯が点かない              → 容疑者は節点より【上】か、節点から計器盤までの1本道
     どちらの絵にも「始動レバーの節点」が出てくる。そこが電気の分かれ道だから。

   このストーリーだけの特徴＝【主役が1つの灯ではなく「2つの灯が揃って消えていること」】。
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
    /* 赤地に白抜きの札＝この絵でいちばん見てほしい所に1枚だけ置く。
       ⚠️札は1つの絵に1枚まで。2枚置くと、どちらを見ればいいのか分からなくなる。 */
    function chip(x, y, t, anchor) {
      var w = t.length * 12 + 14, h = 22;
      var bx = (anchor === 'end') ? x - w : x;
      s.push('<rect x="' + bx + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="5" fill="' + C.hi + '"/>');
      s.push('<text x="' + (bx + 7) + '" y="' + (y + 4.5) + '" font-size="12" font-weight="700" fill="#fffdf8">' + t + '</text>');
    }
    /* 線が1本外れている場面の描き方（第3号と同じ作法）。
       ⚠️これは接点の位置ではなく「線が無い」状態＝netlist から外して解いている。
       ⚠️【2026-08-24 やり直し】「外れている所が、目で追わないと見つけられない」（ユーザー）＝
         この絵でいちばん強い赤にした。すき間を広げ・×を打ち・札を添え、さらに図幅いっぱいの
         境界線で【ここから下は電気が来ていない】ことを一目で言う。
       cx＝切る線の x（落とし先の細い線でも使えるように引数にした）。 */
    function cutAt(cx, y1, y2, id, thick, opt) {
      opt = opt || {};
      var mid = (y1 + y2) / 2, col = k.wcol(id, C.dim).col, g = 13, w = thick ? 6.5 : 5;
      s.push('<path d="M' + cx + ',' + y1 + ' L' + cx + ',' + (mid - g) + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>');
      s.push('<path d="M' + cx + ',' + (mid + g) + ' L' + cx + ',' + y2 + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>');
      if (opt.line) {                            /* ここから下が全部死ぬ、という境界 */
        s.push('<path d="M4,' + mid + ' L296,' + mid + '" stroke="' + C.hi + '" stroke-width="1.4" stroke-dasharray="4 6" opacity="0.4"/>');
      }
      s.push('<circle cx="' + cx + '" cy="' + mid + '" r="19" fill="' + C.hi + '" opacity="0.13"/>');
      s.push('<circle cx="' + cx + '" cy="' + mid + '" r="11" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
      s.push('<path d="M' + (cx - 5.5) + ',' + (mid - 5.5) + ' L' + (cx + 5.5) + ',' + (mid + 5.5)
        + ' M' + (cx + 5.5) + ',' + (mid - 5.5) + ' L' + (cx - 5.5) + ',' + (mid + 5.5)
        + '" stroke="' + C.hi + '" stroke-width="3" stroke-linecap="round"/>');
      /* ⚠️札は図の【左の余白】に置く＝切断点の右（x=196〜）はヒューズ箱と枝ラベルで埋まっていて、
         そこへ出すと囲いの破線をまたぐか図の右端を越える（第4号で前に直したのと同じ型の事故）。
         境界線の左端に札が乗る形になり、「外れている→この線から下が死ぬ」が一続きに読める。 */
      if (opt.chip !== false) chip(6, mid, opt.chip || '外れている');
    }

    /* ===== バッテリー ===== */
    k.battery(X);

    /* ===== ＋の太線 → 始動レバーの節点。ここで第3号のストーリー（セル）と分かれる =====
       ⚠️端子バッジは【原典に番号がある端子】にだけ付ける。この線が出るのはバッテリーの
         ＋端子なので、ここも同じ形で名乗らせる（2026-08-24・端子の扱いを揃えた）。
       ⚠️バッジは線の【右】＝左に出すと、容疑の囲いのラベル（y=90・x=10〜101）と縦に触れる（実測）。
         右へ出した分、色ラベルは 88→94 へ下げてバッジの下に逃がしてある。 */
    seg(X, 62, X, 106, 'w11-01', true);
    k.term(X, 74, '+', 'r');
    label(X + 12, 94, 'ROSSO 赤', WC.ROSSO);
    k.node(X, 106);
    /* ⚠️ここは端子ではない＝原典に番号が無い。バッジを付けると実車に無い端子を探させる */
    /* ⚠️y=110/122＝囲いのラベル（y=90）とレギュレータの箱（y=130〜）の隙間。実測で詰めた */
    label(X - 14, 110, '分かれ道', C.sub, 'end', 9.5);
    label(X - 14, 122, '（端子ではない）', C.sub, 'end', 9.5);
    /* ⚠️この枝ラベルは容疑の囲い（x=4..192）の【外】に置く＝中に入ると「セルも容疑者」に読める。
       囲いを右へ広げた分、開始 x も 184→198 へ逃がした（2026-08-23 実測）。 */
    k.dashOut(X, 106, 194);
    label(198, 98, 'セルモーターへ', C.sub, null, 10.5);
    label(198, 111, '（第3号のストーリー）', C.sub, null, 10.5);

    /* ===== 節点 → レギュレータの端子30（車の後ろ）=====
       ⚠️ここが 500 の意外なところ＝キーに来る電気は、いったん車の【後ろ】まで行って
         前へ戻ってくる。原典の 30 系はレギュレータの端子で1つに集まっている。 */
    if (mode.cut === 'w11-03') cutAt(X, 106, 152, 'w11-03', true, { line: true });
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
    /* ⚠️入る線（茶）と出る線（赤）は【同じ 30 端子】に着いている＝原典どおり。
       バッジを1つだけ置いて、そこへ上下から線が刺さっている絵にする（2つ置くと別端子に見える）。 */
    k.term(X, 152, '30', 'r');

    /* ===== レギュレータ30 → ヒューズ箱の【電源側】（車の前へ戻る） ===== */
    if (mode.cut === 'w11-04') cutAt(X, 152, 208, 'w11-04', true, { line: true });
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
    label(296, 263, '（このストーリーは通らない）', C.sub, 'end', 9.5);
    /* ⚠️ヒューズ箱の【電源側】も 30。同じ番号が何か所にも出るのは「常時電気が来ている線」の
       印だから＝本文でその意味を説明している（原典の端子番号の決まり） */
    k.term(X, 208, '30', 'l');

    /* ===== ヒューズ箱の電源側 → キースイッチ 30 ===== */
    if (mode.cut === 'w10-01') cutAt(X, 208, 262, 'w10-01', false, { line: true });
    else { seg(X, 208, X, 262, 'w10-01'); label(X + 12, 240, 'ROSSO 赤', WC.ROSSO); }

    /* ===== キースイッチ（30 ↔ 15/54）＝このストーリーの主役 =====
       ⚠️部品名は x=198 から＝容疑の囲い（右端192）の外。既定の x+56=156 だと破線が文字を貫く（実測）
       ⚠️2つの端子は【絞り込みの表でテスターを当てる場所】そのもの＝濃いバッジで名乗らせる。
         図に無い端子を本文が「当てろ」と指していたのが、やり直し前のいちばんの穴だった。 */
    k.keySwitch(X, 262, pos.ign_sw === 'ON', 198, { hero: true });
    /* ⚠️バッジは箱の【外】＝y=250/322。hero のハロー（y=255〜317）に掛けると箱に食い込んで見える。
       箱の中へ入れる案は鍵の絵（cx=72・r=12）と衝突するので採らない（どちらも実測で確認） */
    k.term(X, 250, '30', 'l', true);
    k.term(X, 322, '15/54', 'l', true);

    /* ===== キー → 計器盤の INTER ===== */
    if (mode.cut === 'w10-02') cutAt(X, 310, 372, 'w10-02', false, { line: true });
    else { seg(X, 310, X, 372, 'w10-02'); label(X + 12, 344, 'AZZURRO 水色', WC.AZZURRO, null, 10); }

    /* ===== 計器盤の中＝1本の給電レール（INTER）が2つの灯を養っている =====
       ⚠️計器盤の内部結線は原典の図から読み切れていない（v:inf）。だから細い内部線として
         描き、電線の被覆色は付けない＝「原典に書いてあること」と見分けが付くようにする。 */
    s.push('<rect x="12" y="372" width="276" height="140" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    /* ⚠️見出しは短く＝x=100 の内部線を横切らない長さに収める（12文字だと線に串刺しになった） */
    s.push('<text x="20" y="388" font-size="10.5" fill="' + C.in_ + '">計器盤の中</text>');
    k.node(X, 372);
    /* ⚠️箱の【中】に置く＝箱の上（y=364）だと容疑の囲いの下辺（y=366）を跨ぐ */
    k.term(X, 384, 'INTER', 'r');
    s.push('<path d="M' + X + ',372 L' + X + ',400 M' + LG + ',400 L' + LO + ',400" stroke="' + C.in_ + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>');
    s.push('<path d="M' + LG + ',400 L' + LG + ',418 M' + LO + ',400 L' + LO + ',418" stroke="' + C.in_ + '" stroke-width="3.5" stroke-linecap="round"/>');
    s.push('<circle cx="' + LG + '" cy="400" r="4" fill="' + C.in_ + '"/><circle cx="' + LO + '" cy="400" r="4" fill="' + C.in_ + '"/>');
    label(192, 394, '給電レール', C.in_, null, 10);

    k.lampWindow(LG, 418, 'GENERAT.', sc.chargeOn, null, 0);
    k.lampWindow(LO, 418, 'OLIO', sc.oilOn, null, 0);

    /* 2つまとめて言う＝このストーリーの主役は「1つの灯」ではなく「2つが揃っているか」。
       ⚠️点灯時のにじみは中心 y=432・ry=56＝下端 488 まで広がる。状態語はその外（y=496）に置く
         （488 より上に置くと赤い光に埋もれて読めなくなった。実測で確認済み）。 */
    var both = sc.chargeOn && sc.oilOn, none = !sc.chargeOn && !sc.oilOn;
    var word = both ? '2つとも点いている' : (none ? '2つとも消えている' : '片方だけ点いている');
    var wcol = (pos.ign_sw !== 'ON') ? C.in_ : (both ? '#7fd6a0' : '#ff8a70');
    s.push('<text x="120" y="497" font-size="12" font-weight="700" fill="' + wcol + '" text-anchor="middle">' + word + '</text>');

    /* 灯から下＝落とし先。ここから先はそれぞれ別のストーリーなので、色だけ見せて手放す。
       ⚠️端子名（51・0）は箱の中なので明るい色で書く＝濃い地に濃い字にしない */
    s.push('<path d="M' + LG + ',452 L' + LG + ',512 M' + LO + ',452 L' + LO + ',512" stroke="' + C.in_ + '" stroke-width="2.5" stroke-dasharray="3 4"/>');
    k.term(LG, 476, '51', 'l');
    k.term(LO, 476, '0', 'l');
    k.node(LG, 512); k.node(LO, 512);
    seg(LG, 512, LG, 546, 'w11-07');
    /* ⚠️落とし先の線が外れる場面（片方だけ消える）も【切れているように描く】。
       線が薄くなるだけでは「外れている」と読めない＝やり直し前はここが無言だった。
       札は図幅に収まらないので出さない（×印だけ・言葉は本文の cap が持つ）。 */
    if (mode.cutLow === 'w07-01') cutAt(LO, 512, 546, 'w07-01', false, { chip: false });
    else seg(LO, 512, LO, 546, 'w07-01');
    label(LG + 10, 532, 'VERDE 緑', WC.VERDE, null, 11);
    /* ⚠️切れている印（ハロー r=19）と重なるので、その場面だけ右へ逃がす（実測 2026-08-24） */
    label(LO + (mode.cutLow ? 26 : 10), 532, 'GRIGIO 灰', WC.GRIGIO, null, 11);
    s.push('<path d="M' + LG + ',546 L' + LG + ',564 M' + LO + ',546 L' + LO + ',564" stroke="' + C.out + '" stroke-width="3" stroke-dasharray="5 5"/>');
    label(6, 582, '緑→レギュレータ51（第1号）／灰→油圧センダ（第2号）', C.sub, null, 10.5);

    /* ⚠️容疑の囲いは計器盤の手前で止める＝2つの電球が同時に切れることは、まず無い。
       囲いを警告灯まで広げると「電球も疑え」に読めて、絞り込みが1段ゆるくなる。
       ⚠️【2026-08-23】囲いのラベルは「容疑者はこの中」だけにした＝以前の
         「（セルが回るなら）」まで入れると右へ伸びて ROSSO のラベルと重なる（実測）。
         条件のほうは本文（cap）が「①でセルが回った場合」と言う。 */
    if (mode.suspect) {
      /* ⚠️quiet＝囲いを一段引く。同じ絵にある「切れている場所」の赤と争わせない（2026-08-24） */
      k.suspect(4, 96, 188, 270, 90, '容疑者はこの中', true);
      label(6, 600, '⚠️計器盤の中（給電レールと電球）が最後の容疑者', C.sub, null, 10.5);
      return 614;
    }
    if (mode.minus) {
      /* ⚠️この場面だけ、外れている所が【線の上に無い】＝どの線も生きて見えるので、印が無いと
         「どこも壊れていない絵」に読めてしまう（やり直し前がこれ）。バッテリーの − 端子そのものに
         印を打つ。帰り道は原典の図でも車体を通る＝線として描けないので、札で言葉にする。 */
      /* ⚠️ハローだけ r=15（他の切断点は19）＝端子が図の上端 y=0 の近くにあり、19だと上が切れる */
      var mx = X + 27.5, my = 15;
      s.push('<circle cx="' + mx + '" cy="' + my + '" r="15" fill="' + C.hi + '" opacity="0.13"/>');
      s.push('<circle cx="' + mx + '" cy="' + my + '" r="11" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
      s.push('<path d="M' + (mx - 5.5) + ',' + (my - 5.5) + ' L' + (mx + 5.5) + ',' + (my + 5.5)
        + ' M' + (mx + 5.5) + ',' + (my - 5.5) + ' L' + (mx - 5.5) + ',' + (my + 5.5)
        + '" stroke="' + C.hi + '" stroke-width="3" stroke-linecap="round"/>');
      chip(168, my, '帰り道が外れている');   /* ⚠️150 だと − の文字（x=148〜162）に乗る（実測） */
      /* ⚠️「12Vは来ている」は言葉より当てて見せる＝テスターを給電レールに当てた絵にする */
      k.probe(X, 372, '12V', -36, -20);
      label(6, 600, '⚠️どの線にも色が付いたまま＝12Vはここまで来ている。', C.hi, null, 10.5);
      label(6, 616, 'それでも点かない。帰り道（バッテリーの −）が無い（→第5号）。', C.hi, null, 10.5);
      return 628;
    }
    if (mode.cutLow) {
      label(6, 600, '⭕キーから上は生きている＝2つに共通する部分は無実。', C.deep, null, 10.5);
      return 614;
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
    /* 片方だけ消えるなら共通部分は無実＝このストーリーの絞り込みの裏づけ */
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
    /* このストーリーは2つの灯を同時に読む＝どちらも場面に持たせる */
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
        /* 片方だけ消える＝共通部分は無実。この1枚が絞り込みの根拠
           ⚠️mode.cutLow＝外した線を【切れている絵】で見せる（やり直し前は薄くなるだけだった） */
        { id: 'j-one', sc: scenario({ inputs: ON, ops: cut('w07-01') }), mode: { cutLow: 'w07-01' } },
        { id: 'j-fixed', sc: scenario({ inputs: ON }), mode: {} }
      ];
    },
    /* ⚠️このストーリーも車の全長が要る＝キーに来る電気がいったん車の後ろまで行って戻るため。
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
                /* ⚠️y=-40 だと文字の上が viewBox の上端（-140）を 3.7px はみ出す（実測） */
                '<text x="1510" y="-32" font-size="96" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
