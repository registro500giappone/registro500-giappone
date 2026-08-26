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

  /* ===== 従図＝「火花ができるまで」（主図のトグルに連動して描き替わる・2026-08-26） =====
     ⭐主図の一番下に敷いていた高圧の帯をここへ移し、コイルの中で何が起きているかまで解説する。
       （ユーザー指示＝主図を1画面に収める／その代わり点火のしくみを解説する絵を連携させる）
     ⚠️ここは【しくみの解説】であって配線図ではない＝原典の配線図はコイルの中身を描いていない。
       だから電線の被覆色を使わず、内部線（C.in_）と灰色だけで描く（主図の箱の中と同じ作法）。
     ⛔二次巻線のもう一端がコイルの中でどこへ落ちているかは描かない＝原典で断定できないから。
       絵に描けるのは「同じ鉄芯に2つの巻線が巻いてある」ところまで。 */
  var SB = { x: 14, y: 26, w: 272, h: 162 };   /* コイルの断面の箱 */
  var CORE = 150, P1 = 104, P2 = 196;          /* 鉄芯／一次巻線／二次巻線の中心 x */

  /* ⚠️2026-08-26 ユーザー確定＝従図は【ボタンと無関係に、1周6秒の通しアニメを回し続ける】。
       描く物語は「電気が来る → 一次に磁気が溜まる → ポイントが開いて電流が切れる →
       二次に高圧が生まれる → 高圧が線を伝ってプラグまで届く → 火花が飛ぶ」。
     ⛔だから状態で描き分けない（closed / fire の分岐を捨てた）。動きは全部 CSS の6秒周期に載る。
     ⚠️初期値（＝アニメが効かない `prefers-reduced-motion: reduce` の読者）は
       「① 電気が流れて磁気が溜まっている」の静止画になるよう opacity 属性を置いてある。
       ⛔この属性を消すと、動きを止めている読者に見出しが3枚重なって出る。
     ⚠️見出し3枚と右上のラベル2枚は【同じ場所に重ねて置く】＝getBBox の衝突検査に必ず出る。
       意図した重なりなので、検査結果を見るときはこの5枚を除いて数えること。
     ⚠️電気の向きは連載の作法どおり【＋から出てアースへ帰る】（第5回と同じ）。
       ユーザーの言う「マイナスの電気が来る」は電子の向きの話だが、そちらに合わせると
       他の回と逆向きになるので採らない。 */
  var PY = 220, GY = 242;        /* ポイントの接点／車体アース（どちらもコイルの箱の外） */
  var HEADTOP = 272;             /* シリンダーヘッドの絵の始まり（高圧の道の行き先を決めるので定数にする） */

  function cyc(c) { return ' class="ig-cycle ' + c + '"'; }

  function drawSpark(k) {
    var s = k.s;
    var y1 = SB.y + 32, y2 = SB.y + 132;       /* 巻線の上下 */

    /* ---- 見出し＝物語の3つの段。重ねて置いて CSS で入れ替える ---- */
    s.push('<text x="6" y="15" font-size="12" fill="' + C.deep + '"' + cyc('ig-s1') + '>① 電気が流れて、コイルに磁気が溜まる</text>');
    s.push('<text x="6" y="15" font-size="12" font-weight="700" fill="' + C.hi + '" opacity="0"' + cyc('ig-s2') + '>② ポイントが開いて、電流が切れた</text>');
    s.push('<text x="6" y="15" font-size="12" font-weight="700" fill="#c2701a" opacity="0"' + cyc('ig-s3a') + '>③ 高圧がプラグ ① へ届いて火花</text>');
    s.push('<text x="6" y="15" font-size="12" font-weight="700" fill="#c2701a" opacity="0"' + cyc('ig-s3b') + '>③ 次はプラグ ② へ＝交互に配られる</text>');

    s.push('<rect x="' + SB.x + '" y="' + SB.y + '" width="' + SB.w + '" height="' + SB.h + '" rx="8" fill="' + C.body + '" stroke="' + C.deep + '" stroke-width="2.5"/>');
    s.push('<text x="' + (SB.x + 10) + '" y="' + (SB.y + 17) + '" font-size="11" fill="#fffdf8">点火コイルの中</text>');
    var rx = SB.x + SB.w - 10, ry = SB.y + 17;
    s.push('<text x="' + rx + '" y="' + ry + '" font-size="11" font-weight="700" text-anchor="end" fill="#7fd6a0"' + cyc('ig-s1') + '>磁気が溜まる</text>');
    s.push('<text x="' + rx + '" y="' + ry + '" font-size="11" font-weight="700" text-anchor="end" fill="#e8a33d" opacity="0"' + cyc('ig-m2') + '>磁気が崩れる</text>');

    /* 鉄芯＝2つの巻線が同じ芯を共有していることが、この絵のいちばん大事な一点 */
    s.push('<rect x="' + (CORE - 5) + '" y="' + (y1 - 4) + '" width="10" height="' + (y2 - y1 + 8) + '" rx="2" fill="#9a927f"/>');

    /* 磁気＝鉄芯を取り巻く輪。育つ→満ちる→崩れる を1本の keyframes で回す。
       ⚠️rx は 40 まで＝これ以上広げると左右の巻線に触る（P1=104 / P2=196）。
       ⚠️2枚の輪に同じクラスを付ける＝ばらばらに動くと「崩れる」に見えない。 */
    [[26, 44, .85], [40, 54, .5]].forEach(function (q) {
      s.push('<ellipse cx="' + CORE + '" cy="' + ((y1 + y2) / 2) + '" rx="' + q[0] + '" ry="' + q[1]
        + '" fill="none" stroke="#7fd6a0" stroke-width="2" opacity="' + q[2] + '"' + cyc('ig-mag') + '/>');
    });

    /* 一次巻線＝太い線・巻数は少ない（4巻き）。⚠️被覆色を付けない＝電線ではない */
    var coil1 = 'L' + P1 + ',' + (y1 + 6) + ' q20,10 0,20 q20,10 0,20 q20,10 0,20 q20,10 0,20 L' + P1 + ',' + y2;
    s.push('<path d="M14,' + y1 + ' L' + P1 + ',' + y1 + ' ' + coil1 + ' L30,' + y2 + ' L30,' + (SB.y + SB.h) + '" fill="none" stroke="' + C.in_ + '" stroke-width="4"/>');
    k.label(18, y1 + 26, 'キーから', '#cfc7b4', null, 9.5);

    /* 二次巻線＝細い線・巻数がずっと多い（7巻き）。高圧が出ている間だけ色が変わる（CSS） */
    s.push('<path' + cyc('ig-sec') + ' d="M' + P2 + ',' + y1 + ' q13,7 0,14 q13,7 0,14 q13,7 0,14 q13,7 0,14 q13,7 0,14 q13,7 0,14 q13,7 0,14" fill="none" stroke="' + C.in_ + '" stroke-width="2.2"/>');
    s.push('<path' + cyc('ig-sec') + ' d="M' + P2 + ',' + (y1 + 98) + ' L' + P2 + ',' + y2 + '" stroke="' + C.in_ + '" stroke-width="2.2"/>');
    s.push('<path' + cyc('ig-bolt') + ' d="M' + (P2 + 20) + ',' + (y1 + 30) + ' l9,-14 -4,13 9,-15" stroke="#e07a1f" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>');

    /* 端子＝実車のコイルに刻印がある3つだけ（主図と同じ名前で呼ぶ） */
    k.term(60, y1, '+', 'l');
    k.term(60, y2, 'D', 'l');
    s.push('<path' + cyc('ig-sec') + ' d="M' + P2 + ',' + y1 + ' L236,' + y1 + '" stroke="' + C.in_ + '" stroke-width="2.5"/>');
    /* ---- 高圧の道＝B端子から【コイルの外へ出て】右端を降り、プラグ①②へ配られる。
       ⭐ここを1本の線で繋いだのが要点（2026-08-26 ユーザー確定）＝「二次に高圧が生まれた」と
         「プラグが光った」の間を、線が伸びていく動きで結ぶ。⛔2つを同時に光らせない。
       ⚠️道は【B端子が起点】＝dashoffset を実長ぶん振るので、途中で形を変えたら長さも直すこと。 */
    var HVX = 292, HVY = HEADTOP + 4;
    var road = function (x) {
      return 'M236,' + y1 + ' L' + HVX + ',' + y1 + ' L' + HVX + ',' + HVY + ' L' + x + ',' + HVY + ' L' + x + ',' + (HEADTOP + 14);
    };
    var roadLen = function (x) { return (HVX - 236) + (HVY - y1) + (HVX - x) + 10; };
    s.push('<path d="' + road(98) + ' ' + road(202) + '" stroke="#b9b2a2" stroke-width="1.6" fill="none"/>');
    [[98, 'ig-runA'], [202, 'ig-runB']].forEach(function (q) {
      var x = q[0], L = roadLen(x);
      s.push('<path' + cyc(q[1]) + ' d="' + road(x) + '" style="--L:' + L + '" stroke="#e07a1f" stroke-width="3" fill="none"'
        + ' stroke-linecap="round" stroke-dasharray="' + L + '" stroke-dashoffset="' + L + '" opacity="0"/>');
    });
    k.term(236, y1, 'B', 'r');
    k.label(P1, SB.y + SB.h - 12, '一次', '#cfc7b4', 'middle', 9.5);
    k.label(CORE, SB.y + SB.h - 12, '鉄芯', '#cfc7b4', 'middle', 9.5);
    k.label(P2, SB.y + SB.h - 12, '二次', '#cfc7b4', 'middle', 9.5);

    /* ---- ポイント＝一次の輪を切る所。⚠️コイルの箱の【外】に描く（デスビの中の部品だから）。
       ⭐2026-08-26 ユーザー要望「ポイントをもっと目立たせたい・切れる動作も」で作り直した所：
         ①接点まわりを一回り大きく描いた（腕を長く・接点の玉を r3.4→5）
         ②開いたときの跳ね上がりを 13px→20px にして、離れたことが遠目にも分かるようにした
           （⚠️そのぶん PY を 204→218 まで下げてある＝上げると開いた腕の玉がコイルの箱に食い込む）
         ③開いている間だけ【橙のリング・大きめの⚡・「ここで切れる」の文字】の3点セットを出す
         ④開いた【瞬間】に橙の波紋を1回はじけさせる（ig-snap）＝「パチンと切れた」を目に留める
       ⚠️⛔ここで赤は使わない。赤は連載を通して【故障で切れている場所】に取ってある色で、
         ポイントが開くのは正常な動作だから。橙＝高圧まわりの色で統一する。 */
    s.push('<path d="M30,' + (SB.y + SB.h) + ' L30,' + PY + ' L48,' + PY + ' M92,' + PY + ' L92,' + GY
      + '" fill="none" stroke="' + C.deep + '" stroke-width="3"/>');
    s.push('<circle' + cyc('ig-snap') + ' cx="48" cy="' + PY + '" r="12" fill="none" stroke="#e07a1f" stroke-width="2.5" opacity="0"/>');
    s.push('<circle' + cyc('ig-ptO') + ' cx="48" cy="' + PY + '" r="11" fill="none" stroke="#e07a1f" stroke-width="2" opacity="0"/>');
    s.push('<circle cx="48" cy="' + PY + '" r="6" fill="' + C.deep + '"/>');
    s.push('<path' + cyc('ig-ptC') + ' d="M60,' + PY + ' L92,' + PY + '" stroke="' + C.deep + '" stroke-width="4" stroke-linecap="round"/>');
    s.push('<circle' + cyc('ig-ptC') + ' cx="60" cy="' + PY + '" r="6" fill="' + C.deep + '"/>');
    s.push('<path' + cyc('ig-ptO') + ' d="M66,' + (PY - 22) + ' L92,' + PY + '" stroke="' + C.deep + '" stroke-width="4" stroke-linecap="round" opacity="0"/>');
    s.push('<circle' + cyc('ig-ptO') + ' cx="66" cy="' + (PY - 22) + '" r="6" fill="' + C.deep + '" opacity="0"/>');
    s.push('<path' + cyc('ig-ptO') + ' d="M48,' + (PY - 9) + ' l9,-13 -5,13 10,-14" stroke="#e07a1f" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>');
    k.ground(92, GY, null);
    k.label(110, PY + 5, '点火ポイント', C.deep, null, 10.5);
    s.push('<text x="184" y="' + (PY + 5) + '" font-size="10.5" font-weight="700" fill="#c2701a" opacity="0"'
      + cyc('ig-ptO') + '>⚡ ここで切れる</text>');
    k.label(116, GY + 6, '車体アース', C.deep, null, 10.5);
    /* 流れる点＝丸い破線を動かす（サイクルの前半だけ流れて、ポイントが開いた瞬間に消える）。
       ⚠️⛔【ポイントより後に描く】＝先に描くとポイントの線（太さ3・濃色）に上書きされて、
         箱の外を流れる点が1つも見えなくなる（2026-08-26 に実機で確認した）。
       ⭐⛔【道は車体アースまで通す】＝ポイントの接点(48)で止めると、閉じている間も接点から
         アースまで電気が流れていないように見える（2026-08-26 ユーザー指摘）。一次は
         キー → コイル → ポイント → 車体アース で輪になって初めて電流が流れる。⛔手前で切らない。
         ⚠️閉じている腕(60→92)の上を通るが、ig-prim は開いている間は消えるので矛盾しない。 */
    s.push('<path' + cyc('ig-prim') + ' d="M16,' + y1 + ' L' + P1 + ',' + y1 + ' ' + coil1 + ' L30,' + y2 + ' L30,' + PY + ' L48,' + PY
      + ' L92,' + PY + ' L92,' + GY
      + '" fill="none" stroke="#dfae21" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="0.1 18"/>');


    /* ===== 高圧の行き先＝シリンダーヘッドの断面 ===== */
    return head(k, HEADTOP);
  }
  /* ---- シリンダーヘッドの断面＝高圧がどこへ届き、どこで火花になるか（2026-08-26 ユーザー要望）
     ⚠️模式図。500 は【空冷の直列2気筒】＝ヘッドは1つ、プラグは2本。冷却フィンを描くのは
       「空冷のヘッド」だと一目で分かるようにするため。
     ⛔ヘッド・燃焼室の寸法は原典に無い＝形を写した図ではないと分かる粗さにとどめる。
     ⭐デスビのローターが①と②へ【交互に】配る＝2本が同時に飛ぶことはない。だから絵も
       【前半サイクルで①・後半サイクルで②】と代わりばんこに光らせている（2026-08-26 ユーザー
       指摘「同時点火？」で直した）。⛔同時に光らせる作りへ戻さない。
     ⚠️ただし【本文で「2本が同時に飛ぶことはありません」と断らない】＝2026-08-26 ユーザー確定。
       同時点火（ウェイストスパーク）に換えている車も多く、わざわざ言うと余計な断りになる。
       ⛔この但し書きを本文へ書き戻さない。絵が交互に飛ばしていること自体は変えない。
     ⭐高圧の道は【B端子から伸びていく】＝二次の稲妻が出てから火花までを線の流れで繋ぐ。
       そのために道を2本の連続パスに分け、実長を `--L` で渡して dashoffset を動かす。
       ⛔サブパスを混ぜた1本にしない（dash が各サブパスで独立して伸びてしまう）。 ---- */
  function head(k, top) {
    var s = k.s, A = 98, B = 202, HY = top + 50, HB = top + 100, ROOF = HB - 26;
    k.label(6, top - 4, 'デスビの中心 → ローター → プラグへ', C.deep, null, 10.5);

    /* シリンダーの中＝暗く塗る。⚠️ここを明るいままにすると火花が背景に埋もれて「派手さ」が出ない
       （2026-08-26 に実際にそうなった）。ヘッドより先に描いて、ヘッドで上を隠す。 */
    [A, B].forEach(function (cx) {
      s.push('<path d="M' + (cx - 38) + ',' + (top + 140) + ' L' + (cx - 38) + ',' + HB
        + ' A38,26 0 0,1 ' + (cx + 38) + ',' + HB + ' L' + (cx + 38) + ',' + (top + 140)
        + ' Z" fill="#2b2822"/>');
    });

    /* ヘッドの塊。下辺に燃焼室のくぼみを2つ（sweep=1 で上へ凹ませる＝0 だと下へ膨らむ） */
    s.push('<path d="M22,' + HB + ' L' + (A - 38) + ',' + HB
      + ' A38,26 0 0,1 ' + (A + 38) + ',' + HB
      + ' L' + (B - 38) + ',' + HB
      + ' A38,26 0 0,1 ' + (B + 38) + ',' + HB
      + ' L278,' + HB + ' L278,' + HY + ' L22,' + HY + ' Z" fill="#6f6757" stroke="#4a443a" stroke-width="1.6"/>');
    /* 冷却フィン（プラグの六角部にかかる所は空ける） */
    for (var fx = 30; fx <= 270; fx += 11)
      if ((fx < 82 || fx > 114) && (fx < 186 || fx > 218))
        s.push('<path d="M' + fx + ',' + (HY - 9) + ' L' + fx + ',' + HY + '" stroke="#6f6757" stroke-width="4" stroke-linecap="round"/>');
    k.label(28, top + 80, 'ヘッド', '#d8d2c4', null, 9.5);

    /* シリンダーとピストン＝火花が飛ぶ場所を示すための添え物 */
    [A, B].forEach(function (cx) {
      s.push('<path d="M' + (cx - 38) + ',' + HB + ' L' + (cx - 38) + ',' + (top + 140)
        + ' M' + (cx + 38) + ',' + HB + ' L' + (cx + 38) + ',' + (top + 140)
        + '" stroke="#4a443a" stroke-width="1.6" fill="none"/>');
      s.push('<rect x="' + (cx - 36) + '" y="' + (top + 122) + '" width="72" height="12" rx="2" fill="#575046" stroke="#9a927f" stroke-width="1.2"/>');
    });
    k.label(6, top + 132, 'ピストン', C.sub, null, 9.5);

    /* プラグ2本 */
    [[A, '①'], [B, '②']].forEach(function (q) {
      var cx = q[0];
      s.push('<rect x="' + (cx - 5) + '" y="' + (top + 14) + '" width="10" height="8" rx="2" fill="#b9b2a2" stroke="#4a443a" stroke-width="1"/>');
      s.push('<path d="M' + (cx - 8) + ',' + (top + 22) + ' L' + (cx + 8) + ',' + (top + 22)
        + ' L' + (cx + 11) + ',' + (top + 44) + ' L' + (cx - 11) + ',' + (top + 44)
        + ' Z" fill="#efece3" stroke="#c2bba9" stroke-width="1.2"/>');
      s.push('<rect x="' + (cx - 13) + '" y="' + (top + 44) + '" width="26" height="10" fill="#a49b87" stroke="#4a443a" stroke-width="1"/>');
      s.push('<rect x="' + (cx - 9) + '" y="' + (top + 54) + '" width="18" height="' + (ROOF - (top + 54)) + '" fill="#a49b87" stroke="#4a443a" stroke-width="1"/>');
      s.push('<path d="M' + cx + ',' + ROOF + ' L' + cx + ',' + (ROOF + 12) + '" stroke="#ddd5c4" stroke-width="2.4" stroke-linecap="round"/>');
      s.push('<path d="M' + (cx + 7) + ',' + ROOF + ' L' + (cx + 7) + ',' + (ROOF + 18) + ' L' + (cx + 1) + ',' + (ROOF + 18)
        + '" stroke="#ddd5c4" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
      k.label(cx + 18, top + 38, q[1], C.deep, null, 11);
      /* 火花＝白い芯＋橙の外炎＋放射の閃光。⚠️高圧の道が届いてから光る（同時ではない） */
      var gx = cx + 1, gy = ROOF + 15;
      s.push('<g' + cyc(cx === A ? 'ig-sparkA' : 'ig-sparkB') + ' opacity="0">'
        + '<circle cx="' + gx + '" cy="' + gy + '" r="16" fill="#ffe6a0" opacity=".17"/>'
        + '<circle cx="' + gx + '" cy="' + gy + '" r="9" fill="#ffd274" opacity=".38"/>'
        + '<path d="M' + (gx - 17) + ',' + (gy - 12) + ' L' + (gx - 7) + ',' + (gy - 5)
        + ' M' + (gx + 17) + ',' + (gy - 12) + ' L' + (gx + 7) + ',' + (gy - 5)
        + ' M' + (gx - 19) + ',' + gy + ' L' + (gx - 9) + ',' + gy
        + ' M' + (gx + 19) + ',' + gy + ' L' + (gx + 9) + ',' + gy
        + ' M' + (gx - 15) + ',' + (gy + 11) + ' L' + (gx - 6) + ',' + (gy + 5)
        + ' M' + (gx + 15) + ',' + (gy + 11) + ' L' + (gx + 6) + ',' + (gy + 5)
        + '" stroke="#ffd97a" stroke-width="2" opacity="1" stroke-linecap="round"/>'
        + '<path d="M' + gx + ',' + (gy - 8) + ' l6,6 -8,2 7,7" stroke="#ff9d14" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M' + gx + ',' + (gy - 8) + ' l6,6 -8,2 7,7" stroke="#ffffff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        + '</g>');
    });

    s.push('<text x="150" y="' + (top + 156) + '" font-size="11.5" font-weight="700" text-anchor="middle" fill="#2f7d4f">⚡ 電極のすき間で火花が飛ぶ</text>');
    k.label(6, top + 178, '一次の輪が切れていれば、ここに火花は出ない。', C.sub, null, 10);
    return top + 190;
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
        { id: 'j-fixed', sc: scenario({ inputs: OPEN }), mode: {} },
        /* ⭐従図＝火花ができるまで。⚠️トグルには連動しない（1周6秒の通しアニメを回し続ける・
           2026-08-26 ユーザー確定）＝だから scenes に置く。sc は使わないが器として渡す。 */
        { id: 'j-spark', sc: scenario({ inputs: OPEN }), mode: { spark: true } }
      ];
    },
    /* 点火の部品はエンジンルームに固まっている＝バッテリーとキーだけが車の前。
       ⭐2026-08-26 にオーナーが coil と distributor を実測記入した（LAYOUT_VERSION 6）ので印を打った。
       ⚠️⚠️コイルは【個体差のある部品】＝ユーザー「右後方の場合と左後方の場合がある。今回は左後方」。
         印は実測どおり左後方に打つが、⛔本文の .note で必ず個体差を断ること（読者が自分の車で探すため）。
       ⚠️⛔ダイナモの印は【外した】＝実測が無かった頃に「位置の目安」として置いていたもので、
         役目が終わったため（本文にダイナモは1度も出てこない）。コイルとは lat が 157mm しか
         離れておらず、札が必ず重なる（文字の高さ179 > 間隔157＝実測）。⛔戻さない。
       ⚠️札はどちらも既定（点の左へ伸ばす）＝右へ出すと図の右端(3020)からはみ出す。
         anchor:'below' も不可＝下の凡例「車の後ろ（エンジン）→」に乗る（どちらも衝突検査で実測）。 */
    carmap: function () {
      return {
        viewBox: '0 -140 3020 1640',
        scale: 4,
        marks: [{ id: 'battery', color: '#8d8574', label: 'バッテリー', anchor: 'start' },
                { id: 'ign_sw', color: '#b8442e', label: 'キー', anchor: 'start' },
                { id: 'starter', color: '#8d8574', label: 'セルモーター' },
                { id: 'distributor', color: '#2c3a31', label: 'デスビ' },
                { id: 'coil', color: '#2c3a31', label: '点火コイル' }],
        legend: '<text x="40" y="1430" font-size="96" fill="#a49b87">←車の前方（トランク）</text>' +
                '<text x="2980" y="1430" font-size="96" fill="#a49b87" text-anchor="end">車の後ろ（エンジン）→</text>' +
                '<text x="1510" y="-32" font-size="96" fill="#a49b87" text-anchor="middle">車を上から（上が車の右側）</text>'
      };
    }
  });
})();
