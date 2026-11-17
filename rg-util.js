/**
 * rg-util.js — 各ページに散らばっていた小さな道具を1か所に（S2-1）
 *
 * 使い方:
 *   <script src="/rg-util.js"></script> を、それを使うインライン <script> より前に置く（defer にしない）。
 *   rg-car.js など同じ名前空間 RG を使うファイルとは、読み込み順がどちらでも動く。
 *
 *   RG.esc(s)       … HTML エスケープ（& < > " ' の5文字）。null / undefined は空文字、数値も文字列にする
 *   RG.safeUrl(u)   … http(s) の URL だけ通す（前後の空白は除く）。それ以外は空文字（javascript: 等を href に入れない）
 *   RG.linkify(s)   … 本文を escape したうえで http(s) の URL を <a> にする（末尾の句読点・閉じ括弧はリンクに含めない）
 *   RG.fmtDate(s)   … 'YYYY-MM-DD…' を「2026年11月17日」に。空は空文字
 *   RG.$(id)        … document.getElementById
 */
(function () {
  var RG = window.RG = window.RG || {};

  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  RG.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return ESC_MAP[ch]; });
  };

  RG.safeUrl = function (u) {
    var t = u == null ? '' : String(u).trim();
    return /^https?:\/\//i.test(t) ? t : '';
  };

  RG.linkify = function (text) {
    if (!text) return '';
    return RG.esc(text).replace(
      /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  };

  RG.fmtDate = function (s) {
    if (!s) return '';
    var p = String(s).slice(0, 10).split('-');
    return p[0] + '年' + Number(p[1]) + '月' + Number(p[2]) + '日';
  };

  RG.$ = function (id) { return document.getElementById(id); };
})();
