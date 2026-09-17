import { simulate, camFromCatalog } from './sim.js';
import { engines } from './engines_stock.js';
const RPM = [2000, 3000, 4000, 5000, 6000, 7000];
const clone = (o) => JSON.parse(JSON.stringify(o));
const base = engines['500F 純正 (18CV/4600, 3.1kgm)'];
const cam4080 = camFromCatalog(40, 80, 80, 40, 7.65);
const variants = {
  '純正': [base, {}],
  '40/80': [Object.assign(clone(base), { cam: cam4080 }), {}],
  '40/80 checkLift1.0': [Object.assign(clone(base), { cam: { ...cam4080, checkLift: 1.0 } }), {}],
  '40/80 runner0.25': [Object.assign(clone(base), { cam: cam4080 }), { runnerLen_m: 0.25 }],
  '40/80 kValve1.0': [Object.assign(clone(base), { cam: cam4080 }), { kValveIn: 1.0, kValveEx: 1.0 }],
  '40/80 cdVen0.8': [Object.assign(clone(base), { cam: cam4080 }), { cdVenturi: 0.8 }],
  '40/80 kExh0': [Object.assign(clone(base), { cam: cam4080 }), { kExh: 0 }],
  '40/80 all': [Object.assign(clone(base), { cam: { ...cam4080, checkLift: 1.0 } }), { kValveIn: 1.0, kValveEx: 1.0, cdVenturi: 0.8, kExh: 0, runnerLen_m: 0.25 }],
};
for (const [name, [spec, cal]] of Object.entries(variants)) {
  const r = simulate(spec, RPM, { cal });
  console.log(name.padEnd(20) + r.map(x => `${x.rpm}: ${x.powerCv.toFixed(1)}CV VE${x.ve.toFixed(2)} bk${(100 * x.backflowIn).toFixed(0)} ex${(100 * x.backflowEx).toFixed(0)} pE${x.pExh_bar.toFixed(2)} dV${x.dpVenturi_kPa.toFixed(0)}/${x.dpValve_kPa.toFixed(0)}`).join(' | '));
}
