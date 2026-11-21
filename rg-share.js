// サイトをシェア（500・126 のトップ共通・2026-11-21）＝まずトップの QR を出す（目の前の人に読み取ってもらう場面）
// → その下に「LINE・SNSで送る」（共有シートがある端末だけ）・「URLをコピー」・「閉じる」。312 の header.js（R312qr）と同じ形。
// QR はページの中で描く（外部の作成サービスへ URL を送らない・2026-11-05）。ライブラリは押したときだけ読む（detail.html の QR と同じもの）
// 使い方：RG.shareSite({ title, text, url })
(function () {
  window.RG = window.RG || {};
  var LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  var lib = null;
  function load() {
    return lib || (lib = new Promise(function (ok, ng) {
      var s = document.createElement('script');
      s.src = LIB;
      s.integrity = 'sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k'; s.crossOrigin = 'anonymous';
      s.onload = function () { ok(window.qrcode); };
      s.onerror = function () { lib = null; ng(new Error('qr')); };
      document.head.appendChild(s);
    }));
  }
  var CSS = '.rgs-dlg{border:0;border-radius:14px;padding:22px 20px 18px;max-width:calc(100vw - 32px);text-align:center;background:#fff;color:#222;box-shadow:0 20px 50px rgba(0,0,0,.3)}'
    + '.rgs-dlg::backdrop{background:rgba(15,23,42,.6)}'
    + '.rgs-title{margin:0 0 12px;font-weight:700;font-size:1.05rem}'
    + '.rgs-box{width:220px;height:220px;margin:0 auto 8px;display:grid;place-items:center;background:#fff;font-size:.85rem}'
    + '.rgs-box svg{width:100%;height:100%}'
    + '.rgs-note{margin:0 0 14px;font-size:.85rem;color:#666}'
    + '.rgs-acts{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:0 0 12px}'
    + '.rgs-btn{font:inherit;font-size:.9rem;font-weight:700;padding:10px 16px;border-radius:999px;border:0;background:#222;color:#fff;cursor:pointer}'
    + '.rgs-close{background:none;color:#555;border:1px solid #ccc;font-weight:400}';
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
  function btn(cls, label, fn) { var b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function copy(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (ok, ng) {
      var ta = document.createElement('textarea'); ta.value = t; ta.readOnly = true; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? ok() : ng(new Error('copy')); } catch (er) { ng(er); } finally { ta.remove(); }
    });
  }
  function track(via) { if (window.gtag) window.gtag('event', 'site_share', { via: via }); }
  RG.shareSite = function (data) {
    if (!document.getElementById('rgs-css')) { var st = el('style'); st.id = 'rgs-css'; st.textContent = CSS; document.head.appendChild(st); }
    track('open');
    var dlg = el('dialog', 'rgs-dlg'); dlg.setAttribute('aria-label', 'サイトのトップのQRコード');
    var box = el('div', 'rgs-box', '読み込んでいます…');
    var acts = el('div', 'rgs-acts');
    if (navigator.share) acts.appendChild(btn('rgs-btn', 'LINE・SNSで送る', function () { track('sheet'); navigator.share(data).catch(function () {}); }));
    acts.appendChild(btn('rgs-btn', 'URLをコピー', function (e) {
      var b = e.currentTarget, was = b.dataset.was || (b.dataset.was = b.textContent);
      copy(data.url).then(function () { track('copy'); return '✓ コピーしました'; }, function () { return 'コピーできませんでした'; }).then(function (t) {
        b.textContent = t; clearTimeout(b._t); b._t = setTimeout(function () { b.textContent = was; }, 2000);
      });
    }));
    dlg.append(el('p', 'rgs-title', 'サイトのトップ'), box, el('p', 'rgs-note', 'カメラで読み取ってください'), acts,
      btn('rgs-btn rgs-close', '閉じる', function () { dlg.close(); }));
    dlg.addEventListener('close', function () { dlg.remove(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });  // 外側を押しても閉じる
    document.body.appendChild(dlg); dlg.showModal();
    load().then(function (qrcode) {
      var qr = qrcode(0, 'M'); qr.addData(data.url); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });  // ライブラリが作る SVG（URL の文字は入らない）
    }).catch(function () { box.textContent = 'QRコードを表示できませんでした。時間をおいてもう一度押してください。'; });
  };
})();
