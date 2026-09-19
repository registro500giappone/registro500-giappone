// 段2の検品：全プリセットが計算を通ること＋物語・判定が段1の結論と矛盾しないこと。node test_presets.js
import { simulate } from './sim.js';
import { MODELS, SLOTS, START_EXAMPLES, PACKAGES, buildSpec, modelById, packagesFor, packageChoices, packageMatches } from './presets.js';
import { tellStory, findBottleneck, warnings, summarizeRes } from './story.js';
const RPM = [1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500];
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗ ' + msg); } };
const finite = (res) => res.every(r => Number.isFinite(r.torque) && Number.isFinite(r.powerCv) && r.powerCv >= 0);

// 1. 型式ごとに、各欄の全選択肢を単独で当てて全部が有限値を返す
let n = 0;
for (const m of MODELS) {
  for (const [slot, list] of Object.entries(SLOTS)) {
    for (const o of list) {
      const b = buildSpec(m.id, { [slot]: o.id, ...(slot === 'disp' && o.crHint ? {} : {}) });
      const res = simulate(b.spec, RPM); n++;
      ok(finite(res), `${m.id} ${slot}=${o.id} が非数を返した`);
      ok(b.assumed.every(s => typeof s === 'string'), `${m.id} ${slot}=${o.id} assumed の型`);
    }
  }
}
console.log(`1. 単独選択 ${n} 通り：${fails ? '失敗あり' : 'すべて有限値'}`);

// 2. 純正のままの型式は engines_stock.js と同じ結果（プリセット化で値を壊していない）
{
  const { engines } = await import('./engines_stock.js');
  const pairs = [['500F', '500F 純正 (18CV/4600, 3.1kgm)'], ['500R', '500R 純正 (18CV/4600, 3.7kgm)'], ['126A1', '126 652 純正 (24CV/4500, 4.2kgm)'], ['126A', '126 594 純正 (23CV/4800, 4.0kgm)']];
  for (const [id, name] of pairs) {
    const a = summarizeRes(simulate(buildSpec(id, {}).spec, RPM)), b = summarizeRes(simulate(engines[name], RPM));
    ok(Math.abs(a.peakCv - b.peakCv) < 1e-9 && Math.abs(a.peakNm - b.peakNm) < 1e-9, `${id} の純正がテスト諸元と一致しない（${a.peakCv.toFixed(2)} vs ${b.peakCv.toFixed(2)}）`);
  }
  console.log('2. 純正4機の一致：' + (fails ? '要確認' : 'OK'));
}

// 3. 段1で確定した方向が物語でも出る
{
  const f = (ch) => { const b = buildSpec('500F', ch); return { b, r: simulate(b.spec, RPM) }; };
  const base = f({});
  const cam = f({ cam: 'c3575' });
  const st1 = tellStory(base.r, cam.r, base.b, cam.b);
  ok(st1.zones.find(z => z.id === 'town').delta < -10, 'カム単独で街乗りが痩せる、が出ない');
  ok(findBottleneck(cam.r, cam.b).more.some(t => t.includes('吹き返')), 'カム単独で吹き返しの指摘が出ない');
  const big = f({ disp: 'b77', cr: 'cr75' });
  const st2 = tellStory(base.r, big.r, base.b, big.b);
  ok(st2.zones.find(z => z.id === 'town').delta > 25, '650cc 化で街乗りトルクが大きく増える、が出ない');
  const head = f({ head: 'h3933' });
  ok(findBottleneck(head.r, head.b).main.includes('キャブ'), '大バルブだけ入れたらキャブが先に詰まる、が出ない');
  ok(warnings(head.b, head.r).some(w => w.level === 'stop'), '39/33 は 67.4 ボアに収まらない、の警告が出ない');
  const carb = f({ carb: 'dcoe45' });
  ok(findBottleneck(carb.r, carb.b).main.includes('バルブ'), '大キャブだけ入れたらバルブが先に詰まる、が出ない');
  const hi = f({ disp: 'b85', cr: 'cr100' });
  ok(warnings(hi.b, hi.r).some(w => w.text.includes('ノッキング')), '圧縮比 10 のノッキング警告が出ない');
  console.log('3. 方向の検品：' + (fails ? '要確認' : 'OK'));
}

// 4. 出発点の例が全部 buildSpec を通る
for (const ex of START_EXAMPLES) for (const m of MODELS) { if (ex.families && !ex.families.includes(m.series)) continue; ok(finite(simulate(buildSpec(m.id, ex.choices).spec, RPM)), `出発点の例 ${ex.id} × ${m.id}`); }
console.log('4. 出発点の例：' + (fails ? '要確認' : 'OK'));

// 5. 王道パッケージ：車種ごとの出し分け・エンジン換装（eng）・自動換装・型式単位の除外を検品（2026-09-19 §7-17）
{
  // 選択肢 id が実在し、その車種の全型式で有限値を返す（choices.eng も modelById が解決できること）
  for (const pk of PACKAGES) {
    for (const [slot, id] of Object.entries(pk.choices)) {
      if (slot === 'eng') { ok(MODELS.some(m => m.id === id), `パッケージ ${pk.id} の eng=${id} が MODELS に無い`); continue; }
      ok(SLOTS[slot] && SLOTS[slot].some(o => o.id === id), `パッケージ ${pk.id} の ${slot}=${id} が選択肢に無い`);
    }
  }
  for (const m of MODELS) {
    const pks = packagesFor(m);
    ok(pks.length > 0, `${m.id}（series ${m.series}）に札が1枚も出ない`);
    for (const pk of pks) ok(finite(simulate(buildSpec(m.id, packageChoices(pk, m)).spec, RPM)), `パッケージ ${pk.id} × ${m.id}`);
  }
  console.log('5a. 車種ごとの札×全型式：' + (fails ? '要確認' : 'OK'));
}
{
  // 500R は series '500' 側で「650 にボアアップ」を持つ（旧 family '126' の歪みが直っていること）
  const r500 = modelById('500R');
  ok(packagesFor(r500).some(pk => pk.id === 'p650'), '500R が 500 側で p650 を持たない');

  // eng:'126A1' で本物の換装＝エンジンの土台がまるごと 126 後期に変わる
  const swapped = buildSpec('500F', { eng: '126A1' });
  ok(swapped.model.id === '126A1', 'eng:126A1 で built.model が 126A1 にならない');
  ok(swapped.picks.cam.id === 'stock' && swapped.spec.cam.ivo === 26, 'eng:126A1 でカムの ivo が 26（126 後期純正）にならない');
  ok(swapped.spec.valves.dIn === 33, 'eng:126A1 で吸気バルブ径が 33（126 後期純正）にならない');
  ok(swapped.model.revLimit.rpm === 4725, 'eng:126A1 で revLimit が 4725 にならない');
  ok(swapped.model.block === '126', 'eng:126A1 で block が 126 にならない');
  const b795 = buildSpec('500F', { eng: '126A1', disp: 'b795' });
  ok(!b795.blockMismatch, 'eng:126A1 のあとに Ø79.5（700系）を選んでもブロック不適合の警告が出てしまう');

  // 500F で p700 を押すと eng が自動で入る（ベース車両のエンジン側 block が '500' のため）
  const m500F = modelById('500F'), p700 = PACKAGES.find(p => p.id === 'p700');
  const c700 = packageChoices(p700, m500F);
  ok(c700.eng === '126A1', '500F で p700 を選んでも eng が自動で入らない');
  ok(packageMatches(p700, m500F, c700), 'packageMatches が p700 自動換装後の choices と一致しない');
  // 500R は block が既に 126＝自動換装は要らない
  const c700r = packageChoices(p700, r500);
  ok(!c700r.eng, '500R で p700 を選ぶと不要な eng が入ってしまう');

  // 126A1 に p595ss は出ない（652→594 のボアダウンになるため except で除外）
  const m126A1 = modelById('126A1'), m126A = modelById('126A');
  ok(!packagesFor(m126A1).some(pk => pk.id === 'p595ss'), '126A1 に p595ss が出てしまう');
  // 126A に「652 にボアアップ」、126A1 に「まずカムとマフラー」が出る（126 用の入口）
  ok(packagesFor(m126A).some(pk => pk.id === 'p652'), '126A に p652 が出ない');
  ok(packagesFor(m126A1).some(pk => pk.id === 'p126cam'), '126A1 に p126cam が出ない');
  console.log('5b. 換装・自動換装・除外の検品：' + (fails ? '要確認' : 'OK'));
}
{
  const b0 = buildSpec('500F', {}), b1 = buildSpec('500F', PACKAGES.find(p => p.id === 'p650').choices);
  const st = tellStory(simulate(b0.spec, RPM), simulate(b1.spec, RPM), b0, b1);
  ok(st.zones.find(z => z.id === 'town').delta > 15 && st.zones.find(z => z.id === 'high').delta > 15, '「650 にボアアップ」で街乗り・高回転とも +15% を超えない');
  const b7 = buildSpec('500F', packageChoices(PACKAGES.find(p => p.id === 'p700'), modelById('500F')));
  const w = warnings(b7, simulate(b7.spec, RPM));
  ok(!w.some(x => /ケース|ブロック/.test(x.text)), '500F に 700 DCOE を当てたとき（eng 自動換装後）ブロック不適合の警告が誤って出る');
}
console.log('5. 王道パッケージ：' + (fails ? '要確認' : 'OK'));

console.log(fails ? `\n失敗 ${fails} 件` : '\nすべて通過');
process.exit(fails ? 1 : 0);
