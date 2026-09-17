// エンジン妄想シミュレーター 計算核（0次元 充填・排出モデル）
// 純粋関数 simulate(spec, rpmList, opts) → 各回転数の結果配列。Node でも ブラウザ（ES module）でも動く。
// 目的は「純正と改造の差」を見ること。絶対値の誤差は 10〜15% を前提とする（HANDOFF §2）。

const R = 287.0;          // J/(kg·K)
const P_ATM = 101325;     // Pa
const T_ATM = 305;        // K（空冷・エンジンルーム内の吸気温度として少し高め）
const DEG = Math.PI / 180;

function gammaOf(T) { return Math.max(1.26, 1.40 - 7e-5 * (T - 300)); }

// 圧縮性オリフィス流れ（Heywood）。戻り値 kg/s（正＝上流→下流）
function orifice(cdA, pUp, tUp, pDown) {
  if (cdA <= 0 || pUp <= pDown) return 0;
  const g = gammaOf(tUp);
  const pr = Math.max(pDown / pUp, 1e-6);
  const crit = Math.pow(2 / (g + 1), g / (g - 1));
  let f;
  if (pr <= crit) {
    f = Math.sqrt(g) * Math.pow(2 / (g + 1), (g + 1) / (2 * (g - 1)));
  } else {
    f = Math.pow(pr, 1 / g) * Math.sqrt((2 * g / (g - 1)) * (1 - Math.pow(pr, (g - 1) / g)));
  }
  return cdA * pUp / Math.sqrt(R * tUp) * f;
}

// バルブのリフト曲線。カタログ角（IVO/IVC 等）は checkLift[mm] でのリフトとみなし、余弦曲線を座面まで延長する。
function makeLiftFn(openDeg, closeDeg, liftMax, checkLift) {
  const dCat = closeDeg - openDeg;
  const xChk = Math.acos(1 - 2 * Math.min(checkLift, liftMax * 0.49) / liftMax) / (2 * Math.PI);
  const dFull = dCat / (1 - 2 * xChk);
  const center = (openDeg + closeDeg) / 2;
  return (theta) => {
    let d = ((theta - center) % 720 + 1440) % 720; // 0..720
    if (d > 360) d -= 720;                          // -360..360
    if (Math.abs(d) >= dFull / 2) return 0;
    const x = d / dFull + 0.5;                      // 0..1
    return liftMax * (1 - Math.cos(2 * Math.PI * x)) / 2;
  };
}

// バルブの有効流路面積 [m²]。カーテン面積と喉面積の小さい方 × 流量係数。
function valveArea(lift_mm, d_mm, stem_mm, k) {
  if (lift_mm <= 0) return 0;
  const L = lift_mm / 1000, D = d_mm / 1000, s = stem_mm / 1000;
  const curtain = Math.PI * D * L;
  const throat = Math.PI / 4 * (D * D - s * s) * 0.92;
  const ld = L / D;
  const cd = 0.68 - 0.4 * Math.min(ld, 0.3);
  return k * cd * Math.min(curtain, throat);
}

function advanceAt(table, rpm) {
  if (typeof table === 'function') return table(rpm);
  if (rpm <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (rpm <= table[i][0]) {
      const [r0, a0] = table[i - 1], [r1, a1] = table[i];
      return a0 + (a1 - a0) * (rpm - r0) / (r1 - r0);
    }
  }
  return table[table.length - 1][1];
}

export const DEFAULT_CAL = {
  kValveIn: 0.85, kValveEx: 0.85, cdVenturi: 0.55, manifoldVol_L: 0.35,   // 2026-09-17 再校正（純正4機＋500F SAE 検証：500F +4%／500R +5%／126-652 −2%／126-594 −3%／SAE +4%）
  burnBase: 55, burnPerRpm: 0.006, wiebeA: 5, wiebeM: 2,
  kHeat: 2.5, tWall: 450,
  fmepA: 0.45, fmepB: 0.005, fmepC: 0.09, fmepD: 0.0012,
  kFan_kW: 1.5,                                 // 冷却ファン＋発電機の吸収動力 [kW at 4600rpm]（∝ rpm³）。DIN/Fiat「con ventilatore」条件に含まれる。spec.accessories.fan=false で外す（SAE 総出力相当）
  pExh_bar: 1.0, kExh: 0.08, tExh: 900,        // 背圧＝1.0 + kExh·(rpm/4600)²·(総排気量/500cc) bar（純正消音器。SAE 検証は kExh 0）
  dTheat: 35, vMixRef: 42, mixMin: 0.6,         // 吸気の加熱（低回転ほど大）と、ベンチュリ流速が低いときの混合気の質（Fiat 資料 p.39 図45 のベンチ曲線＝1500rpm で 2.6kgm・2500〜4200 平坦 に合わせた）
  runnerLen_m: 0.12, runnerXi: 1.5, kPortArea: 0.72, // 吸気ランナー（慣性＝ラム効果）：長さ・損失係数・ポート面積/バルブ面積比
  exRunnerLen_m: 0.35, exRunnerXi: 2.0,              // 排気管（慣性＝掃気効果）：純正の短い管。スポーツ排気は spec.exhaust.runnerLen_m で
  afr: 13.2, lhv: 44.0e6, effComb: 0.95,
  subSteps: 4, cycles: 6,
};

export function simulate(spec, rpmList, opts = {}) {
  const cal = { ...DEFAULT_CAL, ...(opts.cal || {}), ...(spec.cal || {}) };
  const E = spec.engine, C = spec.cam, V = spec.valves, I = spec.intake, X = spec.exhaust || {};
  const B = E.bore / 1000, S = E.stroke / 1000, l = (E.rod || 126) / 1000, a = S / 2;
  const Ap = Math.PI / 4 * B * B;
  const Vd = Ap * S;                       // 1気筒の行程容積
  const Vc = Vd / (E.cr - 1);
  const vol = (th) => Vc + Ap * (l + a - a * Math.cos(th * DEG) - Math.sqrt(l * l - a * a * Math.sin(th * DEG) ** 2));
  const area = (th) => Math.PI * B * B / 2 + Math.PI * B * (vol(th) - Vc) / Ap; // 熱伝達面積の近似

  // クランク角の定義：0=燃焼上死点, 180=下死点, 360=オーバーラップ上死点, 540=下死点
  const ivOpen = 360 - C.ivo, ivClose = 540 + C.ivc;
  const evOpen = 180 - C.evo, evClose = 360 + C.evc;
  const chk = C.checkLift ?? 0.5;
  const liftIn = makeLiftFn(ivOpen, ivClose, C.liftIn, chk);
  const liftEx = makeLiftFn(evOpen, evClose, C.liftEx, chk);

  const venturiArea = Math.PI / 4 * (I.venturi / 1000) ** 2 * (I.barrels || 1);
  const cdAv = cal.cdVenturi * venturiArea;
  const Vman = (I.manifoldVol_L ?? cal.manifoldVol_L) / 1000;
  const Lr = I.runnerLen_m ?? cal.runnerLen_m;
  const Ar = Math.PI / 4 * (V.dIn / 1000) ** 2 * cal.kPortArea;   // ランナー断面 ≒ ポート面積
  const Vport = Ar * Lr / 2;                                        // ランナー下流半分を集中容積として扱う
  const LrE = X.runnerLen_m ?? cal.exRunnerLen_m;
  const ArE = Math.PI / 4 * (V.dEx / 1000) ** 2 * cal.kPortArea;
  const VportE = ArE * LrE / 2;
  const kExh = X.kExh ?? cal.kExh;
  const tExh = cal.tExh;
  const ign = spec.ignition || [[1000, 10], [2000, 27], [3000, 38], [6000, 38]];
  const nCyl = E.ncyl || 2;

  const results = [];
  for (const rpm of rpmList) {
    const dth = 1 / cal.subSteps;
    const dt = dth / (6 * rpm);
    const Sp = 2 * S * rpm / 60;
    const adv = advanceAt(ign, rpm);
    const sparkAt = (720 - adv) % 720;
    const burnDur = cal.burnBase + cal.burnPerRpm * rpm;
    const pExh = ((X.backPressure_bar ?? cal.pExh_bar) + kExh * (rpm / 4600) ** 2 * (Vd * nCyl / 500e-6)) * 1e5;
    const tMan = T_ATM + cal.dTheat * Math.sqrt(2500 / rpm);
    const vMix = (Vd * nCyl * rpm / 120) / venturiArea;
    const mixQ = cal.mixMin + (1 - cal.mixMin) * Math.min(1, vMix / cal.vMixRef);

    // 状態
    let mCyl = P_ATM * vol(0) / (R * 600), tCyl = 600;
    let mMan = P_ATM * Vman / (R * tMan);
    let mPort = P_ATM * Vport / (R * tMan), u = 0;
    let mPortE = pExh * VportE / (R * tExh), uE = 0;
    let mFresh = 0, mFreshTrapped = 0, qTotal = 0, sinceSpark = -1, xbPrev = 0;
    let work = 0, pmax = 0, backIn = 0, backOut = 0, inFlowTot = 0;
    let dpVen = 0, dpVal = 0, nIn = 0;

    for (let cyc = 0; cyc < cal.cycles; cyc++) {
      work = 0; pmax = 0; backIn = 0; backOut = 0; inFlowTot = 0; dpVen = 0; dpVal = 0; nIn = 0;
      for (let th = 0; th < 720; th += dth) {
        const Vn = vol(th), Vnext = vol(th + dth);
        const p = mCyl * R * tCyl / Vn;
        const pMan = mMan * R * tMan / Vman;
        const pPort = mPort * R * tMan / Vport;
        // ランナーの運動量（半陰的オイラー）：du/dt = (pMan − pPort)/(ρL) − ξ u|u|/(2L)
        const rhoR = pMan / (R * tMan);
        u += dt * ((pMan - pPort) / (rhoR * Lr) - cal.runnerXi * u * Math.abs(u) / (2 * Lr));
        const mr = rhoR * Ar * u * dt; mMan -= mr; mPort += mr;
        const g = gammaOf(tCyl), cv = R / (g - 1), cp = cv + R;

        // 点火・燃焼（Wiebe）
        let dSpark = ((th - sparkAt) % 720 + 1440) % 720; if (dSpark > 360) dSpark -= 720;
        if (Math.abs(dSpark) < dth / 2 && sinceSpark < 0) {
          sinceSpark = 0; xbPrev = 0;
          mFreshTrapped = mFresh;
          qTotal = (mFreshTrapped / cal.afr) * cal.lhv * cal.effComb * mixQ;
        }
        let dQ = 0;
        if (sinceSpark >= 0) {
          sinceSpark += dth;
          const xb = 1 - Math.exp(-cal.wiebeA * Math.pow(sinceSpark / burnDur, cal.wiebeM + 1));
          dQ = qTotal * (xb - xbPrev); xbPrev = xb;
          if (sinceSpark > burnDur * 1.5) { sinceSpark = -1; }
        }

        // バルブ流れ
        const aIn = valveArea(liftIn(th), V.dIn, V.stemIn || 8, cal.kValveIn);
        const aEx = valveArea(liftEx(th), V.dEx, V.stemEx || 8, cal.kValveEx);
        let dmIn = 0, hIn = 0; // 流入エンタルピー
        let dmOut = 0;
        if (aIn > 0) {
          if (pPort > p) { const f = orifice(aIn, pPort, tMan, p) * dt; dmIn += f; hIn += cp * tMan * f; mPort -= f; mFresh += f; inFlowTot += f; }
          else { const f = orifice(aIn, p, tCyl, pPort) * dt; dmOut += f; mPort += f; mFresh -= f; backIn += f; }
          if (th > 360 && th < 540) { dpVen += (P_ATM - pMan); dpVal += (pPort - p); nIn++; }
        }
        // 排気ポート容積と排気管の運動量
        const pPortE = mPortE * R * tExh / VportE;
        const rhoE = pPortE / (R * tExh);
        uE += dt * ((pPortE - pExh) / (rhoE * LrE) - cal.exRunnerXi * uE * Math.abs(uE) / (2 * LrE));
        const mrE = rhoE * ArE * uE * dt; mPortE -= mrE;
        if (aEx > 0) {
          if (p > pPortE) { const f = orifice(aEx, p, tCyl, pPortE) * dt; dmOut += f; mPortE += f; }
          else { const f = orifice(aEx, pPortE, tExh, p) * dt; dmIn += f; hIn += cp * tExh * f; backOut += f; mPortE -= f; }
        }
        if (mPortE < 1e-9) mPortE = 1e-9;
        // ベンチュリ（大気→マニホールド）
        const fv = orifice(cdAv, P_ATM, T_ATM, pMan) * dt; mMan += fv;
        const fvBack = orifice(cdAv, pMan, tMan, P_ATM) * dt; mMan -= fvBack;

        // 熱伝達（Woschni 簡易）
        const w = 2.28 * Sp * (sinceSpark >= 0 ? 1.6 : 1.0);
        const h = 3.26 * Math.pow(B, -0.2) * Math.pow(p / 1000, 0.8) * Math.pow(tCyl, -0.55) * Math.pow(w, 0.8) * cal.kHeat;
        const dQht = h * area(th) * (tCyl - cal.tWall) * dt;

        // エネルギー式（単一領域）
        const dV = Vnext - Vn;
        const dW = p * dV; work += dW;
        const mNew = mCyl + dmIn - dmOut;
        tCyl = (mCyl * cv * tCyl + dQ - dW - dQht + hIn - cp * tCyl * dmOut) / (mNew * cv);
        tCyl = Math.max(250, Math.min(tCyl, 3200));
        mCyl = mNew;
        if (p > pmax) pmax = p;
        // 吸気の積算は排気上死点の少し前でリセット（次サイクルの新気を数え直す）
        if (Math.abs(th - 340) < dth / 2) mFresh = 0;
      }
    }
    const imep = work / Vd;                                   // Pa
    const fmep = (cal.fmepA + cal.fmepB * pmax / 1e5 + cal.fmepC * Sp + cal.fmepD * Sp * Sp) * 1e5;
    const bmep = imep - fmep;
    const omega = rpm * 2 * Math.PI / 60;
    const fanOn = (spec.accessories?.fan ?? true) !== false;
    const fanKw = fanOn ? cal.kFan_kW * (rpm / 4600) ** 3 : 0;   // 冷却ファン＋発電機（∝ rpm³）
    const torqueGross = bmep * Vd * nCyl / (4 * Math.PI);      // Nm（ファン無し）
    const powerKw = Math.max(0, torqueGross * omega / 1000 - fanKw);
    const torque = powerKw * 1000 / omega;                     // Nm（ファン込み）
    const rhoAtm = P_ATM / (R * T_ATM);
    const pExhOut = pExh;
    const ve = mFreshTrapped / (rhoAtm * Vd);
    const dynCR = vol(ivClose) / Vc;
    results.push({
      rpm, torque, powerKw, powerCv: powerKw / 0.7355, torqueGross, fanKw,
      imep_bar: imep / 1e5, bmep_bar: bmep / 1e5, fmep_bar: fmep / 1e5,
      ve, pmax_bar: pmax / 1e5, dynCR,
      backflowIn: backIn / Math.max(inFlowTot, 1e-12),
      backflowEx: backOut / Math.max(mFreshTrapped, 1e-12),
      dpVenturi_kPa: nIn ? dpVen / nIn / 1000 : 0, dpValve_kPa: nIn ? dpVal / nIn / 1000 : 0,
      overlap: C.ivo + C.evc, mixQ, tMan, pExh_bar: pExhOut / 1e5,
    });
  }
  return results;
}

// 便利関数：カタログ表記「35/75-75/35」等から cam オブジェクトを作る（リフトはカム山 mm × ロッカー比）
export function camFromCatalog(ivo, ivc, evo, evc, lobeLift_mm, rockerRatio = 1.5, checkLift = 0.5) {
  return { ivo, ivc, evo, evc, liftIn: lobeLift_mm * rockerRatio, liftEx: lobeLift_mm * rockerRatio, checkLift };
}

export function summarize(res) {
  const peakP = res.reduce((m, r) => r.powerCv > m.powerCv ? r : m, res[0]);
  const peakT = res.reduce((m, r) => r.torque > m.torque ? r : m, res[0]);
  return { peakPowerCv: peakP.powerCv, peakPowerRpm: peakP.rpm, peakTorqueNm: peakT.torque, peakTorqueRpm: peakT.rpm };
}
