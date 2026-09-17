// スポーツカム側の校正目標＝Abarth 595 / 595 SS / 695 SS（公表値・出典は ref/stock_specs.md §⑦）
// ⚠️ 一次資料（Abarth の libretto）は手元に無い。Web の転記どうしを突き合わせて採った値＝信頼度は純正4機より低い。
// カム角は手元 `Fiat 500_126 Camshaft Specs (EN).pdf`（595＝40/80-80/40・695＝45/80-85/40）と 500forum の転記（冷間隙 0.20 で測定）が一致。
// Abarth の角は運転クリアランス（0.20）で測った値＝checkLift ≒ 0（カタログ角が座面角に等しい）。
const camAbarth595 = { ivo: 40, ivc: 80, evo: 80, evc: 40, liftIn: 10.7, liftEx: 10.7, checkLift: 0.05 };
const camAbarth695 = { ivo: 45, ivc: 80, evo: 85, evc: 40, liftIn: 10.7, liftEx: 10.7, checkLift: 0.05 };
// Abarth の点火進角＝資料なし。純正より少し多め（高圧縮・高回転向け）の仮定
const ignAbarth = [[1000, 12], [2000, 28], [3000, 36], [6000, 36]];
// 排気＝Record Monza（Abarth）：純正消音器より背圧が低く、管が長い
const exhAbarth = { kExh: 0.03, runnerLen_m: 0.6 };
// ポート加工済みヘッド（595 SS「re-worked inlet ports」・吸気弁 34 は純正 32 と別物）＝バルブ・ポートの流量係数を上げる
const calPorted = { kValveIn: 1.0, kValveEx: 1.0, runnerXi: 0.7 };

export const abarth = {
  'Abarth 595 (27CV/5000, 5.0kgm/3500)': {
    engine: { bore: 73.5, stroke: 70, rod: 126, cr: 9.5, ncyl: 2 },
    cam: camAbarth595,
    valves: { dIn: 34, dEx: 28, stemIn: 8, stemEx: 8 },     // 500forum「Diam. esterno max. valvola 34 / 28」
    intake: { venturi: 24, mixMin: 0.8 },                   // Solex C28 PBJ（ベンチュリ径は未確認＝28 の口径から推定）・加速ポンプ付き
    exhaust: exhAbarth, ignition: ignAbarth, cal: calPorted,
    target: { cv: 27, rpm: 5000, nm: 49.0, nmRpm: 3500 },   // autotecnica（5 kgm/3500）
  },
  'Abarth 595 SS (32CV/5000, 5.2kgm/3800)': {
    engine: { bore: 73.5, stroke: 70, rod: 126, cr: 9.9, ncyl: 2 },
    cam: camAbarth595,
    valves: { dIn: 34, dEx: 28, stemIn: 8, stemEx: 8 },
    intake: { venturi: 28, mixMin: 0.8 },                   // Solex 34 PBIC・diffusore Ø28・getto pompa Ø40＝加速ポンプ付き（bicilindriche.blogspot）
    exhaust: exhAbarth, ignition: ignAbarth, cal: calPorted,
    target: { cv: 32, rpm: 5000, nm: 51.0, nmRpm: 3800 },   // motor-car.net（DIN・5.2 kgm/3800）。500forum は 32CV/6000
  },
  'Abarth 695 SS (38CV/5400)': {
    engine: { bore: 76, stroke: 76, rod: 126, cr: 9.8, ncyl: 2 },
    cam: camAbarth695,
    valves: { dIn: 34, dEx: 28, stemIn: 8, stemEx: 8 },
    intake: { venturi: 30, mixMin: 0.8 },                   // Solex 34 PBIC・diffusore Ø30・加速ポンプ付き
    exhaust: exhAbarth, ignition: ignAbarth, cal: calPorted,
    target: { cv: 38, rpm: 5400, nm: null, nmRpm: null },   // motor-car.net（DIN）。トルクの公表値なし
  },
};
