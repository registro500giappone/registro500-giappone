// stats-map.js
// 都道府県別の台数を濃淡（コロプレス）で塗り分ける日本地図。
//
// 台数に応じて色の濃さを変えるので、登録の有無しか分からなかった2値塗りと違い
// 「どこに偏っているか」がひと目で分かる。
// 描画そのものしか持たず、クリックしたときに何をするかは呼び出し側が決める
// （統計ページは読むだけ、mappa はオーナー一覧を開く）。
//
// 必要なもの: d3, topojson-client, prefectures.json, stats-core.js の
// normalizePrefecture()。

// 段階は1台から倍々（1 / 2〜3 / 4〜7 / 8〜15 / 16〜）。
// 台数の分布は東京に大きく偏るので、等間隔で切ると上位以外が全部同じ色になる。
const MAP_BUCKETS = [
  { min: 1,  label: '1台' },
  { min: 2,  label: '2〜3台' },
  { min: 4,  label: '4〜7台' },
  { min: 8,  label: '8〜15台' },
  { min: 16, label: '16台〜' }
];

const MAP_SCALES = {
  '500': { light: ['#dbe9df', '#a9cbb6', '#74ac8c', '#427f5e', '#1f5c3d'],
           dark:  ['#33463b', '#3f6650', '#4f8a67', '#63ad7e', '#7fb894'] },
  // ダークの126は、0台の #403a30 と最も薄い段階が同系の茶で見分けられなかったので
  // 暖色寄りに振ってある
  '126': { light: ['#fbe6d8', '#f5c3a1', '#ee9a6c', '#e2703d', '#d4541a'],
           dark:  ['#5c3a24', '#7d4a2b', '#a05c33', '#c4703c', '#f97316'] }
};

function mapBucketIndex(n) {
  let idx = 0;
  MAP_BUCKETS.forEach((b, i) => { if (n >= b.min) idx = i; });
  return idx;
}

let _mapDataPromise = null;
function loadMapData(url) {
  if (!_mapDataPromise) _mapDataPromise = fetch(url || 'prefectures.json').then(r => r.json());
  return _mapDataPromise;
}

// opts:
//   container   描画先のセレクタ（中身は毎回作り直す）
//   counts      { '東京都': 34, ... }
//   carType     '500' | '126'（配色）
//   dark        true でダーク配色
//   legendEl    凡例を書き出す要素（省略可）
//   noteEl      「38都道府県に161台」の一文を書き出す要素（省略可）
//   onClick     (prefName, count, element) クリック時。省略すると押せない地図になる
function drawChoropleth(opts) {
  const counts = opts.counts || {};
  const palette = (MAP_SCALES[opts.carType] || MAP_SCALES['500'])[opts.dark ? 'dark' : 'light'];
  const emptyFill = opts.dark ? '#403a30' : '#faf6ec';

  return loadMapData(opts.mapUrl).then(mapData => {
    const wrap = d3.select(opts.container);
    wrap.select('svg').remove();
    const width = 800, height = 800;
    const svg = wrap.append('svg').attr('viewBox', `0 0 ${width} ${height}`);

    const objKey = mapData.objects.japan ? 'japan'
                 : (mapData.objects.prefectures ? 'prefectures' : Object.keys(mapData.objects)[0]);
    const all = topojson.feature(mapData, mapData.objects[objKey]).features;
    const isOkinawa = d => d.id == 47 || (d.properties && d.properties.id == 47);

    // viewBoxは800x800のまま。投影から外れる小笠原・南西諸島はSVGが自動で切る。
    // （描画物のbboxで詰めるとその離島まで含まれ、逆に本土が小さくなる）
    const main = d3.geoMercator().center([137.5, 38.3]).scale(2300).translate([width / 2, height / 2]);
    paintPrefectures(svg, all.filter(d => !isOkinawa(d)), d3.geoPath().projection(main), counts, palette, emptyFill, opts);

    const okinawa = all.filter(isOkinawa);
    if (okinawa.length) {
      const bx = 20, by = 20, bw = 160, bh = 120;
      const inset = d3.geoMercator().center([127.8, 26.5]).scale(6000).translate([bx + bw / 2, by + bh / 2]);
      svg.append('rect').attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh).attr('class', 'map-inset-box');
      paintPrefectures(svg, okinawa, d3.geoPath().projection(inset), counts, palette, emptyFill, opts);
    }

    const maxCount = Math.max(0, ...Object.values(counts));
    if (opts.legendEl) {
      // 実際に使う段階だけ出す（6台しかない126で「16台〜」を並べても意味がない）
      opts.legendEl.innerHTML =
        `<span><i style="background:${emptyFill}"></i>0台</span>` +
        MAP_BUCKETS.filter(b => b.min <= maxCount)
          .map((b, i) => `<span><i style="background:${palette[i]}"></i>${b.label}</span>`).join('');
    }
    if (opts.noteEl) {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      opts.noteEl.textContent = top
        ? `${Object.keys(counts).length}都道府県に${total}台。最も多いのは${top[0]}の${top[1]}台。`
        : '';
    }
    return svg;
  });
}

function paintPrefectures(svg, features, path, counts, palette, emptyFill, opts) {
  const nameOf = d => {
    const p = d.properties || {};
    return normalizePrefecture(p.nam_ja || p.name || p.nam || '') || null;
  };
  const fillOf = d => { const n = counts[nameOf(d)] || 0; return n ? palette[mapBucketIndex(n)] : emptyFill; };

  const shapes = svg.append('g').selectAll('path').data(features).enter().append('path')
    .attr('class', d => 'pref-shape' + (counts[nameOf(d)] ? ' has-cars' : ''))
    .attr('d', path)
    .attr('fill', fillOf);
  shapes.append('title').text(d => { const name = nameOf(d); return name ? `${name} ${counts[name] || 0}台` : ''; });

  if (opts.onClick) {
    shapes.on('click', function (event, d) {
      const name = nameOf(d);
      if (name && counts[name]) opts.onClick(name, counts[name], this);
    });
  }

  svg.append('g').selectAll('text').data(features).enter().append('text')
    .attr('class', 'pref-count')
    .attr('transform', d => {
      const c = path.centroid(d);
      if (isNaN(c[0])) return 'translate(-999,-999)';
      let x = c[0], y = c[1];
      const name = nameOf(d) || '';
      // 首都圏は県が小さく数字も大きいので、重ならない向きへ逃がす
      if (name.includes('東京')) { y -= 30; x -= 14; }
      if (name.includes('神奈川')) { y += 10; x -= 8; }
      if (name.includes('千葉')) { x += 8; }
      if (name.includes('埼玉')) { y -= 6; x -= 6; }
      if (name.includes('長崎')) x += 5;
      if (name.includes('鹿児島')) y -= 10;
      if (name.includes('兵庫')) y -= 5;
      return `translate(${x},${y})`;
    })
    // 薄い塗りの上では白抜き文字が読めないので、濃さに応じて文字色を反転させる。
    // ※ .pref-count に CSS で fill を書くと、この属性より優先されてしまうので書かないこと。
    .attr('fill', d => {
      const idx = mapBucketIndex(counts[nameOf(d)] || 0);
      if (opts.dark) return idx >= 3 ? '#1a1714' : '#ece6d9';
      return idx >= 2 ? '#fff' : '#2e2a24';
    })
    .attr('stroke', fillOf)
    .text(d => counts[nameOf(d)] || '');
}

// cars 配列から { 県名: 台数 } を作る。表記ゆれは normalizePrefecture が吸収する。
function countByPrefecture(cars, key) {
  const counts = {};
  cars.forEach(c => {
    const p = normalizePrefecture(c[key || 'Prefecture']);
    if (p) counts[p] = (counts[p] || 0) + 1;
  });
  return counts;
}
