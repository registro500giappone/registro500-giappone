// プリセット越しの感度診断（しきい値決めの材料）。node diag_presets.js
import { simulate, summarize } from './sim.js';
import { buildSpec } from './presets.js';
const RPM = [1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500];
const cases = [
  ['500F', {}], ['500F', { carb: 'w28imb' }], ['500F', { cam: 'c3575' }], ['500F', { cam: 'c4080', carb: 'w28imb' }],
  ['500F', { cam: 'c4080', carb: 'w28imb', exh: 'sport' }], ['500F', { disp: 'b77', cr: 'cr75' }], ['500F', { disp: 'b77', cr: 'cr75', carb: 'w28imb' }],
  ['500F', { disp: 'b77', cr: 'cr75', carb: 'w28imb', cam: 'c3575' }], ['500F', { disp: 'b77', cr: 'cr85', carb: 'pbic34', cam: 'c4080', head: 'h34', exh: 'sport' }],
  ['500F', { head: 'h3933' }], ['500F', { carb: 'dcoe45' }], ['500F', { cam: 'd5170' }],
  ['126A1', {}], ['126A1', { cam: 'c4080' }], ['126A1', { cam: 'c4080', exh: 'sport' }], ['126A1', { cam: 'c4080', head: 'h3631', carb: 'dgf30', cr: 'cr85', exh: 'sport' }],
  ['126A1', { disp: 'b795', cr: 'cr90', cam: 'c4575', head: 'h3933', carb: 'dcoe40', exh: 'sport' }],
  ['126A1', { disp: 'b85', cr: 'cr95', cam: 'c4575', head: 'h3933', carb: 'dcoe45', exh: 'sport' }],
  ['126A1', { disp: 'b85', cr: 'cr95' }], ['126A1', { disp: 'b85', cr: 'cr95', cam: 'd5170', head: 'h3933', carb: 'w28imb' }],
  ['500N', {}], ['500R', {}], ['GIA', {}], ['126A', {}], ['500D', {}],
];
console.log('型式 選択 | CV@rpm | Nm@rpm | Nm1500/2000/2500/3000 | back%1500/2000 | @peakP: dpVen/dpVal/pExh/VE | overlap dynCR cc');
for (const [mid, ch] of cases) {
  const b = buildSpec(mid, ch);
  const r = simulate(b.spec, RPM); const s = summarize(r);
  const at = (x) => r.find(q => q.rpm === x);
  const pk = at(s.peakPowerRpm);
  console.log(`${mid} ${JSON.stringify(ch)} | ${s.peakPowerCv.toFixed(1)}@${s.peakPowerRpm} | ${s.peakTorqueNm.toFixed(1)}@${s.peakTorqueRpm} | ${[1500, 2000, 2500, 3000].map(x => at(x).torque.toFixed(1)).join('/')} | ${(100 * at(1500).backflowIn).toFixed(0)}/${(100 * at(2000).backflowIn).toFixed(0)} | ${pk.dpVenturi_kPa.toFixed(1)}/${pk.dpValve_kPa.toFixed(1)}/${pk.pExh_bar.toFixed(2)}/${pk.ve.toFixed(2)} | ${pk.overlap} ${pk.dynCR.toFixed(2)} ${b.cc.toFixed(0)}`);
}
