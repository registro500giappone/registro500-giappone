// エンジン妄想シミュレーター プリセット（段2・2026-09-17）
// 出典＝ref/stock_specs.md（純正）・ref/catalog_draft.md（定番品・5店掲載）・engines_abarth.js（Abarth）
// ⭐ カムは店ごとに表記が違うので IVO/IVC/EVO/EVC の4角＋バルブリフト（カム山×ロッカー比 1.5）＋checkLift に正規化して持つ。
//    checkLift＝カタログ角を測ったクリアランス − 運転クリアランス（HANDOFF §5）。店が基準を書かない品は 0.5（camFromCatalog の既定）。
// ⚠️ 店に数値の記載が無い項目を補ったところは assumed に列挙する（画面で「※」を付けて断る）。値は捏造せず、同系の既知品から借りる。

const IGN_500 = [[1000, 10], [2000, 27], [3000, 38], [6000, 38]];
const IGN_126 = [[1000, 10], [2300, 30], [3000, 38], [6000, 38]];
const IGN_HI = [[1000, 12], [2000, 28], [3000, 36], [6000, 36]];   // 高圧縮（CR 9 以上）＝Abarth 校正で使った表

// ───────────── 型式（出発点の土台） ─────────────
// series＝画面の分類（車種チップ）。block＝ケース（Ø79.5 以上が入るか）。500R は series '500'・block '126'＝画面の
// 「500」枠で選べつつ、126 系の大径キットがそのまま組める（2026-09-19 §7-17＝旧 family はこの2つを兼ねていて 500R で歪みが出ていた）。
export const MODELS = [
  {
    id: '500N', label: '500 N（479cc・13CV）', series: '500', type: 'N', block: '500',
    engine: { bore: 66, stroke: 70, rod: 126, cr: 6.55, ncyl: 2 },
    cam: { ivo: 19, ivc: 50, evo: 50, evc: 19, liftIn: 8.4, liftEx: 8.4, checkLift: 0.275 },  // 取説 p.39：検査 0.375 − 運転 0.10
    valves: { dIn: 32, dEx: 28, stemIn: 8, stemEx: 8 },
    carb: 'w24imb', ignition: IGN_500,
    assumed: ['バルブ径 32/28 とリフト 8.4 は 500D と同じと仮定（取説に記載なし）'],
    // ⚠️ 126 後期と同じ扱い＝型式としては足さず、ここで期間を断る（2026-09-20 ユーザー確定）。
    //    「500 N」には生産時期で 13CV / 15CV（Weber 26 IMB）/ 16.5CV（26 IMB 1）の3段階があるが、
    //    後2者は圧縮比が手元資料から出ない＝どの仕様か分からないまま選ばれると差が読めなくなるため扱わない。
    note: '純正 13CV/4000（取説の値・ファン付）。※この諸元は 1957年10月以前の 13CV 仕様。以降の 15CV・16.5CV 仕様はキャブとバルブタイミングが異なる（ここでは扱っていない）',
    revLimit: { rpm: 4400, src: 'N取説 印刷 p.45 の各ギア最高速 25/40/60/85 km/h から換算（4543/4591/4331/4130）' },
  },
  {
    id: '500D', label: '500 D（499.5cc・17.5CV）', series: '500', type: 'D', block: '500',
    engine: { bore: 67.4, stroke: 70, rod: 126, cr: 7.1, ncyl: 2 },
    cam: { ivo: 25, ivc: 51, evo: 64, evc: 12, liftIn: 8.4, liftEx: 8.4, checkLift: 0.24 },
    valves: { dIn: 32, dEx: 28, stemIn: 8, stemEx: 8 },
    carb: 'w26imb', ignition: IGN_500,
    note: '純正 17.5CV/4400（DIN）',
    revLimit: { rpm: 4650, src: 'D取説 印刷 p.44 の 23/40/65/95 km/h から換算（4725/4591/4692/4616）' },
  },
  {
    id: '500F', label: '500 F・L（499.5cc・18CV）', series: '500', type: 'F・L', block: '500',
    engine: { bore: 67.4, stroke: 70, rod: 126, cr: 7.1, ncyl: 2 },
    cam: { ivo: 25, ivc: 51, evo: 64, evc: 12, liftIn: 8.4, liftEx: 8.4, checkLift: 0.24 },
    valves: { dIn: 32, dEx: 28, stemIn: 8, stemEx: 8 },
    carb: 'w26imb', ignition: IGN_500,
    note: '純正 18CV/4600・3.1kgm/3000（DIN）',
    revLimit: { rpm: 4650, src: 'L取説 印刷 p.50 の 23/40/65/95 km/h から換算（4725/4591/4692/4616）' },
  },
  {
    id: 'GIA', label: 'ジャルディニエラ（499.5cc・17.5CV）', series: '500', type: 'ジャルディニエラ', block: '500',
    engine: { bore: 67.4, stroke: 70, rod: 126, cr: 7.1, ncyl: 2 },
    cam: { ivo: 25, ivc: 51, evo: 64, evc: 12, liftIn: 8.4, liftEx: 8.4, checkLift: 0.24 },
    valves: { dIn: 32, dEx: 28, stemIn: 8, stemEx: 8 },
    carb: 'w26oc', ignition: IGN_500,
    note: '純正 17.5CV/4600・3.0kgm/3000（DIN）。横倒しエンジン＝カムは専用品',
    revLimit: { rpm: 4650, src: 'G取説 印刷 p.41 の 23/40/65/95 km/h から換算（横倒しでも変速比は同じ）' },
  },
  {
    id: '500R', label: '500 R（594cc・18CV）', series: '500', type: 'R', block: '126',
    engine: { bore: 73.5, stroke: 70, rod: 126, cr: 7.5, ncyl: 2 },
    cam: { ivo: 25, ivc: 51, evo: 64, evc: 12, liftIn: 8.4, liftEx: 8.4, checkLift: 0.24 },
    valves: { dIn: 32, dEx: 28, stemIn: 8, stemEx: 8 },
    carb: 'w24imb', ignition: IGN_500,
    note: '純正 18CV/4600・3.7kgm/2800（Axel 表）。⚠️資料の信頼度が低い型式',
    revLimit: { rpm: 4950, src: 'R取説 p.3 の 30/45/75/約100 km/h から換算（5150/4913/5150/4606）' },
  },
  {
    id: '126A', label: '126 前期（594cc・23CV）', series: '126', type: '594cc', block: '126',
    engine: { bore: 73.5, stroke: 70, rod: 126, cr: 7.5, ncyl: 2 },
    cam: { ivo: 26, ivc: 56, evo: 66, evc: 16, liftIn: 9.32, liftEx: 9.32, checkLift: 0.42 },
    valves: { dIn: 32, dEx: 28, stemIn: 8, stemEx: 8 },
    carb: 'w28imb', ignition: IGN_126,
    note: '車検証の総排気量 0.59。1977 年ごろまでの Fiat 126／Polski Fiat 126p。純正 23CV/4800・4.0kgm/3400',
    assumed: ['126 の回転上限 5050 は取説の裏付けが無い（500 の5型式で「許容速度の回転÷公称回転」が 1.01〜1.10 だったことから 1.05 を採った）'],
    revLimit: { rpm: 5050, src: '126 の資料に速度表が無い＝公称 23CV/4800 の 5% 増し' },
  },
  {
    id: '126A1', label: '126 後期（652cc・24CV）', series: '126', type: '652cc', block: '126',
    engine: { bore: 77, stroke: 70, rod: 126, cr: 7.5, ncyl: 2 },
    cam: { ivo: 26, ivc: 57, evo: 66, evc: 17, liftIn: 9.32, liftEx: 9.32, checkLift: 0.42 },
    valves: { dIn: 33, dEx: 28, stemIn: 8, stemEx: 8 },
    carb: 'w28imb', ignition: IGN_126,
    // ⚠️ 652 には 1985年5月以降の別仕様がある（CR 8.0・カム山 10.38・ロータレス Marelli S152A）が、型式としては足さない
    //    ＝どちらの仕様か分からないまま選ばれると差が読めなくなるため（2026-09-20 ユーザー確定）。代わりにここで期間を断る。
    note: '車検証の総排気量 0.65。1977 年以降＝126 Personal 4／126p／126p FL／EL／ELX／Maluch。純正 24CV/4500・4.2kgm/3000。※この諸元は 1977年8月〜1985年5月の仕様。1985年5月以降は圧縮比・カム・点火が異なる（ここでは扱っていない）',
    assumed: ['126 の回転上限 4725 は取説の裏付けが無い（500 の5型式で「許容速度の回転÷公称回転」が 1.01〜1.10 だったことから 1.05 を採った）'],
    revLimit: { rpm: 4725, src: '126 の資料に速度表が無い＝公称 24CV/4500 の 5% 増し' },
  },
];

// ───────────── 欄1：排気量（シリンダー＋ピストン） ─────────────
// cc は ボア×行程70 から計算した値（店の呼び名は nominal）。⚠️ 圧縮比はキットでは決まらない（ピストン頂面・圧縮高さ・ヘッドで決まる）＝別欄。
export const DISPLACEMENTS = [
  { id: 'stock', label: '純正のまま', bore: null, nominal: null, blocks: ['500', '126'], shops: [] },
  { id: 'b70', label: '540cc（Ø70.0）', bore: 70.0, nominal: 540, blocks: ['500'],
    shops: ['FD Ricambi「Piston and Cylinder Kit 540cc」', 'Axel Gerstl「Cylinder Kit 540cc (500-block)」', 'EuroItalia500「540cc Ø70」'],
    crHint: 7.5, hint: '500ブロック用の定番。ヘッドはそのまま' },
  { id: 'b735', label: '594cc（Ø73.5）', bore: 73.5, nominal: 600, blocks: ['500', '126'],
    shops: ['FD Ricambi「Piston and Cylinder Kit 600cc 126A5/126A」', 'Axel Gerstl「600cc」', 'EuroItalia500「600cc Ø73.5」'],
    crHint: 7.5, hint: '500R・126前期と同じ寸法。Abarth 595 も 500 のケースにこの径' },
  { id: 'b77', label: '652cc（Ø77.0）', bore: 77.0, nominal: 650, blocks: ['500', '126'],
    shops: ['FD Ricambi「Piston and Cylinder Kit 650cc 126A1」', 'Axel Gerstl「650cc (500-block)」「650cc」', "D'Angelo Motori「650cc Ø77」", 'EuroItalia500「650cc Ø77」'],
    crHint: 7.5, hint: '一番よく見る改造。126後期と同じ寸法＝500ブロック専用品もある' },
  { id: 'b795', label: '695cc（Ø79.5）', bore: 79.5, nominal: 700, blocks: ['126'],
    shops: ['FD Ricambi「Big Bore 695cc Kit」', 'Axel Gerstl「700cc Ø79.5」', "D'Angelo Motori「700cc Ø79.5」", 'EuroItalia500「Ø79.5 鍛造」'],
    crHint: 8.5, hint: 'ここから「本気」の領域。ヘッドとキャブも一緒に見直す前提' },
  { id: 'b80', label: '704cc（Ø80.0）', bore: 80.0, nominal: 700, blocks: ['126'],
    shops: ["D'Angelo Motori「700cc Ø80」", 'Axel Gerstl「Ø80.0 焼き入れ」', 'EuroItalia500「Ø80 鍛造」'],
    crHint: 8.5 },
  { id: 'b82', label: '739cc（Ø82.0）', bore: 82.0, nominal: 740, blocks: ['126'],
    shops: ['FD Ricambi「Piston and Cylinder Kit 739cc」', "D'Angelo Motori「740cc 一式」", 'Axel Gerstl「Ø82.0 焼き入れ」', 'EuroItalia500「Ø82 鍛造」'],
    crHint: 9.0 },
  { id: 'b85', label: '794cc（Ø85.0）', bore: 85.0, nominal: 800, blocks: ['126'],
    shops: ["D'Angelo Motori「800cc Ø85」", 'FD Ricambi「Piston Kit Ø85（ピストンのみ）」'],
    crHint: 9.0, hint: 'この道具の上限（HANDOFF §2）。シリンダー壁が薄く、冷却も余裕が無い' },
];

// ───────────── 欄2：圧縮比 ─────────────
export const COMP_RATIOS = [
  { id: 'stock', label: '純正のまま', cr: null },
  { id: 'cr75', label: '7.5', cr: 7.5 },
  { id: 'cr80', label: '8.0', cr: 8.0 },
  { id: 'cr85', label: '8.5', cr: 8.5 },
  { id: 'cr90', label: '9.0', cr: 9.0 },
  { id: 'cr95', label: '9.5（Abarth 595 相当）', cr: 9.5 },
  { id: 'cr100', label: '10.0', cr: 10.0 },
];

// ───────────── 欄3：カム ─────────────
// lobe＝カム山リフト mm（店の表記）。rocker 1.5 でバルブリフトへ。checkLift は店の測定基準（無ければ 0.5）。
const cam = (ivo, ivc, evo, evc, lobe, checkLift = 0.5, rocker = 1.5) =>
  ({ ivo, ivc, evo, evc, liftIn: +(lobe * rocker).toFixed(2), liftEx: +(lobe * rocker).toFixed(2), checkLift });
export const CAMS = [
  { id: 'stock', label: '純正のまま', cam: null, shops: ['FD Ricambi「Camshaft STD」', 'Axel Gerstl「Standard camshaft」', "D'Angelo Motori「originale standard」", 'EuroItalia500「standard」'] },
  { id: 'c3575', label: '35/75-75/35（公道向け・290°）', cam: cam(35, 75, 75, 35, 7.2),
    shops: ['Axel Gerstl「Sport camshaft 35/75-75/35 - 110°/290° (7.2mm) stradale」', 'EuroItalia500「35/75 acciaio／ghisa」', 'FD Ricambi「35/75 Steel（ジャルディニエラ）」'],
    hint: '一番おとなしいスポーツカム。街乗りを残したい人向け' },
  { id: 'c3878', label: '38/78（FD Ricambi）', cam: cam(38, 78, 78, 38, 7.65),
    shops: ['FD Ricambi「Camshaft 38/78 Steel」'], assumed: ['リフトは店に記載なし＝40/80 の 7.65mm を借用', '排気側の角は吸気と対称と仮定'] },
  { id: 'c4080', label: '40/80-80/40（Abarth 595 型・300°）', cam: cam(40, 80, 80, 40, 7.65),
    shops: ['Axel Gerstl「Sports camshaft 40/80, 7.65mm」', 'EuroItalia500「40/80 acciaio／ghisa」'],
    hint: 'Abarth 595 と同じ角。キャブと排気を一緒に変えないと効かない（段1の結果）' },
  { id: 'c4377', label: '43/77-77/43（300°）', cam: cam(43, 77, 77, 43, 7.7),
    shops: ['Axel Gerstl「Sport camshaft 43/77-77/43 - 64-107° (7.7mm)」', 'FD Ricambi「Camshaft 43/77 Steel」'] },
  { id: 'c4575', label: '45/75-75/45（hot race・300°）', cam: cam(45, 75, 75, 45, 7.7),
    shops: ['Axel Gerstl「Sport camshaft 45/75-75/45 - 105° (7.7mm) hot race」', 'FD Ricambi「Camshaft 45/75 Steel（ジャルディニエラ）」'],
    hint: 'オーバーラップ 90°。アイドルは荒れる' },
  { id: 'c5585', label: '55/85（FD Ricambi・320°）', cam: cam(55, 85, 85, 55, 7.7),
    shops: ['FD Ricambi「Camshaft 55/85 Steel」'], assumed: ['リフトは店に記載なし＝45/75 の 7.7mm を借用', '排気側の角は吸気と対称と仮定'] },
  // D'Angelo は「合計作用角/ロブセパ角 – 吸気開/閉 – 排気開/閉」表記。基準記載のある2点は「con gioco 0,25／0,30」＝運転クリアランス 0.15（500）との差。
  { id: 'd3397', label: "D'Angelo 54/78-78/54（312°）", cam: cam(54, 78, 78, 54, 7.1, 0.10),
    shops: ["D'Angelo Motori「Albero a camme 206/102° 54/78 78/54」"], assumed: ['測定基準は店に記載なし＝同店の他品（gioco 0,25）と同じと仮定'] },
  { id: 'd3413', label: "D'Angelo 60/90-90/60（サーキット・330°）", cam: cam(60, 90, 90, 60, 7.63, 0.10),
    shops: ["D'Angelo Motori「Albero a camme 367/105° 60/90 90/60 per le gare in pista」"], hint: '店が「con gioco 0,25」と基準を明記している数少ない品' },
  { id: 'd5170', label: "D'Angelo 66/94-94/66（最長・340°）", cam: cam(66, 94, 94, 66, 8.10, 0.10),
    shops: ["D'Angelo Motori「Albero a camme 944/104° 66/94 94/66」"], assumed: ['測定基準は店に記載なし＝同店の他品（gioco 0,25）と同じと仮定'] },
  // Abarth 純正カム＝角は運転クリアランス 0.20 で測った値（checkLift 0.05）。同じ「40/80」でも店のカタログ角（checkLift 0.5）より作用角が長い＝別物として持つ。
  { id: 'a4080', label: 'Abarth 595 純正 40/80-80/40（運転隙で測定）', cam: cam(40, 80, 80, 40, 7.13, 0.05),
    shops: ['Axel Gerstl「Abarth 595 camshaft」（復刻）'], hint: '§5 Abarth 校正で当てた値。店の 40/80 とは測り方が違うので同じ数字でも長い' },
  { id: 'a4585', label: 'Abarth 695 純正 45/80-85/40（運転隙で測定）', cam: cam(45, 80, 85, 40, 7.13, 0.05),
    shops: ['fiat500sport「Abarth 695 用」'], hint: '695 SS の角。「695 相当」のカムは店ごとに 45/75・40/80 と割れる' },
];

// ───────────── 欄4：ヘッド（バルブ径・ポート） ─────────────
// ported＝ポート加工済み（Abarth 校正で当てた spec.cal＝kValveIn/kValveEx 1.0・runnerXi 0.7）
export const HEADS = [
  { id: 'stock', label: '純正のまま', valves: null, ported: false, shops: [] },
  { id: 'h34', label: '純正ヘッド加工＋吸気弁 34（Abarth 595 型）', valves: { dIn: 34, dEx: 28 }, ported: true,
    shops: ['FD Ricambi「Intake Valve Ø34mm」', 'Axel Gerstl「Intake valve 34mm」', "D'Angelo Motori「Valvola d.34」"],
    hint: 'シート打ち替えとポート研磨を伴う。595 SS の「re-worked inlet ports」がこれ' },
  { id: 'h3631', label: 'チューニングヘッド 36/31（650用・モノ通路）', valves: { dIn: 36, dEx: 31 }, ported: true,
    shops: ["D'Angelo Motori「Testata 36/31」", 'Axel Gerstl「Intake valve 36mm」＋「Exhaust valve 31mm」', 'FD Ricambi「Valve Ø36」＋「Exhaust Valve Ø30」'],
    hint: '650cc 以上向け' },
  { id: 'h3933', label: 'Lavazza 分割ヘッド 39/33', valves: { dIn: 39, dEx: 33 }, ported: true,
    shops: ["D'Angelo Motori「Testata sdoppiata Lavazza 39/33」", 'EuroItalia500「Testata nuova Lavazza in alluminio semilavorata」', 'PBP「guide valvole 33 39」'],
    hint: '吸気ポートを気筒ごとに分けたレース系。ボアが小さいと収まらない' },
];

// ───────────── 欄5：キャブ ─────────────
// venturi＝主ベンチュリ径 mm。pump＝加速ポンプ付き（mixMin 0.8＝Abarth 校正）。DCOE や気筒ごと1基の物は瞬間の絞りが1本ぶん＝barrels 1。
// registered＝registro500 の登録車（`cars.carburetor_name`・2026-09-17 集計）に使用例がある物。⭐ユーザー指示「使われているものは対象にする」
//   ＝店の5店に無くても登録車にあれば載せる（バイク用のフラットスライドなど）。件数は時点情報なので書かない（印だけ）。
export const CARBS = [
  { id: 'stock', label: '純正のまま', venturi: null, shops: [] },
  { id: 'w24imb', label: 'Weber 24 IMB（500N・500R 純正）', venturi: 18, pump: false, registered: true, shops: ['EuroItalia500「revisionato 24 IMB」'] },
  { id: 'w26oc', label: 'Weber 26 OC（ジャルディニエラ純正）', venturi: 20, pump: false, shops: ['Axel Gerstl「Weber 26 OC (rebuilt)」'] },
  { id: 'w26imb', label: 'Weber 26 IMB（500D/F/L 純正）', venturi: 21, pump: false, registered: true,
    shops: ['FD Ricambi「Weber 26 IMB」', 'Axel Gerstl「Weber 26 IMB 10」', "D'Angelo Motori「26 imb originale」", 'EuroItalia500「26 IMB」'] },
  { id: 'w28imb', label: 'Weber 28 IMB（126 純正）', venturi: 23, pump: false, registered: true,
    shops: ['FD Ricambi「Weber 28 IMB」', 'Axel Gerstl「Weber 28 IMB/650cc」', "D'Angelo Motori「28 imb originale (126)」", 'EuroItalia500「28 IMB」'],
    hint: '650cc 化とセットの定番。登録車でもいちばん多い換装先' },
  { id: 's1a28', label: 'Weber 28 S1A（ポーランド製 126 純正）', venturi: 23, pump: false, registered: true,
    shops: ['FD Ricambi「Weber 28 S1A Remanufactured」', 'Axel Gerstl「Weber 28 S1A (rebuilt)」'], assumed: ['ベンチュリ径は資料なし＝28 IMB と同じ 23 と仮定'] },
  { id: 'w28imb30', label: 'Weber 28 IMB 拡大加工 30/25（PBP）', venturi: 25, pump: false,
    shops: ['PBP Klaudia Lorens「CARBURATORE MAGGIORATO 30/25 WEBER 28 IMB」'] },
  { id: 'w32iba', label: 'Weber 32 IBA（流用）', venturi: 25, pump: true, registered: true,
    shops: [], assumed: ['ベンチュリ径・加速ポンプは資料なし＝32 口径の一般的な構成（25・ポンプ付き）を仮定'] },
  { id: 'frg28', label: "Dell'Orto FRG 28", venturi: 23, pump: true, registered: true,
    shops: [], assumed: ['ベンチュリ径・加速ポンプは資料なし＝28 口径の一般的な構成を仮定'] },
  { id: 'frg30', label: "Dell'Orto FRG 30", venturi: 25, pump: true,
    shops: ["D'Angelo Motori「Carburatore dell'orto FRG 30」"], assumed: ['ベンチュリ径・加速ポンプの有無は店に記載なし＝30 口径の一般的な構成を仮定'] },
  { id: 'fzd30', label: "Dell'Orto FZD 30/24", venturi: 24, pump: true, registered: true,
    shops: [], hint: '名前のとおり口径 30・ベンチュリ 24', assumed: ['加速ポンプ付きと仮定'] },
  { id: 'c30', label: 'Solex C30（DI 系）', venturi: 24, pump: true, registered: true,
    shops: [], assumed: ['ベンチュリ径・加速ポンプは資料なし＝30 口径の一般的な構成を仮定'] },
  { id: 'pbic34', label: 'Solex 34 PBIC（Abarth 595 SS 型）', venturi: 28, pump: true, registered: true,
    shops: ['Axel Gerstl「Carburetor Solex 34 PBIC (reproduction)」'], hint: 'ベンチュリ 28＝595 SS の実装。695 SS は同じキャブで 30' },
  { id: 'dgf30', label: 'Weber 30 DGF（2バレル・126 BIS 流用）', venturi: 23, barrels: 2, pump: true, registered: true,
    shops: ['Axel Gerstl「Weber 30 DGF-4/100 (rebuilt)」'], assumed: ['ベンチュリ径は店に記載なし＝23 相当×2 と仮定'] },
  { id: 'dell32x2', label: "Dell'Orto 32 ツイン（気筒ごと1基）", venturi: 26, pump: true,
    shops: ['Axel Gerstl「SoPo: Dell\'Orto 32, dual carburettor」'], assumed: ['ベンチュリ径は店に記載なし＝26 と仮定'] },
  { id: 'dhlb32', label: "Dell'Orto DHLB 32（2バレル横置き）", venturi: 26, pump: true, registered: true,
    shops: [], assumed: ['チョーク径は資料なし＝26 と仮定（気筒ごと1バレル）'] },
  { id: 'dcoe40', label: 'Weber 40 DCOE（チョーク 30）', venturi: 30, pump: true, registered: true,
    shops: ['FD Ricambi「Weber 40 DCOE」', 'Axel Gerstl「Carburatore WEBER 40 DCOE」', "D'Angelo Motori「40 dcoe（本体／キット）」"],
    hint: 'マニホールドが別に要る。チョーク（内ベンチュリ）は 30 で計算。登録車では Abarth 系に多い' },
  { id: 'dcoe45', label: 'Weber 45 DCOE（チョーク 32）', venturi: 32, pump: true, registered: true,
    shops: ['Axel Gerstl「Weber carburetor 45 DCOE」', "D'Angelo Motori「45 dcoe（本体／キット）」"], hint: '700cc 以上の本気仕様向け' },
  { id: 'fcr33', label: 'Keihin FCR 33（バイク用・気筒ごと1基）', venturi: 31, pump: true, registered: true,
    shops: [], hint: 'フラットスライド＝全開時はほぼ口径どおりに開く', assumed: ['ベンチュリに相当する絞りは無い＝口径 33 の 95% で計算'] },
  { id: 'mikuni', label: 'Mikuni TMR 40／HSR 42（バイク用・気筒ごと1基）', venturi: 38, pump: true, registered: true,
    shops: [], hint: '250cc/気筒に対してはかなり大きい', assumed: ['絞りは口径の 95% で計算・2機種を1つに括った'] },
];

// ───────────── 欄6：排気 ─────────────
export const EXHAUSTS = [
  { id: 'stock', label: '純正マフラー', exhaust: null },
  { id: 'sport', label: 'スポーツマフラー（Abarth Record 型）', exhaust: { kExh: 0.03, runnerLen_m: 0.6 },
    shops: ['各店「Marmitta Abarth／Record Monza 型」（品目名のみ・数値なし）'], hint: '背圧が低く管が長い＝段1では「これが無いとカムが効かない」' },
];

export const SLOTS = { disp: DISPLACEMENTS, cr: COMP_RATIOS, cam: CAMS, head: HEADS, carb: CARBS, exh: EXHAUSTS };

// よくある出発点（「いま」欄への一括入力）
export const START_EXAMPLES = [
  { id: 'pure', label: '純正のまま', choices: {} },
  { id: '650', label: '650cc 化済み（26 IMB のまま）', choices: { disp: 'b77', cr: 'cr75' }, families: ['500'] },
  { id: '650+28', label: '650cc＋28 IMB', choices: { disp: 'b77', cr: 'cr75', carb: 'w28imb' }, families: ['500'] },
  { id: '650+28+cam', label: '650cc＋28 IMB＋カム 35/75', choices: { disp: 'b77', cr: 'cr75', carb: 'w28imb', cam: 'c3575' }, families: ['500'] },
  { id: '28', label: '28 IMB に換装済み', choices: { carb: 'w28imb' }, families: ['500'] },
  { id: '126cam', label: 'カム 40/80＋スポーツマフラー', choices: { cam: 'c4080', exh: 'sport' }, families: ['126'] },
];

// ───────────── 王道パッケージ（2026-09-18・根拠は ref/packages_research.md／2026-09-19 §7-17 で並び順と126入口を追加）─────────────
// evidence＝その組合せが出た独立した店・スレの数。null＝根拠が無い参考枠（画面は「参考」と出す＝捏造しない）。
//   ⚠️ CR はどのキットも固定しない（店の「q.c.」はピストン圧縮高さで圧縮比ではない）＝慣用値を置き画面で断る。
// families＝出す車種（series）。only／except＝型式単位のさらなる絞り込み。
// needs126・dim 表示は廃止（500R は series '500'・block '126' なので換装不要＝そのまま組める）。
export const PACKAGES = [
  { id: 'p126', name: '126 エンジンに換装', sub: '126 後期（652cc）のエンジンをそのまま載せる', evidence: 3,
    why: '126 のエンジンをそのまま載せる形。英・日でいちばん多い実例。英フォーラム曰く「素の 650 はポート加工した 500 と大差ない＝4本柱を一緒に触って初めて差が出る」',
    choices: { eng: '126A1' }, families: ['500'] },
  { id: 'p650', name: '650 にボアアップ', sub: 'Ø77＋28 IMB＋カム 35/75＋スポーツマフラー', evidence: 5,
    why: '店3店とフォーラム2スレが一致する入門形。狙いは最高速ではなく登坂と巡航の余裕。圧縮比はキットで決まらないので 7.5 を置いた',
    choices: { disp: 'b77', cr: 'cr75', cam: 'c3575', carb: 'w28imb', exh: 'sport' }, families: ['500'] },
  { id: 'p650s', name: '650 スポーツ', sub: 'Ø77＋40/80＋ヘッド 36/31＋二連 30 DGF＋スポーツマフラー・CR 9', evidence: 4,
    why: 'フォーラムで「一段上」と言われる実組み。⚠️ 二連キャブはヘッドの通路と組で決める（モノ通路の 500 ヘッド＋30 DGF は始動・アイドルが決まらなかった報告あり）',
    choices: { disp: 'b77', cr: 'cr90', cam: 'c4080', head: 'h3631', carb: 'dgf30', exh: 'sport' }, families: ['500', '126'] },
  { id: 'p595ss', name: 'Abarth 595 SS 相当', sub: 'Ø73.5＋Abarth 40/80＋吸気弁 34 ポート加工＋Solex 34 PBIC＋Record・CR 9.5', evidence: 3,
    why: '史実の組合せ（公表 32CV）。段1で校正した値そのもの。実車は CR 9.9 だがここでは 9.5（10 でノッキングの警告が出る境目）',
    choices: { disp: 'b735', cr: 'cr95', cam: 'a4080', head: 'h34', carb: 'pbic34', exh: 'sport' }, families: ['500', '126'], except: ['126A1'] },  // 652→594 のボアダウンになる
  { id: 'p700', name: '700 DCOE', sub: 'Ø79.5＋40/80＋ヘッド 36/31＋Weber 40 DCOE＋スポーツ排気・CR 9', evidence: 2,
    why: '店の「本気」段階。126 のクランクケースが前提（500 のケースは 652 が上限）。同じ「700」でも Ø79.5 と Ø80 が混在する',
    choices: { disp: 'b795', cr: 'cr90', cam: 'c4080', head: 'h3631', carb: 'dcoe40', exh: 'sport' }, families: ['500', '126'] },
  { id: 'p800', name: '800 頂点', sub: 'Ø85＋40/80＋Lavazza 39/33＋Weber 45 DCOE＋スポーツ排気・CR 9.5', evidence: 1,
    why: '完成キットは2店だけで、実際に組んだ報告は拾えなかった＝憧れ枠。ケースの Ø92 加工が要る',
    choices: { disp: 'b85', cr: 'cr95', cam: 'c4080', head: 'h3933', carb: 'dcoe45', exh: 'sport' }, families: ['500', '126'] },
  { id: 'p652', name: '652 にボアアップ', sub: 'Ø77＋q.c.39（126 後期と同じ寸法）', evidence: 3,
    why: '126 後期と同じ寸法まで上げる形。126 前期オーナーが後期相当に揃える入口',
    choices: { disp: 'b77', cr: 'cr75' }, families: ['126'], only: ['126A'] },
  { id: 'p126cam', name: 'まずカムとマフラー', sub: 'カム 35/75＋スポーツマフラー（ボアはそのまま）', evidence: null,
    why: '652cc のボアはそのままに、カムとマフラーだけで足を延ばす形。この組合せそのものの実例は資料に見つかっていない＝参考として置いている',
    choices: { cam: 'c3575', exh: 'sport' }, families: ['126'], only: ['126A1'] },
];

export const DEFAULT_CHOICES = { disp: 'stock', cr: 'stock', cam: 'stock', head: 'stock', carb: 'stock', exh: 'stock' };

const byId = (list, id) => list.find(x => x.id === id) || list[0];
export const modelById = (id) => MODELS.find(m => m.id === id) || MODELS[2];

// 型式＋6欄の選択 → simulate() に渡す spec。あわせて画面用の「実際に使った値」を返す。
// ── 回転の上限（取説の「各ギアの最大許容速度」に相当する回転）─────────────────
// ⭐2026-09-18 ユーザー指摘で判明した食い違いの正体＝模型は 5000rpm で変速し 6500rpm まで回していたが、
//   取説は各ギアの最大許容速度（500F なら 23/40/65/95 km/h）を決めていて、それはどの型式でも
//   4400〜4950rpm に当たる。実車で談合坂の 5% を「3速で回し切っても登れない」のはこの範囲で走るから。
//   ⛔上限を上げてよいのはカムだけ（回るようにする部品はカム＝ボアアップや排気だけでは上限は動かない）。
export function revCapRpm(built, res) {
  if (built.picks.cam.id === 'stock') return built.model.revLimit.rpm;
  // 改造カム＝「回し続けられる回転」＝最高出力の回転の 500rpm 下（2026-09-18 オーナー実測＝Colombo & Bariani のロード・ミディアム＋
  // 純正マフラーで一瞬なら 5500、坂を登り続けるのはせいぜい 5000。6000 まで回るのはよほどのレース仕様）。
  // ⛔初版の「最高出力の 500rpm 上」→「最高出力の回転」を経てここに落ち着いた＝戻さない。純正の許容回転（取説）は下回らせない。
  const peak = res.reduce((m, p) => (p.powerCv > m.powerCv ? p : m), res[0]);
  return Math.min(res[res.length - 1].rpm, Math.max(built.model.revLimit.rpm, Math.round((peak.rpm - 500) / 25) * 25));
}
// modelId＝ベース車両（車両側の型式・重さやギアの出所）。choices.eng が立っていれば、エンジンの土台（engine/cam/valves/
// carb の既定・ignition・revLimit・block・assumed・note）はそちらの型式から採る＝「エンジンの土台だけ差し替える」本物の換装
// （2026-09-19 §7-17）。built.model は常にエンジン側の型式＝revCapRpm や warnings() の block 判定はここを見ればよい。
// 車両側（重さ・ギア）は buildVehicle(modelId) が別に持つ＝この関数は触らない。
export function buildSpec(modelId, choices) {
  const m = modelById(modelId);                       // ベース車両
  const c = { ...DEFAULT_CHOICES, ...(choices || {}) };
  const engM = c.eng ? modelById(c.eng) : m;           // エンジン側の型式（土台の差し替え・省略時はベース車両のまま）
  const disp = byId(DISPLACEMENTS, c.disp), cr = byId(COMP_RATIOS, c.cr), cm = byId(CAMS, c.cam);
  const hd = byId(HEADS, c.head), cb = byId(CARBS, c.carb === 'stock' ? engM.carb : c.carb), ex = byId(EXHAUSTS, c.exh);
  const engine = { ...engM.engine };
  if (disp.bore) engine.bore = disp.bore;
  if (cr.cr) engine.cr = cr.cr;
  const camSpec = cm.cam ? { ...cm.cam } : { ...engM.cam };
  const valves = { ...engM.valves, ...(hd.valves || {}) };
  const intake = { venturi: cb.venturi, barrels: cb.barrels || 1 };
  if (cb.pump) intake.mixMin = 0.8;
  const spec = { engine, cam: camSpec, valves, intake, ignition: engine.cr >= 9 ? IGN_HI : engM.ignition };
  if (ex.exhaust) spec.exhaust = { ...ex.exhaust };
  if (hd.ported) spec.cal = { kValveIn: 1.0, kValveEx: 1.0, runnerXi: 0.7 };
  const cc = Math.PI / 4 * engine.bore ** 2 * engine.stroke * engine.ncyl / 1000;
  const assumed = [...(engM.assumed || []), ...(disp.assumed || []), ...(cm.assumed || []), ...(hd.assumed || []), ...(cb.assumed || [])];
  const blockMismatch = !!(disp.bore && !disp.blocks.includes(engM.block));
  return { spec, model: engM, vehicle: m, eng: c.eng || null, picks: { disp, cr, cam: cm, head: hd, carb: cb, exh: ex }, cc, assumed, blockMismatch };
}

// ───────────── 札（PACKAGES）を車種・型式に合わせて出し分ける／点灯判定 ─────────────
// p700・p800 は「126 のクランクケースが前提」＝押した時点のベース車両のエンジン側 block が '500' なら eng:'126A1' を
// 自動で足す（500R は series '500' だが block '126' なのでこの対象にならない＝そのまま組める。2026-09-19 §7-17）。
const NEEDS_126_BLOCK = new Set(['p700', 'p800']);
export function packagesFor(model) {
  return PACKAGES.filter(pk => pk.families.includes(model.series)
    && (!pk.only || pk.only.includes(model.id))
    && (!pk.except || !pk.except.includes(model.id)));
}
export function packageChoices(pk, model) {
  const eng = NEEDS_126_BLOCK.has(pk.id) && model.block === '500' ? '126A1' : undefined;
  return eng ? { eng, ...pk.choices } : { ...pk.choices };
}
export function packageSub(pk, model) {
  return (NEEDS_126_BLOCK.has(pk.id) && model.block === '500') ? '126 エンジンに換装して' + pk.sub : pk.sub;
}
// 現在の choices（state.a / state.b）がこの札と一致するか＝6欄に加えて eng も見る（2026-09-19 §7-17）。
export function packageMatches(pk, model, choices) {
  const want = packageChoices(pk, model);
  const wantFull = { ...DEFAULT_CHOICES, ...want };
  const curFull = { ...DEFAULT_CHOICES, ...choices };
  const slotsOk = Object.keys(DEFAULT_CHOICES).every(k => curFull[k] === wantFull[k]);
  return slotsOk && (want.eng || null) === ((choices && choices.eng) || null);
}
