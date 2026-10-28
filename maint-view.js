// 整備手帳の記録1件を描く部品（車両ページの歩み・みんなの整備手帳で共用）
// 文字はすべて textContent で入れる（記録はオーナーが書いた文章のため）
(function () {
  const AREAS = [
    ['engine', '⚙️ エンジン'], ['fuel', '🔥 燃料・点火'], ['driveline', '🔗 駆動系'], ['suspension', '🛞 足回り・操舵'],
    ['brake', '🛑 ブレーキ'], ['electric', '⚡ 電装'], ['consumable', '🛢 オイル・消耗品'], ['body', '🚗 ボディ・その他']
  ];
  const AREA_LABEL = Object.fromEntries(AREAS);
  const WORKER_LABEL = { diy: 'DIY', shop: 'SHOP' };

  const CSS = `
.mv-meta { font-size: .8rem; color: var(--mv-muted, #7a705f); }
.mv-row { display: flex; gap: 10px; align-items: flex-start; }
.mv-row .mv-thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; flex: none; }
.mv-title { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; color: var(--mv-accent, #1f5c3d); cursor: pointer; text-align: left; }
.mv-title:hover { text-decoration: underline; }
a.mv-title { text-decoration: none; }
.mv-mk { display: inline-block; margin-top: 4px; font-size: .8rem; color: var(--mv-accent, #1f5c3d); }
.mv-body { margin-top: 10px; }
.mv-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.mv-chip { font-size: .72rem; padding: 2px 8px; border-radius: 999px; background: var(--mv-soft, #e7efe7); color: var(--mv-text, inherit); }
.mv-comment { white-space: pre-wrap; word-break: break-word; margin: 0 0 12px; line-height: 1.75; }
.mv-videos { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.mv-yt { position: relative; display: block; width: 100%; max-width: 480px; aspect-ratio: 16 / 9; border: 0; padding: 0; border-radius: 8px; overflow: hidden; cursor: pointer; background: #000; }
.mv-yt img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mv-yt span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 2.4rem; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,.6); }
.mv-yt iframe { width: 100%; height: 100%; border: 0; display: block; }
.mv-ext { display: inline-block; font-size: .85rem; padding: 6px 12px; border: 1px solid var(--mv-accent, #1f5c3d); border-radius: 8px; color: var(--mv-accent, #1f5c3d); text-decoration: none; align-self: flex-start; }
.mv-photo { margin: 0 0 14px; }
.mv-photo img { display: block; max-width: 100%; max-height: 70vh; border-radius: 8px; }
.mv-photo figcaption { font-size: .88rem; margin-top: 6px; white-space: pre-wrap; word-break: break-word; line-height: 1.7; }
.mv-close { background: none; border: 0; padding: 0; font: inherit; font-size: .85rem; color: var(--mv-muted, #7a705f); cursor: pointer; }
`;
  let cssDone = false;
  function injectCss() {
    if (cssDone) return;
    cssDone = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtKm(n) { return Number(n).toLocaleString('ja-JP') + 'km'; }
  function fmtDate(s) { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return y + '年' + Number(m) + '月' + Number(d) + '日'; }
  function sortedPhotos(rec) { return (rec.maint_photos || []).slice().sort((a, b) => a.sort_order - b.sort_order); }

  function youtubeId(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^(www|m)\./, '');
      if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
      if (host !== 'youtube.com') return null;
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|live|embed)\/([A-Za-z0-9_-]{6,})/);
      return m ? m[2] : null;
    } catch (e) { return null; }
  }
  function videoKind(url) {
    if (youtubeId(url)) return 'youtube';
    try {
      const host = new URL(url).hostname.replace(/^(www|m)\./, '');
      if (host === 'instagram.com') return 'instagram';
      if (host === 'x.com' || host === 'twitter.com') return 'x';
    } catch (e) {}
    return null;
  }

  // 一覧の添え書き（例：25,888km ・ DIY ・ 写真3枚 ・ ▶ 動画）
  function metaText(rec) {
    const parts = [];
    if (rec.odometer_km != null) parts.push(fmtKm(rec.odometer_km));
    if (rec.worker) parts.push(WORKER_LABEL[rec.worker]);
    const n = (rec.maint_photos || []).length;
    if (n) parts.push('写真' + n + '枚');
    if ((rec.video_urls || []).length) parts.push('▶ 動画');    if (rec.is_public === false) parts.push('🔒 非公開');
    return parts.join(' ・ ');
  }

  function chips(rec) {
    const box = el('div', 'mv-chips');
    (rec.areas || []).forEach(a => { if (AREA_LABEL[a]) box.appendChild(el('span', 'mv-chip', AREA_LABEL[a])); });
    return box;
  }

  // 開いたときの中身＝コメント → 動画 → 写真とその説明
  function renderBody(rec) {
    injectCss();
    const body = el('div', 'mv-body');
    if (rec.comment) body.appendChild(el('p', 'mv-comment', rec.comment));
    const vids = (rec.video_urls || []).filter(videoKind);
    if (vids.length) {
      const vb = el('div', 'mv-videos');
      vids.forEach(url => {
        const kind = videoKind(url);
        if (kind === 'youtube') {
          // サムネイルは YouTube の公開画像を直接表示し、押したらその場で再生
          const id = youtubeId(url);
          const btn = el('button', 'mv-yt'); btn.type = 'button'; btn.setAttribute('aria-label', '動画を再生');
          const im = el('img'); im.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg'; im.alt = ''; im.loading = 'lazy';
          btn.append(im, el('span', null, '▶'));
          btn.addEventListener('click', () => {
            const f = document.createElement('iframe');
            f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
            f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            f.allowFullscreen = true;
            f.title = 'YouTube';
            const wrap = el('div', 'mv-yt'); wrap.appendChild(f);
            btn.replaceWith(wrap);
          }, { once: true });
          vb.appendChild(btn);
        } else {
          // Instagram・X は埋め込まず、外へ送るボタンだけ
          const a = el('a', 'mv-ext', kind === 'instagram' ? '▶ Instagramで見る ↗' : '▶ Xで見る ↗');
          a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
          vb.appendChild(a);
        }
      });
      body.appendChild(vb);
    }
    sortedPhotos(rec).forEach(p => {
      const fig = el('figure', 'mv-photo');
      const im = el('img'); im.src = p.url; im.alt = p.caption || ''; im.loading = 'lazy';
      fig.appendChild(im);
      if (p.caption) fig.appendChild(el('figcaption', null, p.caption));
      body.appendChild(fig);
    });
    return body;
  }

  // 一覧の1行（1枚目の写真＋タイトル＋添え書き）。タイトルを押すとその場で開閉する
  function renderItem(rec, opts) {
    injectCss();
    opts = opts || {};
    const wrap = el('div', 'mv-item');
    const row = el('div', 'mv-row');
    const ps = sortedPhotos(rec);
    if (ps.length) { const im = el('img', 'mv-thumb'); im.src = ps[0].thumb_url || ps[0].url; im.alt = ''; im.loading = 'lazy'; row.appendChild(im); }
    const txt = el('div');
    txt.style.minWidth = '0';
    if (opts.prefix) txt.appendChild(opts.prefix);
    const label = (opts.emoji ? opts.emoji + ' ' : '') + rec.title;
    const hasBody = !!(rec.comment || ps.length || (rec.video_urls || []).some(videoKind));
    // みんカラから載せた記事で、ここに書いた中身が無いものは題名そのものを記事へのリンクにする
    if (rec.minkara_url && !hasBody) {
      const a = el('a', 'mv-title', label + ' ↗');
      a.href = rec.minkara_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      if (opts.onOpen) a.addEventListener('click', () => opts.onOpen(rec));
      txt.appendChild(a);
      txt.appendChild(el('div', 'mv-meta', [metaText(rec), 'みんカラの記事'].filter(Boolean).join(' ・ ')));
      if ((rec.areas || []).length) txt.appendChild(chips(rec));
      row.appendChild(txt);
      wrap.appendChild(row);
      return wrap;
    }
    const t = el('button', 'mv-title', label); t.type = 'button';
    t.setAttribute('aria-expanded', 'false');
    txt.appendChild(t);
    const meta = metaText(rec);
    if (meta) txt.appendChild(el('div', 'mv-meta', meta));
    if ((rec.areas || []).length) txt.appendChild(chips(rec));
    if (rec.minkara_url) {
      const a = el('a', 'mv-mk', 'みんカラで読む ↗');
      a.href = rec.minkara_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      txt.appendChild(a);
    }
    row.appendChild(txt);
    wrap.appendChild(row);
    let body = null;
    t.addEventListener('click', () => {
      if (body) {
        body.remove(); body = null; t.setAttribute('aria-expanded', 'false');
        return;
      }
      body = renderBody(rec);
      const close = el('button', 'mv-close', '▲ 閉じる'); close.type = 'button';
      close.addEventListener('click', () => { t.click(); t.scrollIntoView({ block: 'nearest' }); });
      body.appendChild(close);
      wrap.appendChild(body);
      t.setAttribute('aria-expanded', 'true');
      if (opts.onOpen) opts.onOpen(rec);
    });
    return wrap;
  }

  window.MaintView = { AREAS, AREA_LABEL, WORKER_LABEL, fmtDate, fmtKm, metaText, renderBody, renderItem, youtubeId, videoKind };
})();
