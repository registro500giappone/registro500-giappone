// 駆動系のしくみ帳（drive-guide.html）の図の生成器。gearbox.html の update()／drawSaw と同じ計算・同じ見た目の
// 静止 SVG 文字列を作り、drive-guide.html の <figure id="fig-sN"> の中身へ差し込む。ページに JS は足さない＝ビルド時にこの
// スクリプトの出力を書き込むだけ（`node build_guide_figs.js` で実行・再実行しても同じ出力＝冪等）。
// HANDOFF §9-14 の確定：①節2〜8＝いま／変えた後のノコギリ線7枚 ②節0＝連鎖図 ③節3＝片持ち構造の模式断面。
import fs from 'node:fs';
import { simulate } from './sim.js';
import { buildSpec, revCapRpm } from './presets.js';
import { buildVehicle, GEARBOXES, FINALS, TIRES } from './presets_vehicle.js';
import { rpmAtSpeed, speedKmh, capRes, accelerate, tireDiameter_m, DEFAULT_POLICY } from './vehicle.js';

const HTML_PATH = new URL('./drive-guide.html', import.meta.url);
const RPM = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500];

const COLORS = {
  stage: '#173d2c',
  grid: 'rgba(255,255,255,.14)',
  cream: '#f6f0e2',
  seriesA: '#8fae9b',
  seriesB: '#e8b04f',
  gold: '#c8a457',
};
const FONT = "system-ui,-apple-system,'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif";

// ───────────────────────── 計算核（gearbox.html と同じ関数を同じ手順で呼ぶ） ─────────────────────────

// 500F・エンジン純正のトルク曲線＋回転の上限（gearbox.html の buildSpec→simulate→revCapRpm→capRes と同じ手順）。
function computeEngine(modelId) {
  const built = buildSpec(modelId, null);
  const raw = simulate(built.spec, RPM);
  const cap = revCapRpm(built, raw);
  return capRes(raw, cap);
}

// 駆動系の選択1つぶんの 0-4000m 加速トレース（gearbox.html の drawSaw と同じ呼び方）＝実際に全開で加速したときの軌跡。
function accelTrace(res, vehicleId, driveChoices) {
  const V = buildVehicle(vehicleId, driveChoices);
  const trace = accelerate(res, V.vehicle, V.drive, { distance_m: 4000, toKmh: 122 }).trace;
  return { V, trace };
}

function seriesTrace(res, vehicleId, spec) {
  return accelTrace(res, vehicleId, spec.choices);
}

// 5速を新設する変更（節3・節8）の「5速の線」＝最上段ギア（5速）の回転が DEFAULT_POLICY.shiftDown（2500rpm＝これ未満で
// 入れるとエンジンが失速する回転）に届く速度から右へ、rpmAtSpeed() の直線で引く（gearbox.html の見出し数字と同じ
// 計算方法）。原点から引くと「5速で発進する」ように読めてしまう（2026-09-21 検品で指摘・修正）ため、1〜4速の区間は
// 「いま」と同じノコギリ線を金でなぞるだけにし、5速はこの開始点から先だけを描く。
function fifthGearLine(res, vehicleId, driveChoices) {
  const V = buildVehicle(vehicleId, driveChoices);
  const top = V.drive.gears.length - 1;
  const ratio = V.drive.gears[top];
  const startKmh = Math.max(0, speedKmh(DEFAULT_POLICY.shiftDown, ratio, V.drive));
  const trace = [
    { kmh: startKmh, rpm: DEFAULT_POLICY.shiftDown },
    { kmh: 120, rpm: rpmAtSpeed(120, ratio, V.drive) },
  ];
  return { V, trace, startKmh };
}

// トレース上で指定速度（km/h）にあたる回転を線形補間する（drawSaw の interpAt と同じ）。
function interpAt(trace, kmh) {
  if (!trace.length) return 0;
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].kmh >= kmh) {
      const a = trace[i - 1], b = trace[i];
      const f = (kmh - a.kmh) / Math.max(b.kmh - a.kmh, 1e-6);
      return a.rpm + (b.rpm - a.rpm) * f;
    }
  }
  return trace[trace.length - 1].rpm;
}

// ───────────────────────── ノコギリ線 SVG（節2〜8で共通） ─────────────────────────

// 80km/h の数字ラベルが重ならないよう、rpm が高い順に上から並べ直し、最低12pxの間隔をあける。
function layoutLabels(items, Y) {
  const withY = items.map((it) => ({ ...it, y: Y(it.rpm) })).sort((a, b) => a.y - b.y);
  let prevLabelY = null;
  for (const it of withY) {
    let labelY = it.y - 6;
    if (prevLabelY !== null && labelY - prevLabelY < 12) labelY = prevLabelY + 12;
    it.labelDy = labelY - it.y;
    prevLabelY = labelY;
  }
  return withY;
}

// series = [{ trace, color, width, alpha, showNumber, gearLabels }] ＝先に書いた順に下から重ねて描く。
// 図の隅に「いま／変えた後」の凡例（2026-09-21 承認の(2)）。
function buildSawSvg({ width = 340, height = 190, series, legend = true }) {
  const padL = 34, padR = 8, padT = 8, padB = 18;
  const W = width, H = height;
  const X = (kmh) => padL + (kmh / 120) * (W - padL - padR);
  const Y = (rpm) => padT + (1 - rpm / 6000) * (H - padT - padB);
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" role="img" aria-label="80km/hでの回転の変化を示すグラフ">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${COLORS.stage}" rx="6"/>`);
  for (let r = 0; r <= 6000; r += 1000) {
    const y = Y(r);
    parts.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${COLORS.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${(padL - 4).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="${COLORS.cream}" fill-opacity=".8" font-family="${FONT}">${r}</text>`);
  }
  for (let k = 0; k <= 120; k += 20) {
    parts.push(`<text x="${X(k).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="${COLORS.cream}" fill-opacity=".8" font-family="${FONT}">${k}</text>`);
  }
  for (const s of series) {
    const d = s.trace.map((p, i) => `${i ? 'L' : 'M'}${X(p.kmh).toFixed(1)} ${Y(p.rpm).toFixed(1)}`).join(' ');
    const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : '';
    parts.push(`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.alpha}" stroke-linejoin="round"${dash}/>`);
  }
  for (const s of series) {
    if (!s.startLabel || !s.trace.length) continue;
    const p0 = s.trace[0];
    const sx = X(p0.kmh), sy = Y(p0.rpm);
    parts.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.5" fill="${s.color}"/>`);
    parts.push(`<text x="${sx.toFixed(1)}" y="${(sy - 8).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="${s.color}" font-family="${FONT}">${s.startLabel}</text>`);
  }
  const gearSeries = series.find((s) => s.gearLabels);
  if (gearSeries) {
    const t = gearSeries.trace;
    const marks = [];
    for (let i = 1; i < t.length; i++) if (t[i].gear !== t[i - 1].gear) marks.push(t[i - 1]);
    if (t.length) marks.push(t[t.length - 1]);
    for (const p of marks) {
      parts.push(`<text x="${X(p.kmh).toFixed(1)}" y="${(Y(p.rpm) - 6).toFixed(1)}" text-anchor="middle" font-size="9" fill="${gearSeries.color}" font-family="${FONT}">${p.gear}</text>`);
    }
  }
  const x80 = X(80);
  parts.push(`<line x1="${x80.toFixed(1)}" y1="${padT}" x2="${x80.toFixed(1)}" y2="${(H - padB).toFixed(1)}" stroke="${COLORS.cream}" stroke-opacity=".7" stroke-width="1" stroke-dasharray="4 3"/>`);
  const numbered = series.filter((s) => s.showNumber).map((s) => ({ rpm: interpAt(s.trace, 80), color: s.color }));
  const laidOut = layoutLabels(numbered, Y);
  for (const it of laidOut) {
    const y = Y(it.rpm);
    parts.push(`<circle cx="${x80.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${it.color}"/>`);
    parts.push(`<text x="${(x80 + 7).toFixed(1)}" y="${(y + it.labelDy + 4).toFixed(1)}" font-size="11" font-weight="700" fill="${it.color}" font-family="${FONT}">${Math.round(it.rpm)}</text>`);
  }
  if (legend) {
    const lx = W - 70;
    parts.push(`<rect x="${lx}" y="10" width="8" height="8" fill="${COLORS.seriesA}"/>`);
    parts.push(`<text x="${lx + 11}" y="17" font-size="9" fill="${COLORS.cream}" font-family="${FONT}">いま</text>`);
    parts.push(`<rect x="${lx}" y="24" width="8" height="8" fill="${COLORS.seriesB}"/>`);
    parts.push(`<text x="${lx + 11}" y="31" font-size="9" fill="${COLORS.cream}" font-family="${FONT}">変えた後</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

// ───────────────────────── 節2〜8：いま／変えた後の設定表 ─────────────────────────
// choices は presets_vehicle.js の buildVehicle() にそのまま渡す形。mode 'trace' ＝全開加速のシミュレーション
// （既存の段がそのまま使われる変更）／'topline' ＝最上段ギアの直線（新しい最上段ギアを足す変更＝5速化）。
const SECTIONS = [
  {
    id: 's2', vehicleId: '500F', pack: 'dp_f839',
    now: { choices: null, mode: 'trace', gearLabels: true, showNumber: true },
    changed: { choices: { final: 'f839' }, mode: 'trace', showNumber: true, width: 4, alpha: .9 },
    sub: { choices: { final: 'f939' }, mode: 'trace', showNumber: true, width: 1.5, alpha: .55 },
    figcaption: '500F・エンジン純正・1人乗車。ファイナルだけを 8/41→8/39 に変えたとき（細い金の線は 9/39）。',
    card: {
      change: '最終減速比が5.125（8/41）→4.875（8/39）に変わり、1〜4速（5速があれば5速も）の全段が一律に約5%長くなる。',
      feel: '499cc純正のままだと3→4の谷を感じやすいという談（499cc＋126箱の構成）。',
      note: '',
    },
  },
  {
    id: 's3', vehicleId: '500F', pack: 'dp_fifth_long',
    now: { choices: null, mode: 'trace', gearLabels: true, showNumber: true },
    changed: { choices: { fifth: 'g5_stradale' }, mode: 'topline', showNumber: true, width: 3, alpha: .9 },
    figcaption: '500F・エンジン純正・1人乗車。1〜4速は純正のまま（金の線も同じノコギリ）、5速化キット「ストラダーレ」（0.743）を足して5速に入れて巡航した場合が金の線の右側。',
    card: {
      change: '4速の後ろに5速（35/26＝0.743）が追加され、1〜4速はそのまま残る。',
      change2rpmNote: '（5速に入れて巡航した場合）',
      feel: '「110km/hを一日中巡航でき、130km/h超まで伸びる」（純正650cc＋126ミッション＋5速化のオーナー）',
    },
  },
  {
    id: 's4', vehicleId: '500F', pack: 'dp_nanni34',
    now: { choices: null, mode: 'trace', gearLabels: true, showNumber: true },
    changed: { choices: { gearset: 'nanni_34' }, mode: 'trace', showNumber: true, width: 4, alpha: .9 },
    figcaption: '500F・エンジン純正・1人乗車。3速・4速だけをNANNI 3/4ショート（ノンシンクロ箱）に変えたとき。',
    card: {
      change: '3速が1.300→1.368、4速が0.875→0.955に変わる（NANNI・ノンシンクロ箱）。1・2速とファイナルはそのまま。',
      feel: '「回転の落ち込みが均等になり、常にパワーバンド内にいられる」（3/4速ショート＋5速ロングを組んだ構成・英語フォーラムの記録）',
    },
  },
  {
    id: 's5', vehicleId: '500F', pack: 'dp_first_long',
    now: { choices: null, mode: 'trace', gearLabels: true, showNumber: true },
    changed: { choices: { gearset: 'first_long' }, mode: 'trace', showNumber: true, width: 4, alpha: .9 },
    figcaption: '500F・エンジン純正・1人乗車。1速だけを126純正と同じ12/39に変えたとき（2〜4速・ファイナルは純正のまま）。',
    card: {
      change: '1速だけが3.700→3.250に変わる（126純正と同歯数）。2〜4速とファイナルはそのまま。',
      forceRpmText: '変化なし。1速だけの変更のため4速・80km/hには効かない',
      feel: 'この変更は体感を語る記録が他の変更に比べて少なく、確度は低いと本文に明記。',
    },
  },
  {
    id: 's6', vehicleId: '500F', pack: 'dp_box',
    now: { choices: null, mode: 'trace', gearLabels: true, showNumber: true },
    changed: { choices: { gearbox: 'sync', final: 'f839' }, mode: 'trace', showNumber: true, width: 4, alpha: .9 },
    figcaption: '500F・エンジン純正・1人乗車。ミッションを126（シンクロ）へ丸ごと換装し、ファイナルも8/41→8/39に変わったとき。',
    card: {
      change: '1速が3.700→3.250に変わり（シンクロ箱）、ファイナルも8/41→8/39に変わる（126ミッションへの丸ごと換装の副作用）。',
      feel: '499cc純正のエンジンに126の8/39を組み合わせると「3速から4速への谷」を強く感じるという記録があります。',
    },
  },
  {
    id: 's7', vehicleId: '500F', pack: 'dp_t10',
    now: { choices: null, mode: 'trace', gearLabels: true, showNumber: true },
    changed: { choices: { tire: 't145_80_10' }, mode: 'trace', showNumber: true, width: 4, alpha: .9 },
    figcaption: '500F・エンジン純正・1人乗車。タイヤを純正125R12から10インチ（145/80R10）に変えたとき。',
    card: {
      change: 'タイヤ外径が約505mm→約486mm（約−3.8%）に小さくなり、同じ速度での回転が上がる。ギア比・ファイナルは純正のまま。',
      feel: '車高はおよそ−10mm下がり、スピードメーターは実速より高く表示するという構造的な記録（純正のドラムブレーキなら干渉しないという記録もある）。',
    },
  },
  {
    id: 's8', vehicleId: '500F', pack: 'dp_bacci34', da: 'gearbox:sync,final:f839',
    now: { choices: { gearbox: 'sync', final: 'f839' }, mode: 'trace', gearLabels: true, showNumber: true },
    changed: { choices: { gearbox: 'sync', gearset: 'bacci_34', fifth: 'g5_2522', final: 'f839' }, mode: 'topline', showNumber: true, width: 3, alpha: .9 },
    figcaption: '500F・エンジン純正・1人乗車。いま＝126箱＋8/39（6節の状態、金の線も1〜4速は同じノコギリ）。そこへBacci 3/4ショート＋5速0.88を足して5速に入れて巡航した場合が金の線の右側。',
    card: {
      change: '3速19/27・4速22/24（純正より4速が25%短い）に5速0.880を追加。「4速」の役割が「5速」に移り、3・4速は登坂側に振られる。',
      change2rpmNote: '（いま＝126箱＋8/39を基準。5速に入れて巡航した場合）',
      feel: 'この組み合わせそのものを語った個別の談は見つかっていません（構造上の推定）。',
    },
  },
];

function buildSectionFig(res, cfg) {
  const now = seriesTrace(res, cfg.vehicleId, cfg.now);
  const series = [];
  if (cfg.sub) {
    const sub = seriesTrace(res, cfg.vehicleId, cfg.sub);
    series.push({ trace: sub.trace, color: COLORS.seriesB, width: cfg.sub.width, alpha: cfg.sub.alpha, showNumber: cfg.sub.showNumber });
  }
  let rpmChanged;
  if (cfg.changed.mode === 'topline') {
    // 5速を足す変更＝1〜4速は「いま」と同じノコギリ線を金でなぞり、5速はシフトダウン回転（2500rpm）に届く速度から右へ引く。
    const fifth = fifthGearLine(res, cfg.vehicleId, cfg.changed.choices);
    series.push({ trace: now.trace, color: COLORS.seriesB, width: cfg.changed.width ?? 3, alpha: cfg.changed.alpha ?? .9, showNumber: false });
    series.push({ trace: fifth.trace, color: COLORS.seriesB, width: cfg.changed.width ?? 3, alpha: cfg.changed.alpha ?? .9, showNumber: true, startLabel: '5速へ' });
    rpmChanged = Math.round(interpAt(fifth.trace, 80));
  } else {
    const changed = seriesTrace(res, cfg.vehicleId, cfg.changed);
    series.push({ trace: changed.trace, color: COLORS.seriesB, width: cfg.changed.width ?? 4, alpha: cfg.changed.alpha ?? .9, showNumber: cfg.changed.showNumber });
    rpmChanged = Math.round(interpAt(changed.trace, 80));
  }
  series.push({ trace: now.trace, color: COLORS.seriesA, width: 2.5, alpha: 1, showNumber: cfg.now.showNumber, gearLabels: !!cfg.now.gearLabels });
  const svg = buildSawSvg({ series });
  const rpmNow = Math.round(interpAt(now.trace, 80));
  const rpmSub = cfg.sub ? Math.round(interpAt(seriesTrace(res, cfg.vehicleId, cfg.sub).trace, 80)) : null;
  return { svg, rpmNow, rpmChanged, rpmSub };
}

function buildCardHtml(cfg, nums) {
  const { rpmNow, rpmChanged } = nums;
  let rpmLine;
  if (cfg.card.forceRpmText) {
    rpmLine = `${rpmNow}rpm → ${rpmChanged}rpm（${cfg.card.forceRpmText}）`;
  } else {
    const pct = Math.round((rpmChanged / rpmNow - 1) * 100);
    const pctTxt = pct >= 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
    rpmLine = `${rpmNow}rpm → ${rpmChanged}rpm（${pctTxt}）${cfg.card.change2rpmNote || ''}`;
  }
  const card3 = `<div class="card3">
    <div><b>何が変わる</b>${cfg.card.change}</div>
    <div><b>80km/hの回転</b>${rpmLine}</div>
    <div><b>体感</b>${cfg.card.feel}</div>
  </div>`;
  return card3 + '\n  ' + buildTryitHtml(cfg);
}

// 「自分の車で試す」＝カードの直下に1本。cfg.pack が駆動系妄想シミュレーターの札 id・cfg.da があれば
// 「いま」の駆動系を先に立ててから（節8＝126箱＋8/39）札を重ねる。
function buildTryitHtml(cfg) {
  if (!cfg.pack) return '';
  const q = new URLSearchParams();
  if (cfg.da) q.set('da', cfg.da);
  q.set('p', cfg.pack);
  return `<p class="note tryit"><a href="./gearbox#${q.toString()}">自分の車で試す（駆動系妄想シミュレーター）</a></p>`;
}

// ───────────────────────── 節0：仕組みの連鎖図（自作線画・数字は計算核から） ─────────────────────────
function buildFigS0() {
  const tire = TIRES.find((t) => t.id === 't125');
  const final = FINALS.find((f) => f.id === 'f841');
  const box = GEARBOXES.find((g) => g.id === 'dfl');
  const diam = tireDiameter_m(tire.tire);
  const circumference = Math.PI * diam;
  const gear4 = box.gears[3];
  const afterFinal = circumference / final.ratio;
  const perEngineRev = afterFinal / gear4;
  const fmt = (v) => v.toFixed(2);

  const W = 340, H = 160;
  const boxes = [
    { x: 8, w: 92, title: 'タイヤ 1回転', lines: ['125R12 ≈505mm', `≈${fmt(circumference)}m`] },
    { x: 124, w: 92, title: 'ファイナル通過後', lines: ['÷ 5.125（8/41）', `≈${fmt(afterFinal)}m`] },
    { x: 240, w: 92, title: 'エンジン 1回転', lines: ['÷ 0.875（4速）', `≈${fmt(perEngineRev)}m`] },
  ];
  const y = 46, h = 58;
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" role="img" aria-label="タイヤ1回転からエンジン1回転までの距離の連鎖">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${COLORS.stage}" rx="6"/>`);
  parts.push(`<text x="${W / 2}" y="18" text-anchor="middle" font-size="10.5" fill="${COLORS.cream}" font-family="${FONT}" font-weight="700">500F・125R12・8/41・4速（0.875）を基準</text>`);
  boxes.forEach((b, i) => {
    parts.push(`<rect x="${b.x}" y="${y}" width="${b.w}" height="${h}" rx="8" fill="none" stroke="${COLORS.cream}" stroke-opacity=".55" stroke-width="1.2"/>`);
    parts.push(`<text x="${b.x + b.w / 2}" y="${y + 17}" text-anchor="middle" font-size="10" fill="${COLORS.gold}" font-family="${FONT}" font-weight="700">${b.title}</text>`);
    b.lines.forEach((line, li) => {
      parts.push(`<text x="${b.x + b.w / 2}" y="${y + 32 + li * 13}" text-anchor="middle" font-size="10.5" fill="${COLORS.cream}" font-family="${FONT}">${line}</text>`);
    });
    if (i < boxes.length - 1) {
      const x1 = b.x + b.w, x2 = boxes[i + 1].x;
      const midY = y + h / 2;
      parts.push(`<line x1="${x1 + 3}" y1="${midY}" x2="${x2 - 8}" y2="${midY}" stroke="${COLORS.gold}" stroke-width="1.5"/>`);
      parts.push(`<path d="M${x2 - 8} ${midY - 4} L${x2 - 2} ${midY} L${x2 - 8} ${midY + 4} Z" fill="${COLORS.gold}"/>`);
    }
  });
  parts.push(`<text x="${W / 2}" y="${y + h + 22}" text-anchor="middle" font-size="10" fill="${COLORS.cream}" fill-opacity=".8" font-family="${FONT}">エンジン1回転あたりに進む距離＝タイヤ1回転の距離 ÷（ファイナル比 × ギア比）</text>`);
  parts.push('</svg>');
  return { svg: parts.join(''), circumference, afterFinal, perEngineRev };
}

// ───────────────────────── 節3b：5速の片持ち構造の模式断面（自作線画・原典の切り出しではない） ─────────────────────────
function buildFigS3b() {
  const W = 340, H = 190;
  const caseX = 24, caseY = 56, caseW = 170, caseH = 78;
  const coverX = caseX + caseW, coverY = 66, coverW = 62, coverH = 58;
  const shaftTopY = caseY + 24, shaftBotY = caseY + 54;
  const wallX = coverX;
  const gearX = coverX + coverW - 18;
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" role="img" aria-label="5速の片持ち構造の模式断面図">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${COLORS.stage}" rx="6"/>`);
  parts.push(`<text x="${W / 2}" y="16" text-anchor="middle" font-size="10" fill="${COLORS.cream}" fill-opacity=".85" font-family="${FONT}">模式図（実際の形状・縮尺どおりではありません）</text>`);

  // ミッションケース
  parts.push(`<rect x="${caseX}" y="${caseY}" width="${caseW}" height="${caseH}" rx="6" fill="none" stroke="${COLORS.cream}" stroke-opacity=".6" stroke-width="1.4"/>`);
  parts.push(`<text x="${caseX + 8}" y="${caseY + 14}" font-size="9.5" fill="${COLORS.cream}" fill-opacity=".85" font-family="${FONT}">ミッションケース（4速までの軸）</text>`);
  // 主軸・副軸（4速まで）
  parts.push(`<line x1="${caseX + 10}" y1="${shaftTopY}" x2="${wallX + 4}" y2="${shaftTopY}" stroke="${COLORS.cream}" stroke-width="3"/>`);
  parts.push(`<line x1="${caseX + 10}" y1="${shaftBotY}" x2="${wallX + 4}" y2="${shaftBotY}" stroke="${COLORS.cream}" stroke-width="3"/>`);

  // 後部カバー
  parts.push(`<rect x="${coverX}" y="${coverY}" width="${coverW}" height="${coverH}" rx="6" fill="none" stroke="${COLORS.gold}" stroke-opacity=".7" stroke-width="1.4" stroke-dasharray="3 3"/>`);
  parts.push(`<text x="${coverX + coverW / 2}" y="${coverY + coverH + 14}" text-anchor="middle" font-size="9.5" fill="${COLORS.gold}" font-family="${FONT}">後部カバー</text>`);

  // 5速ギア対（片持ち＝ケース壁でしか支えられない軸の先に載る）
  parts.push(`<line x1="${wallX}" y1="${shaftTopY}" x2="${gearX}" y2="${shaftTopY}" stroke="${COLORS.gold}" stroke-width="3"/>`);
  parts.push(`<circle cx="${gearX}" cy="${shaftTopY}" r="12" fill="none" stroke="${COLORS.gold}" stroke-width="2"/>`);
  parts.push(`<circle cx="${gearX - 2}" cy="${shaftTopY + 16}" r="9" fill="none" stroke="${COLORS.gold}" stroke-width="2"/>`);

  // 軸受（唯一の支持点＝ケース壁）
  parts.push(`<rect x="${wallX - 4}" y="${shaftTopY - 9}" width="8" height="18" fill="${COLORS.cream}"/>`);

  // 引き出し線・ラベル（3か所）
  const leader = (x1, y1, x2, y2) => parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLORS.cream}" stroke-opacity=".7" stroke-width="1"/>`);
  leader(gearX, shaftTopY - 12, gearX, 30);
  parts.push(`<text x="${gearX}" y="24" text-anchor="middle" font-size="9.5" fill="${COLORS.cream}" font-family="${FONT}">①5速ギア対（片持ち）</text>`);

  leader(wallX, shaftTopY - 9, wallX - 30, H - 40);
  parts.push(`<text x="${wallX - 30}" y="${H - 30}" text-anchor="middle" font-size="9.5" fill="${COLORS.cream}" font-family="${FONT}">②5速下の軸受</text>`);
  parts.push(`<text x="${wallX - 30}" y="${H - 18}" text-anchor="middle" font-size="8.5" fill="${COLORS.cream}" fill-opacity=".75" font-family="${FONT}">（唯一の支持点）</text>`);

  const forkX = caseX + caseW * 0.42;
  parts.push(`<circle cx="${forkX}" cy="${(shaftTopY + shaftBotY) / 2}" r="3.5" fill="${COLORS.cream}"/>`);
  leader(forkX, (shaftTopY + shaftBotY) / 2, forkX, H - 40);
  parts.push(`<text x="${forkX}" y="${H - 30}" text-anchor="middle" font-size="9.5" fill="${COLORS.cream}" font-family="${FONT}">③2速フォークとの</text>`);
  parts.push(`<text x="${forkX}" y="${H - 18}" text-anchor="middle" font-size="9.5" fill="${COLORS.cream}" font-family="${FONT}">干渉位置</text>`);

  parts.push('</svg>');
  return { svg: parts.join('') };
}

// ───────────────────────── HTML への差し込み（冪等：既存の同種ブロックを剥がしてから入れ直す） ─────────────────────────
function stripAndInsertAfter(html, anchor, block) {
  const idx = html.indexOf(anchor);
  if (idx === -1) throw new Error('anchor not found (after): ' + anchor);
  const start = idx + anchor.length;
  const rest = html.slice(start);
  let consumed = 0;
  const figM = rest.match(/^\s*<figure id="fig-[^"]+">[\s\S]*?<\/figure>/);
  if (figM) {
    consumed = figM[0].length;
    const afterFig = rest.slice(consumed);
    const cardM = afterFig.match(/^\s*<div class="card3">/);
    if (cardM) {
      // card3 の中は <div> が3つ入れ子＝単純な非貪欲正規表現だと最初の内側 </div> で止まって壊れる
      // （2026-09-21 に踏んだ）＝タグの深さを数えて対応する閉じタグまで手で走査する。
      let i = cardM[0].length, depth = 1;
      while (depth > 0 && i < afterFig.length) {
        const nextOpen = afterFig.indexOf('<div', i);
        const nextClose = afterFig.indexOf('</div>', i);
        if (nextClose === -1) { depth = 0; break; }
        if (nextOpen !== -1 && nextOpen < nextClose) { depth++; i = nextOpen + 4; }
        else { depth--; i = nextClose + 6; }
      }
      consumed += i;
      // card3 の直後に「自分の車で試す」の1行があれば、それも剥がす対象に含める（中に入れ子タグは無いので非貪欲で足りる）。
      const afterCard = afterFig.slice(i);
      const tryitM = afterCard.match(/^\s*<p class="note tryit">[\s\S]*?<\/p>/);
      if (tryitM) consumed += tryitM[0].length;
    }
  }
  return html.slice(0, start) + '\n  ' + block + html.slice(start + consumed);
}
function stripAndInsertBefore(html, anchor, block) {
  const idx = html.indexOf(anchor);
  if (idx === -1) throw new Error('anchor not found (before): ' + anchor);
  let cut = idx;
  const before = html.slice(0, idx);
  // 直前が（既に差し込み済みの）<figure>...</figure> で終わっていれば、その開始位置まで戻って剥がす。
  // ⚠️ 文書中には他の節の <figure> も複数あるため、後方から最も近い開始タグを探す（先頭から探すと離れた figure まで
  //   巻き込んで消してしまう＝2026-09-21 に一度この事故を踏んだ）。
  if (/<\/figure>\s*$/.test(before)) {
    const openIdx = before.lastIndexOf('<figure id="fig-');
    if (openIdx !== -1) cut = openIdx;
  }
  return html.slice(0, cut) + block + '\n  ' + html.slice(idx);
}

const CARD3_CSS = `figure{margin:12px 0 6px;padding:10px 10px 4px;background:var(--stage);border-radius:10px}
figure svg{display:block;width:100%;height:auto}
figcaption{margin:6px 2px 2px;font-size:11.5px;color:var(--sub);text-align:center}
.card3{display:grid;grid-template-columns:1fr;gap:8px;margin:4px 0 16px}
@media (min-width:480px){.card3{grid-template-columns:repeat(3,1fr)}}
.card3 div{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:9px 12px;font-size:12.5px;color:var(--ink)}
.card3 b{display:block;color:var(--deep);font-size:11px;font-weight:700;margin-bottom:3px}
`;

const TRYIT_CSS = `.note.tryit{background:none;border-left:none;padding:0;margin:2px 0 18px;font-size:12.5px}
.note.tryit a{color:var(--deep);font-weight:600;text-decoration:none;border-bottom:1px solid var(--gold)}
.note.tryit a:hover{color:var(--red)}
`;

function ensureCss(html) {
  if (!html.includes('.card3{')) html = html.replace('</style>', CARD3_CSS + '</style>');
  if (!html.includes('.note.tryit{')) html = html.replace('</style>', TRYIT_CSS + '</style>');
  return html;
}

function main() {
  const res = computeEngine('500F');
  let html = fs.readFileSync(HTML_PATH, 'utf8');
  html = ensureCss(html);

  const summary = [];

  // 節0：連鎖図（<div class="bars"> の直前）
  const figS0 = buildFigS0();
  const blockS0 = `<figure id="fig-s0">\n    ${figS0.svg}\n    <figcaption>500F・エンジン純正・125R12・8/41・4速（0.875）を基準にした連鎖。タイヤ1回転→ファイナル通過後→エンジン1回転で進む距離。</figcaption>\n  </figure>`;
  html = stripAndInsertBefore(html, '<div class="bars">', blockS0);
  summary.push(`s0: 連鎖図（タイヤ${figS0.circumference.toFixed(2)}m→ファイナル後${figS0.afterFinal.toFixed(2)}m→エンジン1回転${figS0.perEngineRev.toFixed(2)}m）`);

  // 節2〜8：ノコギリ線＋3行カード（各 h2 の直後）
  for (const cfg of SECTIONS) {
    const nums = buildSectionFig(res, cfg);
    const cardHtml = buildCardHtml(cfg, nums);
    const block = `<figure id="fig-${cfg.id}">\n    ${nums.svg}\n    <figcaption>${cfg.figcaption}</figcaption>\n  </figure>\n  ${cardHtml}`;
    const anchorMatch = html.match(new RegExp(`<h2 id="${cfg.id}">[^<]*<\\/h2>`));
    if (!anchorMatch) throw new Error('h2 anchor not found for ' + cfg.id);
    html = stripAndInsertAfter(html, anchorMatch[0], block);
    summary.push(`${cfg.id}: いま${nums.rpmNow} → 変えた後${nums.rpmChanged}rpm${nums.rpmSub ? `（添え${nums.rpmSub}）` : ''}`);
  }

  // 節3b：片持ち構造の模式断面（<h3>故障の型…</h3> の直前）
  const figS3b = buildFigS3b();
  const blockS3b = `<figure id="fig-s3b">\n    ${figS3b.svg}\n    <figcaption>5速化キットの片持ち構造（模式図）。4速までの軸はケース内で両側支持だが、5速のギア対は後部カバー側へケース壁1点だけで片持ちに支えられる。</figcaption>\n  </figure>`;
  html = stripAndInsertBefore(html, '<h3>故障の型（構造の帰結として）</h3>', blockS3b);
  summary.push('s3b: 片持ち構造の模式断面');

  fs.writeFileSync(HTML_PATH, html);
  console.log(summary.join('\n'));
}

main();
