// 給油の記録の燃費と表示 — /my-fuel と車両ページ（detail.html）で共有する
// 燃費は保存しない＝表示のたびに満タン法で数える（満タン〜次の満タンの距離 ÷ その間に入れた量の合計。継ぎ足しも合計に入れる）
(function () {
  const FUEL_LABEL = { regular: 'レギュラー', premium: 'ハイオク', diesel: '軽油' };
  const SUSPECT_KMPL = 30;   // これを超える区間は記録漏れか継ぎ足しの付け忘れ＝平均から外す（実物で 146km/L が出た）
  const ODO_WRAP = 100000;   // メーターは5桁＝10万kmで一周する
  const WRAP_SLACK = 1500;   // 一周とみなす差の上限

  // 前回→今回の距離。一周したときは足し戻す（差がマイナスで、一周ぶん足すと妥当な距離になるとき）
  function diffKm(prev, cur) {
    let d = cur - prev;
    if (d < 0 && d + ODO_WRAP <= WRAP_SLACK) d += ODO_WRAP;
    return d;
  }
  function byDate(a, b) {
    if (a.fill_date !== b.fill_date) return a.fill_date < b.fill_date ? -1 : 1;
    return a.odometer_km - b.odometer_km;
  }
  // rows: { id, fill_date, odometer_km, liters, full_tank } の配列
  // 返す: { byId: { id: { km, liters, kmpl, suspect } }, avg（km/L・数えられる区間が無ければ null）, sections }
  function economy(rows) {
    const s = rows.slice().sort(byDate);
    const byId = {};
    let lastFull = null, sumL = 0, totKm = 0, totL = 0, sections = 0;
    for (const r of s) {
      if (lastFull) sumL += Number(r.liters);
      if (!r.full_tank) continue;
      if (lastFull) {
        const km = diffKm(lastFull.odometer_km, r.odometer_km);
        if (km > 0 && sumL > 0) {
          const kmpl = km / sumL;
          const suspect = kmpl > SUSPECT_KMPL;
          byId[r.id] = { km, liters: sumL, kmpl, suspect };
          if (!suspect) { totKm += km; totL += sumL; sections++; }
        }
      }
      lastFull = r; sumL = 0;
    }
    return { byId, avg: totL > 0 ? totKm / totL : null, sections };
  }

  function fmtDate(s) { const [y, m, d] = s.split('-'); return y + '年' + Number(m) + '月' + Number(d) + '日'; }
  function fmtKm(n) { return Number(n).toLocaleString('ja-JP') + 'km'; }
  function fmtL(n) { return Number(n).toFixed(2).replace(/\.?0+$/, '') + 'L'; }
  function fmtKmpl(n) { return n.toFixed(1) + 'km/L'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // 1件ぶんの文字（日付以外）。e は economy().byId の値
  function lineParts(r, e) {
    const parts = [fmtKm(r.odometer_km), fmtL(r.liters) + (r.fuel ? '（' + FUEL_LABEL[r.fuel] + '）' : '')];
    if (!r.full_tank) parts.push('継ぎ足し');
    if (e) parts.push(e.suspect ? '燃費 ―（記録漏れかも）' : '燃費 ' + fmtKmpl(e.kmpl) + '（' + fmtKm(e.km) + '）');
    return parts;
  }

  // fuel_public_rows() の結果（区間の距離・量は非公開の行も含めて DB が数えたもの）を economy() と同じ形にする
  function economyFromSections(rows) {
    const byId = {};
    let totKm = 0, totL = 0, sections = 0;
    for (const r of rows) {
      if (r.sec_km == null || !(Number(r.sec_liters) > 0)) continue;
      const km = r.sec_km, liters = Number(r.sec_liters), kmpl = km / liters, suspect = kmpl > SUSPECT_KMPL;
      byId[r.id] = { km, liters, kmpl, suspect };
      if (!suspect) { totKm += km; totL += liters; sections++; }
    }
    return { byId, avg: totL > 0 ? totKm / totL : null, sections };
  }

  // 車両ページの「給油の記録」欄。最新1件だけ見せ、残りは畳む（2026-11-04 ユーザー指示）
  // rows は fuel_public_rows() の結果＝公開の行だけ。燃費は非公開の行も含めて数えてある
  function renderCarSection(host, rows) {
    const eco = economyFromSections(rows);
    const s = rows.slice().sort(byDate).reverse();
    const row = r => `<div class="fv-row"><span class="fv-dt">${esc(fmtDate(r.fill_date))}</span><span class="fv-bd">${lineParts(r, eco.byId[r.id]).map(esc).join('　')}</span></div>`;
    let html = '';
    if (eco.avg != null) html += `<p class="fv-avg">平均燃費 <strong>${esc(fmtKmpl(eco.avg))}</strong><small>（満タン法・${eco.sections}区間）</small></p>`;
    html += row(s[0]);
    if (s.length > 1) {
      html += `<details class="fv-fold"><summary><span class="fv-open">これまでの給油（ほか${s.length - 1}件）▾</span><span class="fv-close">閉じる ▴</span></summary>${s.slice(1).map(row).join('')}</details>`;
    }
    host.innerHTML = html;
  }

  window.FuelView = { FUEL_LABEL, economy, economyFromSections, diffKm, lineParts, renderCarSection, fmtDate, fmtKm, fmtL, fmtKmpl };
})();
