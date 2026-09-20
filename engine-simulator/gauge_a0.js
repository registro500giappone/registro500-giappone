/* 回転計（タコメーター）の文字盤 ─ イタリア製の古典的な計器に寄せた顔つき。
   寸法・字形は意匠定義からの実測値をそのまま使う。外部依存なし・ブラウザのみで動く ES モジュール。

   使い方:
     import { renderTach, setNeedle, setNeedles } from "./gauge_a0.js";
     renderTach(svgEl, { rpm: 3770, redFrom: 4650, max: 6000, label: "×1000 r/min" });
     setNeedle(svgEl, 4200);                    // 針Aだけ動かす(アニメ用)
     setNeedles(svgEl, { a: 3770, b: 4115 });    // 針A・針Bと、その間の扇を動かす

   svgEl は空の <svg viewBox="0 0 200 200"> を渡すこと。
   フォント(既定 'Poiret One')の読み込みは呼び出し側の責務。このファイルは何も読み込まない。

   色は CSS カスタムプロパティ(接頭辞 a0-)で外から上書きできる。既定値は var(--a0-x, 既定)の
   フォールバックとしてこのファイルの中に直接書いてあるので、呼び出し側は何も定義しなくても
   動く。上書きしたいときは呼び出し側のCSSで --a0-needle-a 等を定義すればよい。
   例: svgEl.style.setProperty("--a0-needle-a", "#40c080");

   対応するカスタムプロパティ:
     --a0-tick    目盛・目盛数字・ラベル文字の色(既定 #ead9ae)
     --a0-needle-a / --a0-needle-b   針A・針Bの色(比較用の2本針。既定は淡緑/淡金)
     --a0-fan     針Aと針Bの間を塗る扇の色(既定 #e8b04f)
     --a0-hub     針の根元(ハブ)の色
     --a0-f0 / --a0-f1   盤全体の下地グラデーション(明→暗)
     --a0-red     レッドゾーンの色
     --a0-dialfont / --a0-nw   目盛数字・ラベル文字のフォントと太さ

   針は2本(A・B)を常に持つ。setNeedles() の b を省くと針Bと扇は隠れ、針Aだけの
   ふつうのタコメーターになる(renderTach() 直後もこの状態)。 */

const NS = "http://www.w3.org/2000/svg";
const el = (t, a) => {
  const x = document.createElementNS(NS, t);
  for (const k in a) x.setAttribute(k, a[k]);
  return x;
};

/* 盤の開き角 */
const A0 = -135, SW = 270;

/* 中心 (100,100) から角度 a(度・真上=0・時計回り) だけ離れた半径 r の点 */
const P = (r, a) => {
  const rad = (a - 90) * Math.PI / 180;
  return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)];
};
/* 値の割合 f(0〜1) を盤の角度へ(この盤は目盛が等間隔で、曲げは無い) */
const ang = f => A0 + SW * Math.max(0, Math.min(1, f));

/* 針のパス(先端の羽根＋反対側の丸いテール)。座標は意匠定義の実測値からの導出値で固定 */
const NEEDLE_D = "M100 21 L97.9 100 L96.4 121 Q100 125 103.6 121 L102.1 100 Z";

/* パス文字列から中心(100,100)より上側にある座標の最大距離(=針先の半径)を拾う。
   針を複製して2本にしたとき、扇をどこまで伸ばすかに使う */
function tipRadius(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  let r = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const q = 100 - nums[i + 1];
    if (q > r) r = q;
  }
  return r;
}
/* 扇の外周半径。針先の少し手前で止める(針の下に隠れず、かつ目盛には掛からない) */
const FAN_R = tipRadius(NEEDLE_D) - 3;

let seq = 0;

/**
 * 文字盤・目盛・数字・ラベル・扇・針(A/B)・ハブを描く。呼ぶたびに svgEl の中身を作り直す。
 * 針Bと扇は隠した状態で用意される(setNeedles() の b を渡すまで出ない)。
 * @param {SVGSVGElement} svgEl 空の <svg viewBox="0 0 200 200">
 * @param {{rpm?:number, redFrom?:number, max?:number, label?:string}} opts
 */
export function renderTach(svgEl, opts = {}) {
  const { rpm = 0, redFrom, max = 6000, label = "×1000 r/min" } = opts;
  if (!svgEl.getAttribute("viewBox")) svgEl.setAttribute("viewBox", "0 0 200 200");
  svgEl.textContent = "";
  if (!svgEl.id) svgEl.id = "a0tach-" + (++seq);
  const id = svgEl.id;
  svgEl.__tachMax = max;

  const defs = el("defs", {});
  defs.innerHTML =
    `<radialGradient id="${id}f" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="var(--a0-f0, #1c1712)"/><stop offset="100%" stop-color="var(--a0-f1, #0e0b07)"/></radialGradient>
     <radialGradient id="${id}h" cx="38%" cy="34%" r="80%">
      <stop offset="0%" stop-color="#fff" stop-opacity=".55"/><stop offset="45%" stop-color="var(--a0-hub, #4a3d26)"/>
      <stop offset="100%" stop-color="#000" stop-opacity=".55"/></radialGradient>
     <radialGradient id="${id}g" cx="50%" cy="0%" r="90%">
      <stop offset="0%" stop-color="#fff" stop-opacity=".10"/><stop offset="60%" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  svgEl.appendChild(defs);

  /* 盤全体の下地 */
  svgEl.appendChild(el("circle", { cx: 100, cy: 100, r: 99, fill: `url(#${id}f)` }));
  /* 外周の縁(ベゼル・暗い縁線1本) */
  svgEl.appendChild(el("circle", {
    cx: 100, cy: 100, r: 96.5, fill: "none", stroke: "#000", "stroke-opacity": .5, "stroke-width": 4,
  }));
  /* 盤の縁の線(目盛の外とベゼルの間の帯に、面の終わりを示す1本を入れる) */
  svgEl.appendChild(el("circle", {
    cx: 100, cy: 100, r: 93.6, fill: "none", stroke: "var(--a0-tick, #ead9ae)", "stroke-opacity": .25, "stroke-width": .8,
  }));

  const rangeK = max / 1000; /* 目盛は ×1000 r/min 単位で引く */

  /* レッドゾーン */
  if (redFrom != null) {
    const f1 = Math.max(0, Math.min(1, redFrom / max)), R = 85;
    const [x1, y1] = P(R, ang(f1)), [x2, y2] = P(R, ang(1));
    const large = (1 - f1) * SW > 180 ? 1 : 0;
    svgEl.appendChild(el("path", {
      d: `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
      fill: "none", stroke: "var(--a0-red, #ff4a35)", "stroke-width": 6, opacity: .92,
    }));
  }

  /* 目盛(1刻み=主目盛・0.5刻み=中目盛・0.1刻み=細目盛)と主目盛の数字 */
  const steps = Math.round(rangeK / 0.1), eps = 1e-6;
  for (let i = 0; i <= steps; i++) {
    const val = i * 0.1, f = val / rangeK;
    const maj = Math.abs(val - Math.round(val)) < eps;
    const mid = !maj && Math.abs(val * 2 - Math.round(val * 2)) < eps;
    const t = maj ? { len: 13, w: 3, op: 1 } : mid ? { len: 8, w: 1.8, op: .8 } : { len: 4.5, w: .9, op: .45 };
    const [x1, y1] = P(89, ang(f)), [x2, y2] = P(89 - t.len, ang(f));
    svgEl.appendChild(el("line", {
      x1, y1, x2, y2, stroke: "var(--a0-tick, #ead9ae)", "stroke-width": t.w, opacity: t.op, "stroke-linecap": "round",
    }));
    if (maj) {
      const [tx, ty] = P(55, ang(f)), lv = Math.round(val);
      const n = el("text", {
        x: tx, y: ty + 7, fill: "var(--a0-tick, #ead9ae)", "font-size": 20, "text-anchor": "middle",
      });
      n.style.font = "var(--a0-nw, 600) 20px var(--a0-dialfont, 'Poiret One', sans-serif)";
      n.textContent = lv;
      svgEl.appendChild(n);
    }
  }

  /* ラベル(既定「×1000 r/min」。空白で割れれば2段、割れなければ1段) */
  const parts = label.split(" ");
  const lb = el("text", {
    x: 100, y: 146, fill: "var(--a0-tick, #ead9ae)", "font-size": 11, "text-anchor": "middle",
    "letter-spacing": 1.8, opacity: .85,
  });
  lb.style.font = "var(--a0-nw, 600) 11px var(--a0-dialfont, 'Poiret One', sans-serif)";
  if (parts.length === 2) {
    [146, 158].forEach((y, j) => {
      const ts = el("tspan", { x: 100, y });
      ts.textContent = parts[j];
      lb.appendChild(ts);
    });
  } else {
    lb.textContent = label;
  }
  svgEl.appendChild(lb);

  /* 扇(針Aと針Bの間を塗る。setNeedles() の b が無い間は隠す・針より下の層) */
  svgEl.appendChild(el("path", {
    d: "M100 100Z", "data-role": "a0-fan", fill: "var(--a0-fan, #e8b04f)", "fill-opacity": .22,
    style: "display:none",
  }));

  /* 針A */
  const gA = el("g", { "data-role": "a0-needle-a" });
  gA.style.filter = "drop-shadow(1.5px 3px 2.5px rgba(0,0,0,.55))";
  gA.appendChild(el("path", { d: NEEDLE_D, fill: "var(--a0-needle-a, #8fae9b)" }));
  gA.setAttribute("transform", `rotate(${ang(rpm / max)} 100 100)`);
  svgEl.appendChild(gA);

  /* 針B(比較用。setNeedles() の b が無い間は隠す) */
  const gB = el("g", { "data-role": "a0-needle-b" });
  gB.style.filter = "drop-shadow(1.5px 3px 2.5px rgba(0,0,0,.55))";
  gB.style.display = "none";
  // 針Bは少し透かす＝2本が同じ位置に重なったとき、下の針Aが見える
  gB.appendChild(el("path", { d: NEEDLE_D, fill: "var(--a0-needle-b, #e8b04f)", "fill-opacity": .85 }));
  gB.setAttribute("transform", `rotate(${ang(rpm / max)} 100 100)`);
  svgEl.appendChild(gB);

  /* ハブ(1つだけ・両針の根元を覆う・針より上の層) */
  svgEl.appendChild(el("circle", { cx: 100, cy: 100, r: 9.5, fill: `url(#${id}h)` }));
  svgEl.appendChild(el("circle", { cx: 100, cy: 100, r: 3, fill: "var(--a0-f1, #0e0b07)" }));

  /* 表面の映り込み */
  svgEl.appendChild(el("ellipse", {
    cx: 100, cy: 52, rx: 80, ry: 44, fill: `url(#${id}g)`, "pointer-events": "none",
  }));
}

/**
 * 針A・針Bを rpm の位置へ回し、2本の間を扇で塗る(文字盤の描き直しはしない・アニメ用)。
 * b が undefined/null なら針Bと扇を隠して針Aだけにする。
 * |a-b| が max の0.2%未満なら(ほぼ同じ値)扇は描かない。
 * @param {SVGSVGElement} svgEl renderTach 済みの svg
 * @param {{a?:number, b?:number}} v
 */
export function setNeedles(svgEl, v = {}) {
  const { a, b } = v;
  const max = svgEl.__tachMax || 6000;
  const needleA = svgEl.querySelector('[data-role="a0-needle-a"]');
  const needleB = svgEl.querySelector('[data-role="a0-needle-b"]');
  const fan = svgEl.querySelector('[data-role="a0-fan"]');
  if (!needleA) return;
  if (a != null) needleA.setAttribute("transform", `rotate(${ang(a / max)} 100 100)`);

  if (b == null) {
    if (needleB) needleB.style.display = "none";
    if (fan) fan.style.display = "none";
    return;
  }
  if (needleB) {
    needleB.setAttribute("transform", `rotate(${ang(b / max)} 100 100)`);
    needleB.style.display = "";
  }
  if (fan) {
    if (a == null || Math.abs(a - b) < max * 0.002) {
      fan.style.display = "none";
    } else {
      const angA = ang(a / max), angB = ang(b / max);
      const lo = Math.min(angA, angB), hi = Math.max(angA, angB);
      const large = hi - lo > 180 ? 1 : 0;
      const [x1, y1] = P(FAN_R, lo), [x2, y2] = P(FAN_R, hi);
      fan.setAttribute("d", `M100 100 L${x1} ${y1} A${FAN_R} ${FAN_R} 0 ${large} 1 ${x2} ${y2} Z`);
      fan.style.display = "";
    }
  }
}

/**
 * 針Aだけを rpm の位置へ回す(C1の setNeedle() と口を揃えた別名)。
 * @param {SVGSVGElement} svgEl renderTach 済みの svg
 * @param {number} rpm
 */
export function setNeedle(svgEl, rpm) {
  setNeedles(svgEl, { a: rpm });
}
