/**
 * back-fab.js — ホーム画面（standalone）起動時に「一つ前に戻る」ボタンを左下に出す
 *
 * 背景:
 *   manifest.json が display:standalone のため、ホーム画面から起動するとブラウザの
 *   戻るボタンが消える。Android は端末のジェスチャーで戻れるが iPhone は手段が乏しい。
 *   さらに各ページの「← ガレージに戻る」は行き先が "/" 固定で「一つ前」には戻れず、
 *   一覧 → 詳細 と進んで戻るとトップまで飛ばされてしまう。
 *
 * 使い方:
 *   <script src="/back-fab.js" defer></script> を 1 行足すだけ。
 *
 *   任意で body の属性で調整できる:
 *     data-back-fab="off"               … このページには出さない
 *     data-back-fab-home="/equipment"   … 戻る履歴が無いときの行き先（既定は "/"）
 *     data-back-fab-above=".submit-bar" … 下部固定バーがあるページで、その上に逃がす
 *
 *   ブラウザで見た目を確認したいときは URL に ?backfab=1 を付ける（standalone 判定を迂回）。
 *
 * 出さない条件:
 *   ブラウザで開いている時は出さない。ブラウザには元から戻るボタンがあり、二重になって
 *   画面を狭くするだけのため。
 */
(function () {
  'use strict';

  if (window.__rgBackFab) return;   // 二重読み込み対策
  window.__rgBackFab = true;

  var body = document.body;
  if (!body) return;

  // ---- 出すかどうか ----------------------------------------------------
  var forced = /[?&]backfab=1(&|$)/.test(location.search);
  var standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true ||
    document.referrer.indexOf('android-app://') === 0;   // Android の TWA 起動

  if (body.dataset.backFab === 'off') return;
  if (!standalone && !forced) return;

  // ---- 「一つ前」に戻れるか -------------------------------------------
  // referrer が同一オリジンのときだけ history.back() する。
  // これを見ないと、外部サイトから来た人を back() でサイトの外へ押し出してしまう。
  function canGoBack() {
    if (history.length <= 1) return false;
    if (!document.referrer) return false;
    try {
      return new URL(document.referrer).origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  var goesBack = canGoBack();
  var home = body.dataset.backFabHome || '/';

  // ---- 見た目 ----------------------------------------------------------
  var css = [
    '.rg-back-fab{',
    '  position:fixed; left:14px; z-index:90;',
    '  bottom:calc(16px + env(safe-area-inset-bottom, 0px));',
    '  width:52px; height:52px; padding:0; border-radius:50%;',
    '  display:flex; align-items:center; justify-content:center;',
    '  border:1px solid rgba(15,23,42,.10);',
    '  background:rgba(255,255,255,.72);',
    '  -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);',
    '  box-shadow:0 3px 12px rgba(15,23,42,.16);',
    '  color:#334155; cursor:pointer; -webkit-tap-highlight-color:transparent;',
    '  transition:opacity .2s, transform .1s, background-color .2s;',
    '}',
    '.rg-back-fab:active{ transform:scale(.94); background:rgba(255,255,255,.92); }',
    '.rg-back-fab svg{ width:24px; height:24px; display:block; }',
    // 印刷には出さない
    '@media print{ .rg-back-fab{ display:none; } }'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rg-back-fab';
  btn.setAttribute('aria-label', goesBack ? '一つ前のページに戻る' : 'ガレージに戻る');
  btn.title = btn.getAttribute('aria-label');

  // 戻れるときは矢印、戻る先が無いときは家（行き先を偽らないため見た目を変える）
  btn.innerHTML = goesBack
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/></svg>';

  btn.addEventListener('click', function () {
    if (goesBack) history.back();
    else location.href = home;
  });

  body.appendChild(btn);

  // ---- 下部固定バーがあるページで、その上に逃がす -----------------------
  // 例: edit.html / equipment-edit.html の保存バー、126/index.html の左下ボタン。
  var aboveSel = body.dataset.backFabAbove;
  if (aboveSel) {
    var target = document.querySelector(aboveSel);
    if (target) {
      var lift = function () {
        var h = target.offsetHeight || 0;
        var visible = h > 0 && getComputedStyle(target).display !== 'none';
        btn.style.bottom = visible
          ? 'calc(' + (h + 12) + 'px + env(safe-area-inset-bottom, 0px))'
          : '';
      };
      lift();
      if (window.ResizeObserver) new ResizeObserver(lift).observe(target);
      window.addEventListener('resize', lift);
    }
  }
})();
