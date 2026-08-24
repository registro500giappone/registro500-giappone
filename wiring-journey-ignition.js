/* ストーリー第6号「セルは回るが、かからない（火花が飛ばない）」の絵。journey_id: no_spark（URLと対＝変えない）
   共通の土台（場面の作り方・描画プリミティブ・共通部品・実車図・検算・起動）は /wiring-journey.js。
   ⚠️図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。

   このストーリーだけの特徴＝【絵に「外」がある】。
     点火は2つの輪でできている：バッテリーで回る一次の輪と、その電流が切れた瞬間に
     誘導で生まれる二次（高圧）の輪。L1（到達性）が解けるのは【一次だけ】。
     だから高圧側は計算せず、右の囲みに「この絵の外」として置く。
   ⛔ここを混ぜると「つながっている＝火花が出る」と読めて、診断の道具として人を誤らせる
     （JOURNEY-INDEX §4／wiring-net.json の _sys9_scope）。
   ⛔点火時期・ドエル角は「道は正常なまま値だけが動く」領域＝UCM-1 の担当。本文で境界を書く。

   ⚠️系統9 を新設したストーリー＝NET_VERSION 4→5（部品 coil・distributor、電線 w09-01/02/03）。 */
(function () {
  'use strict';
  var WC = Journey.WC, C = Journey.C;
  /* ⚠️配置の決めごと（実測して直した結果・崩さない）：
       ①部品の箱の中は【左＝端子名／中央 x=76 の縦軸＝内部の線／右＝文字】の3列に分ける。
         文字が縦軸を横切ると線に串刺しになる（第4号の「計器盤の中」で踏んだのと同じ穴）。
       ②高圧の囲みは【右横ではなく一番下の帯】。右に置くとキースイッチや電線のラベルと
         横で押し合って、どちらも読めなくなった。下に敷けば横幅を全部使える。 */
  var X = 76;                                  /* 一次の輪の縦軸 */
  var CB = { x: 16, y: 222, w: 174, h: 90 };   /* コイルの箱 */
  var DB = { x: 16, y: 362, w: 174, h: 68 };   /* デスビ（ポイント）の箱 */
  var HT = { x: 6, y: 500, w: 288, h: 104 };   /* 高圧側＝この絵の外（一番下の帯） */

  function draw(k, mode) {
    var sc = k.sc, pos = k.pos, s = k.s;
    var on = pos.ign_sw === 'ON', closed = pos.distributor === 'CLOSED';

    function cutV(y1, y2, id, thick) {
      var mid = (y1 + y2) / 2, col = k.wcol(id, C.dim).col, w = thick ? 6.5 : 5;
      s.push('<path d="M' + X + ',' + y1 + ' L' + X + ',' + (mid - 8) + ' M' + X + ',' + (mid + 8) + ' L' + X + ',' + y2 + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>');
      s.push('<circle cx="' + X + '" cy="' + mid + '" r="6" fill="none" stroke="' + C.hi + '" stroke-width="3"/>');
      k.label(X + 14, mid + 4, 'ここが外れている', C.hi, null, 12);
    }

    /* ===== バッテリー〜キーまでは第1〜4号でたどった道＝畳む ===== */
    k.battery(X);
    s.push('<path d="M' + X + ',62 L' + X + ',118" stroke="' + (on ? WC.ROSSO : C.dim) + '" stroke-width="5" stroke-dasharray="9 6" stroke-linecap="round"/>');
    k.label(X + 14, 84, '第1〜4号でたどった道', C.sub, null, 10);
    k.label(X + 14, 97, '（レギュレータ30→ヒューズ箱の', C.sub, null, 10);
    k.label(X + 14, 110, '　電源側→キーの30）', C.sub, null, 10);

    /* ===== キースイッチ（30 ↔ 15/54） ===== */
    k.keySwitch(X, 118, on);
    /* このストーリーが通らない枝＝計器盤の警告灯とヒューズF2。⚠️コイルはF2を通らない。
       ⚠️分岐は y=180（キースイッチのラベル y=152 から十分離す）。166 に置いたら文字が重なった。 */
    k.node(X, 180);
    k.dashOut(X, 180, 150);
    k.label(152, 174, '計器盤の警告灯・', C.sub, null, 10);
    k.label(152, 187, 'ヒューズF2へ', C.sub, null, 10);

    /* ===== 15/54 → コイルの＋ ===== */
    if (mode.cut === 'w09-01') cutV(166, CB.y, 'w09-01');
    else { k.seg(X, 166, X, CB.y, 'w09-01'); k.label(X + 14, 212, 'AZZURRO 水色', WC.AZZURRO, null, 11); }

    /* ===== コイル（一次巻線＝この絵で計算している負荷） =====
       3列に分ける：左＝端子名／中央 x=76＝巻線／右＝文字 */
    s.push('<rect x="' + CB.x + '" y="' + CB.y + '" width="' + CB.w + '" height="' + CB.h + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="100" y="' + (CB.y + 18) + '" font-size="11" fill="#fffdf8">点火コイル</text>');
    /* 一次巻線の記号。⚠️これは電線ではないので被覆色を付けない＝明るい内部線で描く
       （計器盤の中を細い明るい線で描いたのと同じ作法＝原典の電線と見分けが付くように） */
    s.push('<path d="M' + X + ',' + (CB.y + 2) + ' L' + X + ',' + (CB.y + 22) + '" stroke="' + C.in_ + '" stroke-width="3"/>');
    s.push('<path d="M' + X + ',' + (CB.y + 22) + ' q18,8 0,16 q18,8 0,16 q18,8 0,16" fill="none" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<path d="M' + X + ',' + (CB.y + 70) + ' L' + X + ',' + (CB.y + 88) + '" stroke="' + C.in_ + '" stroke-width="3"/>');
    if (sc.coilOn) k.dots(X, CB.y + 8, CB.y + 80, false);
    k.label(66, CB.y + 20, '＋', C.in_, 'end', 12);
    k.label(66, CB.y + 86, 'D', C.in_, 'end', 12);
    k.label(100, CB.y + 52, sc.coilOn ? '電流が流れて' : 'いま電流は', sc.coilOn ? '#7fd6a0' : C.in_, null, 10);
    k.label(100, CB.y + 66, sc.coilOn ? '磁気を溜めている' : '流れていない', sc.coilOn ? '#7fd6a0' : C.in_, null, 10);
    /* B端子＝二次（高圧）の出口。ここから先は計算しない＝下の帯へ送る */
    s.push('<path d="M' + (X + 18) + ',' + (CB.y + 32) + ' L' + (CB.x + CB.w) + ',' + (CB.y + 32) + '" stroke="' + C.in_ + '" stroke-width="2.5"/>');
    k.label(164, CB.y + 28, 'B', C.in_, null, 11);
    s.push('<path d="M' + (CB.x + CB.w) + ',' + (CB.y + 32) + ' L214,' + (CB.y + 32) + '" stroke="' + C.out + '" stroke-width="3" stroke-dasharray="5 5"/>');
    k.label(218, CB.y + 36, '→ 高圧へ', C.sub, null, 10);

    /* ===== コイルD → ポイント ===== */
    if (mode.cut === 'w09-02') cutV(CB.y + CB.h, DB.y, 'w09-02');
    else { k.seg(X, CB.y + CB.h, X, DB.y, 'w09-02'); k.label(X + 14, 342, 'NERO 黒', WC.NERO, null, 11); }

    /* ===== ディストリビュータ（点火ポイント） ===== */
    s.push('<rect x="' + DB.x + '" y="' + DB.y + '" width="' + DB.w + '" height="' + DB.h + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="100" y="' + (DB.y + 18) + '" font-size="11" fill="#fffdf8">点火ポイント</text>');
    s.push('<text x="100" y="' + (DB.y + 32) + '" font-size="9.5" fill="' + C.in_ + '">（デスビの中）</text>');
    /* 接点＝上下2点と橋（キースイッチと同じ描き方に揃える＝読者が同じ物として読める） */
    s.push('<circle cx="' + X + '" cy="' + (DB.y + 20) + '" r="3.8" fill="' + C.in_ + '"/>');
    s.push('<circle cx="' + X + '" cy="' + (DB.y + 48) + '" r="3.8" fill="' + C.in_ + '"/>');
    if (closed) s.push('<path d="M' + X + ',' + (DB.y + 20) + ' L' + X + ',' + (DB.y + 48) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    else s.push('<path d="M' + X + ',' + (DB.y + 20) + ' L' + (X + 13) + ',' + (DB.y + 42) + '" stroke="' + C.in_ + '" stroke-width="3.5"/>');
    s.push('<text x="100" y="' + (DB.y + 54) + '" font-size="11" font-weight="700" fill="' + (closed ? '#7fd6a0' : C.in_) + '">' + (closed ? '閉じている' : '開いている') + '</text>');

    /* ===== ポイント → 車体アース ===== */
    if (mode.cut === 'w09-03') cutV(DB.y + DB.h, 462, 'w09-03');
    else { k.seg(X, DB.y + DB.h, X, 462, 'w09-03'); k.label(X + 14, 450, 'NERO 黒', WC.NERO, null, 11); }
    k.ground(X, 462, '車体アース');
    k.label(6, 492, '⬆ 車体からバッテリーの − へ帰って、輪が閉じる（第5号）。', C.sub, null, 10.5);

    /* ===== 高圧側＝この絵の外（一番下に敷く帯） ===== */
    s.push('<rect x="' + HT.x + '" y="' + HT.y + '" width="' + HT.w + '" height="' + HT.h + '" rx="10" fill="#f3efe4" stroke="' + C.out + '" stroke-width="2.5" stroke-dasharray="7 6"/>');
    s.push('<text x="' + (HT.x + 12) + '" y="' + (HT.y + 22) + '" font-size="11.5" font-weight="700" fill="' + C.hi + '">高圧（HT）側＝この絵は計算しない</text>');
    k.label(HT.x + 12, HT.y + 40, 'コイル B端子 → デスビ中心 → ローター → プラグ①②', C.deep, null, 10);
    plug(HT.x + 44, HT.y + 50, sc.primaryOk && !closed, '①');
    plug(HT.x + 92, HT.y + 50, sc.primaryOk && !closed, '②');
    var w = sc.primaryOk ? (closed ? '接点が開けば火花が出る' : '火花が出る（はず）') : '火花は出ない';
    s.push('<text x="' + (HT.x + 150) + '" y="' + (HT.y + 72) + '" font-size="11.5" font-weight="700" fill="'
      + (sc.primaryOk ? '#2f7d4f' : C.hi) + '">' + w + '</text>');
    k.label(HT.x + 12, HT.y + 96, '一次の輪が切れていれば、ここに火花は出ない。', C.sub, null, 10);

    function plug(px, py, spark, n) {
      s.push('<rect x="' + (px - 8) + '" y="' + py + '" width="16" height="22" rx="3" fill="#ddd5c4" stroke="' + C.deep + '" stroke-width="1.8"/>');
      s.push('<text x="' + px + '" y="' + (py + 15) + '" font-size="9" fill="' + C.deep + '" text-anchor="middle">' + n + '</text>');
      s.push('<path d="M' + px + ',' + (py + 22) + ' L' + px + ',' + (py + 31) + ' M' + (px + 9) + ',' + (py + 22) + ' L' + (px + 9) + ',' + (py + 31) + ' L' + (px + 2) + ',' + (py + 31) + '" stroke="' + C.deep + '" stroke-width="1.8" fill="none"/>');
      /* 火花＝小さすぎると見えないので、うっすらした光の玉を1枚敷いてから稲妻を描く。
         ⛔点滅させない（警告灯と同じ理由＝断続する不具合に読める） */
      if (spark) s.push('<circle cx="' + (px + 4) + '" cy="' + (py + 26) + '" r="7" fill="#e8a33d" opacity=".28"/>'
        + '<path d="M' + (px + 1) + ',' + (py + 30) + ' l4,-5 -2,5 4,-6" stroke="#e07a1f" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
    }

    if (mode.cut) {
      k.label(6, 624, '⚠️一次の輪が切れている＝ポイントを開いても、二次に高圧は出ない。', C.hi, null, 10.5);
      return 638;
    }
    return 618;
  }

  /* ---- トグル（ポイント 閉 ↔ 開）＝このストーリーで人が動かせる唯一のもの ----
     ⚠️「開いているときに電流が止まっているのが正常」＝ここが第1〜5号と逆で、いちばん誤解される所。 */
  var CAPS = {
    CLOSED: '<b>ポイントが閉じている＝一次に電流が流れています。</b>コイルは電気を消費しているのではなく、<b>磁気を溜めて</b>います。黄色い点が動いているのはそのためです。この状態で止めたままキーONで放置すると、コイルが熱を持ちます。',
    OPEN: '<b>ポイントが開いた＝一次の電流が切れました。</b>絵の上では電気が止まっていますが、<b>これが正常</b>です。火花は電気が流れている間ではなく、<b>流れが断ち切られた瞬間</b>に、溜めた磁気が二次側へ高い電圧を生んで飛びます。エンジンが回っている間、これが毎秒何十回も繰り返されています。'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function get(sc, id) { for (var i = 0; i < sc.r.loads.length; i++) if (sc.r.loads[i].id === id) return sc.r.loads[i].on; return false; }
  function chg(sc) { return get(sc, 'quadro.warn_charge'); }
  function oil(sc) { return get(sc, 'quadro.warn_oil'); }
  function cel(sc) { return get(sc, 'starter'); }
  var PW = ['流れる', '流れない'], LW = ['点く', '点かない'], CW = ['回る', '回らない'];
  var ON = { key: 'ON', engine: 'STOP' };
  var OPEN = { key: 'ON', engine: 'STOP', points: 'OPEN' };
  function cut(id) { return [{ op: 'removeWire', id: id }]; }
  var CHECKS = [
    { label: 'キーON・ポイント閉（正常）＝一次', s: { inputs: ON }, expect: true, words: PW },
    { label: 'キーON・ポイント開（正常）＝一次', s: { inputs: OPEN }, expect: false, words: PW },
    { label: 'キーOFF・ポイント閉＝一次', s: { inputs: { key: 'OFF', engine: 'STOP' } }, expect: false, words: PW },
    /* ⭐このストーリーの要＝ヒューズを見ても直らない（コイルはF2を通らず、F1とも無関係） */
    { label: 'ヒューズF1が切れている・キーON＝一次', s: { inputs: { key: 'ON', engine: 'STOP', f1: 'BLOWN' } }, expect: true, words: PW },
    /* このストーリーの前提＝セルは回る。回しながらでも点火の電気は生きている（500は始動レバー式） */
    { label: 'レバーを引いてセルを回している間＝一次', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' } }, expect: true, words: PW },
    { label: '↑同じ場面のセル（このストーリーの前提）', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' } }, expect: true, read: cel, words: CW },
    /* 一次の輪を1本ずつ切る＝3か所とも「流れない」になる */
    { label: 'コイルへの水色線（w09-01）が外れた＝一次', s: { inputs: ON, ops: cut('w09-01') }, expect: false, words: PW },
    { label: '↑同じ場面のチャージランプ（無実）', s: { inputs: ON, ops: cut('w09-01') }, expect: true, read: chg, words: LW },
    { label: 'ポイントへの黒線（w09-02）が外れた＝一次', s: { inputs: ON, ops: cut('w09-02') }, expect: false, words: PW },
    { label: 'ポイントのアース（w09-03）が外れた＝一次', s: { inputs: ON, ops: cut('w09-03') }, expect: false, words: PW },
    { label: '↑同じ場面の油圧灯（無実）', s: { inputs: ON, ops: cut('w09-03') }, expect: true, read: oil, words: LW },
    /* キーの手前が切れると、警告灯も点火も一緒に死ぬ＝第4号へ渡す場面 */
    { label: 'キーへの赤線（w10-01）が外れた＝一次', s: { inputs: ON, ops: cut('w10-01') }, expect: false, words: PW },
    { label: '↑同じ場面のチャージランプ（一緒に消える）', s: { inputs: ON, ops: cut('w10-01') }, expect: false, read: chg, words: LW },
    /* アースの帰り道が切れると点火も死ぬ＝第5号へ渡す場面 */
    { label: 'バッテリー−（w11-10）が外れた＝一次', s: { inputs: ON, ops: cut('w11-10') }, expect: false, words: PW },
    { label: 'オルタネーター換装車・キーON・ポイント閉', s: { alt: true, inputs: ON }, expect: true, words: PW }
  ];

  Journey.boot({
    lampId: 'coil',
    lampName: 'コイルの一次',
    alt: false,
    mainInit: 'CLOSED',
    mainInputs: function (v) { return { key: 'ON', engine: 'STOP', points: v }; },
    /* primaryOk＝「一次の輪が最後までつながっているか」。いま流れているか（coilOn）とは別物で、
       ポイントが開いている正常な瞬間も true になる。⚠️これは solve() の端子状態から導いたもので、
       絵の都合で作った旗ではない：ポイントの手前が hot か post（＝＋側から見えている）で、
       かつポイントの向こう側が gnd（＝アースまで帰れる）なら、閉じれば必ず流れる。 */
    extra: function (sc) {
      var st = sc.r.node, i = st['distributor._in'];
      sc.coilOn = get(sc, 'coil');
      sc.primaryOk = sc.coilOn || ((i === 'hot' || i === 'post') && st['distributor._gnd'] === 'gnd');
    },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function (scenario) {
      return [
        /* ①コイルに電気が来ていない＝テスターをコイル＋に当てれば0V */
        { id: 'j-nopower', sc: scenario({ inputs: ON, ops: cut('w09-01') }), mode: { cut: 'w09-01' } },
        /* ★②12Vは来ているのに流れない＝アース側が切れている。いちばん紛らわしい形 */
        { id: 'j-noearth', sc: scenario({ inputs: ON, ops: cut('w09-03') }), mode: { cut: 'w09-03' } },
        { id: 'j-fixed', sc: scenario({ inputs: OPEN }), mode: {} }
      ];
    },
    /* 点火の部品はエンジンルームに固まっている＝バッテリーとキーだけが車の前。
       ⛔コイルとデスビには印を打たない＝wiring-layout.json はオーナーの実測値だけで
         できていて、こちらの推定値を1つも入れていない（この2部品はまだ実測が無い）。
         「だいたいこの辺」で丸を打つと、それが実測値のふりをして残る。 */
    carmap: function () {
      return {
        viewBox: '0 -140 3020 1640',
        scale: 4,
        marks: [{ id: 'battery', color: '#8d8574', label: 'バッテリー', anchor: 'start' },
                { id: 'ign_sw', color: '#b8442e', label: 'キー', anchor: 'start' },
                { id: 'starter', color: '#8d8574', label: 'セル' },
                { id: 'dynamo', color: '#8d8574', label: 'ダイナモ' }],
        legend: '<text x="40" y="1430" font-size="96" fill="#a49b87">←車の前方（トランク）</text>' +
                '<text x="2980" y="1430" font-size="96" fill="#a49b87" text-anchor="end">車の後ろ（エンジン）→</text>' +
                '<text x="1510" y="-40" font-size="96" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
