// 段2の検品：全プリセットが計算を通ること＋物語・判定が段1の結論と矛盾しないこと。node test_presets.js
import { simulate } from './sim.js';
import { MODELS, SLOTS, START_EXAMPLES, buildSpec } from './presets.js';
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
for (const ex of START_EXAMPLES) for (const m of MODELS) { if (ex.families && !ex.families.includes(m.family)) continue; ok(finite(simulate(buildSpec(m.id, ex.choices).spec, RPM)), `出発点の例 ${ex.id} × ${m.id}`); }
console.log('4. 出発点の例：' + (fails ? '要確認' : 'OK'));

console.log(fails ? `\n失敗 ${fails} 件` : '\nすべて通過');
process.exit(fails ? 1 : 0);
