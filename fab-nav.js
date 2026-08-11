/**
 * fab-nav.js — 画面下に浮かぶ移動ボタン2つ（左下「一つ前に戻る」／右下「先頭へ」）
 *
 * 背景:
 *   manifest.json が display:standalone のため、ホーム画面から起動するとブラウザの
 *   戻るボタンが消える。Android は端末のジェスチャーで戻れるが iPhone は手段が乏しい。
 *   さらに各ページの「← ガレージに戻る」は行き先が "/" 固定で「一つ前」には戻れず、
 *   一覧 → 詳細 と進んで戻るとトップまで飛ばされてしまう。
 *   「先頭へ」は各ページが個別に持っていた scroll-top ボタンをここへ統合したもの。
 *
 * 使い方:
 *   <script src="/fab-nav.js" defer></script> を 1 行足すだけ。
 *   統合したページからは、旧 scroll-top ボタン（HTML/CSS/JS）を削除すること。
 *
 *   任意で body の属性で調整できる:
 *     data-fab="off"                … 両方とも出さない
 *     data-fab-back="off"           … 戻るボタンだけ出さない（トップページなど）
 *     data-fab-top="off"            … 先頭へボタンだけ出さない
 *     data-fab-home="/equipment"    … 戻る履歴が無いときの行き先（既定は "/"）
 *     data-fab-above=".submit-bar"  … 下部固定バーがあるページで、その上に逃がす
 *
 *   ブラウザで見た目を確認したいときは URL に ?fab=1 を付ける（standalone 判定を迂回）。
 *
 * 表示条件が左右で違う理由:
 *   戻る … ホーム画面起動時のみ。ブラウザには元から戻るボタンがあり、二重になって
 *          画面を狭くするだけのため。
 *   先頭へ … 常時（ブラウザにこの機能は無いため）。ただし十分に長いページを
 *            スクロールしたときだけ現れる。
 */
(function () {
  'use strict';

  if (window.__rgFabNav) return;   // 二重読み込み対策
  window.__rgFabNav = true;

  var body = document.body;
  if (!body || body.dataset.fab === 'off') return;

  var forced = /[?&]fab=1(&|$)/.test(location.search);
  var standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true ||
    document.referrer.indexOf('android-app://') === 0;   // Android の TWA 起動

  // ---- 見た目（左右で共通） --------------------------------------------
  var css = [
    '.rg-fab{',
    '  position:fixed; z-index:90;',
    '  bottom:calc(16px + env(safe-area-inset-bottom, 0px));',
    '  width:52px; height:52px; padding:0; border-radius:50%;',
    '  display:flex; align-items:center; justify-content:center;',
    '  border:1px solid rgba(15,23,42,.10);',
    '  background:rgba(255,255,255,.94);',
    '  box-shadow:0 3px 12px rgba(15,23,42,.16);',
    '  color:#334155; cursor:pointer; -webkit-tap-highlight-color:transparent;',
    '  transition:opacity .25s, visibility .25s, transform .1s, background-color .2s;',
    // iOS のスクロール中に、固定したはずのボタンが本文に付いて画面半ばまで上がる
    // 現象が出た（2026-08-10・イベント一覧の実機）。fixed をコンポジタで持たせ続けるよう
    // レイヤーに載せて、本文のスクロールと切り離す。translateZ(0) は見た目を変えない。
    // ※ :active の scale と同じ transform プロパティなので、押した時も併記が要る。
    '  transform:translateZ(0); -webkit-transform:translateZ(0);',
    '  backface-visibility:hidden; -webkit-backface-visibility:hidden;',
    '}',
    // 2026-08-11追記: translateZ(0) だけでは直らず再発した。原因は backdrop-filter
    // （iOS はスクロール中の再ラスタライズで fixed 要素の backdrop-filter が
    // 位置ズレを起こす既知の不具合）。blur は諦めて削除し、代わりに背景を
    // 不透明寄りにして視認性を保った。
    '.rg-fab:active{ transform:scale(.94) translateZ(0); background:rgba(255,255,255,.98); }',
    '.rg-fab svg{ width:24px; height:24px; display:block; }',
    '.rg-fab-back{ left:14px; }',
    '.rg-fab-top{ right:14px; opacity:0; visibility:hidden; }',
    '.rg-fab-top.is-on{ opacity:1; visibility:visible; }',
    '@media (prefers-color-scheme: dark){',
    '  .rg-fab{ background:rgba(30,41,59,.94); border-color:rgba(255,255,255,.12); color:#e2e8f0;',
    '           box-shadow:0 3px 12px rgba(0,0,0,.4); }',
    '  .rg-fab:active{ background:rgba(30,41,59,.98); }',
    '}',
    '@media print{ .rg-fab{ display:none; } }'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    up:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>'
  };

  function makeFab(cls, icon, label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rg-fab ' + cls;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = icon;
    b.addEventListener('click', onClick);
    body.appendChild(b);
    return b;
  }

  var fabs = [];

  // ---- 左下：一つ前に戻る（ホーム画面起動時のみ） ------------------------
  if ((standalone || forced) && body.dataset.fabBack !== 'off') {
    // referrer が同一オリジンのときだけ history.back() する。
    // これを見ないと、外部サイトから来た人を back() でサイトの外へ押し出してしまう。
    var goesBack = (function () {
      if (history.length <= 1 || !document.referrer) return false;
      try { return new URL(document.referrer).origin === location.origin; }
      catch (e) { return false; }
    })();

    var home = body.dataset.fabHome || '/';

    // 見た目は常に左矢印で固定する。戻る先の有無でアイコンを変えると
    // 「なぜここだけ違うのか」という疑問を生むため（2026-08-10 ユーザー確定）。
    // 読み上げ用のラベルだけは実際の行き先に合わせる。
    fabs.push(makeFab(
      'rg-fab-back',
      ICON.back,
      goesBack ? '一つ前のページに戻る' : 'ガレージに戻る',
      function () { if (goesBack) history.back(); else location.href = home; }
    ));
  }

  // ---- 右下：先頭へ（常時。長いページをスクロールしたときだけ現れる） ----
  if (body.dataset.fabTop !== 'off') {
    var topBtn = makeFab('rg-fab-top', ICON.up, 'ページの先頭へ', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    fabs.push(topBtn);

    var ticking = false;
    var update = function () {
      ticking = false;
      // 短いページには出さない（スクロールできる余地が1画面分に満たないなら不要）
      var room = document.documentElement.scrollHeight - window.innerHeight;
      var on = room > 400 && window.scrollY > 240;
      topBtn.classList.toggle('is-on', on);
    };
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  // ---- 下部固定バーがあるページで、その上に逃がす -----------------------
  // 例: edit.html / equipment-edit.html の保存バー。
  var aboveSel = body.dataset.fabAbove;
  if (aboveSel && fabs.length) {
    var target = document.querySelector(aboveSel);
    if (target) {
      var lift = function () {
        var h = target.offsetHeight || 0;
        var visible = h > 0 && getComputedStyle(target).display !== 'none';
        var pos = visible ? 'calc(' + (h + 12) + 'px + env(safe-area-inset-bottom, 0px))' : '';
        fabs.forEach(function (f) { f.style.bottom = pos; });
      };
      lift();
      if (window.ResizeObserver) new ResizeObserver(lift).observe(target);
      window.addEventListener('resize', lift);
    }
  }
})();
