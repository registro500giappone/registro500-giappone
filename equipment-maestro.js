/*
 * 車載マエストロ判定の共有定義（正本）
 * ------------------------------------------------------------------
 * 2026-08-05 新設。従来は equipment-edit.html のインラインスクリプトだけが
 * 判定基準を持っていたが、公開手帳一覧（equipment.html）でも同じ称号を出す
 * ことになったため、値が二重管理になるのを避けて外だしした。
 *
 * ⚠️ 判定基準（マスター装備50項目・90%・安全・救援4点必須）は
 *    2026-08-04 にユーザー確定した設計判断。勝手に変えないこと（HANDOFF参照）。
 *
 * 読み込み順の注意: このファイルは各ページの <head> で、Supabase を使う
 * インラインスクリプトより前に読み込む（config.js と同じ扱い）。
 */
(function (global) {
  'use strict';

  // 安全・救援4点（法律・レスキューの事実として言えるため、唯一ダメ出しが許されるゾーン）。
  // 三角表示板39 → 発煙筒38 → ロードサービス連絡先44 → 保険証券45。
  var SAFETY_ITEM_IDS = [39, 38, 44, 45];

  // マスター装備リスト（安全・救援4点を含む・50項目）。
  // 47（従来の必須項目）＋2（テープ類）＋1（タイミングライト id74）＝50。
  var MASTER_ITEM_IDS = [
    4, 55, 56, 1, 5, 6, 61, 2, 60, 3, 58, 9, 57, 10, 7, 11, 13, 62, 63, 64,
    14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 27, 28, 65, 68, 71,
    29, 31, 32, 33, 70,
    40, 46,
    39, 38, 44, 45,
    8, 59, 74
  ];

  // マエストロ認定の必要割合（90%）。ハードコードせず比率で定数化する（50項目なら45項目）。
  var MAESTRO_THRESHOLD_RATIO = 0.9;

  // ===== 上位互換（2026-08-06 ユーザー確定） =====
  // 「本体を丸ごと車載している人は、その配下の部品も充足とみなす」。
  // 例: キャブレター本体(66)を積んでいれば、現地で開けて直すための補修部品(71)が
  //     無くても、載せ替えで同じ故障に対処できる＝対応力としては上位。
  // これを入れないと「本体を積んでいるのに補修部品が無い」と判定され、
  // 実態より低く出てしまう（スシオさんの実データで発覚した）。
  //
  // ⚠️ 判定は equipment_public_list() のSQL側にも同じ関係が実装されている（二重管理）。
  //    ここを変えたら public_list_rpc の SUPERSEDES 相当部分も必ず同期すること。
  //
  // ⚠️ id67（デスビ本体）のDB上のreasonは「キャップ・ローター単品とは別の備え方」と
  //    書かれており、当初は上位互換でなく別アプローチとして設計されていた。
  //    2026-08-06にユーザー判断で上位互換に改めた（同じ故障に対する備えのため）。
  //    ポイント(15)・コンデンサー(16)は物理的にデスビ内部だが、消耗品として定期交換
  //    する性格が強いため**あえて含めていない**（含めるかは要判断）。
  var SUPERSEDES = {
    66: [71],      // キャブレター本体 → キャブレターの補修部品
    67: [19, 20]   // デスビ本体 → デスビキャップ・ローター
  };

  // 上位互換を展開した搭載セットを返す（元のSetは変更しない）。
  // 判定に使うのは常にこの展開後のセット。
  // 引数は Set でも配列でも受ける（別realmのSetでも動くよう new Set(...) で作り直す）。
  function expandLoadedIds(loadedIds) {
    var out = new Set(loadedIds ? Array.from(loadedIds) : []);
    Object.keys(SUPERSEDES).forEach(function (key) {
      if (out.has(Number(key))) {
        SUPERSEDES[key].forEach(function (covered) { out.add(covered); });
      }
    });
    return out;
  }

  // MASTER_ITEM_IDS のうち、項目マスターに実在するものだけを判定対象にする。
  // 存在しない id を母数に含めると「どれだけ積んでも届かない基準」になり、
  // migration 適用前後でユーザーが不利益を被るため（equipment-edit.html の教訓）。
  // existingItemIds には項目マスターの id の集合（Set か配列）を渡す。
  // ⚠️ instanceof Set ではなく has の有無で判定する。iframe など別realmで作られた Set は
  //    instanceof が false になり、Setに対して indexOf を呼んで TypeError になるため。
  function masterExistingItemIds(existingItemIds) {
    var has = (existingItemIds && typeof existingItemIds.has === 'function')
      ? function (id) { return existingItemIds.has(id); }
      : function (id) { return existingItemIds.indexOf(id) !== -1; };
    return MASTER_ITEM_IDS.filter(has);
  }

  // マスター装備リストの充足状況（搭載数／必要数／不足数）。上位互換を展開して数える。
  function computeMasterProgress(loadedIds, existingItemIds) {
    var effective = expandLoadedIds(loadedIds);
    var existing = masterExistingItemIds(existingItemIds);
    var loaded = existing.filter(function (id) { return effective.has(id); }).length;
    var required = Math.ceil(existing.length * MAESTRO_THRESHOLD_RATIO);
    return { loaded: loaded, required: required, remaining: Math.max(0, required - loaded) };
  }

  // 車載マエストロ判定：マスター装備リストの90%以上を搭載 かつ 安全・救援4点を全て搭載。
  // 安全・救援は90%の計算対象にも含まれるが、それとは別に必須条件でもある。
  // 安全・救援4点に上位互換は無いが、判定の一貫性のため展開後のセットで見る。
  function computeIsMaster(loadedIds, existingItemIds) {
    var progress = computeMasterProgress(loadedIds, existingItemIds);
    var effective = expandLoadedIds(loadedIds);
    var safetyFull = SAFETY_ITEM_IDS.every(function (id) { return effective.has(id); });
    return progress.loaded >= progress.required && safetyFull;
  }

  // ===== 車載マエストロのシールロゴ（インラインSVG） =====
  // 2026-08-05 に equipment-edit.html から移設。結果画面・車両ページの両方が使う。
  // Canvas版（equipment-edit.html の drawMaestroSeal）は同じ幾何を2Dパスで描くので、
  // SEAL_GEOM を変えたら両方の見た目が変わる＝ここが幾何の正本。
  var SEAL_GEOM = { cx: 100, cy: 104, r: 76, leaves: 7 };

  // 月桂樹の枝1本ぶんの葉を、円弧に沿って並べる。mirror=true で右側の枝（葉の傾きを反転）
  function laurelLeaves(from, to, mirror) {
    var g = SEAL_GEOM;
    var out = '';
    for (var k = 0; k < g.leaves; k++) {
      var t = from + (to - from) * (k / (g.leaves - 1));
      var rad = t * Math.PI / 180;
      var x = g.cx + Math.cos(rad) * g.r, y = g.cy + Math.sin(rad) * g.r;
      var lean = t + (mirror ? -64 : 64);
      var grow = 0.62 + 0.38 * Math.sin(Math.PI * (k / (g.leaves - 1)));
      out += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + (9 * grow).toFixed(1) +
        '" ry="' + (4 * grow).toFixed(1) + '" transform="rotate(' + lean.toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
    }
    return out;
  }

  // idSuffix: 同一ページに複数描くときにグラデーションのid衝突を避ける（省略可）
  function maestroSealSvg(idSuffix) {
    var gid = 'mseal' + (idSuffix || '');
    return '<svg class="maestro-seal" viewBox="0 0 200 200" role="img" aria-label="車載マエストロ">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f7e3a1"/><stop offset=".45" stop-color="#d9a92b"/><stop offset="1" stop-color="#9a6b00"/>' +
      '</linearGradient></defs>' +
      '<circle cx="100" cy="100" r="92" fill="#fffdf6"/>' +
      '<circle cx="100" cy="100" r="90" fill="none" stroke="url(#' + gid + ')" stroke-width="3.5"/>' +
      '<circle cx="100" cy="100" r="82" fill="none" stroke="url(#' + gid + ')" stroke-width="1.1" opacity=".65"/>' +
      '<g fill="url(#' + gid + ')">' + laurelLeaves(128, 218, false) + laurelLeaves(52, -38, true) + '</g>' +
      '<path d="M100 24l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1z" fill="url(#' + gid + ')"/>' +
      '<text x="103" y="84" text-anchor="middle" font-size="17" font-weight="700" fill="#9a6b00" letter-spacing="7">車載</text>' +
      '<text x="100.5" y="115" text-anchor="middle" font-size="21" font-weight="800" fill="#8a5f00" letter-spacing="1">マエストロ</text>' +
      '<line x1="70" y1="127" x2="130" y2="127" stroke="url(#' + gid + ')" stroke-width="1.3"/>' +
      '<text x="100.6" y="143" text-anchor="middle" font-size="8" font-weight="700" fill="#a9750d" letter-spacing="1.2">MAESTRO DI BORDO</text>' +
      '</svg>';
  }

  global.EQ_MAESTRO = {
    SEAL_GEOM: SEAL_GEOM,
    laurelLeaves: laurelLeaves,
    maestroSealSvg: maestroSealSvg,
    SAFETY_ITEM_IDS: SAFETY_ITEM_IDS,
    MASTER_ITEM_IDS: MASTER_ITEM_IDS,
    MAESTRO_THRESHOLD_RATIO: MAESTRO_THRESHOLD_RATIO,
    SUPERSEDES: SUPERSEDES,
    expandLoadedIds: expandLoadedIds,
    masterExistingItemIds: masterExistingItemIds,
    computeMasterProgress: computeMasterProgress,
    computeIsMaster: computeIsMaster
  };
})(window);
