/* 旅ページの検算とスナップショットをブラウザ無しで走らせる（読み取り専用）
 *
 *   node check_journeys.js              … 全旅ページの検算を実行して ✓/✗ を出す
 *   node check_journeys.js --snapshot   … 各場面の SVG を .snapshots/ へ書き出す
 *   node check_journeys.js --diff       … 前回のスナップショットと突き合わせる（回帰検証）
 *   node check_journeys.js --dots       … 【通電しているのに黄点が1つも出ない線】を洗い出す
 *   node check_journeys.js --terms      … 【廃止語・混入禁止語】が公開ファイルに残っていないか数える
 *
 * ⚠️なぜ要るか（HANDOFF §0 その3・その4の教訓）：
 *   共通ランタイム（wiring-journey.js）や wiring-sim.js・wiring-net.json を触ると、
 *   既に確定済みの旅の絵が【黙って】変わる。過去に実際にラベルが1行落ちたのを
 *   この方式の使い捨てスクリプトで検出した。使い捨てにせず置いておく。
 * ⚠️ただし数値の検算では図の不具合は出ない＝図は必ず目で見ること（第3号の教訓）。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const REPO = path.join(__dirname, '..');

/* ---- --dots ＝【通電しているのに黄点が1つも出ない線】を探す ----
 * なぜ要るか（その111 の教訓）：seg() の黄点は線の両端に 6px と 26px の余白を取るので、
 * 【31px 以下の線には黄点が1つも打てない】。第8回のハイビーム表示灯のアースが 13px しかなく、
 * 「点いているのに電気が流れていない」ようにユーザーの目に映った。
 * ⭐数え方は【線ID単位】＝同じ線の他の区間に黄点があれば流れは読めるので咎めない。
 * ⚠️本番の wiring-journey.js には計測を入れない＝ここで読み込む文字列だけを加工する。 */
const DOTS = process.argv.indexOf('--dots') >= 0;
function instrument(src) {
  /* ⚠️下の目印は LF で書いてある＝共通JSが CRLF で保存されていると1件も当たらず、
     検査は「差し込めない」で落ちる。改行だけ先に揃える（⛔ファイルへは書き戻さない）。 */
  src = src.replace(/\r\n/g, '\n');
  const jobs = [[`      var dir = this.flow(id, x1, y1, y2);
      if (dir === 'down')`, `      var dir = this.flow(id, x1, y1, y2);
      if (dir) { var G=(globalThis.__G=globalThis.__G||{f:{},d:{}}); G.f[id]=1; if (Math.abs(y2-y1) >= HEAD+TAIL) G.d[id]=1; }
      if (dir === 'down')`],
                [`    if (c.live && this.flow(id, x1, y, y) && Math.abs(x2 - x1) >= HEAD + TAIL) {`, `    if (c.live && this.flow(id, x1, y, y)) { var G=(globalThis.__G=globalThis.__G||{f:{},d:{}}); G.f[id]=1; if (Math.abs(x2-x1) >= HEAD+TAIL) G.d[id]=1; }
    if (c.live && this.flow(id, x1, y, y) && Math.abs(x2 - x1) >= HEAD + TAIL) {`],
                [`    if (!this.flow(id, pts[0][0], pts[0][1], pts[pts.length - 1][1])) return;`, `    if (!this.flow(id, pts[0][0], pts[0][1], pts[pts.length - 1][1])) return;
    { var G=(globalThis.__G=globalThis.__G||{f:{},d:{}}); G.f[id]=1; for (var q=0;q<pts.length-1;q++){ var qa=pts[q], qb=pts[q+1];
      if ((qa[0]===qb[0] && Math.abs(qa[1]-qb[1])>=HEAD+TAIL) || (qa[1]===qb[1] && Math.abs(qa[0]-qb[0])>=HEAD+TAIL)) G.d[id]=1; } }`]];
  for (const j of jobs) {
    /* ⚠️置換に失敗したら黙って検査が効かなくなる＝必ず落とす */
    if (src.split(j[0]).length - 1 !== 1) throw new Error('--dots の計測を差し込めない（wiring-journey.js の書き方が変わった）');
    src = src.replace(j[0], j[1]);
  }
  return src;
}
const SNAPDIR = path.join(__dirname, '.snapshots');

/* 旅ページの一覧＝HTMLとその旅のJS。増えたらここに足す */
const PAGES = [
  { id: 'charge',     html: 'wiring-journey-charge.html',     js: 'wiring-journey-charge.js' },
  { id: 'charge-alt', html: 'wiring-journey-charge-alt.html', js: 'wiring-journey-charge.js' },
  { id: 'oil',        html: 'wiring-journey-oil.html',        js: 'wiring-journey-oil.js' },
  { id: 'starter',    html: 'wiring-journey-starter.html',    js: 'wiring-journey-starter.js' },
  { id: 'key',        html: 'wiring-journey-key.html',        js: 'wiring-journey-key.js' },
  { id: 'ground',     html: 'wiring-journey-ground.html',     js: 'wiring-journey-ground.js' },
  { id: 'ignition',   html: 'wiring-journey-ignition.html',   js: 'wiring-journey-ignition.js' },
  { id: 'horn',       html: 'wiring-journey-horn.html',       js: 'wiring-journey-horn.js' },
  { id: 'room',       html: 'wiring-journey-room.html',       js: 'wiring-journey-room.js' },
  { id: 'brake',      html: 'wiring-journey-brake.html',      js: 'wiring-journey-brake.js' },
  { id: 'headlight',  html: 'wiring-journey-headlight.html',  js: 'wiring-journey-headlight.js' },
  { id: 'tail',       html: 'wiring-journey-tail.html',       js: 'wiring-journey-tail.js' },
  { id: 'turn',       html: 'wiring-journey-turn.html',       js: 'wiring-journey-turn.js' },
  { id: 'wiper',      html: 'wiring-journey-wiper.html',      js: 'wiring-journey-wiper.js' }
];

/* ---- ごく小さな DOM の代わり ---- */
function makeEl(id) {
  return {
    id: id, innerHTML: '', textContent: '', className: '', _attrs: {}, children: [],
    setAttribute: function (k, v) { this._attrs[k] = v; },
    getAttribute: function (k) { return this._attrs[k]; },
    appendChild: function (c) { this.children.push(c); },
    addEventListener: function (t, f) { this._on = f; },
    /* 段ずれ補正（setMain の anchor）がここを叩く＝無いとクリック処理が途中で落ちる */
    getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; }
  };
}

function runPage(page) {
  const htmlPath = path.join(REPO, page.html);
  if (!fs.existsSync(htmlPath)) return Promise.resolve({ id: page.id, missing: true });
  const html = fs.readFileSync(htmlPath, 'utf8');
  /* トグルのボタンは HTML 側が持っている＝そこから data-v を拾う（決め打ちしない）。
     ⚠️⚠️属性の【並び順】を決め打ちにしない＝第8回で data-axis を先に書いた瞬間、
       旧 /<button\s+data-v="…"/ は1つも拾えなくなった（その46-4 と同じ空回りの穴）。
       だから button タグを丸ごと拾ってから属性を取り出す。 */
  const toggles = [];
  html.replace(/<button([^>]*)>/g, function (_, attrs) {
    const v = /data-v="([^"]+)"/.exec(attrs);
    if (!v) return _;
    const ax = /data-axis="([^"]+)"/.exec(attrs);
    toggles.push({ v: v[1], axis: ax ? ax[1] : null });
    return _;
  });

  const els = {};
  const doc = {
    getElementById: function (id) { return (els[id] = els[id] || makeEl(id)); },
    querySelectorAll: function (sel) {
      if (sel === '.toggle button' || sel === '#tg button') {
        els._btns = els._btns || toggles.map(function (t) {
          const b = makeEl('btn:' + t.v);
          b._attrs['data-v'] = t.v;
          if (t.axis) b._attrs['data-axis'] = t.axis;
          return b;
        });
        return els._btns;
      }
      return [];
    },
    createElement: function () { return makeEl('tr'); }
  };
  const ctx = { document: doc, console: console, scrollBy: function () {} };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  /* HTML 側がスクリプト読み込み前に立てるフラグを再現する（オルタ版の JOURNEY_ALT など）。
     ⚠️決め打ちせず HTML から拾う＝ページが増えても書き換えずに済む */
  html.replace(/window\.([A-Z_]+)\s*=\s*(true|false)/g, function (_, k, v) { ctx[k] = (v === 'true'); return _; });
  ctx.fetch = function (url) {
    const p = path.join(REPO, url.replace(/^\//, ''));
    const txt = fs.readFileSync(p, 'utf8');
    return Promise.resolve({ json: function () { return Promise.resolve(JSON.parse(txt)); },
                             text: function () { return Promise.resolve(txt); } });
  };
  ctx.Promise = Promise;
  vm.createContext(ctx);
  for (const f of ['wiring-sim.js', 'wiring-journey.js', page.js]) {
    let src = fs.readFileSync(path.join(REPO, f), 'utf8');
    if (DOTS && f === 'wiring-journey.js') src = instrument(src);
    vm.runInContext(src, ctx, { filename: f });
  }

  /* boot() の中の fetch チェーンが解けるまで待つ（layout → carMap が最後） */
  return new Promise(function (res) { setTimeout(res, 0); }).then(function () {
    return new Promise(function (res) { setTimeout(res, 0); });
  }).then(function () {
    /* 検算行を読む */
    const rows = (els.checks ? els.checks.children : []).map(function (tr) {
      const cells = tr.innerHTML.split(/<\/td>/).map(function (c) { return c.replace(/<[^>]*>/g, '').trim(); });
      return { label: cells[0], got: cells[1], want: cells[2], ok: tr.innerHTML.indexOf('check-ng') < 0 };
    });
    /* スナップショット＝場面ごとの SVG。トグルは全ての値で1枚ずつ取る。
       ⭐2軸の旅（data-axis 付き）は、押すと【他の軸の選択が残る】＝キーは押した値ではなく
         その時点の全軸の状態にする。単軸の旅のキーは従来どおり値そのもの（差分が出ない）。 */
    const snap = {}, axState = {};
    (els._btns || []).forEach(function (b) {
      const v = b._attrs['data-v'], ax = b._attrs['data-axis'];
      if (ax) axState[ax] = v;
      const key = ax ? Object.keys(axState).sort().map(function (k) { return k + '=' + axState[k]; }).join(',') : v;
      if (b._on) { b._on.call(b); snap['j-main@' + key] = els['j-main'] ? els['j-main'].innerHTML : ''; }
      snap['cap@' + key] = els.mainCap ? els.mainCap.innerHTML : '';
    });
    Object.keys(els).forEach(function (k) {
      if (k.indexOf('j-') === 0 && !snap['j-main@' + k]) snap[k] = els[k].innerHTML;
      if (k === 'carmap') snap[k] = els[k].innerHTML + '|vb=' + els[k]._attrs.viewBox;
    });
    snap['_checks'] = rows.map(function (r) { return r.label + '=' + r.got; }).join('\n');
    if (DOTS) {
      const G = ctx.__G || { f: {}, d: {} };
      const gaps = Object.keys(G.f).filter(function (k) { return !G.d[k]; });
      console.log(gaps.length ? '  ⚠️黄点が1つも出ない通電線 [' + page.id + '] ' + gaps.join(', ')
                              : '  ・黄点の抜けなし [' + page.id + ']');
    }
    return { id: page.id, rows: rows, snap: snap };
  });
}

/* ---- --terms ＝【廃止語・混入禁止語】が公開ファイルに残っていないか数える ----
 * なぜ要るか（2026-09-02〜03 の教訓）：一斉訂正のたび、本文は直したのに
 * 【見出し／図の中の文字（JSの label）／JS・HTMLのコメント／journey-schedule.json の desc】
 * が旧説のまま公開される事故が3回続いた。「本文と別に数える」を人ではなくここに数えさせる。
 * ⭐対象は【ブラウザが読むファイル】＝HTML だけでなく JS も JSON も含む（*.json は fetch される＝公開物）。
 * ⛔語の追加は ref/forbidden-terms.json 側で行う＝このコードは触らない。 */
function runTerms() {
  const def = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref', 'forbidden-terms.json'), 'utf8'));
  /* targets はごく簡易な glob（* だけ）。REPO 直下のみを見る＝旅ページはすべてここに在る */
  const files = fs.readdirSync(REPO).filter(function (f) {
    return def.targets.some(function (g) {
      return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(f);
    });
  }).sort();
  if (!files.length) { console.log('⚠️対象ファイルが1つも無い（targets の書き方が repo と合っていない）'); return true; }

  /* ⭐⭐まず自己テスト＝各ルールが【違反文字列を捕まえ、紛らわしい正しい文字列は捕まえない】ことを確かめる。
   * 💡なぜ要るか：『ゼロ件』には【違反が無いからゼロ】と【ルールが壊れていてゼロ】の2種があり、
   *   出力を見ただけでは区別できない。⛔対照を書かずにゼロを信じない。 */
  let broken = 0;
  for (const r of def.rules) {
    (r.probe || []).forEach(function (p) {
      if (!new RegExp(r.re).test(p)) { console.log('✗ 自己テスト失敗 [' + r.id + '] 捕まえられない: ' + p); broken++; }
    });
    (r.notProbe || []).forEach(function (p) {
      if (new RegExp(r.re).test(p)) { console.log('✗ 自己テスト失敗 [' + r.id + '] 誤検出: ' + p); broken++; }
    });
    if (!(r.probe || []).length) { console.log('✗ 自己テスト失敗 [' + r.id + '] probe が書かれていない'); broken++; }
  }
  if (broken) { console.log('\n⚠️ルールが壊れている（' + broken + '件）＝本検査に進まない。ref/forbidden-terms.json を直すこと'); return true; }
  console.log('✓ 自己テスト合格（' + def.rules.length + 'ルール）\n');

  let total = 0;
  for (const rule of def.rules) {
    const hits = [];
    for (const f of files) {
      if ((rule.allow || []).indexOf(f) >= 0) continue;
      const lines = fs.readFileSync(path.join(REPO, f), 'utf8').replace(/\r\n/g, '\n').split('\n');
      lines.forEach(function (line, i) {
        /* ⚠️⚠️1行に複数あれば全部数える＝ wiring-net.json の note は1行が2000字近く、
           そこに同じ廃止語が2つ入っていた。最初の1件だけ直すと残りが黙って生き残る。 */
        const re = new RegExp(rule.re, 'g');
        let m;
        while ((m = re.exec(line)) !== null) {
          hits.push({ f: f, n: i + 1, ctx: line.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).trim() });
          if (m.index === re.lastIndex) re.lastIndex++;  /* 空マッチでの無限ループ避け */
        }
      });
    }
    total += hits.length;
    console.log((hits.length ? '✗ ' : '✓ ') + rule.id + ' 〈' + rule.re + '〉 … ' + (hits.length ? hits.length + '件' : '残存なし'));
    if (hits.length) {
      console.log('    → ' + rule.why);
      console.log('    → 正しくは: ' + rule.fix);
      hits.forEach(function (h) { console.log('    ' + h.f + ':' + h.n + '  …' + h.ctx + '…'); });
    }
  }
  console.log('\n' + def.rules.length + 'ルール × ' + files.length + 'ファイル ／ 違反 ' + total + '件');
  if (!total) console.log('→ 廃止語の残存はゼロ');
  return total > 0;
}

const mode = process.argv[2] || '';
if (mode === '--terms') process.exit(runTerms() ? 1 : 0);

(async function () {
  let fail = 0, n = 0;
  const all = {};
  for (const p of PAGES) {
    const r = await runPage(p);
    if (r.missing) { console.log('— ' + p.id + ': （未実装）'); continue; }
    all[r.id] = r.snap;
    const ng = r.rows.filter(function (x) { return !x.ok; });
    n += r.rows.length; fail += ng.length;
    console.log((ng.length ? '✗' : '✓') + ' ' + p.id + ' … 検算 ' + r.rows.length + '件' + (ng.length ? '／✗ ' + ng.length + '件' : ' すべて一致'));
    ng.forEach(function (x) { console.log('    ✗ ' + x.label + ' → 実際:' + x.got + ' / 期待:' + x.want); });
  }
  console.log('\n合計 ' + n + '件 ／ 不一致 ' + fail + '件');

  if (mode === '--snapshot') {
    fs.mkdirSync(SNAPDIR, { recursive: true });
    fs.writeFileSync(path.join(SNAPDIR, 'journeys.json'), JSON.stringify(all, null, 1));
    console.log('スナップショットを書き出した: ' + path.join(SNAPDIR, 'journeys.json'));
  } else if (mode === '--diff') {
    const f = path.join(SNAPDIR, 'journeys.json');
    if (!fs.existsSync(f)) { console.log('⚠️比較対象が無い。先に --snapshot で取る'); process.exit(1); }
    const before = JSON.parse(fs.readFileSync(f, 'utf8'));
    let d = 0, same = 0;
    for (const pid of Object.keys(all)) {
      const b = before[pid];
      if (!b) { console.log('＋ 新規: ' + pid); continue; }
      for (const k of Object.keys(all[pid])) {
        if (b[k] === undefined) { console.log('＋ 新規の場面: ' + pid + ' / ' + k); d++; continue; }
        if (b[k] !== all[pid][k]) { console.log('★ 変化: ' + pid + ' / ' + k + '（' + b[k].length + '→' + all[pid][k].length + '文字）'); d++; }
        else same++;
      }
    }
    console.log('\n一致 ' + same + '項目 ／ 変化 ' + d + '項目');
    if (d === 0) console.log('→ 既存の旅の絵は1文字も変わっていない');
  }
  process.exit(fail ? 1 : 0);
})();
