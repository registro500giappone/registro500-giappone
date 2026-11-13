/**
 * rg-car.js — 500 と 126 の見分け・呼び名を1か所に（2026-11-13・S2-4）
 *
 * 背景:
 *   「126 か」の判定（car.car_type === '126'）と、それに付く呼び名・戻り先が
 *   各ページに手書きで散らばっていた。URL の ?type= も各ページがそのまま使っており、
 *   想定外の値（?type=foo）がそのまま DB の絞り込みに入っていた。
 *
 * 使い方:
 *   <script src="rg-car.js"></script> を、それを使うインライン <script> より前に置く（defer にしない）。
 *   引数は車の行（{ car_type }）でも、型の文字列（'126'）でもよい。空・null は 500 扱い。
 *
 *   RG.car.type()          … URL の ?type= を '500' か '126' に丸めて返す（それ以外の値は '500'）
 *   RG.car.is126(x)        … true / false
 *   RG.car.label(x)        … 'FIAT 126' / 'FIAT 500'
 *   RG.car.siteName(x)     … 'Registro126' / 'Registro500'
 *   RG.car.home(x)         … '/126/' / '/'
 *   RG.car.logo(x)         … 'logo_horizontal126.png' / 'logo_horizontal.png'
 *
 *   型式（モデル名）の正規化は stats-core.js の getNormalizedModel のまま（ここには持たない）。
 */
(function () {
  var RG = window.RG = window.RG || {};

  function norm(x) {
    var t = (x && typeof x === 'object') ? x.car_type : x;
    return String(t == null ? '' : t).trim() === '126' ? '126' : '500';
  }

  RG.car = {
    type: function () {
      var v = null;
      try { v = new URLSearchParams(window.location.search).get('type'); } catch (e) {}
      return norm(v);
    },
    is126: function (x) { return norm(x) === '126'; },
    label: function (x) { return norm(x) === '126' ? 'FIAT 126' : 'FIAT 500'; },
    siteName: function (x) { return norm(x) === '126' ? 'Registro126' : 'Registro500'; },
    home: function (x) { return norm(x) === '126' ? '/126/' : '/'; },
    logo: function (x) { return norm(x) === '126' ? 'logo_horizontal126.png' : 'logo_horizontal.png'; }
  };
})();
