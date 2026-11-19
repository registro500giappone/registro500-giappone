// トップのロゴ：車が発進して画面の外へ走り去り、反対側から戻ってきて急ブレーキでロゴの位置に止まる（文字は置いたまま）。
// 1セッションに1回だけ／「視差効果を減らす」設定では動かさない／失敗したら静止のロゴに戻す。
// 置き場所＝ロゴの <img> の直後に同期で読む（読み込み前にロゴを隠すため defer にしない）。
(function () {
  'use strict';
  // cut＝車と文字の境目（画像に対する%）・car＝車の左右端（%）・dir＝進む向き（-1 左へ／1 右へ）・org＝つんのめる支点（前輪の下）
  var LOGOS = {
    'logo_vertical.png':      { cut: 'y', at: 54.73, car: [12.6, 87.4], dir: -1, org: '23.1% 53.5%' },
    'logo_horizontal.png':    { cut: 'x', at: 39.25, car: [0.8, 37.8],  dir: -1, org: '5.9% 96%' },
    'logo_vertical126.png':   { cut: 'y', at: 53.76, car: [10.5, 89.5], dir: 1,  org: '78.4% 52.5%' },
    'logo_horizontal126.png': { cut: 'x', at: 40.49, car: [0.8, 39.0],  dir: 1,  org: '33.6% 96%' }
  };
  var KEY = 'logoArrived';
  // T_GO＝発進まで（止まった姿を一瞬見せる）・T_OUT＝画面の外へ出た瞬間（ここで反対側へ回す）
  // T_STOP＝ロゴの位置で止まる・T_END＝揺り戻しが収まる
  var T_GO = 0.25, T_OUT = 0.85, T_STOP = 1.45, T_END = 1.95, N = 120;

  try { if (sessionStorage.getItem(KEY)) return; } catch (e) { return; }
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var img = Array.prototype.filter.call(document.querySelectorAll('.logo-mobile, .logo-pc'), function (el) {
    return getComputedStyle(el).display !== 'none';
  })[0];
  if (!img || !img.animate) return;
  var L = LOGOS[(img.getAttribute('src') || '').split('/').pop()];
  if (!L) return;
  try { sessionStorage.setItem(KEY, '1'); } catch (e) {}

  var carClip = L.cut === 'y' ? 'inset(0 0 ' + (100 - L.at) + '% 0)' : 'inset(0 ' + (100 - L.at) + '% 0 0)';
  var txtClip = L.cut === 'y' ? 'inset(' + L.at + '% 0 0 0)' : 'inset(0 0 0 ' + L.at + '%)';

  // 同じ画像を2枚重ね、片方を車・片方を文字に切り抜く（新しい画像は使わない）
  var wrap = document.createElement('span');
  wrap.style.cssText = 'position:relative;display:block';
  img.parentNode.insertBefore(wrap, img);
  wrap.appendChild(img);
  var car = null, anims = [];

  function restore() {
    anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
    if (car && car.parentNode) car.parentNode.removeChild(car);
    img.style.opacity = '';
    img.style.clipPath = '';
    if (wrap.parentNode) { wrap.parentNode.insertBefore(img, wrap); wrap.parentNode.removeChild(wrap); }
  }
  function sstep(a, b, t) { var k = Math.min(Math.max((t - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); }

  function run() {
    var r = img.getBoundingClientRect();
    if (!r.width) { restore(); return; }
    var left = r.left + r.width * L.car[0] / 100, right = r.left + r.width * L.car[1] / 100;
    // 出口＝進む向きの画面の外／入口＝反対側の画面の外（500 は左へ進む＝左へ消えて右から戻る・126 はその逆）
    var OUT = L.dir < 0 ? -(right + 8) : window.innerWidth - left + 8;
    var IN  = L.dir < 0 ? window.innerWidth - left + 8 : -(right + 8);
    var A = 3.6 * L.dir, frames = [];
    function push(t, x, a) {
      frames.push({ transform: 'translateX(' + x.toFixed(1) + 'px) rotate(' + a.toFixed(2) + 'deg)', offset: Math.min(t / T_END, 1) });
    }
    for (var i = 0; i <= N; i++) {
      var t = T_END * i / N, x, a, k;
      if (t < T_GO) {
        x = 0; a = 0;                                       // 止まった姿
      } else if (t < T_OUT) {
        k = (t - T_GO) / (T_OUT - T_GO);
        x = OUT * Math.pow(k, 2.6);                        // じわっと出てぐんぐん加速
        a = -A * 0.6 * Math.sin(Math.min(k * 2.2, 1) * Math.PI / 2) * (1 - k); // 発進で鼻先が持ち上がる
      } else if (t < T_STOP) {
        k = (t - T_OUT) / (T_STOP - T_OUT);
        x = IN * Math.pow(1 - k, 3);                       // 速く入って最後に一気に減速（急ブレーキ）
        a = A * sstep(0.6, 1, k);                          // ブレーキで前のめり
      } else {
        x = 0;
        a = A * Math.exp(-(t - T_STOP) * 7) * Math.cos((t - T_STOP) * 20); // 止まって揺り戻す
      }
      // 画面の外へ出た瞬間に反対側へ回す（同じ offset に2コマ置く＝その間は補間しない）
      if (i > 0 && t >= T_OUT && T_END * (i - 1) / N < T_OUT) { push(T_OUT, OUT, 0); push(T_OUT, IN, 0); }
      push(t, x, a);
    }
    car = img.cloneNode(false);
    car.alt = '';
    car.setAttribute('aria-hidden', 'true');
    car.style.cssText = 'position:absolute;top:0;left:0;opacity:1;clip-path:' + carClip + ';transform-origin:' + L.org +
      ';transform:' + frames[0].transform + ';will-change:transform;pointer-events:none';
    img.style.clipPath = txtClip;
    wrap.appendChild(car);
    // fill:'forwards'＝終わってから後始末までの1コマで、開始位置に戻ったり文字が消えたりしないように
    anims.push(car.animate(frames, { duration: T_END * 1000, easing: 'linear', fill: 'forwards' }));
    anims[0].onfinish = restore;
  }

  try {
    var ready = img.complete && img.naturalWidth ? Promise.resolve() : (img.decode ? img.decode() : Promise.reject());
    var late = new Promise(function (_, no) { setTimeout(no, 1500); });   // 画像が遅いときは動かさずに静止のロゴを出す
    Promise.race([ready, late]).then(function () { try { run(); } catch (e) { restore(); } }, restore);
  } catch (e) { restore(); }
})();
