import { simulate, summarize } from './sim.js';
import { engines, validation } from './engines_stock.js';
const RPM = [1500, 2000, 2500, 3000, 3500, 4000, 4600, 5000, 5500];
const cal = process.argv[2] ? JSON.parse(process.argv[2]) : {};
for (const [name, spec] of Object.entries({ ...engines, ...validation })) {
  const res = simulate(spec, RPM, { cal });
  const s = summarize(res);
  console.log(`\n== ${name}`);
  console.log(' rpm   Nm    CV   VE   IMEP  FMEP pmax  back% dpVen dpVal  fanCV mixQ');
  for (const r of res) console.log(` ${r.rpm.toString().padStart(4)} ${r.torque.toFixed(1).padStart(5)} ${r.powerCv.toFixed(1).padStart(5)} ${r.ve.toFixed(2)} ${r.imep_bar.toFixed(2)} ${r.fmep_bar.toFixed(2)} ${r.pmax_bar.toFixed(0).padStart(3)} ${(100 * r.backflowIn).toFixed(1).padStart(5)} ${r.dpVenturi_kPa.toFixed(1).padStart(5)} ${r.dpValve_kPa.toFixed(1).padStart(5)} ${(r.fanKw/0.7355).toFixed(2).padStart(5)} ${r.mixQ.toFixed(2)}`);
  const t = spec.target;
  console.log(` peak: ${s.peakPowerCv.toFixed(1)} CV @${s.peakPowerRpm} (目標 ${t.cv} @${t.rpm}, ${(100 * (s.peakPowerCv / t.cv - 1)).toFixed(0)}%) / ${s.peakTorqueNm.toFixed(1)} Nm @${s.peakTorqueRpm} (目標 ${t.nm}@${t.nmRpm ?? '?'}, ${(100 * (s.peakTorqueNm / t.nm - 1)).toFixed(0)}%)`);
}
