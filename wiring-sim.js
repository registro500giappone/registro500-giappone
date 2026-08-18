/*! wiring-sim.js — FIAT 500 配線シミュレーター L1（通電ハイライト）エンジン
 *
 *  設計の正本: wiring-simulator/SCHEMA.md ／ 確定事項・不変条件: wiring-simulator/HANDOFF.md
 *  データ:     wiring-net.json（トポロジー）＋ wiring-terminals.json（図座標）
 *
 *  ⛔このファイルは物理演算をしない（HANDOFF §2-5「L4はやらない」）。
 *    やるのはグラフの到達性だけ＝電流も電圧降下も持たない。
 *
 *  中心の考え方は「エッジを2種類に分ける」こと：
 *    導体エッジ … 電線と、閉じている接点（スイッチ・ヒューズ・カットアウト・巻線）。抵抗ゼロ扱い
 *    負荷エッジ … ランプのフィラメント・モーター巻線。ここで電圧が落ちる
 *  B+ の到達は導体エッジだけで数える。これをしないと、点いているランプを通り抜けた
 *  先（実際は0V付近）まで「通電」になってしまう（SCHEMA §G の宿題）。
 */
(function (global) {
  'use strict';

  function nid(part, term) { return part + '.' + term; }
  function partOf(node) { return node.slice(0, node.indexOf('.')); }
  function inTypes(o, type) { return !o.types || o.types.indexOf(type) >= 0; }

  /* 部品の内部を、いまの位置における「導体ペア」と「負荷」に展開する。
     model.positions[位置] = 閉じている接点＝導体。
     負荷の持ち方は2通り: kind:"load"（pair 1組）と kind:"lamps"（lamps[] 複数）。 */
  function partEdges(part, pos) {
    var cond = [], load = [], m = part.model, i, L;
    if (!m) return { cond: cond, load: load };
    if (m.positions) {
      var pairs = m.positions[pos] || [];
      for (i = 0; i < pairs.length; i++) cond.push([nid(part.id, pairs[i][0]), nid(part.id, pairs[i][1])]);
    }
    if (m.kind === 'load' && m.pair) {
      load.push({ id: part.id, part: part.id, label: part.label,
                  a: nid(part.id, m.pair[0]), b: nid(part.id, m.pair[1]) });
    }
    if (m.kind === 'lamps' && m.lamps) {
      for (i = 0; i < m.lamps.length; i++) {
        L = m.lamps[i];
        load.push({ id: part.id + '.' + L.id, part: part.id, label: L.label || L.id,
                    a: nid(part.id, L.a), b: nid(part.id, L.b) });
      }
    }
    return { cond: cond, load: load };
  }

  /* 各部品の初期位置（model.default）。 */
  function defaultPositions(net, type) {
    var st = {}, i, p;
    for (i = 0; i < net.parts.length; i++) {
      p = net.parts[i];
      if (!inTypes(p, type)) continue;
      if (p.model && p.model.positions) st[p.id] = p.model.default || Object.keys(p.model.positions)[0];
    }
    return st;
  }

  /* 画面の操作（キー・エンジン・スタータ…）→ 部品位置。対応表は wiring-net.json の controls
     が持つ＝どのレバーがどの部品を動かすかはデータ側の話で、ここには書かない。 */
  function positionsFrom(net, inputs, type) {
    var st = defaultPositions(net, type), cs = net.controls || [], i, c, v, opt, k;
    for (i = 0; i < cs.length; i++) {
      c = cs[i];
      v = (inputs && inputs[c.id] !== undefined) ? inputs[c.id] : c.default;
      opt = null;
      for (var j = 0; j < c.options.length; j++) if (c.options[j].v === v) opt = c.options[j];
      if (!opt || !opt.set) continue;
      for (k in opt.set) if (st.hasOwnProperty(k)) st[k] = opt.set[k];
    }
    return st;
  }

  /* L1本体。返すのは端子ごとの状態・負荷の点灯・短絡の有無だけ。 */
  function solve(net, opt) {
    opt = opt || {};
    var type = opt.type || 'F';
    var pos = opt.positions || positionsFrom(net, opt.inputs, type);
    var parts = [], byId = {}, i, j, p;

    for (i = 0; i < net.parts.length; i++) if (inTypes(net.parts[i], type)) { parts.push(net.parts[i]); byId[net.parts[i].id] = net.parts[i]; }

    var nodes = [], adj = {};
    function add(n) { if (!adj[n]) { adj[n] = []; nodes.push(n); } }
    function link(a, b) { add(a); add(b); adj[a].push(b); adj[b].push(a); }

    for (i = 0; i < parts.length; i++) for (j = 0; j < parts[i].terms.length; j++) add(nid(parts[i].id, parts[i].terms[j]));

    var wires = [];
    for (i = 0; i < net.wires.length; i++) {
      var w = net.wires[i];
      if (!inTypes(w, type)) continue;
      if (!byId[partOf(w.a)] || !byId[partOf(w.b)]) continue; // 相手の部品がこの型式に無い線は張らない
      wires.push(w); link(w.a, w.b);
    }

    var loads = [];
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      var e = partEdges(p, pos[p.id]);
      for (j = 0; j < e.cond.length; j++) link(e.cond[j][0], e.cond[j][1]);
      for (j = 0; j < e.load.length; j++) loads.push(e.load[j]);
    }

    /* 導体エッジだけで連結成分に切る。同じ成分＝同じ電位。 */
    var comp = {}, nc = 0;
    for (i = 0; i < nodes.length; i++) {
      if (comp[nodes[i]] !== undefined) continue;
      var c = nc++, q = [nodes[i]];
      comp[nodes[i]] = c;
      while (q.length) {
        var x = q.pop(), nb = adj[x] || [];
        for (j = 0; j < nb.length; j++) if (comp[nb[j]] === undefined) { comp[nb[j]] = c; q.push(nb[j]); }
      }
    }

    /* 電源とアースはデータから見つける（battery の pos / kind:"ground" の端子）。 */
    var hotNode = null, gndNodes = [];
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (p.model && p.model.kind === 'battery') hotNode = nid(p.id, p.model.pos);
      if (p.kind === 'ground') for (j = 0; j < p.terms.length; j++) gndNodes.push(nid(p.id, p.terms[j]));
    }
    var hotC = hotNode ? comp[hotNode] : -1, gndC = {};
    for (i = 0; i < gndNodes.length; i++) gndC[comp[gndNodes[i]]] = 1;
    var shorted = hotC in gndC; // バッテリー＋がアースと導体だけで繋がった＝短絡（L2で使う）

    var state = {};
    for (i = 0; i < nodes.length; i++) state[nodes[i]] = (comp[nodes[i]] === hotC) ? 'hot' : (gndC[comp[nodes[i]]] ? 'gnd' : 'off');

    /* 負荷が働く＝片側がB+・反対側がアース。それ以外は電流が流れない。 */
    for (i = 0; i < loads.length; i++) {
      var ca = comp[loads[i].a], cb = comp[loads[i].b];
      loads[i].on = (ca === hotC && !!gndC[cb]) || (cb === hotC && !!gndC[ca]);
    }

    /* 「負荷の先」＝働いていない負荷を跨いだ向こう側。テスターを当てれば電圧は出るが
       電流は流せない場所。hot と同じ色で塗ると誤読するので段を分ける。 */
    var live = {}; live[hotC] = 1;
    var changed = true;
    while (changed) {
      changed = false;
      for (i = 0; i < loads.length; i++) {
        if (loads[i].on) continue; // 働いている負荷の先は電位が落ちている＝伝わらない
        var a = comp[loads[i].a], b = comp[loads[i].b];
        if (live[a] && !live[b]) { live[b] = 1; changed = true; }
        if (live[b] && !live[a]) { live[a] = 1; changed = true; }
      }
    }
    for (i = 0; i < nodes.length; i++) if (state[nodes[i]] === 'off' && live[comp[nodes[i]]]) state[nodes[i]] = 'post';

    /* 線の状態＝両端が同じならその色。またぐものは無い（線は導体なので必ず同じ成分）。 */
    var wireState = {};
    for (i = 0; i < wires.length; i++) wireState[wires[i].id] = state[wires[i].a];

    return { type: type, positions: pos, node: state, wire: wireState, loads: loads,
             comp: comp, nodes: nodes, wires: wires, shorted: shorted,
             count: (function () { var c = { hot: 0, gnd: 0, post: 0, off: 0 }, k;
                                   for (k in state) c[state[k]]++; return c; })() };
  }

  global.WiringSim = { solve: solve, positionsFrom: positionsFrom, defaultPositions: defaultPositions,
                       partEdges: partEdges, nid: nid, STATES: ['hot', 'post', 'gnd', 'off'] };
})(typeof window !== 'undefined' ? window : globalThis);
