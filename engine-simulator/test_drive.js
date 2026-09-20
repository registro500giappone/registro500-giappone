// 駆動系プリセット層の検品：GEARSETS・FIFTHS の拡張と driveOptionsFor の適合フィルタ。node test_drive.js
// 計算核（vehicle.js・sim.js）は無変更＝ここは presets_vehicle.js だけを見る。
import { buildVehicle, driveOptionsFor, GEARSETS, FINALS, TIRES, FIFTHS, GEARBOXES } from './presets_vehicle.js';
import { tireDiameter_m } from './vehicle.js';

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else { console.log('  ✓ ' + m); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('① nanni_34 on 500F');
{
  const { drive } = buildVehicle('500F', { gearset: 'nanni_34' });
  const want = [3.700, 2.067, 1.368, 0.955];
  ok(drive.gears.length === 4 && drive.gears.every((g, i) => near(g, want[i], 0.001)),
    `gears ${drive.gears.map(g => g.toFixed(3))} vs ${want}`);
}

console.log('② bacci_34 on 126A');
{
  const { drive } = buildVehicle('126A', { gearset: 'bacci_34' });
  ok(near(drive.gears[2], 1.421, 0.001), `3速 ${drive.gears[2].toFixed(3)} vs 1.421`);
  ok(near(drive.gears[3], 1.091, 0.001), `4速 ${drive.gears[3].toFixed(3)} vs 1.091`);
}

console.log('③ first_long on 500F');
{
  const stock = buildVehicle('500F', {});
  const { drive } = buildVehicle('500F', { gearset: 'first_long' });
  ok(near(drive.gears[0], 3.250, 0.001), `1速 ${drive.gears[0].toFixed(3)} vs 3.250`);
  ok(drive.gears.slice(1).every((g, i) => g === stock.drive.gears[i + 1]), '2〜4速が純正のまま不変');
}

console.log('④ bacci_34 は 500F（dfl 指定）の driveOptionsFor に出ない');
{
  const opts = driveOptionsFor('500F', { gearbox: 'dfl' });
  ok(!opts.gearsets.some(g => g.id === 'bacci_34'), 'bacci_34 が含まれていない（想定どおり）');
}

console.log('⑤ f939 は 500D に出ず 500F には出る');
{
  const optsD = driveOptionsFor('500D', {});
  const optsF = driveOptionsFor('500F', {});
  ok(!optsD.finals.some(f => f.id === 'f939'), '500D の finals に f939 が出ない（想定どおり）');
  ok(optsF.finals.some(f => f.id === 'f939'), '500F の finals に f939 が出ない');
}

console.log('⑥ FIFTHS は none 以外すべて 0.70〜0.92・grp を持つ');
{
  const rest = FIFTHS.filter(f => f.id !== 'none');
  ok(rest.length > 0, 'none 以外の FIFTHS が空');
  rest.forEach((f) => {
    ok(f.ratio >= 0.70 && f.ratio <= 0.92, `${f.id} 比 ${f.ratio.toFixed(3)} は 0.70〜0.92 の範囲内`);
    ok(!!f.grp, `${f.id} の grp = ${f.grp}`);
  });
}

console.log('⑦ TIRES 全部の外径が「リム×25.4＋2×幅×扁平」±1mm・t145_80_10 は 125 比 −3.8%±0.2');
{
  TIRES.forEach((t) => {
    const calc = t.tire.rim * 25.4 + 2 * t.tire.w * t.tire.ar;
    const fromLib = tireDiameter_m(t.tire) * 1000;
    ok(near(fromLib, calc, 1), `${t.id} 外径 ${fromLib.toFixed(1)}mm vs 算出 ${calc.toFixed(1)}mm`);
  });
  const d125 = tireDiameter_m(TIRES.find(t => t.id === 't125').tire);
  const d10 = tireDiameter_m(TIRES.find(t => t.id === 't145_80_10').tire);
  const pct = (d10 / d125 - 1) * 100;
  ok(near(pct, -3.8, 0.2), `t145_80_10 の 125 比 ${pct.toFixed(2)}% vs -3.8%±0.2`);
}

console.log('⑧ 既存 id 一式がすべて存在する');
{
  ok(['n_early', 'dfl', 'sync'].every(id => GEARBOXES.some(g => g.id === id)), 'GEARBOXES の既存 id が揃っている');
  ok(['f841', 'f839', 'f939'].every(id => FINALS.some(f => f.id === id)), 'FINALS の既存 id が揃っている');
  ok(['t125', 't135', 't145'].every(id => TIRES.some(t => t.id === id)), 'TIRES の既存 id が揃っている');
  ok(['none', 'g5_stradale'].every(id => FIFTHS.some(f => f.id === id)), 'FIFTHS の既存 id が揃っている');
}

console.log("⑨ buildVehicle('500F', {}) が拡張前と同一（gears・final・tire）");
{
  const r = buildVehicle('500F', {});
  ok(r.drive.gears.length === 4 && r.drive.gears.every((g, i) => g === [3.700, 2.067, 1.300, 0.875][i]),
    `gears ${r.drive.gears}`);
  ok(r.drive.final === 41 / 8, `final ${r.drive.final} vs ${41 / 8}`);
  ok(r.drive.tire.w === 125 && r.drive.tire.ar === 0.80 && r.drive.tire.rim === 12, `tire ${JSON.stringify(r.drive.tire)}`);
  ok(r.picks.gearset.id === 'stock', `gearset の既定が stock になっていない（${r.picks.gearset.id}）`);
}

console.log(fails ? `\n失敗 ${fails} 件` : '\nすべて通過'); process.exit(fails ? 1 : 0);
