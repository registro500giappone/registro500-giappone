// 場面の検品：全場面×全型式が有限値・談合坂で 500F 純正（1人）は 80 で入って落ちる・650 化で出口速度が上がる・Ω は談合坂より厳しい。node test_scenes.js
import { simulate } from './sim.js';
import { buildSpec, MODELS, PACKAGES, revCapRpm } from './presets.js';
import { buildVehicle } from './presets_vehicle.js';
import { climbHill, accelerate, capRes, redline, speedKmh } from './vehicle.js';
import { SCENES } from './scenes.js';
const RPM = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500];
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } };
// 回転の上限（取説の「各ギアの最大許容速度」に相当する回転）まで切る＝画面と同じ条件
const capped = (modelId, eng) => { const b = buildSpec(modelId, eng); const raw = simulate(b.spec, RPM); return capRes(raw, revCapRpm(b, raw)); };
const run = (modelId, eng, drv, scene) => {
  const res = capped(modelId, eng); const { vehicle, drive } = buildVehicle(modelId, drv);
  return scene.kind === 'drag' ? accelerate(res, vehicle, drive, { distance_m: scene.distance_m }) : climbHill(res, vehicle, drive, scene);
};
for (const sc of SCENES) for (const m of MODELS) { const r = run(m.id, {}, {}, sc); ok(Number.isFinite(r.exitKmh ?? r.finalKmh) && Number.isFinite(r.time_s), `${sc.id} × ${m.id}`); }
console.log('1. 全場面×全型式：' + (fails ? '要確認' : 'OK'));
const dz = SCENES.find(s => s.id === 'dangozaka'), om = SCENES.find(s => s.id === 'omega'), dr = SCENES.find(s => s.id === 'drag');
const p650 = PACKAGES.find(p => p.id === 'p650').choices;
const a = run('500F', {}, {}, dz), b = run('500F', p650, {}, dz), c = run('500F', {}, { load: 'duo' }, dz);
console.log(`談合坂 500F 純正1人：80→${a.exitKmh.toFixed(0)} 最低 ${a.minKmh.toFixed(0)}km/h（${a.minAt_m}m 地点）最低ギア ${a.minGear} 出口 ${a.gearAtExit}速 ${a.rpmAtExit.toFixed(0)}rpm 所要 ${a.time_s.toFixed(0)}s`);
console.log(`談合坂 500F まず650：80→${b.exitKmh.toFixed(0)} 最低 ${b.minKmh.toFixed(0)}km/h 最低ギア ${b.minGear}`);
console.log(`談合坂 500F 純正2人：80→${c.exitKmh.toFixed(0)} 最低 ${c.minKmh.toFixed(0)}km/h 最低ギア ${c.minGear}`);
// ⭐実車＝談合坂の 5% は純正だと 4速で速度を保てず、3速で回し切っても 60km/h 台（2026-09-18 ユーザー指摘）。
//   取説の「各ギアの最大許容速度」に相当する回転を上限にしたので、模型もそこへ収まる。⛔ここを緩めない。
ok(a.minKmh < 70, '500F 純正は談合坂の 5% で 70km/h を割る、が出ない');
ok(c.minGear <= 3, '500F 純正・2人は談合坂で 3速に落ちる、が出ない');   // 1人では 3速に入れる 64km/h まで落ちきらない（5% が 1.8km しかない）
{
  const res = capped('500F', {}), { drive } = buildVehicle('500F', {});
  const g3 = speedKmh(redline(res), drive.gears[2], drive);
  console.log(`500F 純正の回転上限 ${redline(res)} rpm＝3速 ${g3.toFixed(0)} km/h（取説 65 km/h）`);
  ok(Math.abs(g3 - 65) <= 3, '純正 500F の 3速の頭打ちが取説の 65km/h と 3km/h 以内で合わない');
}
ok(b.minKmh > a.minKmh + 5, 'まず650 で最低速度が 5km/h 以上上がる、が出ない');
ok(c.minKmh < a.minKmh, '2人乗ると最低速度が下がる、が出ない');
const o = run('500F', {}, {}, om), of = run('500F', {}, { load: 'full' }, om);
console.log(`Ω 500F 純正1人：60→${o.exitKmh.toFixed(0)} 最低 ${o.minKmh.toFixed(0)}km/h 最低ギア ${o.minGear} 所要 ${(o.time_s / 60).toFixed(1)}分／満載：最低 ${of.minKmh.toFixed(0)}km/h 最低ギア ${of.minGear}`);
ok(a.exitKmh >= dz.entryKmh - 0.5, '談合坂の出口（2% 区間の末）で入口速度まで戻れていない');   // 理論値＝常に全開（制限速度は勘案しない）
ok(of.minKmh < o.minKmh - 2 && of.minGear <= 3, 'Ω を満載で登ると 1人より遅くなり 3速以下に落ちる、が出ない');
const d = run('500F', {}, {}, dr), e = run('500F', p650, {}, dr);
console.log(`0-400 500F 純正 ${d.time_s.toFixed(1)}s／まず650 ${e.time_s.toFixed(1)}s`);
ok(e.time_s < d.time_s - 1, '650 で 0-400 が 1 秒以上縮む、が出ない');
console.log(fails ? `\n失敗 ${fails} 件` : '\nすべて通過'); process.exit(fails ? 1 : 0);
