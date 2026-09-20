// 車両側のプリセット（変速比・最終減速比・タイヤ・重量）。出典＝ref/vehicle_specs.md（手元の取説・整備書から実読）と ref/packages_research.md §4。
// ⚠️ Cd・前面投影面積は一次資料に無い＝assumed に明記した仮定値。差を見る道具なので絶対値は追わない（HANDOFF §2）。
// ⭐ 126 の車重は 2026-09-18 に Haynes 126 整備書で確定（下の '126A'・'126A1' の src）。残る仮定は総重量だけ。

// ───────────── 変速機（1〜4速・後退） ─────────────
export const GEARBOXES = [
  { id: 'n_early', label: '500 N 初期（1速 3.273）', gears: [3.273, 2.067, 1.300, 0.875], reverse: 4.134,
    src: 'N 取説。エンジン No.173487 から 1速 3.70／後退 5.14 に変更（独語整備書 p.111 注記）' },
  { id: 'dfl', label: '500 D/F/L・ジャルディニエラ（ノンシンクロ・1速 3.70）', gears: [3.700, 2.067, 1.300, 0.875], reverse: 5.140,
    src: 'D/F/L 取説・Caratteristiche 文書。歯数 37/10×25/18＝5.139 なので後退は 5.14 が正（L 取説の 5.144 は末尾桁の誤り）' },
  { id: 'sync', label: '500 R・126（シンクロ・1速 3.25）', gears: [3.250, 2.067, 1.300, 0.872], reverse: 4.024,
    src: 'R 取説・126 Autobook・126 Reparaturhandbuch', hint: '650cc 化で「126 のミッションごと載せる」のがこれ' },
];

// ───────────── 変速機の一部ギアだけを差し替えるキット（3/4速ショート・1速ロング等） ─────────────
// over は箱 id ごとに { 段: 比 } を持つ（比は歯数から算出。src に元の歯数の出典を書く）。boxes に無い箱には効かない＝driveOptionsFor がここで絞る。
export const GEARSETS = [
  { id: 'stock', label: '純正のまま', boxes: ['n_early', 'dfl', 'sync'], over: {} },
  { id: 'nanni_34', label: 'NANNI 3/4 ショート', boxes: ['n_early', 'dfl', 'sync'],
    over: {
      n_early: { 3: 26 / 19, 4: 21 / 22 },
      dfl: { 3: 26 / 19, 4: 21 / 22 },
      sync: { 3: 26 / 19, 4: 34 / 36 },
    },
    hint: '3・4速だけ短くして段間の谷を詰める。単体で成立（4速 0.955）。最高速は落ちる',
    src: 'NANNI Art.0109/0110/0112/0113（gearsets 調査 §1-A）' },
  { id: 'bacci_34', label: 'Bacci 3/4 ショート（5速前提）', boxes: ['sync'],
    over: { sync: { 3: 27 / 19, 4: 24 / 22 } },
    needsFifth: true,
    hint: '4速が純正より 25% 短い＝5速 0.88（25/22）を足して初めて純正4速相当。FD・D\'Angelo・500automotor・Monteferri が同歯数',
    src: 'gearsets 調査 §1-B・§6',
    assumed: ['ノンシンクロ箱に入るかは裏が取れず（Monteferri は両方に同歯数）＝S のみに出す'] },
  { id: 'first_long', label: '1速ロング（126 の 12/39）', boxes: ['n_early', 'dfl'],
    over: { n_early: { 1: 39 / 12 }, dfl: { 1: 39 / 12 } },
    hint: '1→2 の谷が縮む・発進は重くなる。体感談が少ない',
    src: 'Bacci RCE02／FD VB1119「close ratio 1速」＝126 純正と同歯数（gearsets 調査 §1-B・§1-C）' },
];

// ───────────── 最終減速（コッピア・コニカ） ─────────────
export const FINALS = [
  { id: 'f841', label: '8/41（5.125・500 N/D/F/L 純正）', ratio: 41 / 8, shops: ['500ricambi', 'Passione 500', 'Axel Gerstl'] },
  { id: 'f839', label: '8/39（4.875・500 R/126 純正）', ratio: 39 / 8, shops: ['500ricambi', 'Axel Gerstl'],
    hint: '650cc 化の定番。595 SS ではオプション。500F 以降のケースに無加工で載る。499cc だと 3→4 の谷を感じる談' },
  { id: 'f939', label: '9/39（4.333・126 BIS 純正／巡航向け）', ratio: 39 / 9, shops: ['Axel Gerstl', 'Tecnotrasmissioni'],
    excludeModels: ['500D'],
    hint: '650 チューンの巡航向け。店は 23PS 以上向けと線を引く。実装者談＝1速がうるさい・20% 坂はシフトダウン・低回転で冷却が落ちる' },
];

// ───────────── タイヤ（外径は規格からの算出） ─────────────
// 旧いバイアス「125-12」は偏平率表記が無い＝125/80 相当（外径 ≈505mm）として扱う（assumed）。
export const TIRES = [
  { id: 't125', label: '125 R12（500 純正・外径 ≈505mm）', tire: { w: 125, ar: 0.80, rim: 12 }, grp: 'same',
    assumed: ['バイアス 125-12 の外径は 125/80R12 と同じと仮定'] },
  { id: 't135', label: '135/80 R12（126 純正・≈521mm・+3.2%）', tire: { w: 135, ar: 0.80, rim: 12 }, grp: 'plus3',
    hint: '3.5J に入る明言なし・フルロックで擦る談あり・車高 +8mm。同じ速度で回転 3%ほど低い' },
  { id: 't145', label: '145/70 R12（幅広・≈508mm・+0.6%）', tire: { w: 145, ar: 0.70, rim: 12 }, grp: 'same',
    hint: '外径は 125 とほぼ同じ＝回転数は変わらず幅だけ広がる' },
  { id: 't145_80_10', label: '145/80 R10（10インチ・≈486mm・−3.8%）', tire: { w: 145, ar: 0.80, rim: 10 }, grp: 'ten',
    hint: '4×190 のまま履ける新品は D\'Angelo 10×5J のみ。車高 −10mm・メーターが高く読む・ドラムなら干渉なし。同じ速度で回転 4%ほど高い',
    src: 'final_tire 調査 §7-2・10inch 調査 §6' },
  { id: 't165_60_12', label: '165/60 R12（≈503mm・−0.4%）', tire: { w: 165, ar: 0.60, rim: 12 }, grp: 'same',
    hint: '外径は 125 とほぼ変わらない＝同じ速度で回転もほぼ変わらない。実例1件（リム幅不明）',
    src: 'final_tire 調査 §7-2' },
  { id: 't155_70_12', label: '155/70 R12（≈522mm・+3.4%）', tire: { w: 155, ar: 0.70, rim: 12 }, grp: 'plus3',
    hint: '135 とほぼ同じ外径＝同じ速度で回転 3%ほど低い。適合の明言は無く否定的言及のみ',
    src: 'final_tire 調査 §7-2' },
  { id: 't165_55_13', label: '165/55 R13（≈512mm・+1.4%）', tire: { w: 165, ar: 0.55, rim: 13 }, grp: 'thirteen',
    hint: '13インチへの入口。同じ速度で回転 1%強高い。実例1件（652cc）',
    src: 'final_tire 調査 §7-2' },
  { id: 't155_65_13', label: '155/65 R13（≈532mm・+5.3%）', tire: { w: 155, ar: 0.65, rim: 13 }, grp: 'thirteen',
    hint: 'BIS 界隈の定番。同じ速度で回転 5%ほど低い・干渉なし',
    src: 'final_tire 調査 §7-2' },
  { id: 't135_80_13', label: '135/80 R13（≈546mm・+8.2%）', tire: { w: 135, ar: 0.80, rim: 13 }, grp: 'thirteen',
    hint: '126 BIS 純正の13インチ（4.5J×13）。同じ速度で回転 8%ほど低い',
    src: 'final_tire 調査 §7-2' },
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
             // ⭐ 2026-09-20 再確認：カムの開閉角・圧縮比・キャブは N 取説 印刷 p.39 の実値と一致していた（借り物ではない）。
             //    借用はバルブのヘッド径だけ＝整備書の図はステム径しか入れていない。最大トルクはどの本にも無い（取説・販売資料・整備書を確認済み）。
             assumed: ['500N のエンジン諸元は段1の校正外（バルブのヘッド径だけ 500D から借用）＝登坂・最高速が取説より 1〜2 割楽観に出る'] },
  '500D':  { gearbox: 'dfl', final: 'f841', tire: 't125', mass_kg: 500, gvw_kg: 820, ...AERO,
             calib: { climb: [26, 13, 7, 3.5], vmax: 95, gearVmax: null }, src: 'D 取説 印刷 p.44・Caratteristiche p.3' },
  '500F':  { gearbox: 'dfl', final: 'f841', tire: 't125', mass_kg: 520, gvw_kg: 840, ...AERO,
             calib: { climb: [26, 13, 7, 3.5], vmax: 95, gearVmax: [23, 40, 65, 95] }, src: 'L 取説 印刷 p.50・Caratteristiche 印刷 p.80' },
  'GIA':   { gearbox: 'dfl', final: 'f841', tire: 't125', mass_kg: 555, gvw_kg: 875, cd: 0.42, area_m2: 1.75, crr: 0.018,
             calib: { climb: [22, 11.5, 6, 3], vmax: 95, gearVmax: null }, src: 'G 取説 印刷 p.41', assumed: ['ワゴン形の Cd・面積は少し大きいと仮定'] },
  '500R':  { gearbox: 'sync', final: 'f839', tire: 't125', mass_kg: 525, gvw_kg: 845, ...AERO,
             calib: { climb: [24.5, 14.5, 8.5, 4.5], vmax: 100, gearVmax: [30, 45, 75, 100] }, src: 'R 取説 p.3（525/845 は要再確認）' },
  // ⭐ 2026-09-18：車重は Haynes 126 整備書で裏が取れた（旧「Web の一般値」＝580/600 と同値だった）。総重量だけは依然どの本にも無い。
  // ⛔ 2026-09-20 調査打ち切り＝手元の126資料は独 Reparaturhandbuch と英 Autobook の2冊だけで、どちらも重量・寸法の節が最初から無い
  //    （修理書は手順・公差・締付トルクの本＝登録向けの数値は収録対象外）。もう一度この2冊を開き直さないこと。
  // ⚠️ 総重量を使うのは積載「満載」を選んだときだけ＝坂の画面は乗員1人固定なので、この値のズレは坂の結果に効かない。
  '126A':  { gearbox: 'sync', final: 'f839', tire: 't135', mass_kg: 580, gvw_kg: 900, ...AERO,
             calib: null, src: '変速比・ファイナル・タイヤは Autobook／Reparaturhandbuch。車重 580kg は Haynes 126（印刷 p.9「Kerb weight 1279 lb (580 kg)」）', assumed: ['総重量 900kg は Web の一般値（手元の126資料2冊に重量の節が無いことを確認済み）。車重 580＋積載 320kg と辻褄は合う'] },
  '126A1': { gearbox: 'sync', final: 'f839', tire: 't135', mass_kg: 600, gvw_kg: 920, ...AERO,
             calib: null, src: '同上。車重 600kg は Haynes 126 補遺 Chapter 12（印刷 p.121「Kerb weight 1323 lbs (600 kg)」＝1977年8月以降）', assumed: ['総重量 920kg は Web の一般値（同上）。車重 600＋積載 320kg と辻褄は合う'] },
};

// ───────────── 5速化（既存の4速に5速を足すキット） ─────────────
// ⭐ミッションの種類（1速の比が型式で違う）と直交するので、掛け算で選択肢を増やさないよう独立の欄にした。
//   ⛔「5速ミッション」という別のギアボックスを作らない＝どの型式の 1〜4速にも足せるのが実物のキット。
export const FIFTHS = [
  { id: 'none', label: '4速のまま（純正）', ratio: null },
  { id: 'g5_stradale', label: '5速化キット「ストラダーレ」（5速 0.743）', ratio: 26 / 35, grp: 'long',
    shops: ['FD Ricambi', '500ricambi', 'Axel Gerstl'],
    hint: '1〜4速は純正のまま、5速だけを足すキット。4速 0.872 に対して 0.743＝同じ速度で回転が 15% 下がる。高速の巡航が楽になる代わりに、登りでは 5速が使えない。巡航専用・1〜4速はそのまま',
    src: 'FD Ricambi VB1101「Gearbox Stradale 5 Speed Conversion Kit」（適合＝500 N/D/F/L/R・ジャルディニエラ・126・BIS・Bianchina）／歯数 35/26 は複数店の商品名に明記（AutoBella・nonsoloricambidepoca）',
    assumed: ['歯数 35/26 から比を 26/35＝0.743 と算出（店は比の数値そのものを公表していない）'] },
  { id: 'g5_2719', label: '5速化キット 27/19（0.704・長距離向け）', ratio: 19 / 27, grp: 'long',
    hint: '巡航専用・1〜4速はそのまま。35hp 以上・平坦路向け',
    src: 'Bacci（gearsets 調査 §6）', assumed: ['歯数から算出'] },
  { id: 'g5_3626', label: '5速化キット 36/26（0.722・長距離向け）', ratio: 26 / 36, grp: 'long',
    hint: '巡航専用・1〜4速はそのまま',
    src: 'Monteferri（gearsets 調査 §6）', assumed: ['歯数から算出'] },
  { id: 'g5_4231', label: '5速化キット 42/31（0.738・長距離向け）', ratio: 31 / 42, grp: 'long',
    hint: '巡航専用・1〜4速はそのまま',
    src: 'NANNI（gearsets 調査 §6）', assumed: ['歯数から算出'] },
  { id: 'g5_2520', label: '5速化キット 25/20（0.800）', ratio: 20 / 25, grp: 'mid',
    hint: '4速と少しだけ差',
    src: '500automotor（gearsets 調査 §6）', assumed: ['歯数から算出'] },
  { id: 'g5_4033', label: '5速化キット 40/33（0.825・NANNI「+300rpm」）', ratio: 33 / 40, grp: 'mid',
    hint: '4速と少しだけ差',
    src: 'NANNI（gearsets 調査 §6）', assumed: ['歯数から算出'] },
  { id: 'g5_2521', label: '5速化キット 25/21（0.840）', ratio: 21 / 25, grp: 'mid',
    hint: '4速と少しだけ差',
    src: '500automotor（gearsets 調査 §6）', assumed: ['歯数から算出'] },
  { id: 'g5_2421', label: '5速化キット 24/21（0.875＝純正4速と同じ）', ratio: 21 / 24, grp: 'short',
    hint: 'クロス化の続き＝4速を短くした人向け',
    src: '500automotor（gearsets 調査 §6）', assumed: ['歯数から算出'] },
  { id: 'g5_2522', label: '5速化キット 25/22（0.880・FD 完成箱の標準）', ratio: 22 / 25, grp: 'short',
    hint: 'クロス化の続き＝4速を短くした人向け。Bacci 3/4 と組む',
    src: 'FD Ricambi 3209／3920（gearsets 調査 §1-C）', assumed: ['歯数から算出'] },
  { id: 'g5_2422', label: '5速化キット 24/22（0.917）', ratio: 22 / 24, grp: 'short',
    hint: 'クロス化の続き＝4速を短くした人向け',
    src: '500automotor（gearsets 調査 §6）', assumed: ['歯数から算出'] },
];

export const DEFAULT_DRIVE_CHOICES = { gearbox: 'stock', gearset: 'stock', final: 'stock', tire: 'stock', fifth: 'none', load: 'solo' };

const byId = (list, id) => list.find(x => x.id === id) || list[0];

// 選ばれている箱 id（'stock' なら型式の純正箱）。driveOptionsFor と buildVehicle の両方で使う。
const resolveBoxId = (base, gearboxChoice) => (gearboxChoice === 'stock' ? base.gearbox : gearboxChoice);

// 型式と選択から vehicle.js に渡す { vehicle, drive } を組む。'stock' は型式の純正値。
export function buildVehicle(modelId, choices) {
  const base = VEHICLES[modelId] || VEHICLES['500F'];
  const c = { ...DEFAULT_DRIVE_CHOICES, ...(choices || {}) };
  const gb = byId(GEARBOXES, resolveBoxId(base, c.gearbox));
  const gs = byId(GEARSETS, c.gearset);
  const fn = byId(FINALS, c.final === 'stock' ? base.final : c.final);
  const tr = byId(TIRES, c.tire === 'stock' ? base.tire : c.tire);
  const f5 = byId(FIFTHS, c.fifth);
  const ld = byId(LOADS, c.load);
  const mass = ld.kg === null ? base.gvw_kg : base.mass_kg + ld.kg;
  const assumed = [...(base.assumed || []), ...(gs.assumed || []), ...(tr.assumed || []), ...(f5.assumed || [])];
  const boxGears = [...gb.gears];   // コピーしてから上書き＝GEARBOXES の元配列を汚さない
  const over = (gs.over && gs.over[gb.id]) || {};
  Object.keys(over).forEach((step) => { boxGears[Number(step) - 1] = over[step]; });
  const gears = f5.ratio ? [...boxGears, f5.ratio] : boxGears;   // vehicle.js は gears.length を見るので 5速でもそのまま動く
  return {
    vehicle: { mass, cd: base.cd, area_m2: base.area_m2, crr: base.crr },
    drive: { gears, final: fn.ratio, tire: tr.tire, eff: 0.87 },
    picks: { gearbox: gb, gearset: gs, final: fn, tire: tr, fifth: f5, load: ld }, base, assumed,
  };
}

// 画面が使う適合済み一覧＝{ gearsets, fifths, finals, tires }。gearsets は選ばれている箱の boxes に含まれるものだけ／
// finals は excludeModels に型式が無いものだけ／fifths・tires は全部（grp 付きのまま返す）。
export function driveOptionsFor(modelId, choices) {
  const base = VEHICLES[modelId] || VEHICLES['500F'];
  const c = { ...DEFAULT_DRIVE_CHOICES, ...(choices || {}) };
  const boxId = resolveBoxId(base, c.gearbox);
  return {
    gearsets: GEARSETS.filter((gs) => gs.boxes.includes(boxId)),
    fifths: FIFTHS,
    finals: FINALS.filter((fn) => !(fn.excludeModels || []).includes(modelId)),
    tires: TIRES,
  };
}
