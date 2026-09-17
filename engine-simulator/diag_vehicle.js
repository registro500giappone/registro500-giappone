// 車両層の感度確認（仮の駆動系諸元＝ref/vehicle_specs.md ができたら差し替える）。node diag_vehicle.js
import { simulate } from './sim.js';
import { buildSpec } from './presets.js';
import { steadySpeed, climbHill, accelerate, topSpeed, gearTable, rpmAtSpeed } from './vehicle.js';
const RPM = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500];
const TIRE = { w: 125, ar: 0.82, rim: 12 };
const drive = { gears: [3.25, 2.067, 1.3, 0.872], final: 5.125, tire: TIRE, eff: 0.9 };   // 仮
const veh = { mass: 500 + 75, cd: 0.40, area_m2: 1.7, crr: 0.015 };                         // 仮
const run = (label, choices, d = drive, v = veh) => {
  const res = simulate(buildSpec('500F', choices).spec, RPM);
  const top = topSpeed(res, v, d);
  const line = [label.padEnd(22), `top ${top?.kmh.toFixed(0)}km/h@${top?.rpm.toFixed(0)} g${top?.gear}`];
  for (const gr of [2, 3, 4, 5, 6]) { const s = steadySpeed(res, v, d, gr).best; line.push(`${gr}%:${s ? s.kmh.toFixed(0) + 'g' + s.gear : '×'}`); }
  const h = climbHill(res, v, d, { gradePct: 4, length_m: 3000, entryKmh: 80 });
  line.push(`坂4%/3km 80→${h.exitKmh.toFixed(0)} min${h.minKmh.toFixed(0)} g${h.gearAtExit} shifts${h.shifts.length}`);
  const a = accelerate(res, v, d, { distance_m: 400 });
  line.push(`0-400 ${a.time_s.toFixed(1)}s ${a.finalKmh.toFixed(0)}km/h 0-60 ${a.marks[60]?.toFixed(1)}s`);
  console.log(line.join(' | '));
};
run('500F 純正', {});
run('650 (b77 cr75)', { disp: 'b77', cr: 'cr75' });
run('650 sport', { disp: 'b77', cr: 'cr80', cam: 'c3575', carb: 'w28imb', exh: 'sport' });
run('500F final 8/39', {}, { ...drive, final: 39 / 8 });
run('500F 135/80-12', {}, { ...drive, tire: { w: 135, ar: 0.80, rim: 12 } });
run('500F +2人 (mass+130)', {}, drive, { ...veh, mass: veh.mass + 130 });
console.log(gearTable(simulate(buildSpec('500F', {}).spec, RPM), drive).map(g => `g${g.gear} ${g.kmhAt1000.toFixed(1)}km/h/1000rpm  ${g.kmhAtShiftDown.toFixed(0)}〜${g.kmhAtRedline.toFixed(0)}`).join('\n'));
console.log('80km/h 4速 =', rpmAtSpeed(80, drive.gears[3], drive).toFixed(0), 'rpm');
