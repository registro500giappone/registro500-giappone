import { simulate, summarize, camFromCatalog } from './sim.js';
import { engines } from './engines_stock.js';
const RPM = [1500, 2000, 2500, 3000, 3500, 4000, 4600, 5000, 5500, 6000, 6500];
const clone = (o) => JSON.parse(JSON.stringify(o));
const base500 = engines['500F 純正 (18CV/4600, 3.1kgm)'];
const base652 = engines['126 652 純正 (24CV/4500, 4.2kgm)'];
const cam4080 = camFromCatalog(40, 80, 80, 40, 7.65);   // Axel 23087 / Abarth 595 相当
const cam3575 = camFromCatalog(35, 75, 75, 35, 7.2);    // Axel 23454 stradale
const cam4575 = camFromCatalog(45, 75, 75, 45, 7.7);    // Axel 23452 hot race
const cases = [];
const add = (name, spec) => cases.push([name, spec]);
add('500F 純正', base500);
{ const s = clone(base500); s.intake.venturi = 23; add('500F + 28 IMB(ベンチュリ23)', s); }
{ const s = clone(base500); s.cam = cam3575; add('500F + カム35/75', s); }
{ const s = clone(base500); s.cam = cam4080; add('500F + カム40/80', s); }
{ const s = clone(base500); s.cam = cam4080; s.intake.venturi = 23; add('500F + カム40/80 + 28IMB', s); }
{ const s = clone(base500); s.engine.bore = 77; s.engine.cr = 7.5; add('500F → 650cc(77mm) 純正カム・26IMB', s); }
{ const s = clone(base500); s.engine.bore = 77; s.engine.cr = 7.5; s.intake.venturi = 23; add('500F → 650cc + 28IMB', s); }
add('126 652 純正', base652);
{ const s = clone(base652); s.cam = cam4080; add('652 + カム40/80', s); }
{ const s = clone(base652); s.cam = cam4080; s.valves = { dIn: 36, dEx: 31, stemIn: 8, stemEx: 8 }; add('652 + カム40/80 + ヘッド36/31', s); }
{ const s = clone(base652); s.cam = cam4080; s.valves = { dIn: 36, dEx: 31, stemIn: 8, stemEx: 8 }; s.intake = { venturi: 26 }; s.engine.cr = 8.5; add('652 + 40/80 + 36/31 + 30DGF相当(26) + CR8.5', s); }
{ const s = clone(base652); s.engine.bore = 79.5; s.engine.cr = 9.0; s.cam = cam4575; s.valves = { dIn: 39, dEx: 33, stemIn: 8, stemEx: 8 }; s.intake = { venturi: 30, barrels: 1 }; s.exhaust = { kExh: 0.05 }; s.ignition = [[1000, 12], [3000, 34], [6000, 34]]; add('700cc + 45/75 + 39/33 + 40DCOE(30) + CR9 + スポーツ排気', s); }
{ const s = clone(base652); s.engine.bore = 85.5; s.engine.cr = 9.5; s.cam = cam4575; s.valves = { dIn: 39, dEx: 33, stemIn: 8, stemEx: 8 }; s.intake = { venturi: 32, barrels: 1 }; s.exhaust = { kExh: 0.05 }; s.ignition = [[1000, 12], [3000, 34], [6000, 34]]; add('800cc(85.5) + 45/75 + 39/33 + 45DCOE(32) + CR9.5', s); }
// Abarth 595 / 595 SS / 695 SS は engines_abarth.js（公表値付き）＝ node test_abarth.js で見る
console.log('名称 | ピーク CV@rpm | ピーク Nm@rpm | Nm@2000 | Nm@3000 | 逆流%@2000 | dpVen/dpVal@4600 kPa');
for (const [name, spec] of cases) {
  const r = simulate(spec, RPM); const s = summarize(r);
  const at = (rpm) => r.find(x => x.rpm === rpm);
  console.log(`${name} | ${s.peakPowerCv.toFixed(1)}@${s.peakPowerRpm} | ${s.peakTorqueNm.toFixed(1)}@${s.peakTorqueRpm} | ${at(2000).torque.toFixed(1)} | ${at(3000).torque.toFixed(1)} | ${(100 * at(2000).backflowIn).toFixed(0)} | ${at(4600).dpVenturi_kPa.toFixed(0)}/${at(4600).dpValve_kPa.toFixed(0)}`);
}
