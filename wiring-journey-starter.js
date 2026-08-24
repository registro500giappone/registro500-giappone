/* ストーリー第3号「セルが回らない」の絵。journey_id: starter_no_crank（URLと対＝変えない）
   共通の土台（場面の作り方・描画プリミティブ・共通部品・実車図・検算・起動）は /wiring-journey.js。
   ⚠️図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。

   第1号（チャージランプ）・第2号（油圧警告灯）との関係:
     前2つは「計器盤の警告灯」が主役で、どちらも キースイッチ→計器盤 の道を通っていた。
     このストーリーは【主役が警告灯ではない】＝負荷はスターター（モーター）。バッテリーの＋端子から
     始動レバーの節点を経て、太い線1本でセルへ落ちる短い輪で、灯の道とはまったく別物。
     節点から右へ分かれるのが前2つのストーリー＝この絵では「灯へ行く枝」として同じ画面に出す。
     灯が点いているのにセルが回らない／灯も点かない、の2枚が絞り込みそのものになる。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;
  var X = 100, RX = 232;                       /* 主列（セルへ落ちる太い輪）と、右の枝＝灯の道 */

  /* ---- ストーリーの絵（縦の滝）。線1本ごとに netlist の wire id を対応させ、状態で塗る ---- */
  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    function seg(a, b, c, d, e, f, g) { k.seg(a, b, c, d, e, f, g); }
    function label(x, y, t, col, anchor, size) { k.label(x, y, t, col, anchor, size); }

    /* ===== バッテリー（端子とセルキャップのある形・共通部品） ===== */
    k.battery(X);

    /* ===== ＋の太線（w11-01 ROSSO太）→ 始動レバーの節点 ===== */
    if (mode.cut === 'w11-01') {
      /* ＋端子から外れている＝線はレバー側にぶら下がったまま。
         ⚠️これは接点の位置ではなく「線が1本無い」状態＝netlist から w11-01 を外して解いている。 */
      var c1 = k.wcol('w11-01', WC.ROSSO);
      s.push('<path d="M' + X + ',90 L' + X + ',104" stroke="' + c1.col + '" stroke-width="6.5" fill="none" stroke-linecap="round"/>');
      s.push('<circle cx="' + X + '" cy="82" r="6" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
      label(X + 14, 86, '外れている', C.hi, null, 12);
    } else {
      seg(X, 62, X, 104, 'w11-01', true);
      label(X + 12, 86, 'ROSSO 赤', WC.ROSSO);
    }

    /* ===== 節点＝始動レバーの入口。ここでストーリーが2つに分かれる ===== */
    k.node(X, 104);

    /* 右の枝＝第1号・第2号のストーリー（レギュレータ30→F1→キースイッチ→計器盤）。
       途中は省略するが、灯が点いているかどうかは solve() の答えをそのまま出す＝
       「灯は点いているのにセルは回らない」が同じ1枚で言える。 */
    var br = k.wcol('w11-03', WC.MARRONE);
    s.push('<path d="M' + X + ',104 L' + RX + ',104 L' + RX + ',152" stroke="' + br.col + '" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
    /* 省略の印＝二重線。ここは1本の電線ではなく「4つの部品を通る道」なので線として描かない */
    s.push('<path d="M' + (RX - 9) + ',131 L' + (RX + 9) + ',126 M' + (RX - 9) + ',138 L' + (RX + 9) + ',133" stroke="' + C.sub + '" stroke-width="2.5" stroke-linecap="round"/>');
    if (sc.warnOn) k.dotsH(104, X + 10, RX - 14, 'right');
    k.lampWindow(RX, 152, 'GENERAT.', sc.warnOn, null, 0);
    /* ⚠️灯の窓（y=152）の光は下へ50px近く伸びる＝ここに薄い字を置くと光に埋もれて読めない（実測）。
       2行あった注記は1行に減らし、光の外まで下げた（「第1号・第2号のストーリー」は下の fork リンクと重複） */
    s.push('<text x="296" y="212" font-size="10.5" fill="' + C.sub + '" text-anchor="end">計器盤の警告灯へ</text>');

    /* ===== 始動レバー＝引いている間だけ閉じるスイッチ ===== */
    var pull = pos.starter_sw === 'START';
    s.push('<rect x="30" y="112" width="140" height="86" rx="10" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    /* ⚠️【2026-08-23 ユーザー確認】電気の接点は運転席ではなく【セルモーターの上】に付いている。
       箱の絵（左のノブ→ケーブル→右の接点）は元から正しいが、副題が「運転席の引きノブ」だけ
       だったため箱ごと運転席の物に読め、「接点の荒れ」を足もとで探させる絵になっていた。 */
    s.push('<text x="100" y="130" font-size="12" fill="#fffdf8" text-anchor="middle">始動レバー</text>');
    s.push('<text x="100" y="145" font-size="9.5" fill="' + C.in_ + '" text-anchor="middle">ノブ＝運転席／接点＝セルの上</text>');
    /* 接点：手で引いている間だけ閉じるモーメンタリ */
    s.push('<circle cx="' + X + '" cy="162" r="3.8" fill="' + C.in_ + '"/>');
    s.push('<circle cx="' + X + '" cy="182" r="3.8" fill="' + C.in_ + '"/>');
    if (pull) s.push('<path d="M' + X + ',162 L' + X + ',182" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    else s.push('<path d="M' + X + ',162 L' + (X + 12) + ',174" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<text x="146" y="178" font-size="10" fill="' + C.in_ + '" text-anchor="middle">接点 ' + (pull ? '閉' : '開') + '</text>');
    /* ノブの絵（引くと手前＝左へ出る）。⚠️位置は controls の starter_sw から＝勝手な演出ではない */
    s.push('<circle cx="' + (pull ? 44 : 56) + '" cy="172" r="7.5" fill="' + C.in_ + '"/>');
    s.push('<path d="M' + (pull ? 51 : 63) + ',172 L78,172" stroke="' + C.in_ + '" stroke-width="3" stroke-linecap="round"/>');
    s.push('<text x="100" y="193" font-size="10" fill="' + C.in_ + '" text-anchor="middle">' + (pull ? '引いている' : '引く前') + '</text>');

    /* ===== レバー→セル（w11-02 MARRONE太） ===== */
    seg(X, 198, X, 240, 'w11-02', true);
    label(X + 12, 222, 'MARRONE 茶', WC.MARRONE);

    /* ===== セルモーター＝このストーリーの主役の負荷。⚠️呼び名は「セルモーター」で統一（旧「スターター」表記は
       本文と食い違うので廃止。本文では略して「セル」と書く） ===== */
    var run = sc.lampOn;                        /* lampId:'starter' ＝ 回っているか */
    s.push('<rect x="34" y="240" width="132" height="92" rx="30" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="100" y="268" font-size="12" fill="#fffdf8" text-anchor="middle">セルモーター</text>');
    /* 中の巻線＝ここで電圧が落ちる（負荷エッジ）。導線ではないことをコイルの形で言う */
    s.push('<path d="M' + X + ',288 q-9,4 0,8 q9,4 0,8 q-9,4 0,8" fill="none" stroke="' + C.in_ + '" stroke-width="3" stroke-linecap="round"/>');
    s.push('<text x="' + (X - 14) + '" y="304" font-size="10.5" fill="' + C.in_ + '" text-anchor="end">巻線</text>');
    s.push('<text x="100" y="326" font-size="10" fill="' + C.in_ + '" text-anchor="middle">' + (run ? 'いま回っている' : '回っていない') + '</text>');
    /* ピニオンとフライホイールの歯。⚠️噛むかどうかは電気ではなくレバー（機械）で決まる＝
       「ガチャッと言うのに回らない」が起きる理由がここに見える。
       ⚠️部品の箱は x=34..166。ピニオンとそのラベルは必ず箱の右外（>166）に置く
         （箱にかかると濃い地に濃い字で沈んで読めなくなる。実測で確認済み） */
    var px = pull ? 192 : 181;
    s.push('<g' + (run ? ' class="spin"' : '') + ' style="transform-origin:' + px + 'px 286px">' +
           '<circle cx="' + px + '" cy="286" r="13" fill="' + C.in_ + '" stroke="' + C.deep + '" stroke-width="2.5"/>' +
           '<line x1="' + px + '" y1="275" x2="' + px + '" y2="297" stroke="' + C.deep + '" stroke-width="2"/>' +
           '<line x1="' + (px - 11) + '" y1="286" x2="' + (px + 11) + '" y2="286" stroke="' + C.deep + '" stroke-width="2"/></g>');
    s.push('<path d="M212,258 A34 34 0 0 0 212,314" fill="none" stroke="' + C.sub + '" stroke-width="4"/>');
    s.push('<path d="M206,268 L214,268 M204,278 L212,278 M203,288 L211,288 M204,298 L212,298 M206,308 L214,308" stroke="' + C.sub + '" stroke-width="2.5"/>');
    s.push('<text x="184" y="252" font-size="10" fill="' + C.sub + '">ピニオン</text>');
    s.push('<text x="222" y="284" font-size="10" fill="' + C.sub + '">フライホイール</text>');
    s.push('<text x="222" y="297" font-size="10" fill="' + (pull ? C.deep : C.sub) + '">' + (pull ? '噛んでいる' : '離れている') + '</text>');

    /* ===== セル→車体（w11-11 NERO）。この線が細っても灯には出ない＝セルにだけ出る ===== */
    if (mode.cut === 'w11-11') {
      var c2 = k.wcol('w11-11', WC.NERO);
      s.push('<path d="M' + X + ',332 L' + X + ',346" stroke="' + c2.col + '" stroke-width="5" fill="none" stroke-linecap="round"/>');
      s.push('<circle cx="' + X + '" cy="352" r="6" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
      label(X + 14, 348, '外れている', C.hi, null, 12);
    } else {
      seg(X, 332, X, 364, 'w11-11');
      label(X + 12, 352, 'NERO 黒', WC.NERO);
    }
    k.ground(X, 364, '');
    label(X + 12, 376, '車体アース', C.deep, null, 11.5);
    label(6, 404, 'バッテリーの − も、同じ車体に落ちています', C.sub, null, 11);

    /* ⚠️容疑の囲いは灯の小窓（x=183 から光る）に絶対にかけない＝灯は「無実の証人」で、
       囲いの中に入れると意味が反転する。右端は 178 まで。 */
    if (mode.suspect) {
      k.suspect(20, 116, 158, 274, 428, '容疑者はこの中だけ');
      return 444;
    }
    return 416;
  }

  /* ---- トグル（唯一の操作＝レバーを戻す↔引く） ----
     ⚠️キャプションは「いまこの絵で起きていること」だけを言う。しくみ（なぜキーでは回らないか等）
       は下の3段の箇条書きが持つ＝両方に書くと重複する（2026-08-21 の型） */
  var CAPS = {
    OFF: '<b>引く前＝回らない。</b>レバーの接点が開いていて、輪が切れています。警告灯（右上）は点いたまま——<b>警告灯とセルは別の道</b>だからです。',
    START: '<b>引いている間だけ回る。</b>接点が閉じて輪がつながり、黄色い点がバッテリー→レバー→セル→車体アースと一周しています。歯車（ピニオン）も噛みました。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function warnLamp(sc) {
    for (var i = 0; i < sc.r.loads.length; i++) if (sc.r.loads[i].id === 'quadro.warn_charge') return sc.r.loads[i].on;
    return false;
  }
  var CELLW = ['回る', '回らない'];   /* ⚠️このストーリーの主役はモーター＝共通ランタイムの既定語（点く/消える）は使えない */
  var LAMPW = ['点く', '消える'];
  var CHECKS = [
    { label: 'キーOFF・レバーを引く', s: { inputs: { key: 'OFF', engine: 'STOP', starter: 'START' } }, expect: true, words: CELLW },
    { label: 'キーON・レバーは戻したまま', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'OFF' } }, expect: false, words: CELLW },
    { label: 'キーON・レバーを引く', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' } }, expect: true, words: CELLW },
    { label: 'ヒューズF1切れ・レバーを引く', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START', f1: 'BLOWN' } }, expect: true, words: CELLW },
    { label: 'セルのアース線（黒）が外れた・レバーを引く', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' }, ops: [{ op: 'removeWire', id: 'w11-11' }] }, expect: false, words: CELLW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' }, ops: [{ op: 'removeWire', id: 'w11-11' }] }, expect: true, read: warnLamp, words: LAMPW },
    { label: 'レバー→セルの太線（茶）が外れた・レバーを引く', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' }, ops: [{ op: 'removeWire', id: 'w11-02' }] }, expect: false, words: CELLW },
    { label: 'バッテリー＋の太線（赤）が外れた・レバーを引く', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' }, ops: [{ op: 'removeWire', id: 'w11-01' }] }, expect: false, words: CELLW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' }, ops: [{ op: 'removeWire', id: 'w11-01' }] }, expect: false, read: warnLamp, words: LAMPW },
    /* 【2026-08-21 追加】バッテリーの −端子外れ。案A（アースの基準をバッテリー − へ移す）を
       入れるまで、この2件は「回る・点く」と誤答していた＝限界②として文章で断っていたもの。
       いまは実車どおり「戻り道が無い＝全部死ぬ」と答えるので、検算に昇格させた。 */
    { label: 'バッテリーの−端子（アース線）が外れた・レバーを引く', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' }, ops: [{ op: 'removeWire', id: 'w11-10' }] }, expect: false, words: CELLW },
    { label: '↑同じ場面のチャージランプ', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' }, ops: [{ op: 'removeWire', id: 'w11-10' }] }, expect: false, read: warnLamp, words: LAMPW },
    { label: 'オルタネーター換装車・レバーを引く', s: { alt: true, inputs: { key: 'ON', engine: 'STOP', starter: 'START' } }, expect: true, words: CELLW }
  ];

  Journey.boot({
    lampId: 'starter',                          /* ⚠️主役は警告灯ではなくモーター */
    lampName: 'セル',
    alt: false,
    mainInit: 'OFF',
    mainInputs: function (v) { return { key: 'ON', engine: 'STOP', starter: v }; },
    /* 右の枝の灯（＝第1号・第2号のストーリーの主役）を、このストーリーでも読めるようにする */
    extra: function (sc) { sc.warnOn = warnLamp(sc); },
    /* セルが回っているとき＝放電の向き（下へ）。灯の枝は横なので draw 側で描いている */
    flow: function (sc) { return sc.lampOn ? 'down' : null; },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* 異常①＝引いても回らない・灯は点いたまま。上半分は無実＝容疑者はレバーから下だけ。
           絵はその一例（セルのアース線が外れた場合）。 */
        { id: 'j-fault', sc: scenario({ inputs: { key: 'ON', engine: 'STOP', starter: 'START' }, ops: [{ op: 'removeWire', id: 'w11-11' }] }), mode: { suspect: true, cut: 'w11-11' } },
        /* 異常②＝引いても回らない・灯も点かない。＋の太線から先が全部死んでいる。 */
        { id: 'j-dead', sc: scenario({ inputs: { key: 'ON', engine: 'STOP', starter: 'START' }, ops: [{ op: 'removeWire', id: 'w11-01' }] }), mode: { cut: 'w11-01' } },
        { id: 'j-fixed', sc: scenario({ inputs: { key: 'ON', engine: 'STOP', starter: 'START' } }), mode: {} }
      ];
    },
    /* ⚠️このストーリーだけ車の全長が要る＝バッテリーは車の前・セルは後ろ。第1・2号のエンジンルーム
       （665幅）に対して 3020 幅＝4.5倍広いので、印も凡例も拡大しないと読めない。
       ⚠️縦は車体の外まで余白を取る（y -140〜1500）＝車の輪郭で切らず、凡例を車に重ねない。
       ⚠️ラベルの向きは左右の衝突で決める：バッテリーは右へ、後ろの2つは左へ出す。 */
    carmap: function () {
      return {
        viewBox: '0 -140 3020 1640',
        scale: 4,
        marks: [{ id: 'battery', color: '#b8442e', label: 'バッテリー', anchor: 'start' },
                /* ⚠️この●は wiring-layout.json の実測値＝【運転席の引きノブ】の位置。
                   電気の接点はセルモーター側なので、ラベルでノブだと明示する（値は変えない） */
                { id: 'starter_sw', color: '#2c3a31', label: '引きノブ' },
                { id: 'starter', color: '#b8442e', label: 'セルモーター' }],
        legend: '<text x="40" y="1430" font-size="96" fill="#a49b87">←車の前方（トランク）</text>' +
                '<text x="2980" y="1430" font-size="96" fill="#a49b87" text-anchor="end">車の後ろ（エンジン）→</text>' +
                '<text x="1510" y="-40" font-size="96" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
