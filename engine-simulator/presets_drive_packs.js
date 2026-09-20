// 駆動系の札（プリセット）＝駆動系のどこをどう変えるかの組合せ。計算核・presets_vehicle.js は無変更＝ここは表示用の層だけ。
// 出典＝ref/drive_5speed_research.md・ref/drive_gearsets_research.md・ref/drive_final_tire_research.md・ref/drive_10inch_research.md
// ⛔推奨の体裁は取らない＝順位・通称・価格・やり方の助言・店名は書かない。故障の型は構造の帰結として書く。
// back の3段は各150字以内・feel は体感の描写だけ（誰が・どの構成での話かを添える／勧める・勧めないの声は引用しない）。
// 故障率・冷却・騒音・燃費は数値化しない。cases は場面（cruise/hill/launch/bigger/sync/look）の集合＝順位なし。

import { modelById } from './presets.js';
import { GEARBOXES, VEHICLES, DEFAULT_DRIVE_CHOICES, driveOptionsFor } from './presets_vehicle.js';

export const DRIVE_PACKS = [
  {
    id: 'dp_f839', name: 'ファイナル 8/39', sub: '126純正と同じ比（8/39＝4.875）に変える＝500純正は8/41＝5.125',
    cases: ['cruise', 'sync'],
    choices: { final: 'f839' },
    tags: [],
    back: {
      change: '最終減速比が500純正8/41＝5.125から、126純正と同じ8/39＝4.875に変わる。ファイナルだけの交換で1〜5速の比自体は変えず、全段が一律に長くなる＝80km/hの回転は約5%下がる。500F以降のケースに無加工で載る。',
      feel: '499cc純正のままだと3→4の谷を感じやすいという談（499cc＋126箱の構成）。',
      care: '全段が一律に伸びる構造＝発進や登坂で伝わる力も一律に細くなる。500F以降のケース形状が前提。',
    },
    src: 'ref/drive_final_tire_research.md §1-3・§2',
  },
  {
    id: 'dp_fifth_long', name: '5速化（ロング 0.743）', sub: '1〜4速はそのまま・5速だけを追加する',
    cases: ['cruise'],
    choices: { fifth: 'g5_stradale' },
    tags: ['要加工', '故障報告あり'],
    back: {
      change: '1〜4速の比は変えず、5速0.743を追加する。80km/hの回転は約15%下がる。4速の後ろに片持ちで5速を足す構造＝5速下の軸受に荷重が集中する。',
      feel: '純正650＋126箱＋5速で110km/hを長時間巡航・130km/h超まで伸びたという談（650cc・126箱の構成）。',
      care: '片持ち構造のため5速下の軸受が消耗しやすい（独の談では目安5万km）。2速フォークと干渉するため面取りが要る＝ボルトオンではない。組付け精度による個体差の報告もある。',
    },
    src: 'ref/drive_5speed_research.md §3・§5',
  },
  {
    id: 'dp_f939', name: 'ファイナル 9/39', sub: '8/39よりさらに長い比（4.333）・500Dのケースには入らない',
    cases: ['cruise', 'bigger'],
    choices: { final: 'f939' },
    tags: ['500D 不可'],
    back: {
      change: '最終減速比が5.125→4.333に変わる。全段が一律に長くなる構造は8/39と同じで変化量が大きい＝80km/hの回転は約15.5%下がる。リング外径が500Dのケースと合わない。',
      feel: '60mph（約97km/h）を4000rpmで安定して巡航できたという談（650ccチューン＋126箱＋9/39の構成）。',
      care: '一律に長くなる分、同じ速度でも回転が下がる＝低回転側の余力は細くなる構造。20%勾配でのシフトダウンや、低回転運用時の冷却低下を指摘する談もある（650cc構成）。',
    },
    src: 'ref/drive_final_tire_research.md §2-2・§5',
  },
  {
    id: 'dp_t135', name: 'タイヤ 135/80R12', sub: '外径が125R12より3.2%大きい・126純正サイズ',
    cases: ['cruise', 'look'],
    choices: { tire: 't135' },
    tags: [],
    back: {
      change: '外径が125R12より3.2%大きくなる＝同じ速度でも回転は約3%低くなる。車高は+8mm。',
      feel: '外径差が小さく、回転の変化ほどには走行印象は変わらないという談。',
      care: '3.5Jホイールに収まるという明言はなく、フルロックで干渉するという談がある。',
    },
    src: 'ref/drive_final_tire_research.md §3-1・§7-2',
  },
  {
    id: 'dp_nanni34', name: '3/4 ショート（NANNI）', sub: '3・4速だけを短くし、段間の谷を詰める',
    cases: ['hill'],
    choices: { gearset: 'nanni_34' },
    tags: [],
    back: {
      change: '3速が1.300→1.368、4速が0.875→0.955（シンクロ箱は0.944）に変わる。3・4速だけを別歯数に置き換える構造で1・2速とファイナルはそのまま。段間の落差が縮む一方、最高速は下がる。',
      feel: '回転の落ち込みが均等になり、常にパワーバンド内に留まるという談（3/4ショート＋5速ロング構成）。',
      care: 'プライマリ軸ごと入れ替える構造＝ミッションを降ろす作業になる。',
    },
    src: 'ref/drive_gearsets_research.md §1-A・§2',
  },
  {
    id: 'dp_bacci34', name: '3/4 ショート＋5速 0.88（Bacci 系）', sub: '4速を大きく短縮し、5速を足して初めてトップ相当になる',
    cases: ['hill'],
    choices: { gearset: 'bacci_34', fifth: 'g5_2522' },
    tags: ['要加工'],
    back: {
      change: '4速が0.875→1.091に変わり、純正4速より25%短くなる。5速0.880を足すことで初めて純正4速相当のトップギアになる構造。',
      feel: '同じ歯数の組合せが複数の完成品として供給されている。',
      care: '5速なしでは4速が短すぎ常用に向かない構造。ノンシンクロ箱への適合は裏付けが取れておらず、シンクロ箱のみに限る。',
    },
    src: 'ref/drive_gearsets_research.md §1-B・§6',
  },
  {
    id: 'dp_box841', name: '126 ミッション＋8/41 ピニオン', sub: 'シンクロ化しつつ最終減速比だけ純正に残す',
    cases: ['hill'],
    choices: { gearbox: 'sync', final: 'f841' },
    only: ['n_early', 'dfl'],
    tags: ['要加工'],
    back: {
      change: '箱を126ミッションに載せ替えつつ、ピニオンだけ8/41に入れ替えて最終減速比を純正のまま残す構造。デフごとの載せ替えだと8/39に変わるため、ピニオン単体の入替えに箱を開ける追加作業が要る。',
      feel: '499cc純正のまま126箱に換えると3→4の谷を強く感じるという談への対応として挙がる組合せ。',
      care: '箱を開けてピニオンだけ入れ替える構造＝単純な載せ替えでは実現しない。',
    },
    src: 'ref/drive_gearsets_research.md §3',
  },
  {
    id: 'dp_first_long', name: '1速ロング 12/39', sub: '126と同じ歯数の1速に置き換える',
    cases: ['launch'],
    choices: { gearset: 'first_long' },
    tags: [],
    back: {
      change: '1速が3.700→3.250に変わる。1速だけを126純正と同じ歯数に置き換える構造で、2〜4速は変わらない。1→2速の落差が縮む一方、発進は重くなる。',
      feel: '体感を語る談が少なく、他の変更と比べて確度は低い。',
      care: '126純正と同じ歯数の部品を流用する構造。',
    },
    src: 'ref/drive_gearsets_research.md §1-B・§1-C',
  },
  {
    id: 'dp_box', name: '126 ミッションに換装（シンクロ化）', sub: '126箱をそのまま載せ、全段がシンクロになる',
    cases: ['sync', 'bigger'],
    choices: { gearbox: 'sync', final: 'f839' },
    only: ['n_early', 'dfl'],
    tags: ['要加工'],
    back: {
      change: '箱を126のシンクロ式に丸ごと載せ替える構造。副作用として最終減速比も8/39に変わり、全段が一律に長くなる（各ギアで4〜10km/hほど）。',
      feel: '499cc純正のままだと3→4の谷を強く感じるという談がある。',
      care: 'ドライブシャフト・ベルハウジング等の交換が要る構造＝変換専用キットは存在しない。ミッションオイルは500がW90 EP、126はZC90非EP（真鍮シンクロ）指定。',
    },
    src: 'ref/drive_gearsets_research.md §3',
  },
  {
    id: 'dp_t10', name: '10インチ 145/80R10', sub: '外径が小さくなり回転が上がる・車高も下がる',
    cases: ['look'],
    choices: { tire: 't145_80_10' },
    tags: [],
    back: {
      change: '外径が125R12より3.8%小さくなる＝同じ速度でも回転は約4%高くなる。車高は−10mm、メーターは実速より高く表示する構造。',
      feel: '見た目の印象が大きく変わる改造として語られる（回転面の体感談は乏しい）。',
      care: '4×190のまま履ける新品サイズは限られる。ドラム車では干渉しない。',
    },
    src: 'ref/drive_10inch_research.md §1-2・§4-1',
  },
  {
    id: 'dp_t155_65_13', name: '13インチ 155/65R13', sub: '外径が5.3%大きい・5Jホイールが前提',
    cases: ['look'],
    choices: { tire: 't155_65_13' },
    tags: [],
    back: {
      change: '外径が125R12より5.3%大きくなる＝同じ速度でも回転は約5%低くなる。',
      feel: '652cc構成での使用例がある。',
      care: '5Jホイールへの換装が前提の構造。干渉の報告はない。',
    },
    src: 'ref/drive_final_tire_research.md §3-2・§7-2',
  },
  {
    id: 'dp_t145', name: '幅広 145/70R12（回転は変わらず）', sub: '外径はほぼ純正と同じ・幅だけ広がる',
    cases: ['look'],
    choices: { tire: 't145' },
    tags: [],
    back: {
      change: '外径が125R12とほぼ同じ（+0.6%）＝回転数はほとんど変わらず、幅だけ広くなる構造。',
      feel: '見た目の存在感が変わる（回転の体感には出ない）。',
      care: '外径が純正相当のため、メーター表示やスピード計算への影響はほぼない。',
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
