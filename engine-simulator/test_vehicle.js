// 車両層の検品：取説の「満載での最大登坂勾配（1〜4速）」と「4速最高速」に対して、同じ型式のエンジン模型＋車両諸元がどれだけ合うか。node test_vehicle.js
import { simulate } from './sim.js';
import { buildSpec, MODELS, revCapRpm } from './presets.js';
import { buildVehicle, VEHICLES } from './presets_vehicle.js';
import { maxGradeInGear, topSpeed, steadySpeedInGear, speedKmh, redline, capRes } from './vehicle.js';
const RPM = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500];
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } };
// 回転の上限（取説の「各ギアの最大許容速度」に相当する回転）まで切った曲線で検品する＝画面と同じ条件
const capped = (id, choices = {}) => { const b = buildSpec(id, choices); const raw = simulate(b.spec, RPM); return capRes(raw, revCapRpm(b, raw)); };
console.log('型式    | 登坂 1速 2速 3速 4速（模型 / 取説・満載）| 4速最高速（模型 / 取説・満載）');
for (const id of Object.keys(VEHICLES)) {
  const v = VEHICLES[id]; if (!v.calib) continue;
  const res = capped(id);
  const { vehicle, drive } = buildVehicle(id, { load: 'full' });
  const climbs = drive.gears.map(g => maxGradeInGear(res, vehicle, drive, g));
  const top = topSpeed(res, vehicle, drive);
  const cells = climbs.map((c, i) => `${c.toFixed(1)}/${v.calib.climb[i]}`).join(' ');
  console.log(`${id.padEnd(7)} | ${cells} | ${top?.kmh.toFixed(0)}/${v.calib.vmax}${v.calib.vmax === 95 ? '+' : ''}`);
  // 判定：各ギアの登坂能力が取説の ±25%（4速は ±1.5 ポイント）・最高速が取説の −5%〜+12%
  if (v.calib.loose) { console.log(`  （${id} は校正外のエンジン諸元＝参考表示のみ）`); continue; }
  climbs.forEach((c, i) => { const t = v.calib.climb[i]; ok(i === 3 ? Math.abs(c - t) <= 1.5 : Math.abs(c / t - 1) <= 0.25, `${id} ${i + 1}速の登坂 ${c.toFixed(1)}% vs 取説 ${t}%`); });
  ok(top && top.kmh >= v.calib.vmax * 0.95 && top.kmh <= v.calib.vmax * 1.12, `${id} 最高速 ${top?.kmh.toFixed(0)} vs 取説 ${v.calib.vmax}`);
}
// 方向：650 化で 4 速の登坂能力が上がる／9/39 にすると 4 速の登坂は下がり巡航回転は下がる／135 タイヤで巡航回転が下がる
{
  const res0 = capped('500F'), res1 = capped('500F', { disp: 'b77', cr: 'cr75', carb: 'w28imb' });
  const a = buildVehicle('500F', {}), b = buildVehicle('500F', { final: 'f939' }), c = buildVehicle('500F', { tire: 't135' });
  const g4 = (r, x) => maxGradeInGear(r, x.vehicle, x.drive, x.drive.gears[3]);
  ok(g4(res1, a) > g4(res0, a) + 1, '650 化で 4速の登坂が 1 ポイント以上増えない');
  ok(g4(res0, b) < g4(res0, a), '9/39 で 4速の登坂が下がらない');
  const rpm80 = (x) => 80 / speedKmh(1000, x.drive.gears[3], x.drive) * 1000;
  ok(rpm80(b) < rpm80(a) * 0.9 && rpm80(c) < rpm80(a), '9/39・135 タイヤで 80km/h の回転が下がらない');
  console.log(`80km/h 4速の回転：純正 ${rpm80(a).toFixed(0)}／9-39 ${rpm80(b).toFixed(0)}／135 ${rpm80(c).toFixed(0)} rpm`);
  // 5速化（2026-09-19）＝1〜4速は変わらず、5速だけが足される。⛔4速の比が動いたら仕様違反。
  const f5 = buildVehicle('500F', { fifth: 'g5_stradale' });
  ok(f5.drive.gears.length === 5, '5速化で段数が 5 にならない');
  ok(f5.drive.gears.slice(0, 4).every((g, i) => g === a.drive.gears[i]), '5速化キットで 1〜4速の比が変わってしまっている');
  const r5 = 80 / speedKmh(1000, f5.drive.gears[4], f5.drive) * 1000;
  ok(r5 < rpm80(a) * 0.87 && r5 > rpm80(a) * 0.82, '5速の 80km/h の回転が 4速の 15% 減（0.743/0.872）になっていない');
  const topA = topSpeed(res0, a.vehicle, a.drive), top5 = topSpeed(res0, f5.vehicle, f5.drive);
  ok(top5.kmh > topA.kmh && top5.gear === 5, '5速化で最高速が伸びて 5速で頭打ちにならない');
  console.log(`5速化：80km/h で 5速 ${r5.toFixed(0)}rpm（4速 ${rpm80(a).toFixed(0)}）／最高速 ${topA.kmh.toFixed(0)}→${top5.kmh.toFixed(0)}km/h`);
}
console.log(fails ? `\n失敗 ${fails} 件` : '\nすべて通過'); process.exit(fails ? 1 : 0);
