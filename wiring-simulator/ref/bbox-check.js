/* 旅（ストーリー）ページの【図の文字の衝突】を数値で見つける検査（2026-08-24・第6号で常設化）
 *
 *   使い方：ローカルで `python -m http.server 8788` を立ててページを開き、
 *           devtools のコンソールか Playwright の evaluate にこのファイルの中身を貼る。
 *           返り値が 'OK: 衝突ゼロ' でなければ、出た項目を実測で潰してから次へ進む。
 *
 * ⚠️なぜ要るか（HANDOFF その11-3・その12・その16）：
 *   「破線がラベルを貫く」「札が枝ラベルに乗る」類は【スクリーンショットの目測では判断が付かない】。
 *   接しているのか重なっているのか分からないので、getBBox の実座標で機械的に列挙する。
 *   実際、第6号では目視で気付けなかった重なり 14.2×4.6 と はみ出し 5.2px がこれで出た。
 * ⚠️これは目視の代わりではない＝数値がゼロでも図は必ず目で見ること（第3号の教訓）。
 * ⚠️場面の切り替え（トグル）ごとに走らせる＝DOM に出ている svg しか見ていない。
 */
(() => {
  const report = [];
  document.querySelectorAll('svg').forEach((svg, i) => {
    if (!svg.viewBox || !svg.viewBox.baseVal || !svg.viewBox.baseVal.width) return;
    /* C1文字盤は移植元の実測値そのまま＝1文字ずつの字間が誤検出になるので除外する */
    if (svg.querySelector('#c1')) return;
    const holder = svg.closest('[id]');
    const id = holder ? holder.id : ('svg' + i);
    const vb = svg.viewBox.baseVal;
    const inv = svg.getScreenCTM().inverse();
    const out = [];
    svg.querySelectorAll('text').forEach(el => {
      const t = (el.textContent || '').trim();
      if (!t) return;
      let b; try { b = el.getBBox(); } catch (e) { return; }
      /* ⚠️掛け順に注意＝inv.multiply(el.getScreenCTM())。逆にすると座標が化ける */
      const m = inv.multiply(el.getScreenCTM());
      const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
        .map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }));
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      out.push({ t, x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) });
    });
    const issues = [];
    out.forEach(r => {
      if (r.x2 > vb.x + vb.width + 0.5 || r.x1 < vb.x - 0.5 || r.y2 > vb.y + vb.height + 0.5 || r.y1 < vb.y - 0.5)
        issues.push('はみ出し: "' + r.t + '" [' + r.x1.toFixed(1) + ',' + r.y1.toFixed(1) + ' - ' + r.x2.toFixed(1) + ',' + r.y2.toFixed(1) + ']');
    });
    for (let a = 0; a < out.length; a++) for (let b = a + 1; b < out.length; b++) {
      const p = out[a], q = out[b];
      const ox = Math.min(p.x2, q.x2) - Math.max(p.x1, q.x1);
      const oy = Math.min(p.y2, q.y2) - Math.max(p.y1, q.y1);
      if (ox > 0.5 && oy > 0.5) issues.push('重なり: "' + p.t + '" × "' + q.t + '" (' + ox.toFixed(1) + '×' + oy.toFixed(1) + ')');
    }
    if (issues.length) report.push('■ ' + id + '\n  ' + issues.join('\n  '));
  });
  return report.length ? report.join('\n') : 'OK: 衝突ゼロ';
})();
