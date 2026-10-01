// 純正機のテスト用諸元（出典＝ref/stock_specs.md §①〜⑥・axel_datasheets）
// checkLift＝カタログ角を測る検査クリアランス − 運転クリアランス（500: 0.39−0.15＝0.24／126: 0.625−0.20≒0.42）
// 500 のバルブリフト 8.4＝Fiat 資料 p.33 のバルブスプリング検査長（閉 38.5 → 開 30.1 mm）から。Axel「Camshaft lift 5.8」×ロッカー比≒1.45
export const engines = {
  '500F 純正 (18CV/4600, 3.1kgm)': {
    engine: { bore: 67.4, stroke: 70, rod: 126, cr: 7.1, ncyl: 2 },
    cam: { ivo: 25, ivc: 51, evo: 64, evc: 12, liftIn: 8.4, liftEx: 8.4, checkLift: 0.24 },
    valves: { dIn: 32, dEx: 28, stemIn: 8, stemEx: 8 },
    intake: { venturi: 21 },
    ignition: [[1000, 10], [2000, 27], [3000, 38], [6000, 38]],
    target: { cv: 18, rpm: 4600, nm: 30.4, nmRpm: 3000 },   // Fiat 資料 p.84（DIN）
  },
  '500R 純正 (18CV/4600, 3.7kgm)': {
    engine: { bore: 73.5, stroke: 70, rod: 126, cr: 7.5, ncyl: 2 },
    cam: { ivo: 25, ivc: 51, evo: 64, evc: 12, liftIn: 8.4, liftEx: 8.4, checkLift: 0.24 },  // Axel 500R 表＝500 カム（別資料は 126 カム＝食い違い）
    valves: { dIn: 32, dEx: 28, stemIn: 8, stemEx: 8 },
    intake: { venturi: 18 },                                   // Weber 24 IMB 1
    ignition: [[1000, 10], [2000, 27], [3000, 38], [6000, 38]],
    target: { cv: 18, rpm: 4600, nm: 36.3, nmRpm: 2800 },   // Axel 500R 表（DIN）
  },
  '126 652 純正 (24CV/4500, 4.2kgm)': {
    engine: { bore: 77, stroke: 70, rod: 126, cr: 7.5, ncyl: 2 },
    cam: { ivo: 26, ivc: 57, evo: 66, evc: 17, liftIn: 9.32, liftEx: 9.32, checkLift: 0.42 },
    valves: { dIn: 33, dEx: 28, stemIn: 8, stemEx: 8 },
    intake: { venturi: 23 },
    ignition: [[1000, 10], [2300, 30], [3000, 38], [6000, 38]],
    target: { cv: 24, rpm: 4500, nm: 41.2, nmRpm: 3000 },
  },
  '126 594 純正 (23CV/4800, 4.0kgm)': {
    engine: { bore: 73.5, stroke: 70, rod: 126, cr: 7.5, ncyl: 2 },
    cam: { ivo: 26, ivc: 56, evo: 66, evc: 16, liftIn: 9.32, liftEx: 9.32, checkLift: 0.42 },
    valves: { dIn: 32, dEx: 28, stemIn: 8, stemEx: 8 },
    intake: { venturi: 23 },
    ignition: [[1000, 10], [2300, 30], [3000, 38], [6000, 38]],
    target: { cv: 23, rpm: 4800, nm: 39.2, nmRpm: 3400 },
  },
};

// 検証用（校正には使わない）：500F の SAE 総出力条件＝ファン無し・消音器無し。Fiat 資料 p.84：SAE 22CV/4600・3.6kgm/3500
export const validation = {
  '500F SAE条件 (22CV/4600, 3.6kgm/3500)': {
    ...engines['500F 純正 (18CV/4600, 3.1kgm)'],
    accessories: { fan: false },
    exhaust: { backPressure_bar: 1.0, kExh: 0 },
    target: { cv: 22, rpm: 4600, nm: 35.3, nmRpm: 3500 },
  },
};
