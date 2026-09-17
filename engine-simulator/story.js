// 差分の物語・ボトルネックの名指し・副作用の注意（段2・2026-09-17）
// 純粋関数。simulate() の結果2本（いま／変えた後）と buildSpec() の戻り値から文章を組み立てる。
// しきい値は diag_presets.js のレンジから決めた（HANDOFF §6 に表）。⭐数字は「差」と「目安」として書き、絶対値の断定はしない。

const at = (res, rpm) => res.find(r => r.rpm === rpm) || res[0];
const avg = (res, lo, hi, key) => { const xs = res.filter(r => r.rpm >= lo && r.rpm <= hi).map(r => r[key]); return xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1); };
const pct = (b, a) => (a > 0 ? 100 * (b / a - 1) : 0);
const peak = (res, key) => res.reduce((m, r) => r[key] > m[key] ? r : m, res[0]);
const sign = (x, d = 0) => (x > 0 ? '+' : '') + x.toFixed(d);

export function summarizeRes(res) {
  const pP = peak(res, 'powerCv'), pT = peak(res, 'torque');
  return {
    peakCv: pP.powerCv, peakCvRpm: pP.rpm, peakNm: pT.torque, peakNmRpm: pT.rpm,
    town: avg(res, 1500, 3000, 'torque'), high: avg(res, 4500, 5500, 'powerCv'),
    nm2500: at(res, 2500).torque, back2000: at(res, 2000).backflowIn, back1500: at(res, 1500).backflowIn,
  };
}

// 高回転側で何が先に詰まっているか（変えた後のピーク出力回転で見る）
export function findBottleneck(res, built) {
  const s = summarizeRes(res);
  const p = at(res, s.peakCvRpm);
  const dv = p.dpVenturi_kPa, dl = p.dpValve_kPa;
  const carbName = built.picks.carb.label.replace(/（.*$/, '');
  const out = { main: '', more: [] };
  const dominant = (x, y) => x >= 9 && x >= 1.25 * y;
  if (dominant(dv, dl)) {
    out.main = `いちばん先に詰まっているのはキャブ（${carbName}）。ベンチュリの手前で吸気が絞られていて、カムやヘッドを足しても上は伸びにくい。`;
  } else if (dominant(dl, dv)) {
    out.main = `いちばん先に詰まっているのはバルブとポート（吸気弁 ${built.spec.valves.dIn}mm）。キャブには余裕があるので、ヘッド側を触らないと上は伸びない。`;
  } else if (dv >= 9 && dl >= 9) {
    out.main = 'キャブとバルブが同じくらいに効いている。どちらか一方だけ変えても伸びは小さく、両方を一緒に見直すと効き始める。';
  } else {
    out.main = '吸気に目立った絞りは無い。ここから先は排気量そのもの、あるいは回転の上限（スプリング・クランク）が壁になる。';
  }
  if (p.pExh_bar >= 1.12) out.more.push('排気の背圧も高め＝マフラーを変えると同じ仕様のまま少し伸びる。');
  if (s.back2000 >= 0.20) out.more.push(`低速側ではカムが大きすぎて、吸った混合気を 2000rpm で ${Math.round(100 * s.back2000)}% 吹き返している。街乗りの粘りが無いのはこれが原因。`);
  else if (s.back2000 >= 0.14) out.more.push('低速側でカムのオーバーラップによる吹き返しが出始めている（純正の2倍ほど）。');
  return { ...out, dpVenturi: dv, dpValve: dl, pExh: p.pExh_bar, ve: p.ve };
}

// いま（A）と変えた後（B）の差分の物語
export function tellStory(resA, resB, builtA, builtB) {
  const A = summarizeRes(resA), B = summarizeRes(resB);
  const sa = builtA.spec, sb = builtB.spec;
  const zones = [];

  // 街乗り（1500〜3000 の平均トルク）
  {
    const d = pct(B.town, A.town);
    let t;
    if (d >= 25) t = '街なかで踏んだ瞬間の押し出しがまるで別物になる。2速で坂を登れる場面が増える。';
    else if (d >= 8) t = '発進や坂道で粘りが増え、シフトダウンの回数が減る。';
    else if (d > -5) t = '街乗りの感触はほとんど変わらない。';
    else if (d > -15) t = '低速の粘りが少し減る。坂でギアを1段落とす場面が増える。';
    else t = '低速がはっきり痩せる。発進で気を使い、街なかでは回して乗ることになる。';
    zones.push({ id: 'town', title: '街乗り（1500〜3000rpm）', delta: d, text: t, value: `${A.town.toFixed(1)} → ${B.town.toFixed(1)} Nm（${sign(d)}%）` });
  }
  // 回したとき（4500〜5500 の平均出力）
  {
    const d = pct(B.high, A.high);
    const shift = B.peakCvRpm - A.peakCvRpm;
    let t;
    if (d >= 40) t = '回したときは別のエンジン。上まで回す楽しみが生まれる代わりに、回す前提の乗り方になる。';
    else if (d >= 15) t = '高回転の伸びがはっきり増える。追い越しや合流で余裕が出る。';
    else if (d >= 5) t = '上の伸びが少し良くなる。数字より「回りたがる」感触の変化として出る。';
    else if (d > -5) t = '回したときの力はほぼ変わらない。';
    else t = '回しても以前ほど出ない。どこかで絞られている（下の「足を引っ張っている所」を見る）。';
    if (shift >= 1000) t += ` ピークが ${shift} rpm 上に移り、力の山が高回転側へ寄る。`;
    else if (shift <= -500) t += ' ピークが下に移り、回さなくても力が出る性格になる。';
    zones.push({ id: 'high', title: '回したとき（4500〜5500rpm）', delta: d, text: t, value: `${A.high.toFixed(1)} → ${B.high.toFixed(1)} CV（${sign(d)}%）` });
  }
  // アイドル・始動性（オーバーラップ・吹き返し・圧縮比・排気量）
  {
    const dOv = sb.cam.ivo + sb.cam.evc - (sa.cam.ivo + sa.cam.evc);
    const parts = [];
    if (dOv >= 50) parts.push('オーバーラップが大きく、アイドルはかなり荒れる。暖まるまで機嫌が悪く、アイドル回転を上げて逃げることになる');
    else if (dOv >= 25) parts.push('アイドルが少し揺れる。純正の回転数では止まりやすいので、やや高めに取る');
    else if (dOv <= -25) parts.push('オーバーラップが減り、アイドルは落ち着く');
    if (sb.engine.cr >= 9.5) parts.push('圧縮比が高く、セルが重くなりハイオク前提。夏の再始動でぐずることがある');
    else if (sb.engine.cr >= 9.0 && sa.engine.cr < 9.0) parts.push('圧縮が上がるぶんセルの負担が増える。燃料はハイオクにしておきたい');
    if (builtB.cc >= builtA.cc * 1.2) parts.push('排気量が増えたぶん、セルモーターとバッテリーの仕事も増える（冬の朝に差が出る）');
    if (B.back1500 >= 0.25 && A.back1500 < 0.15) parts.push('極低速の吹き返しが多く、チョークを引いた直後の安定が悪い');
    const t = parts.length ? parts.join('。') + '。' : 'アイドルと始動性はほぼ変わらない。';
    zones.push({ id: 'idle', title: 'アイドル・始動性', delta: null, text: t, value: `オーバーラップ ${sa.cam.ivo + sa.cam.evc}° → ${sb.cam.ivo + sb.cam.evc}°／圧縮比 ${sa.engine.cr} → ${sb.engine.cr}` });
  }
  // ピークの一行
  const head = {
    cv: `${A.peakCv.toFixed(1)} → ${B.peakCv.toFixed(1)} CV（${sign(pct(B.peakCv, A.peakCv))}%）`,
    nm: `${A.peakNm.toFixed(1)} → ${B.peakNm.toFixed(1)} Nm（${sign(pct(B.peakNm, A.peakNm))}%）`,
    cvRpm: `${A.peakCvRpm} → ${B.peakCvRpm} rpm`, nmRpm: `${A.peakNmRpm} → ${B.peakNmRpm} rpm`,
  };
  return { A, B, zones, head };
}

// 副作用・組合せの注意（計算しない事柄は閾値で警告する＝HANDOFF §2）
export function warnings(built, res) {
  const s = built.spec, w = [];
  const cc = built.cc;
  if (built.blockMismatch) w.push({ level: 'warn', text: `${built.picks.disp.label} は店の適合表記では ${built.picks.disp.blocks.join('／')} ブロック用。${built.model.block} ブロックに入れるには専用品かブロック加工が要る。` });
  if (s.valves.dIn + s.valves.dEx >= s.engine.bore - 2) w.push({ level: 'stop', text: `吸気弁 ${s.valves.dIn}＋排気弁 ${s.valves.dEx}mm はボア ${s.engine.bore}mm に収まらない。このヘッドは排気量を上げてから。` });
  else if (s.valves.dIn + s.valves.dEx >= s.engine.bore - 6) w.push({ level: 'warn', text: 'バルブがボアの縁に近く、シュラウド（壁に遮られる）で計算ほど流れない可能性がある。' });
  if (s.engine.cr >= 10) w.push({ level: 'stop', text: `圧縮比 ${s.engine.cr} はノッキング領域。ハイオク＋点火時期の遅角＋プラグ熱価の変更が前提。空冷ではヘッド温度の管理も要る。` });
  else if (s.engine.cr >= 9) w.push({ level: 'warn', text: `圧縮比 ${s.engine.cr} はハイオク前提。点火時期を純正のままにしない。` });
  if (s.cam.liftIn >= 11) w.push({ level: 'warn', text: `バルブリフト ${s.cam.liftIn}mm（純正 8.4〜9.2）。純正スプリングでは追従できない回転が早く来る＝スプリングとリテーナーを一緒に。` });
  if (s.cam.ivo + s.cam.evc >= 80 && s.cam.liftIn >= 10.5) w.push({ level: 'warn', text: 'オーバーラップとリフトが大きく、ピストンとバルブの干渉を粘土で確認しないと組めない。' });
  if (s.engine.bore >= 79.5) w.push({ level: 'warn', text: `ボア ${s.engine.bore}mm はシリンダー壁が薄く、熱に余裕が無い。オイルクーラーと油温計は前提。` });
  const pk = res.reduce((m, r) => r.powerCv > m.powerCv ? r : m, res[0]);
  if (pk.rpm >= 6000) w.push({ level: 'warn', text: `ピークが ${pk.rpm}rpm。純正クランクとコンロッドで常用する回転ではない＝バランス取りと強化ボルトを。` });
  if (built.picks.carb.id.startsWith('dcoe') || built.picks.carb.id === 'dell32x2') w.push({ level: 'info', text: 'このキャブはマニホールドとエアクリーナーが別に要る。純正のヒーターホース取り回しと干渉する。' });
  if (built.picks.cam.id !== 'stock' && built.picks.exh.id === 'stock') w.push({ level: 'info', text: 'スポーツカムに純正マフラーの組合せは、段1の計算で「カムだけでは損」と出た組合せ。' });
  if (built.picks.carb.id !== 'stock' && built.picks.carb.venturi >= 25 && cc < 600) w.push({ level: 'info', text: `${cc.toFixed(0)}cc に対してキャブが大きい。低速でベンチュリの流速が落ち、混合気が粗くなる（計算にも入っている）。` });
  if (built.assumed.length) w.push({ level: 'info', text: '※印の値は店に記載が無く、同系の品から借りた仮の値。' });
  return w;
}

// 画面に出す「この道具の限界」（HANDOFF §5 の限界①〜⑦を読者向けに）
export const LIMITS = [
  '純正4機種の再現は ±5%。スポーツカム側（Abarth 3機種）はファン込みで −1〜−12%、ファン無しで +16〜−1%＝公表値はその間。改造の効き目は実車の公表差より控えめに出る。',
  '吸気管の共鳴は入っていない（慣性だけ）。長いランナーやファンネルで出る「共鳴の山」は再現できない。',
  '排気は背圧と慣性だけ。抜けの良いマフラーの「音」と「脈動の同調」は入っていない。',
  'ノッキング、バルブスプリングの追従限界、ピストンとバルブの干渉は計算しない。閾値を超えたら注意文で知らせるだけ。',
  'キャブは「ベンチュリ径×係数」だけ。ジェットの合否・セッティングの良し悪しは見ない。',
  'カムのカタログ角は店ごとに測り方が違う。同じ「40/80」でも測定クリアランスで作用角が 20° 以上変わる＝店の基準が書いてない品は仮の基準で計算している。',
  '500系と126系の吸排気系の差（ポート径・マフラー径）は資料に数値が無く、共通の係数で扱っている。',
];
