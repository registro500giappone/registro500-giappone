/* ストーリー第6回「セルは回るが、かからない（火花が飛ばない）」の絵。journey_id: no_spark（URLと対＝変えない）
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
         文字が縦軸を横切ると線に串刺しになる（第4回の「計器盤の中」で踏んだのと同じ穴）。
       ②高圧の囲みは【右横ではなく一番下の帯】。右に置くとキースイッチや電線のラベルと
         横で押し合って、どちらも読めなくなった。下に敷けば横幅を全部使える。 */
  var X = 76;                                  /* 一次の輪の縦軸 */
  /* ⚠️2026-08-24：端子バッジ（k.term）と切断の札（chip）を入れるため、箱を下へずらして
       縦の余白を広げた。数値はブラウザの getBBox 実測で「文字も札もバッジも重ならない」
       ことを確かめた結果＝目分量で動かさないこと（動かしたら必ず衝突検査を回す）。 */
  /* ⚠️2026-08-26：主図を1画面に収めるため縦を詰めたが、CB.y は【248 が下限】＝これより上げると
       切断シーン j-nopower の×のハロー（r=19）が端子バッジ「15/54」（y=178）と「+」（CB.y-12）に
       触れる。228 まで詰めて circle×text 検査で実際に gap=0 が出た＝目分量で動かさないこと。 */
  var CB = { x: 16, y: 248, w: 174, h: 90 };   /* コイルの箱 */
  var DB = { x: 16, y: 384, w: 174, h: 68 };   /* デスビ（ポイント）の箱 */
  var HT = { x: 6, y: 560, w: 288, h: 104 };   /* 高圧側＝この絵の外（一番下の帯） */

  /* ===== 従図＝「火花ができるまで」（主図のトグルに連動して描き替わる・2026-08-26） =====
     ⭐主図の一番下に敷いていた高圧の帯をここへ移し、コイルの中で何が起きているかまで解説する。
       （ユーザー指示＝主図を1画面に収める／その代わり点火のしくみを解説する絵を連携させる）
     ⚠️ここは【しくみの解説】であって配線図ではない＝原典の配線図はコイルの中身を描いていない。
       だから電線の被覆色を使わず、内部線（C.in_）と灰色だけで描く（主図の箱の中と同じ作法）。
     ⛔二次巻線のもう一端がコイルの中でどこへ落ちているかは描かない＝原典で断定できないから。
       絵に描けるのは「同じ鉄芯に2つの巻線が巻いてある」ところまで。 */
  var SB = { x: 14, y: 26, w: 272, h: 162 };   /* コイルの断面の箱 */
  var CORE = 150, P1 = 104, P2 = 196;          /* 鉄芯／一次巻線／二次巻線の中心 x */

  function drawSpark(k) {
    var sc = k.sc, s = k.s, closed = k.pos.distributor === 'CLOSED';
    var flowing = sc.primaryOk && closed;      /* 一次に電流が流れている＝磁気を溜めている最中 */
    var fire = sc.primaryOk && !closed;        /* 開いた＝磁気が崩れて二次に高圧が出る */

    k.label(6, 15, closed ? '① 閉じている間＝コイルは磁気を溜めている'
                          : '② 開いた瞬間＝磁気が崩れて、二次に高圧が出る',
      closed ? C.deep : C.hi, null, 12);

    s.push('<rect x="' + SB.x + '" y="' + SB.y + '" width="' + SB.w + '" height="' + SB.h + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="' + (SB.x + 10) + '" y="' + (SB.y + 17) + '" font-size="11" fill="#fffdf8">点火コイルの中</text>');
    if (sc.primaryOk) s.push('<text x="' + (SB.x + SB.w - 10) + '" y="' + (SB.y + 17) + '" font-size="11" font-weight="700" text-anchor="end" fill="'
      + (closed ? '#7fd6a0' : '#e8a33d') + '">' + (closed ? '磁気が溜まる' : '磁気が崩れる') + '</text>');

    var y1 = SB.y + 32, y2 = SB.y + 132;       /* 巻線の上下 */
    /* 鉄芯＝2つの巻線が同じ芯を共有していることが、この絵のいちばん大事な一点 */
    s.push('<rect x="' + (CORE - 5) + '" y="' + (y1 - 4) + '" width="10" height="' + (y2 - y1 + 8) + '" rx="2" fill="#9a927f"/>');

    /* 磁気＝鉄芯を取り巻く輪。閉じている間は実線（溜まっている）、開いた瞬間は破線（崩れる）。
       ⚠️rx は 40 まで＝これ以上広げると左右の巻線に触る（P1=104 / P2=196）。 */
    if (sc.primaryOk) {
      var mc = closed ? '#7fd6a0' : '#e8a33d', md = closed ? '' : ' stroke-dasharray="5 5"';
      /* ⭐動き＝閉はゆっくり膨らむ（溜まっていく）、開は外へ弾けて消える（崩れる）。
         ⚠️2枚の輪に同じクラスを付ける＝ばらばらに動くと「崩れる」に見えない。 */
      var ma = ' class="' + (closed ? 'mag-hold' : 'mag-collapse') + '"';
      s.push('<ellipse cx="' + CORE + '" cy="' + ((y1 + y2) / 2) + '" rx="26" ry="44" fill="none" stroke="' + mc + '" stroke-width="2" opacity=".85"' + md + ma + '/>');
      s.push('<ellipse cx="' + CORE + '" cy="' + ((y1 + y2) / 2) + '" rx="40" ry="54" fill="none" stroke="' + mc + '" stroke-width="2" opacity=".5"' + md + ma + '/>');
    }

    /* 一次巻線＝太い線・巻数は少ない（4巻き）。⚠️被覆色を付けない＝電線ではない */
    s.push('<path d="M' + P1 + ',' + y1 + ' L' + P1 + ',' + (y1 + 6) + '" stroke="' + C.in_ + '" stroke-width="4"/>');
    s.push('<path d="M' + P1 + ',' + (y1 + 6) + ' q20,10 0,20 q20,10 0,20 q20,10 0,20 q20,10 0,20" fill="none" stroke="' + C.in_ + '" stroke-width="4"/>');
    s.push('<path d="M' + P1 + ',' + (y1 + 86) + ' L' + P1 + ',' + y2 + '" stroke="' + C.in_ + '" stroke-width="4"/>');
    if (flowing) k.dots(P1, y1 + 8, y2 - 6, false);

    /* 二次巻線＝細い線・巻数がずっと多い（7巻き）。開いた瞬間だけ高圧の色になる */
    var c2 = fire ? '#e8a33d' : C.in_;
    s.push('<path d="M' + P2 + ',' + y1 + ' q13,7 0,14 q13,7 0,14 q13,7 0,14 q13,7 0,14 q13,7 0,14 q13,7 0,14 q13,7 0,14" fill="none" stroke="' + c2 + '" stroke-width="2.2"/>');
    s.push('<path d="M' + P2 + ',' + (y1 + 98) + ' L' + P2 + ',' + y2 + '" stroke="' + c2 + '" stroke-width="2.2"/>');
    if (fire) s.push('<path class="hv-flash" d="M' + (P2 + 20) + ',' + (y1 + 30) + ' l9,-14 -4,13 9,-15" stroke="#e07a1f" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');

    /* 端子＝実車のコイルに刻印がある3つだけ（主図と同じ名前で呼ぶ） */
    s.push('<path d="M60,' + y1 + ' L' + P1 + ',' + y1 + ' M60,' + y2 + ' L' + P1 + ',' + y2 + '" stroke="' + C.in_ + '" stroke-width="2.5"/>');
    k.term(60, y1, '+', 'l');
    k.term(60, y2, 'D', 'l');
    s.push('<path d="M' + P2 + ',' + y1 + ' L236,' + y1 + '" stroke="' + c2 + '" stroke-width="2.5"/>');
    k.term(236, y1, 'B', 'r');
    k.label(P1, SB.y + SB.h - 12, '一次', '#cfc7b4', 'middle', 9.5);
    k.label(CORE, SB.y + SB.h - 12, '鉄芯', '#cfc7b4', 'middle', 9.5);
    k.label(P2, SB.y + SB.h - 12, '二次', '#cfc7b4', 'middle', 9.5);

    /* ===== 高圧の行き先＝主図から移してきた帯の中身 ===== */
    k.label(6, SB.y + SB.h + 22, 'B端子 → デスビの中心 → ローター → プラグ①②', C.deep, null, 10.5);
    plug(k, 44, SB.y + SB.h + 34, fire, '①', 'spark-flash');
    plug(k, 92, SB.y + SB.h + 34, fire, '②', 'spark-flash');
    var w = sc.primaryOk ? (closed ? '接点が開けば火花が出る' : '火花が出る') : '火花は出ない';
    s.push('<text x="140" y="' + (SB.y + SB.h + 60) + '" font-size="11.5" font-weight="700" fill="'
      + (sc.primaryOk ? '#2f7d4f' : C.hi) + '">' + w + '</text>');
    k.label(6, SB.y + SB.h + 96, '一次の輪が切れていれば、ここに火花は出ない。', C.sub, null, 10);
    return SB.y + SB.h + 108;
  }
  /* ---- プラグ（火花の有無で描き分ける）。主図から従図へ移した（2026-08-26） ---- */
  function plug(k, px, py, spark, n, cls) {
    var s = k.s;
    s.push('<rect x="' + (px - 8) + '" y="' + py + '" width="16" height="22" rx="3" fill="#ddd5c4" stroke="' + C.deep + '" stroke-width="1.8"/>');
    s.push('<text x="' + px + '" y="' + (py + 15) + '" font-size="9" fill="' + C.deep + '" text-anchor="middle">' + n + '</text>');
    s.push('<path d="M' + px + ',' + (py + 22) + ' L' + px + ',' + (py + 31) + ' M' + (px + 9) + ',' + (py + 22) + ' L' + (px + 9) + ',' + (py + 31) + ' L' + (px + 2) + ',' + (py + 31) + '" stroke="' + C.deep + '" stroke-width="1.8" fill="none"/>');
    /* 火花＝小さすぎると見えないので、うっすらした光の玉を1枚敷いてから稲妻を描く。
       ⛔点滅させない（警告灯と同じ理由＝断続する不具合に読める） */
    if (spark) s.push('<g' + (cls ? ' class="' + cls + '"' : '') + '><circle cx="' + (px + 4) + '" cy="' + (py + 26) + '" r="7" fill="#e8a33d" opacity=".28"/>'
      + '<path d="M' + (px + 1) + ',' + (py + 30) + ' l4,-5 -2,5 4,-6" stroke="#e07a1f" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>');
  }

  function draw(k, mode) {
    /* 従図（火花ができるまで）は同じ draw から分岐して描く＝共通ランタイムを増やさないため */
    if (mode.spark) return drawSpark(k);
    var sc = k.sc, pos = k.pos, s = k.s;
    var on = pos.ign_sw === 'ON', closed = pos.distributor === 'CLOSED';

    /* 赤地に白抜きの札＝この絵でいちばん見てほしい所に1枚だけ置く（第4回と同じ道具）。
       ⚠️札は1つの絵に1枚まで。2枚置くと、どちらを見ればいいのか分からなくなる。 */
    function chip(x, y, t) {
      var w = t.length * 12 + 14, h = 22;
      s.push('<rect x="' + x + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="5" fill="' + C.hi + '"/>');
      s.push('<text x="' + (x + 7) + '" y="' + (y + 4.5) + '" font-size="12" font-weight="700" fill="#fffdf8">' + t + '</text>');
    }
    /* 線が1本外れている場面の描き方＝【赤の序列】（2026-08-24・第4回で決まった作法をこの号にも当てた）。
       すき間を広げ・×を打ち・ハローを敷き・図幅いっぱいの破線で「ここから下が死ぬ」境界を引き、
       赤地に白抜きの札を1枚だけ添える。⚠️赤はこの「切れている場所」ただ1つに取っておく。
       ⚠️opt.mid＝すき間の中心を区間の真ん中から動かす（端子バッジと近づきすぎるのを避ける）。
       ⚠️札は図の【右の余白】に出す＝左は端子バッジの列（x=26〜67）で埋まっている。 */
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

    /* ===== バッテリー〜キーまでは第1〜4回でたどった道＝畳む ===== */
    k.battery(X);
    /* ⭐端子バッジ＝原典に番号（記号）のある端子にだけ付ける（2026-08-24・第4回の作法）。
       この絵で付けるのは + / 30 / 15/54 / コイルの + ・D ・B の6か所。
       ⚠️デスビの接点とアースには付けない＝原典に番号が無いから（付けると実車に無い端子を探させる）。
       ⚠️コイルの D・B は原典の配線図では割付を断定できない（端子台帳の⛔）が、実車のコイルには
         刻印があり、本文がそこへテスターを当てろと言っている＝図と本文を1対1にするために出す。 */
    k.term(X, 74, '+', 'l');
    s.push('<path d="M' + X + ',62 L' + X + ',118" stroke="' + (on ? WC.ROSSO : C.dim) + '" stroke-width="5" stroke-dasharray="9 6" stroke-linecap="round"/>');
    k.label(X + 14, 84, '第1〜4回でたどった道', C.sub, null, 10);
    k.label(X + 14, 97, '（レギュレータ30→ヒューズ箱の', C.sub, null, 10);
    k.label(X + 14, 110, '　電源側→キーの30）', C.sub, null, 10);

    /* ===== キースイッチ（30 ↔ 15/54） ===== */
    k.term(X, 106, '30', 'l');                 /* キーの入口＝常時プラス */
    k.keySwitch(X, 118, on);
    k.term(X, 178, '15/54', 'l');              /* キーONで出ていく側。ここから2本が別々の行き先へ */
    /* このストーリーが通らない枝＝計器盤の警告灯とヒューズF2。⚠️コイルはF2を通らない。
       ⚠️分岐は y=180（キースイッチのラベル y=152 から十分離す）。166 に置いたら文字が重なった。 */
    k.node(X, 178);
    k.dashOut(X, 178, 150);
    k.label(152, 172, '計器盤の警告灯・', C.sub, null, 10);
    k.label(152, 185, 'ヒューズF2へ', C.sub, null, 10);

    /* ===== 15/54 → コイルの＋ ===== */
    if (mode.cut === 'w09-01') cutV(178, CB.y, 'w09-01', false, { mid: 213 });
    else { k.seg(X, 178, X, CB.y, 'w09-01'); k.label(X + 14, 213, 'AZZURRO 水色', WC.AZZURRO, null, 11); }

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
    /* ⚠️＋とDは本文の絞り込みで【実際にテスターを当てる】2つ＝hero（濃く反転）で出す。
       ⚠️バッジは箱の外（上端-12／下端+12）＝箱の縁や巻線に重ねない。 */
    k.term(X, CB.y - 12, '+', 'l', true);
    k.term(X, CB.y + CB.h + 10, 'D', 'l', true);
    k.label(100, CB.y + 52, sc.coilOn ? '電流が流れて' : 'いま電流は', sc.coilOn ? '#7fd6a0' : C.in_, null, 10);
    k.label(100, CB.y + 66, sc.coilOn ? '磁気を溜めている' : '流れていない', sc.coilOn ? '#7fd6a0' : C.in_, null, 10);
    /* B端子＝二次（高圧）の出口。ここから先は計算しない＝下の帯へ送る */
    s.push('<path d="M' + (X + 18) + ',' + (CB.y + 32) + ' L' + (CB.x + CB.w) + ',' + (CB.y + 32) + '" stroke="' + C.in_ + '" stroke-width="2.5"/>');
    k.term(CB.x + CB.w, CB.y + 32, 'B', 'l');
    s.push('<path d="M' + (CB.x + CB.w) + ',' + (CB.y + 32) + ' L214,' + (CB.y + 32) + '" stroke="' + C.out + '" stroke-width="3" stroke-dasharray="5 5"/>');
    k.label(218, CB.y + 36, '→ 高圧へ', C.sub, null, 10);

    /* ===== コイルD → ポイント ===== */
    if (mode.cut === 'w09-02') cutV(CB.y + CB.h, DB.y, 'w09-02', false, { mid: 361 });
    else { k.seg(X, CB.y + CB.h, X, DB.y, 'w09-02'); k.label(X + 14, 360, 'NERO 黒', WC.NERO, null, 11); }

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
    /* ⚠️アースまでの区間は【56px 以上】空ける＝×のハロー（r=19）とアース記号が食い合う（実測で発見）。 */
    if (mode.cut === 'w09-03') cutV(DB.y + DB.h, 508, 'w09-03');
    else { k.seg(X, DB.y + DB.h, X, 508, 'w09-03'); k.label(X + 14, 480, 'NERO 黒', WC.NERO, null, 11); }
    k.ground(X, 508, '車体アース');
    k.label(6, 534, '⬆ 車体からバッテリーの − へ帰って、輪が閉じる（第5回）。', C.sub, null, 10.5);


    if (mode.cut) {
      k.label(6, 556, '⚠️一次の輪が切れている＝ポイントを開いても、二次に高圧は出ない。', C.hi, null, 10.5);
      return 570;
    }
    return 546;
  }

  /* ---- トグル（ポイント 閉 ↔ 開）＝このストーリーで人が動かせる唯一のもの ----
     ⚠️「開いているときに電流が止まっているのが正常」＝ここが第1〜5回と逆で、いちばん誤解される所。 */
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
    /* このストーリーの前提＝セルは回る。回しながらでも点火の電気は生きている（500はスターターレバー式） */
    { label: 'レバーを引いてセルを回している間＝一次', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' } }, expect: true, words: PW },
    { label: '↑同じ場面のセル（このストーリーの前提）', s: { inputs: { key: 'ON', engine: 'STOP', starter: 'START' } }, expect: true, read: cel, words: CW },
    /* 一次の輪を1本ずつ切る＝3か所とも「流れない」になる */
    { label: 'コイルへの水色線（w09-01）が外れた＝一次', s: { inputs: ON, ops: cut('w09-01') }, expect: false, words: PW },
    { label: '↑同じ場面のチャージランプ（無実）', s: { inputs: ON, ops: cut('w09-01') }, expect: true, read: chg, words: LW },
    { label: 'ポイントへの黒線（w09-02）が外れた＝一次', s: { inputs: ON, ops: cut('w09-02') }, expect: false, words: PW },
    { label: 'ポイントのアース（w09-03）が外れた＝一次', s: { inputs: ON, ops: cut('w09-03') }, expect: false, words: PW },
    { label: '↑同じ場面の油圧警告灯（無実）', s: { inputs: ON, ops: cut('w09-03') }, expect: true, read: oil, words: LW },
    /* キーの手前が切れると、警告灯も点火も一緒に死ぬ＝第4回へ渡す場面 */
    { label: 'キーへの赤線（w10-01）が外れた＝一次', s: { inputs: ON, ops: cut('w10-01') }, expect: false, words: PW },
    { label: '↑同じ場面のチャージランプ（一緒に消える）', s: { inputs: ON, ops: cut('w10-01') }, expect: false, read: chg, words: LW },
    /* アースの帰り道が切れると点火も死ぬ＝第5回へ渡す場面 */
    { label: 'バッテリーのマイナス端子（w11-10）が外れた＝一次', s: { inputs: ON, ops: cut('w11-10') }, expect: false, words: PW },
    { label: 'オルタネーター換装車・キーON・ポイント閉', s: { alt: true, inputs: ON }, expect: true, words: PW }
  ];

  Journey.boot({
    lampId: 'coil',
    lampName: 'コイルの一次',
    alt: false,
    mainInit: 'CLOSED',
    mainInputs: function (v) { return { key: 'ON', engine: 'STOP', points: v }; },
    /* ⭐主図のトグル（ポイント 閉↔開）に連動して描き替わる従図。
       ⚠️scenes（静止した場面）と違い、こちらは押すたびに描き直される。 */
    linked: [{ id: 'j-spark', mode: { spark: true } }],
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
                { id: 'starter', color: '#8d8574', label: 'セルモーター' },
                { id: 'dynamo', color: '#8d8574', label: 'ダイナモ' }],
        legend: '<text x="40" y="1430" font-size="96" fill="#a49b87">←車の前方（トランク）</text>' +
                '<text x="2980" y="1430" font-size="96" fill="#a49b87" text-anchor="end">車の後ろ（エンジン）→</text>' +
                '<text x="1510" y="-32" font-size="96" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
