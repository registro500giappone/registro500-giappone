// 車両側のプリセット（変速比・最終減速比・タイヤ・重量）。出典＝ref/vehicle_specs.md（手元の取説・整備書から実読）と ref/packages_research.md §4。
// ⚠️ 126 の車重・Cd・前面投影面積は一次資料に無い＝assumed に明記した仮定値。差を見る道具なので絶対値は追わない（HANDOFF §2）。

// ───────────── 変速機（1〜4速・後退） ─────────────
export const GEARBOXES = [
  { id: 'n_early', label: '500 N 初期（1速 3.273）', gears: [3.273, 2.067, 1.300, 0.875], reverse: 4.134,
    src: 'N 取説。エンジン No.173487 から 1速 3.70／後退 5.14 に変更（独語整備書 p.111 注記）' },
  { id: 'dfl', label: '500 D/F/L・ジャルディニエラ（ノンシンクロ・1速 3.70）', gears: [3.700, 2.067, 1.300, 0.875], reverse: 5.140,
    src: 'D/F/L 取説・Caratteristiche 文書。歯数 37/10×25/18＝5.139 なので後退は 5.14 が正（L 取説の 5.144 は末尾桁の誤り）' },
  { id: 'sync', label: '500 R・126（シンクロ・1速 3.25）', gears: [3.250, 2.067, 1.300, 0.872], reverse: 4.024,
    src: 'R 取説・126 Autobook・126 Reparaturhandbuch', hint: '650cc 化で「126 のミッションごと載せる」のがこれ' },
];

// ───────────── 最終減速（コッピア・コニカ） ─────────────
export const FINALS = [
  { id: 'f841', label: '8/41（5.125・500 N/D/F/L 純正）', ratio: 41 / 8, shops: ['500ricambi', 'Passione 500', 'Axel Gerstl'] },
  { id: 'f839', label: '8/39（4.875・500 R/126 純正）', ratio: 39 / 8, shops: ['500ricambi', 'Axel Gerstl'], hint: '650cc 化の定番。595 SS ではオプション' },
  { id: 'f939', label: '9/39（4.333・126 BIS 純正／巡航向け）', ratio: 39 / 9, shops: ['Axel Gerstl', 'Tecnotrasmissioni'],
    hint: '60mph≒4000rpm。ただし「登坂で 4 速が苦しい」「素の 650 では恩恵が薄く戻した人あり」（英フォーラム）' },
];

// ───────────── タイヤ（外径は規格からの算出） ─────────────
// 旧いバイアス「125-12」は偏平率表記が無い＝125/80 相当（外径 ≈505mm）として扱う（assumed）。
export const TIRES = [
  { id: 't125', label: '125 R12（500 純正・外径 ≈505mm）', tire: { w: 125, ar: 0.80, rim: 12 }, assumed: ['バイアス 125-12 の外径は 125/80R12 と同じと仮定'] },
  { id: 't135', label: '135/80 R12（126 純正・≈521mm）', tire: { w: 135, ar: 0.80, rim: 12 }, hint: '500 の 3.5J ホイールに無加工で入る。外径 +3%＝ファイナルを 3% ロングにしたのと同じ' },
  { id: 't145', label: '145/70 R12（幅広・≈508mm）', tire: { w: 145, ar: 0.70, rim: 12 }, hint: '外径は 125 とほぼ同じ＝回転数は変わらず幅だけ広がる' },
];

// ───────────── 乗員・荷物 ─────────────
export const LOADS = [
  { id: 'solo', label: '1人（75kg）', kg: 75 },
  { id: 'duo', label: '2人（150kg）', kg: 150 },
  { id: 'full', label: '満載（取説の総重量）', kg: null },   // null＝型式の総重量を使う
];

// ───────────── 型式ごとの車両 ─────────────
// mass_kg＝走行可能状態（燃料・スペア・工具込み）・gvw_kg＝総重量（満載）。cd・area_m2 は一次資料に無い（assumed）。
// 校正目標（取説・満載）：climb＝1〜4速の最大登坂勾配 %・vmax＝4速の最高速 km/h（「oltre 95」は下限）。
// 仮定＝Cd 0.40（Wikipedia は 0.38）・前面投影面積 1.70（公表無し。1.32×1.325×0.8〜0.85＝1.40〜1.49 の推定より大きめ＝Cd と合わせて空気抵抗の積 CdA≈0.68 とみる）・
// 転がり抵抗 0.018（バイアス 125-12 の想定。乗用車の一般値 0.010〜0.015 より上）。eff 0.87 とともに 2026-09-18 に取説の登坂能力（500D/F/R/G・満載）で選んだ＝test_vehicle.js
const AERO = { cd: 0.40, area_m2: 1.70, crr: 0.018 };
export const VEHICLES = {
  '500N':  { gearbox: 'n_early', final: 'f841', tire: 't125', mass_kg: 470, gvw_kg: 680, ...AERO,
             calib: { climb: [23, 14, 8, 4.5], vmax: 85, gearVmax: null, loose: true }, src: 'N 取説 印刷 p.45〜46（13CV 初期）',
             assumed: ['500N のエンジン諸元は段1の校正外（カム・バルブは F から借用）＝登坂・最高速が取説より 1〜2 割楽観に出る'] },
  '500D':  { gearbox: 'dfl', final: 'f841', tire: 't125', mass_kg: 500, gvw_kg: 820, ...AERO,
             calib: { climb: [26, 13, 7, 3.5], vmax: 95, gearVmax: null }, src: 'D 取説 印刷 p.44・Caratteristiche p.3' },
  '500F':  { gearbox: 'dfl', final: 'f841', tire: 't125', mass_kg: 520, gvw_kg: 840, ...AERO,
             calib: { climb: [26, 13, 7, 3.5], vmax: 95, gearVmax: [23, 40, 65, 95] }, src: 'L 取説 印刷 p.50・Caratteristiche 印刷 p.80' },
  'GIA':   { gearbox: 'dfl', final: 'f841', tire: 't125', mass_kg: 555, gvw_kg: 875, cd: 0.42, area_m2: 1.75, crr: 0.018,
             calib: { climb: [22, 11.5, 6, 3], vmax: 95, gearVmax: null }, src: 'G 取説 印刷 p.41', assumed: ['ワゴン形の Cd・面積は少し大きいと仮定'] },
  '500R':  { gearbox: 'sync', final: 'f839', tire: 't125', mass_kg: 525, gvw_kg: 845, ...AERO,
             calib: { climb: [24.5, 14.5, 8.5, 4.5], vmax: 100, gearVmax: [30, 45, 75, 100] }, src: 'R 取説 p.3（525/845 は要再確認）' },
  '126A':  { gearbox: 'sync', final: 'f839', tire: 't135', mass_kg: 580, gvw_kg: 900, ...AERO,
             calib: null, src: '変速比・ファイナル・タイヤは Autobook／Reparaturhandbuch。車重は一次資料に無い', assumed: ['車重 580kg・総重量 900kg は Web の一般値'] },
  '126A1': { gearbox: 'sync', final: 'f839', tire: 't135', mass_kg: 600, gvw_kg: 920, ...AERO,
             calib: null, src: '同上', assumed: ['車重 600kg・総重量 920kg は Web の一般値'] },
};

export const DEFAULT_DRIVE_CHOICES = { gearbox: 'stock', final: 'stock', tire: 'stock', load: 'solo' };

const byId = (list, id) => list.find(x => x.id === id) || list[0];

// 型式と選択から vehicle.js に渡す { vehicle, drive } を組む。'stock' は型式の純正値。
export function buildVehicle(modelId, choices) {
  const base = VEHICLES[modelId] || VEHICLES['500F'];
  const c = { ...DEFAULT_DRIVE_CHOICES, ...(choices || {}) };
  const gb = byId(GEARBOXES, c.gearbox === 'stock' ? base.gearbox : c.gearbox);
  const fn = byId(FINALS, c.final === 'stock' ? base.final : c.final);
  const tr = byId(TIRES, c.tire === 'stock' ? base.tire : c.tire);
  const ld = byId(LOADS, c.load);
  const mass = ld.kg === null ? base.gvw_kg : base.mass_kg + ld.kg;
  const assumed = [...(base.assumed || []), ...(tr.assumed || [])];
  return {
    vehicle: { mass, cd: base.cd, area_m2: base.area_m2, crr: base.crr },
    drive: { gears: gb.gears, final: fn.ratio, tire: tr.tire, eff: 0.87 },
    picks: { gearbox: gb, final: fn, tire: tr, load: ld }, base, assumed,
  };
}
