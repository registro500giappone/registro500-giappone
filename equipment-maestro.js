/*
 * 車載マエストロ判定の共有定義（正本）
 * ------------------------------------------------------------------
 * 2026-08-05 新設。従来は equipment-edit.html のインラインスクリプトだけが
 * 判定基準を持っていたが、公開手帳一覧（equipment.html）でも同じ称号を出す
 * ことになったため、値が二重管理になるのを避けて外だしした。
 *
 * ⚠️ 判定基準（マスター装備50項目・90%・安全装備4点必須）は
 *    2026-08-04 にユーザー確定した設計判断。勝手に変えないこと（HANDOFF参照）。
 *
 * 読み込み順の注意: このファイルは各ページの <head> で、Supabase を使う
 * インラインスクリプトより前に読み込む（config.js と同じ扱い）。
 */
(function (global) {
  'use strict';

  // 安全装備4点（法律・レスキューの事実として言えるため、唯一ダメ出しが許されるゾーン）。
  // 三角表示板39 → 発煙筒38 → ロードサービス連絡先44 → 保険証券45。
  var SAFETY_ITEM_IDS = [39, 38, 44, 45];

  // マスター装備リスト（安全装備4点を含む・50項目）。
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

  // MASTER_ITEM_IDS のうち、項目マスターに実在するものだけを判定対象にする。
  // 存在しない id を母数に含めると「どれだけ積んでも届かない基準」になり、
  // migration 適用前後でユーザーが不利益を被るため（equipment-edit.html の教訓）。
  // existingItemIds には項目マスターの id の集合（Set か配列）を渡す。
  function masterExistingItemIds(existingItemIds) {
    var has = existingItemIds instanceof Set
      ? function (id) { return existingItemIds.has(id); }
      : function (id) { return existingItemIds.indexOf(id) !== -1; };
    return MASTER_ITEM_IDS.filter(has);
  }

  // マスター装備リストの充足状況（搭載数／必要数／不足数）。
  function computeMasterProgress(loadedIds, existingItemIds) {
    var existing = masterExistingItemIds(existingItemIds);
    var loaded = existing.filter(function (id) { return loadedIds.has(id); }).length;
    var required = Math.ceil(existing.length * MAESTRO_THRESHOLD_RATIO);
    return { loaded: loaded, required: required, remaining: Math.max(0, required - loaded) };
  }

  // 車載マエストロ判定：マスター装備リストの90%以上を搭載 かつ 安全装備4点を全て搭載。
  // 安全装備は90%の計算対象にも含まれるが、それとは別に必須条件でもある。
  function computeIsMaster(loadedIds, existingItemIds) {
    var progress = computeMasterProgress(loadedIds, existingItemIds);
    var safetyFull = SAFETY_ITEM_IDS.every(function (id) { return loadedIds.has(id); });
    return progress.loaded >= progress.required && safetyFull;
  }

  global.EQ_MAESTRO = {
    SAFETY_ITEM_IDS: SAFETY_ITEM_IDS,
    MASTER_ITEM_IDS: MASTER_ITEM_IDS,
    MAESTRO_THRESHOLD_RATIO: MAESTRO_THRESHOLD_RATIO,
    masterExistingItemIds: masterExistingItemIds,
    computeMasterProgress: computeMasterProgress,
    computeIsMaster: computeIsMaster
  };
})(window);
