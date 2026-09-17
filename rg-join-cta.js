/**
 * rg-join-cta.js — 検索流入ページに置く「登録への一言」カード
 *
 * 背景:
 *   イベント個別・トルク早見帳・配線図ビューア・旅手帳は検索流入が多く、
 *   読んでいる人の大半は既にクラシック FIAT 500/126 のオーナーなのに、
 *   登録（サイトへの参加）への案内がどこにも無かった（2026-09-10 分析）。
 *   ユーザー指示により、この4群のページに限って登録への一言カードを新設する。
 *
 * 使い方:
 *   置きたい場所にプレースホルダを1つ置き、このスクリプトを1行足すだけ。
 *     <div id="rg-join-cta" data-where="torque" data-benefit="…"></div>
 *     <script src="/rg-join-cta.js" defer></script>
 *
 *   data-where   … 計測用のラベル（例: "torque" "wiring" "journey" "journey-index" "event"）
 *   data-benefit … ページ別の一言（任意。無ければ本文だけ表示）
 *   data-type    … "500" か "126"。無ければ URL の ?type= を見て、それも無ければ "500"
 *
 * 表示しない条件:
 *   ・プレースホルダが無いページ … 何もしない
 *   ・ログイン中 … localStorage に supabase-js のセッションキー（sb-*-auth-token）が
 *     あれば、既にオーナーとして参加している人なので出さない
 */
(function () {
  'use strict';

  var el = document.getElementById('rg-join-cta');
  if (!el) return;

  // ---- ログイン中は出さない（supabase-js を読み込まず localStorage だけ見る） ----
  try {
    var loggedIn = false;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && /^sb-.*-auth-token$/.test(key)) { loggedIn = true; break; }
    }
    if (loggedIn) return;
  } catch (e) { /* localStorage が使えない環境では、出す側に倒す */ }

  // ---- 車種の判定 -------------------------------------------------------
  var carType = el.dataset.type;
  if (carType !== '500' && carType !== '126') {
    carType = /[?&]type=126(&|$)/.test(location.search) ? '126' : '500';
  }

  // ---- 見た目（1回だけ注入） ---------------------------------------------
  if (!document.getElementById('rg-join-cta-style')) {
    var css = [
      '.rg-join-cta{',
      '  max-width:640px; margin:22px auto; padding:18px 20px;',
      '  border:1px solid rgba(70,58,40,.16); border-radius:14px;',
      '  background:rgba(255,254,251,.7); text-align:center;',
      '}',
      '.rg-join-cta h3{ margin:0 0 8px; font-size:1.05rem; color:#2e2a24; }',
      '.rg-join-cta p{ margin:0 0 6px; font-size:.9rem; line-height:1.6; color:#4a4239; }',
      '.rg-join-cta .rg-benefit{ color:#1f5c3d; }',
      '.rg-join-cta a{',
      '  display:inline-block; margin-top:10px; padding:10px 22px;',
      '  border-radius:999px; background:#1f5c3d; color:#fff;',
      '  text-decoration:none; font-size:.92rem; font-weight:600;',
      '}',
      '@media (prefers-color-scheme: dark){',
      '  .rg-join-cta{ background:rgba(43,39,33,.5); border-color:rgba(255,255,255,.14); }',
      '  .rg-join-cta h3{ color:#ece6d9; }',
      '  .rg-join-cta p{ color:#c9c0b0; }',
      '  .rg-join-cta .rg-benefit{ color:#7fb894; }',
      '  .rg-join-cta a{ background:#7fb894; color:#1a1714; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'rg-join-cta-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---- 文言 ---------------------------------------------------------------
  var heading = carType === '126' ? 'あなたの126も、ここに。' : 'あなたのチンクエチェントも、ここに。';
  var body = '日本のクラシック FIAT 500 / 126 のオーナーが、1台ずつ愛車を登録しているサイトです。写真1枚から登録できます。';
  var benefit = el.dataset.benefit || '';

  var h3 = document.createElement('h3');
  h3.textContent = heading;

  var p1 = document.createElement('p');
  p1.textContent = body;

  var link = document.createElement('a');
  link.href = '/edit?type=' + carType;
  link.textContent = '愛車を登録する →';

  var where = el.dataset.where || '';
  link.addEventListener('click', function () {
    try {
      if (typeof gtag === 'function') gtag('event', 'join_cta_click', { where: where });
    } catch (e) { /* 計測できなくても遷移は止めない */ }
  });

  el.classList.add('rg-join-cta');
  el.appendChild(h3);
  el.appendChild(p1);
  if (benefit) {
    var p2 = document.createElement('p');
    p2.className = 'rg-benefit';
    p2.textContent = benefit;
    el.appendChild(p2);
  }
  el.appendChild(link);
})();
