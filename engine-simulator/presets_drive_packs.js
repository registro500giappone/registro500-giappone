// 駆動系の札（プリセット）＝「困りごと」ごとに選ぶ変更の組合せ。計算核・presets_vehicle.js は無変更＝ここは表示用の層だけ。
// 出典＝ref/drive_5speed_research.md・ref/drive_gearsets_research.md・ref/drive_final_tire_research.md・ref/drive_10inch_research.md
// back の3段は各150字以内・feel は「談」＝誰が・どの構成での話かを添える。故障率・冷却・騒音・燃費は数値化しない。

import { modelById } from './presets.js';
import { GEARBOXES, VEHICLES, DEFAULT_DRIVE_CHOICES, driveOptionsFor } from './presets_vehicle.js';

export const DRIVE_PACKS = [
  {
    id: 'dp_f839', name: 'ファイナル 8/39', sub: '巡航が楽になる・650cc 化の定番',
    cases: { A: 1, E: 2 },
    choices: { final: 'f839' },
    tags: [],
    back: {
      change: '最終減速比が 5.125→4.875 に。80km/h の回転が 5% ほど下がる。500F 以降のケースに無加工で載る。',
      feel: '「安くて簡単な5速の代わり」と勧める声の一方で、「丘で 3→4 の谷がひどくきつい」（499cc＋126 箱・英国フォーラム談）。',
      care: '650cc 化とセットで語られる定番。499cc の車体だけに履かせると谷を感じやすい。',
    },
    src: 'ref/drive_final_tire_research.md §1-3・§2',
  },
  {
    id: 'dp_fifth_long', name: '5速化（ロング 0.743）', sub: '1〜4速はそのまま・5速だけ足す',
    cases: { A: 2 },
    choices: { fifth: 'g5_stradale' },
    tags: ['要加工', '故障報告あり'],
    back: {
      change: '1〜4速は純正のまま、5速 0.743 を追加。80km/h の回転が 15% ほど下がる。登りでは5速は使わない。',
      feel: '「純正 650＋126 箱＋Nanni 5速で 110km/h を一日中巡航・130km/h 超」（英・650cc・126 箱）。',
      care: '5速の軸は片持ちで負荷が集中（独の談では寿命の目安 5万km）。2速フォーク干渉・当たり外れの報告も。プロが組んで定期点検すれば長く走るが、€1,000 未満のボルトオンは無い。',
    },
    src: 'ref/drive_5speed_research.md §3・§5',
  },
  {
    id: 'dp_f939', name: 'ファイナル 9/39', sub: '126 BIS 純正・巡航向けのロングファイナル',
    cases: { A: 3, D: 2 },
    choices: { final: 'f939' },
    tags: ['500D 不可'],
    back: {
      change: '最終減速比が 5.125→4.333 に。80km/h の回転が 15.5% ほど下がる「貧者の5速」。',
      feel: '「60mph（約 97km/h）を 4000rpm で安定して巡航」（英・650cc チューン・126 箱＋9/39）。',
      care: '店は 23PS 以上向けと線を引く。1速がうるさい・20% 坂はシフトダウン・低回転で冷却が落ちるという実装者談。',
    },
    src: 'ref/drive_final_tire_research.md §2-2・§5',
  },
  {
    id: 'dp_t135', name: 'タイヤ 135/80R12', sub: '126 純正サイズ・回転 3% ほど低い',
    cases: { A: 4, F: 1 },
    choices: { tire: 't135' },
    tags: [],
    back: {
      change: '外径が 125R12 より 3.2% 大きく、同じ速度で回転が 3% ほど低い。車高 +8mm。',
      feel: '回転が少し下がる程度で、街乗りの印象はほぼ変わらない（実測談は乏しい）。',
      care: '3.5J ホイールに入る明言はなく、フルロックで擦るという談あり。',
    },
    src: 'ref/drive_final_tire_research.md §3-1・§7-2',
  },
  {
    id: 'dp_nanni34', name: '3/4 ショート（NANNI）', sub: '3・4速だけ短くして谷を詰める',
    cases: { B: 1 },
    choices: { gearset: 'nanni_34' },
    tags: [],
    back: {
      change: '3速 1.300→1.368・4速 0.875→0.955（シンクロ箱は 0.944）。段間の谷が縮む代わりに最高速は落ちる。',
      feel: '「回転落ちが均等・常にパワーバンド」（3/4 ショート＋5速ロング構成の談）。',
      care: '単体で成立するキット。プライマリ軸ごと交換＝ミッションを降ろす作業になる。',
    },
    src: 'ref/drive_gearsets_research.md §1-A・§2',
  },
  {
    id: 'dp_bacci34', name: '3/4 ショート＋5速 0.88（Bacci 系）', sub: 'Bacci 系 3/4 ショート・5速前提',
    cases: { B: 2 },
    choices: { gearset: 'bacci_34', fifth: 'g5_2522' },
    tags: ['要加工'],
    back: {
      change: '4速が 0.875→1.091 と純正より 25% 短くなる。5速 0.880 を足して初めて純正4速相当のトップになる。',
      feel: 'FD・D\'Angelo・500automotor・Monteferri が同歯数で採用する組合せ。',
      care: '5速無しでは常用に向かない。ノンシンクロ箱に入るかは裏が取れず、シンクロ（S）箱のみに出す。',
    },
    src: 'ref/drive_gearsets_research.md §1-B・§6',
  },
  {
    id: 'dp_box841', name: '126 ミッション＋8/41 ピニオン', sub: '126 箱に載せ替えつつ純正の最終減速を残す',
    cases: { B: 3 },
    choices: { gearbox: 'sync', final: 'f841' },
    only: ['n_early', 'dfl'],
    tags: ['要加工'],
    back: {
      change: 'シンクロ化しつつファイナルは 8/41 のまま＝126 箱換装で広がる 3→4 の谷を抑える対策。',
      feel: '「丘で 3→4 の谷がひどくきつい」（499cc＋126 箱・英国フォーラム談）への対策として挙がる組合せ。',
      care: 'デフごと載せ替えるだけではファイナルが 8/39 に変わる＝ピニオン単体の入替えに箱を開ける作業が要る。',
    },
    src: 'ref/drive_gearsets_research.md §3',
  },
  {
    id: 'dp_first_long', name: '1速ロング 12/39', sub: '126 と同じ1速で発進の谷を縮める',
    cases: { C: 1 },
    choices: { gearset: 'first_long' },
    tags: [],
    back: {
      change: '1速が 3.700→3.250 に。1→2速の谷が縮む代わりに発進は重くなる。2〜4速は変わらない。',
      feel: '体感談が少ない＝A・B・D の候補より確度は低い。',
      care: 'Bacci RCE02／FD VB1119 の「close ratio 1速」は 126 純正と同じ歯数。',
    },
    src: 'ref/drive_gearsets_research.md §1-B・§1-C',
  },
  {
    id: 'dp_box', name: '126 ミッションに換装（シンクロ化）', sub: '126 箱をそのまま載せてシンクロ化',
    cases: { E: 1, D: 1 },
    choices: { gearbox: 'sync', final: 'f839' },
    only: ['n_early', 'dfl'],
    tags: ['要加工'],
    back: {
      change: 'ファイナルも 8/39 になり全段が長くなる＝各ギアで 4〜10km/h ほど伸びる（約6%）。',
      feel: '499cc 純正のままだと 3→4 の谷を強く感じるという談あり。',
      care: 'ドライブシャフト・ベルハウジング等の交換が要る（変換キットは存在しない）。ミッションオイルは 500 が W90 EP・126 は ZC90 非EP 指定。',
    },
    src: 'ref/drive_gearsets_research.md §3',
  },
  {
    id: 'dp_t10', name: '10インチ 145/80R10', sub: '外径が小さくなり回転が上がる・車高も下がる',
    cases: { F: 2 },
    choices: { tire: 't145_80_10' },
    tags: [],
    back: {
      change: '外径が 125R12 より 3.8% 小さく、同じ速度で回転が 4% ほど高い。車高 −10mm・メーターが高く読む。',
      feel: '見た目の印象が大きく変わる改造として語られる（回転面の体感談は乏しい）。',
      care: '4×190 のまま履ける新品は D\'Angelo 10×5J のみ。ドラムなら干渉なし。',
    },
    src: 'ref/drive_10inch_research.md §1-2・§4-1',
  },
  {
    id: 'dp_t155_65_13', name: '13インチ 155/65R13', sub: '13インチへの入口・BIS 界隈の定番',
    cases: { F: 3 },
    choices: { tire: 't155_65_13' },
    tags: [],
    back: {
      change: '外径が 125R12 より 5.3% 大きく、同じ速度で回転が 5% ほど低い。',
      feel: 'BIS 界隈の定番サイズとして語られる（652cc の実例1件）。',
      care: '5J ホイールへの換装が前提。干渉の報告はなし。',
    },
    src: 'ref/drive_final_tire_research.md §3-2・§7-2',
  },
  {
    id: 'dp_t145', name: '幅広 145/70R12（回転は変わらず）', sub: '外径はほぼ同じ・幅だけ広がる',
    cases: { F: 4 },
    choices: { tire: 't145' },
    tags: [],
    back: {
      change: '外径が 125R12 とほぼ同じ（+0.6%）＝回転数はほとんど変わらず、幅だけ広くなる。',
      feel: '見た目の存在感を出したい人向け（回転の体感には出ない）。',
      care: '外径が純正相当なのでメーター・スピード計算への影響はほぼ無い。',
    },
    src: 'ref/drive_final_tire_research.md §3-1・§7-2',
  },
];

// 型式 id → その型式の純正駆動系（VEHICLES のエントリ）。無ければ 500F を既定にする（presets_vehicle.js と同じ既定）。
const baseOf = (modelId) => VEHICLES[modelId] || VEHICLES['500F'];

// 'stock'／'none' を実体の id へ解決する（比較のため）。gearbox・final・tire は型式の純正値、gearset・fifth・load はそのまま
// （'stock'・'none' 自体が GEARSETS／FIFTHS の有効な id なので、これ以上の解決は不要）。
function resolveField(modelId, key, value) {
  const base = baseOf(modelId);
  if (key === 'gearbox') return value === 'stock' ? base.gearbox : value;
  if (key === 'final') return value === 'stock' ? base.final : value;
  if (key === 'tire') return value === 'stock' ? base.tire : value;
  return value;
}
function currentValue(modelId, da, key) {
  const merged = { ...DEFAULT_DRIVE_CHOICES, ...(da || {}) };
  return resolveField(modelId, key, merged[key]);
}
// 札の choices が「いま(da)と全部同じ」なら、その札は何も変えない＝出さない。
function isNoOp(modelId, da, pack) {
  return Object.keys(pack.choices).every(
    (k) => resolveField(modelId, k, pack.choices[k]) === currentValue(modelId, da, k),
  );
}

// 適合判定＝この型式・この「いま」（da）で、この札を出してよいか。
// ①いまと全部同じなら出さない ②pack.only（series '500'/'126' か、いまの箱 id）があれば一致が要る
// ③選択肢そのものが driveOptionsFor の適合済み一覧に含まれるか（final の 500D 除外・gearset の箱の適合はここで効く）。
export function packFits(modelId, da, pack) {
  if (isNoOp(modelId, da, pack)) return false;
  if (pack.only) {
    const model = modelById(modelId);
    const boxId = currentValue(modelId, da, 'gearbox');
    if (!pack.only.includes(model.series) && !pack.only.includes(boxId)) return false;
  }
  const merged = { ...DEFAULT_DRIVE_CHOICES, ...(da || {}), ...pack.choices };
  const opts = driveOptionsFor(modelId, merged);
  if (pack.choices.gearbox && !GEARBOXES.some((g) => g.id === merged.gearbox)) return false;
  if (pack.choices.gearset && !opts.gearsets.some((g) => g.id === merged.gearset)) return false;
  if (pack.choices.final && !opts.finals.some((f) => f.id === merged.final)) return false;
  if (pack.choices.fifth && !opts.fifths.some((f) => f.id === merged.fifth)) return false;
  if (pack.choices.tire && !opts.tires.some((t) => t.id === merged.tire)) return false;
  return true;
}

// 「いま」（da）にこの札の差分を重ねた駆動系選択を返す（db に丸ごと差し替える）。
export function packChoices(da, pack) {
  return { ...DEFAULT_DRIVE_CHOICES, ...(da || {}), ...pack.choices };
}
