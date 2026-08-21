/* L1 の「アース基準」案A の影響調査（読み取り専用・作業ツリーは変更しない）
 *
 * 現行 : kind:"ground" の端子を無条件にアースとみなす
 * 案A  : kind:"ground" の端子は「バッテリーの − 端子と導通していれば」アース
 *
 * 全型式 × 全 spec × 全コントロール組合せを総当たりし、状態・点灯・短絡を突き合わせる。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const REPO = path.join(__dirname, '..'); // wiring-simulator/ の1つ上＝repo直下

const SRC = fs.readFileSync(path.join(REPO, 'wiring-sim.js'), 'utf8');

/* --- 案A のパッチ（2箇所・最小差分） --- */
const OLD_FIND = `      if (p.model && p.model.kind === 'battery') hotNode = nid(p.id, p.model.pos);`;
const NEW_FIND = `      if (p.model && p.model.kind === 'battery') { hotNode = nid(p.id, p.model.pos); negNode = nid(p.id, p.model.neg); }`;
const OLD_DECL = `    var hotNode = null, gndNodes = [];`;
const NEW_DECL = `    var hotNode = null, negNode = null, gndNodes = [];`;
const OLD_GND = `    for (i = 0; i < gndNodes.length; i++) gndC[comp[gndNodes[i]]] = 1;`;
const NEW_GND = `    var negC = negNode ? comp[negNode] : -2;
    for (i = 0; i < gndNodes.length; i++) if (comp[gndNodes[i]] === negC) gndC[comp[gndNodes[i]]] = 1;`;

for (const s of [OLD_FIND, OLD_DECL, OLD_GND]) {
  if (SRC.indexOf(s) < 0) { console.error('パッチ位置が見つからない:', s.trim()); process.exit(1); }
}
const SRC_A = SRC.replace(OLD_FIND, NEW_FIND).replace(OLD_DECL, NEW_DECL).replace(OLD_GND, NEW_GND);

function load(src) {
  const ctx = { window: undefined };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.WiringSim;
}
const CUR = load(SRC);
const ALT = load(SRC_A);

const net = JSON.parse(fs.readFileSync(path.join(REPO, 'wiring-net.json'), 'utf8'));
const patchFile = JSON.parse(fs.readFileSync(path.join(REPO, 'wiring-patches.json'), 'utf8'));
const patches = patchFile.patches || [];

/* spec の候補＝パッチの when に出てくる値の全組合せ＋未申告 */
const specs = [{}];
for (const p of patches) {
  if (p.when) specs.push(Object.assign({}, p.when));
}

const TYPES = ['F', 'L', 'R', 'D'];
const controls = net.controls || [];

function* combos(idx, acc) {
  if (idx === controls.length) { yield Object.assign({}, acc); return; }
  for (const o of controls[idx].options) {
    acc[controls[idx].id] = o.v;
    yield* combos(idx + 1, acc);
  }
}

function fingerprint(r) {
  const st = Object.keys(r.node).sort().map(k => k + '=' + r.node[k]).join(',');
  const wi = Object.keys(r.wire).sort().map(k => k + '=' + r.wire[k]).join(',');
  const ld = r.loads.slice().sort((a, b) => a.id < b.id ? -1 : 1).map(l => l.id + ':' + (l.on ? 1 : 0)).join(',');
  return st + '|' + wi + '|' + ld + '|shorted=' + (r.shorted ? 1 : 0);
}

function run(SIM, netUsed, type, inputs) {
  return SIM.solve(netUsed, { type: type, inputs: inputs });
}

/* ---------- 1) 通常時（線は全部生きている）＝挙動が変わらないことの確認 ---------- */
let total = 0, diff = 0;
const diffs = [];
for (const type of TYPES) {
  for (let si = 0; si < specs.length; si++) {
    const spec = specs[si];
    const netP = CUR.applyPatches(net, patches, spec, type);
    const netP2 = ALT.applyPatches(net, patches, spec, type);
    for (const inputs of combos(0, {})) {
      total++;
      const a = fingerprint(run(CUR, netP, type, inputs));
      const b = fingerprint(run(ALT, netP2, type, inputs));
      if (a !== b) {
        diff++;
        if (diffs.length < 5) diffs.push({ type, spec, inputs });
      }
    }
  }
}
console.log('=== 1) 通常時の総当たり ===');
console.log('  ケース数:', total, '／ 差分:', diff);
if (diff) console.log('  差分例:', JSON.stringify(diffs, null, 2));

/* ---------- 2) バッテリー − 端子外れ（removeWire w11-10）＝ここは変わってほしい ---------- */
console.log('\n=== 2) バッテリー −端子外れ（removeWire w11-10）===');
const OPS = [{ op: 'removeWire', id: 'w11-10' }];
for (const type of ['F']) {
  const netP = CUR.applyPatchOps(CUR.applyPatches(net, patches, {}, type), OPS);
  const netP2 = ALT.applyPatchOps(ALT.applyPatches(net, patches, {}, type), OPS);
  /* セルが回る条件＝key ON + starter START */
  const inputs = { key: 'ON', engine: 'STOP', starter: 'START', reg_fail: 'OK', f1: 'OK' };
  const a = run(CUR, netP, type, inputs);
  const b = run(ALT, netP2, type, inputs);
  const on = r => r.loads.filter(l => l.on).map(l => l.id).join(', ') || '(なし)';
  console.log('  現行: 働いている負荷 =', on(a));
  console.log('  案A : 働いている負荷 =', on(b));
  /* 灯火も見る：key ON のみ */
  const i2 = { key: 'ON', engine: 'STOP', starter: 'OFF', reg_fail: 'OK', f1: 'OK' };
  console.log('  --- key ON のみ ---');
  console.log('  現行: 働いている負荷 =', on(run(CUR, netP, type, i2)));
  console.log('  案A : 働いている負荷 =', on(run(ALT, netP2, type, i2)));
}

/* ---------- 3) 参考：全ケースのうち w11-10 を外すと結果が変わる件数 ---------- */
let t2 = 0, d2 = 0;
for (const type of TYPES) {
  for (const spec of specs) {
    const netP = CUR.applyPatchOps(CUR.applyPatches(net, patches, spec, type), OPS);
    const netP2 = ALT.applyPatchOps(ALT.applyPatches(net, patches, spec, type), OPS);
    for (const inputs of combos(0, {})) {
      t2++;
      if (fingerprint(run(CUR, netP, type, inputs)) !== fingerprint(run(ALT, netP2, type, inputs))) d2++;
    }
  }
}
console.log('\n=== 3) −端子外れを注入した状態での総当たり ===');
console.log('  ケース数:', t2, '／ 現行と案Aで結果が違うケース:', d2);

/* ---------- 4) 全電線を1本ずつ外して総当たり＝差分が出るのは w11-10 だけか ---------- */
console.log('\n=== 4) 電線を1本ずつ外した総当たり（旅ページの故障注入を含む）===');
const rows = [];
for (const w of net.wires) {
  let t = 0, d = 0;
  const ops = [{ op: 'removeWire', id: w.id }];
  for (const type of TYPES) {
    for (const spec of specs) {
      let nA, nB;
      try {
        nA = CUR.applyPatchOps(CUR.applyPatches(net, patches, spec, type), ops);
        nB = ALT.applyPatchOps(ALT.applyPatches(net, patches, spec, type), ops);
      } catch (e) { continue; }
      for (const inputs of combos(0, {})) {
        t++;
        if (fingerprint(run(CUR, nA, type, inputs)) !== fingerprint(run(ALT, nB, type, inputs))) d++;
      }
    }
  }
  rows.push({ id: w.id, color: w.color || '', a: w.a, b: w.b, cases: t, diff: d });
}
const pad = (s, n) => String(s).padEnd(n, ' ');
console.log('  ' + pad('線ID', 10) + pad('色', 10) + pad('区間', 34) + pad('ケース', 8) + '差分');
for (const r of rows) {
  console.log('  ' + pad(r.id, 10) + pad(r.color, 10) + pad(r.a + ' ↔ ' + r.b, 34) + pad(r.cases, 8) + (r.diff ? '★' + r.diff : '0'));
}
const changed = rows.filter(r => r.diff > 0).map(r => r.id);
console.log('\n  → 差分が出た線:', changed.length ? changed.join(', ') : '(なし)');
console.log('  → 旅ページが実際に外す線 (w07-01 / w11-11 / w11-02 / w11-01) の差分:',
  rows.filter(r => ['w07-01', 'w11-11', 'w11-02', 'w11-01'].includes(r.id)).map(r => r.id + '=' + r.diff).join(' / '));
