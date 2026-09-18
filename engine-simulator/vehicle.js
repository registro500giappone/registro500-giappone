// 車両層：エンジンのトルク曲線（sim.js の simulate の出力）× 駆動系（変速比・最終減速比・タイヤ）× 走行抵抗（転がり・空気・勾配）
// → 各車速・各ギアの余力、坂で維持できる速度、坂の中での速度の落ち方、0-400m。
// 純関数のみ（Node/ブラウザ共用・外部ライブラリ無し）。数値の出典は ref/vehicle_specs.md・ref/grades_research.md。
// 方針は HANDOFF §6【2026-09-18 更新】＝差を見る道具。空気抵抗係数などの一般値は「幅のある仮定」として扱い、絶対値を追わない。

export const G = 9.80665;      // m/s²
export const RHO_AIR = 1.20;   // kg/m³（気温 20℃・標高 0〜500m の丸め値。談合坂は標高 300〜500m で −3% ほど＝差の道具では無視）

// ── タイヤ ──────────────────────────────────────────────
// tire = { w: 断面幅 mm, ar: 偏平率 (0.80 など), rim: リム径 inch }
// 旧いバイアス "125-12" は偏平率の表記が無い＝概ね 0.80〜0.86。ここでは presets 側で ar を明示して持たせる。
export function tireDiameter_m(t) { return (t.rim * 25.4 + 2 * t.w * t.ar) / 1000; }
// 動荷重半径＝外径/2 × 0.97（たわみ分。ETRTO の慣用値。差の道具ではこの係数の差は見ない）
export function rollingRadius_m(t) { return tireDiameter_m(t) / 2 * 0.97; }

// ── 速度と回転の換算 ────────────────────────────────────
// drive = { gears: [1速, 2速, 3速, 4速(,5速)], final: 最終減速比, tire, eff: 伝達効率 }
export function speedKmh(rpm, gearRatio, drive) {
  const r = rollingRadius_m(drive.tire);
  return rpm / 60 / (gearRatio * drive.final) * 2 * Math.PI * r * 3.6;
}
export function rpmAtSpeed(kmh, gearRatio, drive) {
  const r = rollingRadius_m(drive.tire);
  return kmh / 3.6 / (2 * Math.PI * r) * gearRatio * drive.final * 60;
}

// ── エンジン曲線の補間 ─────────────────────────────────
// res = simulate() の出力（rpm 昇順・torque Nm＝ファン・発電機を差し引いた正味）。
// 範囲外＝下は最低点の値で頭打ち（クラッチを滑らせる領域は扱わない）、上はレブ超えとして 0。
export function torqueAt(res, rpm) {
  if (rpm <= res[0].rpm) return res[0].torque;
  const last = res[res.length - 1];
  // ⚠️ 以前は 2% の猶予を持たせていたが、回転の上限を入れた（2026-09-18）ら画面の数字が食い違った
  //    （上限 4650rpm と書きながら「4746rpm に張り付く」と出た）＝上限はきっちり効かせる。
  if (rpm >= last.rpm) return rpm > last.rpm ? 0 : last.torque;
  for (let i = 1; i < res.length; i++) {
    if (rpm <= res[i].rpm) {
      const a = res[i - 1], b = res[i], f = (rpm - a.rpm) / (b.rpm - a.rpm);
      return a.torque + (b.torque - a.torque) * f;
    }
  }
  return 0;
}
export const redline = (res) => res[res.length - 1].rpm;

// ── 回転の上限で曲線を切る（レブリミッターと同じ働き）─────────────────────
// torqueAt は最後の点の 2% 上でトルクを 0 にするので、ここで切るだけで駆動力・定常速度・ギア選び・
// ギア表の「—」が全部その上限を守る＝物理側は一切触らない。上限の出所は presets.js の revLimit。
// ⚠️ 継ぎ足す点の torque/powerCv は前後の線形補間。ve など他の欄は上側の点の値が入る（車の計算では使わない）。
export function capRes(res, rpmCap) {
  if (!rpmCap || rpmCap >= res[res.length - 1].rpm) return res;
  const out = res.filter(p => p.rpm < rpmCap);
  const i = res.findIndex(p => p.rpm >= rpmCap);
  if (i > 0) {
    const a = res[i - 1], b = res[i], f = (rpmCap - a.rpm) / (b.rpm - a.rpm);
    out.push({ ...b, rpm: rpmCap, torque: a.torque + (b.torque - a.torque) * f, powerCv: a.powerCv + (b.powerCv - a.powerCv) * f });
  }
  return out;
}

// ── 力 ─────────────────────────────────────────────────
// vehicle = { mass: 走行時の総質量 kg（車両＋乗員＋荷物）, cd, area_m2, crr }
export function tractiveForce_N(res, kmh, gearRatio, drive) {
  const rpm = rpmAtSpeed(kmh, gearRatio, drive);
  const r = rollingRadius_m(drive.tire);
  return torqueAt(res, rpm) * gearRatio * drive.final * (drive.eff ?? 0.90) / r;
}
export function resistance_N(kmh, vehicle, gradePct = 0) {
  const v = kmh / 3.6, th = Math.atan(gradePct / 100);
  const roll = vehicle.crr * vehicle.mass * G * Math.cos(th);
  const aero = 0.5 * RHO_AIR * vehicle.cd * vehicle.area_m2 * v * v;
  const grade = vehicle.mass * G * Math.sin(th);
  return roll + aero + grade;
}

// ── 定常：この勾配で維持できる最高速（ギアごと・全体）────────
// 「余力 = 駆動力 − 抵抗」が正から負に変わる最も高い車速＝安定な釣り合い点。
// トルク曲線は山なので、山の手前側にも釣り合い点があるが、そこは不安定（少し落ちるとさらに落ちる）＝
// 談合坂で「どんどん速度が落ちる」体感の正体。両方を返す。
export function steadySpeedInGear(res, vehicle, drive, gearRatio, gradePct, vMax = 160, step = 0.25) {
  let prev = null, stable = null, unstable = null;
  for (let v = 0; v <= vMax; v += step) {
    const m = tractiveForce_N(res, v, gearRatio, drive) - resistance_N(v, vehicle, gradePct);
    if (prev !== null) {
      // 釣り合い点＝「まだ余力が残っている最後の速度」を採る。1つ先（余力が負になった最初の速度）を採ると
      // 回転の上限をわずかに超えた値が画面に出る（上限 4650rpm なのに「4656rpm に張り付く」）。
      if (prev.m >= 0 && m < 0) stable = { kmh: prev.v, rpm: rpmAtSpeed(prev.v, gearRatio, drive) };
      if (prev.m < 0 && m >= 0 && stable === null) unstable = { kmh: v, rpm: rpmAtSpeed(v, gearRatio, drive) };
    }
    prev = { v, m };
  }
  return { stable, unstable };
}
export function steadySpeed(res, vehicle, drive, gradePct) {
  let best = null;
  const perGear = drive.gears.map((g, i) => {
    const s = steadySpeedInGear(res, vehicle, drive, g, gradePct);
    if (s.stable && (!best || s.stable.kmh > best.kmh)) best = { ...s.stable, gear: i + 1 };
    return { gear: i + 1, ...s };
  });
  return { best, perGear };   // best === null ＝どのギアでも登れない
}

// ── ギア選択（人の運転の型）────────────────────────────
// policy = { shiftUp: 回転がここまで上がったら上のギア, shiftDown: ここまで落ちたら下のギア, minRpm }
export const DEFAULT_POLICY = { shiftUp: 5000, shiftDown: 2500, minRpm: 1200 };
function pickGearForSpeed(res, drive, kmh, curGear, policy, gradeNeed) {
  // 上りで余力が無ければ下のギアが力を出せるか見る。余力があって回転が高ければ上へ。
  // 往復（3速↔4速のハンチング）を防ぐ：上げるのは「上のギアでも抵抗に勝てる」か「レブに当たる」ときだけ。
  let g = curGear;
  const top = drive.gears.length - 1, rl = redline(res);
  const rpm = (gi) => rpmAtSpeed(kmh, drive.gears[gi], drive);
  const force = (gi) => tractiveForce_N(res, kmh, drive.gears[gi], drive);
  const up = Math.min(policy.shiftUp, rl * 0.98);   // 上限が変速回転より低い型式（純正＝取説の許容回転）では上限で上げる
  // ⚠️上限に当たっていても「上のギアが抵抗に勝てない」なら上げない＝実車の「3速で最高回転のまま登る」。
  //   以前は「レブに当たったら無条件で上げる」だったため、上のギアで力が足りず即座に下げ、2m ごとに 3↔4 を往復していた（談合坂・2人で 530 回）。
  //   上げる側に 5% の余裕を要求するのは、上げた直後の速度変化で往復しないため。
  if (g < top && rpm(g) > up && force(g + 1) >= gradeNeed * 1.05) g += 1;
  else if (g > 0 && rpm(g - 1) < rl * 0.98 && force(g - 1) > force(g) && (rpm(g) < policy.shiftDown || force(g) < gradeNeed)) g -= 1;
  return g;
}

// ── 過渡：坂を登る（入口速度で入って、坂の中で速度がどうなるか）───
// scene = { gradePct, length_m, entryKmh, policy } または { profile: [{ len_m, gradePct }], entryKmh, policy }
// 返り値：距離ごとの {x_m, kmh, gear, rpm, gradePct}、坂の出口の速度、最低速度、ギアを落とした地点。
export function gradeAt(scene, x) {
  if (!scene.profile) return scene.gradePct;
  let acc = 0;
  for (const seg of scene.profile) { acc += seg.len_m; if (x < acc) return seg.gradePct; }
  return scene.profile[scene.profile.length - 1].gradePct;
}
export const sceneLength = (scene) => scene.profile ? scene.profile.reduce((a, s) => a + s.len_m, 0) : scene.length_m;
export function climbHill(res, vehicle, drive, scene, dt = 0.1) {
  const policy = { ...DEFAULT_POLICY, ...(scene.policy || {}) };
  const length_m = sceneLength(scene);
  let v = scene.entryKmh / 3.6, x = 0, t = 0;
  // 入口のギア＝入口速度で回転が範囲に収まる最も高いギア
  let gear = drive.gears.length - 1;
  while (gear > 0 && rpmAtSpeed(scene.entryKmh, drive.gears[gear], drive) < policy.shiftDown) gear--;
  const trace = [], shifts = [];
  let minKmh = scene.entryKmh, sampleEvery = 25, nextSample = 0;
  const maxT = Math.max(600, length_m / (8 / 3.6));   // 平均 8km/h を割るほど遅ければ打ち切る（11km の Ω を 60km/h で登ると 660 秒＝固定 600 では足りなかった）
  while (x < length_m && t < maxT) {
    const kmh = v * 3.6, gradePct = gradeAt(scene, x);
    const need = resistance_N(kmh, vehicle, gradePct);
    const g2 = pickGearForSpeed(res, drive, kmh, gear, policy, need);
    if (g2 !== gear) { shifts.push({ x_m: Math.round(x), from: gear + 1, to: g2 + 1, kmh: Math.round(kmh) }); gear = g2; }
    const F = tractiveForce_N(res, kmh, drive.gears[gear], drive);
    const a = (F - need) / (vehicle.mass * 1.05);   // 回転部分の等価質量 +5%
    // 理論値＝入口から出口まで常に全開（制限速度は勘案しない・2026-09-18 ユーザー確定）。緩い区間では入口速度より伸びる。
    v = Math.max(0.5, v + a * dt); x += v * dt; t += dt;
    if (x >= nextSample) { trace.push({ x_m: Math.round(x), t, kmh: v * 3.6, gear: gear + 1, rpm: rpmAtSpeed(v * 3.6, drive.gears[gear], drive), gradePct }); nextSample += sampleEvery; }
    if (v * 3.6 < minKmh) minKmh = v * 3.6;
  }
  const exitKmh = v * 3.6;
  const maxGrade = scene.profile ? Math.max(...scene.profile.map(s => s.gradePct)) : scene.gradePct;
  const steady = steadySpeed(res, vehicle, drive, maxGrade);   // いちばん急な区間で維持できる速度
  const minAt = trace.reduce((m, p) => (p.kmh < m.kmh ? p : m), trace[0] || { kmh: exitKmh, x_m: x });
  return { trace, shifts, exitKmh, minKmh, minAt_m: minAt.x_m, time_s: t, avgKmh: length_m / t * 3.6, length_m, maxGrade, entryKmh: scene.entryKmh,
    gearAtExit: gear + 1, rpmAtExit: rpmAtSpeed(exitKmh, drive.gears[gear], drive), steadyAtMax: steady.best,
    minGear: Math.min(...trace.map(p => p.gear)), truncated: x < length_m };
}

// ── 過渡：0-400m（または 0→目標速度）────────────────────
// 発進＝1速でクラッチをつないだ直後を launchRpm での駆動力で近似（半クラッチの物理は扱わない）。
export function accelerate(res, vehicle, drive, opts = {}, dt = 0.05) {
  const policy = { ...DEFAULT_POLICY, ...(opts.policy || {}) };
  const target_m = opts.distance_m ?? 400, targetKmh = opts.toKmh ?? Infinity, launchRpm = opts.launchRpm ?? 2500, gradePct = opts.gradePct ?? 0;
  let v = 0, x = 0, t = 0, gear = 0;
  const trace = [], marks = {};
  const maxT = 120;
  while (x < target_m && v * 3.6 < targetKmh && t < maxT) {
    const kmh = v * 3.6;
    let rpm = rpmAtSpeed(kmh, drive.gears[gear], drive);
    // ⚠️ 上限が変速回転より低い型式（純正＝取説の許容回転）では上限で上げる。ここを policy.shiftUp のままにすると
    //    レブに当たったまま変速せず、0-400 が 60 秒台になる（2026-09-18 に踏んだ）。
    const up = Math.min(policy.shiftUp, redline(res) * 0.98);
    if (rpm >= up && gear < drive.gears.length - 1) { gear++; rpm = rpmAtSpeed(kmh, drive.gears[gear], drive); t += 0.4; }  // 変速に 0.4 秒（駆動力ゼロ）
    const r = rollingRadius_m(drive.tire);
    const useRpm = Math.max(rpm, gear === 0 ? launchRpm : 0);
    const F = torqueAt(res, useRpm) * drive.gears[gear] * drive.final * (drive.eff ?? 0.90) / r;
    const a = (F - resistance_N(kmh, vehicle, gradePct)) / (vehicle.mass * (gear === 0 ? 1.15 : 1.05));
    v = Math.max(0, v + a * dt); x += v * dt; t += dt;
    for (const m of [40, 60, 80, 100]) if (!marks[m] && v * 3.6 >= m) marks[m] = t;
    if (trace.length === 0 || t - trace[trace.length - 1].t >= 0.25) trace.push({ t, x_m: x, kmh: v * 3.6, gear: gear + 1, rpm: rpmAtSpeed(v * 3.6, drive.gears[gear], drive) });
  }
  return { trace, time_s: t, distance_m: x, finalKmh: v * 3.6, gear: gear + 1, marks };
}

// ── 平地の最高速と、その回転 ─────────────────────────────
export function topSpeed(res, vehicle, drive) { return steadySpeed(res, vehicle, drive, 0).best; }

// ── 各ギアの守備範囲（画面の表用）──────────────────────
export function gearTable(res, drive, policy = DEFAULT_POLICY) {
  return drive.gears.map((g, i) => ({
    gear: i + 1, ratio: g, overall: g * drive.final,
    kmhAt1000: speedKmh(1000, g, drive),
    kmhAtShiftDown: speedKmh(policy.shiftDown, g, drive),
    kmhAtRedline: speedKmh(redline(res), g, drive),
  }));
}

// ── そのギアで登れる最大勾配（取説の「pendenza massima superabile」に対応・満載で比べる）──
// 釣り合い点が存在する最大の勾配を二分探索。取説の値は「そのギアで登り続けられる坂」＝安定な釣り合いが在ること。
export function maxGradeInGear(res, vehicle, drive, gearRatio, lo = 0, hi = 60) {
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const s = steadySpeedInGear(res, vehicle, drive, gearRatio, mid);
    if (s.stable) lo = mid; else hi = mid;
  }
  return lo;
}
