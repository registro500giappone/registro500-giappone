/***** =========================================================
 *  Registro500 Giappone — main.gs
 *  - cars シートをマスターにした一覧／詳細表示
 *  - Model_DisplayA/B/C, Engine_Display 自動生成
 * ========================================================= ****/

// =================================================
// 設定項目
// =================================================
const SHEET_NAME_MASTER = 'cars';          // マスタシート名
const DOCUMENT_ID_COLUMN_NAME = 'DocumentID';

const CACHE_EXPIRATION_SECONDS = 3600;     // 1時間
const CACHE_KEY_PREFIX_CAR = 'car_';
const CACHE_KEY_WARMED_UP = 'cache_warmed_up';

// ★ ここに「正しい exec URL」を固定で書く
//   ※ デプロイ画面に出ている Web アプリの URL（〜/exec）をコピペ
const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbxbvZ0SJzIpj9NjtdkwI2UJ3jsOjckGJEVWo6MuHfIT7DbQMG-kWGmgp0DE1MprHqBL/exec';

// Firebase Storage の URL 変換に必要な定数
const FIREBASE_STORAGE_BASE_URL =
  'https://firebasestorage.googleapis.com/v0/b/registro500giappone-93f98.firebasestorage.app/o/';

// 写真カラム
const PHOTO_COLUMNS = [
  'PhotoMain',
  'PhotoFront',
  'PhotoSide',
  'PhotoRear',
  'PhotoEngine',
  'PhotoInterior',
  'PhotoSteeringCluster',
];

// 一覧表示に必要なカラム（テンプレートに渡すビュー用）
const INDEX_VIEW_COLUMNS = [
  'PhotoMain',
  'Model_DisplayC',
  'Year',
  'Prefecture',
  'HandleName',
  'DocumentID',
];

// =================================================
// 表示用ロジック（Model_Display*, Engine_Display）
// =================================================

/**
 * select と text から表示値を決める。
 * - select が「その他」以外なら select
 * - それ以外で text があれば text
 * - 両方なければ ''
 */
function resolveSelectAndText(selectValue, textValue) {
  const s = (selectValue || '').toString().trim();
  const t = (textValue || '').toString().trim();

  if (s && s !== 'その他') return s;
  if (t) return t;
  return '';
}

/**
 * モデル表示の組み立て
 * - A/B はスペース区切り（スラッシュは使わない）
 * - Year があれば末尾に "(Year)" を付ける
 */
function buildModelDisplays(record) {
  const modelA = resolveSelectAndText(record.ModelSelectA, record.ModelTextA);
  const modelB = resolveSelectAndText(record.ModelSelectB, record.ModelTextB);

  record.Model_DisplayA = modelA;
  record.Model_DisplayB = modelB;

  const parts = [];
  if (modelA) parts.push(modelA);
  if (modelB) parts.push(modelB);

  let display = parts.join(' ');
  const year = (record.Year || '').toString().trim();

  if (year) {
    if (display) {
      display = display + ' (' + year + ')';
    } else {
      display = '(' + year + ')';
    }
  }

  record.Model_DisplayC = display;
  return record;
}

/**
 * エンジン表示の組み立て
 */
function buildEngineDisplay(record) {
  const engine = resolveSelectAndText(record.EngineTypeSelect, record.EngineTypeText);
  record.Engine_Display = engine || '';
  return record;
}

// =================================================
// Webアプリの入り口（index/detail/edit）
// =================================================

function doGetMain_(e) {
  const mode = e && e.parameter && e.parameter.mode;
  const docId = e && e.parameter && e.parameter.doc;

  if (mode === 'edit') {
    return renderEdit();
  }

  if (mode === 'detail') {
    if (!docId) {
      return HtmlService.createHtmlOutput('エラー: 車両ID(doc)が指定されていません。');
    }
    return renderDetail(docId);
  }

  // mode 未指定 or 'index'
  return renderIndex();
}

// ★ 新しい入口用 doGet（policy / howto / それ以外は元の処理に回す）
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var mode = params.mode || '';
  var scriptUrl = WEB_APP_URL;  // ★ 絶対にこの URL だけを使う

  try {
    // 1) ?mode=policy → policy.html
    if (mode === 'policy') {
      var tPolicy = HtmlService.createTemplateFromFile('policy');
      tPolicy.scriptUrl = scriptUrl;  // ★ 戻り先URLをテンプレに渡す
      return tPolicy
        .evaluate()
        .setTitle('Registro500 Giappone')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // 2) ?mode=howto → howto.html
    if (mode === 'howto') {
      var tHowto = HtmlService.createTemplateFromFile('howto');
      tHowto.scriptUrl = scriptUrl;  // ★ 同じく渡す
      return tHowto
        .evaluate()
        .setTitle('Registro500 Giappone')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // 3) それ以外（index/detail/edit）は、元の処理に任せる
    return doGetMain_(e);

  } catch (err) {
    return HtmlService.createHtmlOutput(
      'Error in doGet (mode=' + mode + '):<br><pre>' +
      err.toString() +
      '</pre>'
    );
  }
}

// =================================================
// キャッシュ構築（詳細ページ用）
// =================================================

function warmUpCache() {
  const cache = CacheService.getScriptCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  if (!sheet) throw new Error('シートが見つかりません: ' + SHEET_NAME_MASTER);

  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values.shift(); // 1行目ヘッダー

  const cacheData = {};

  values.forEach(row => {
    const record = {};
    let docId = '';

    headers.forEach((header, idx) => {
      const colName = (header || '').toString().trim();
      if (!colName) return;
      const value = row[idx];
      record[colName] = value;
      if (colName === DOCUMENT_ID_COLUMN_NAME) {
        docId = value;
      }
    });

    if (!docId) return;

    // 表示用フィールド再構築
    buildModelDisplays(record);
    buildEngineDisplay(record);

    const cacheKey = CACHE_KEY_PREFIX_CAR + docId;
    cacheData[cacheKey] = JSON.stringify(record);
  });

  cache.putAll(cacheData, CACHE_EXPIRATION_SECONDS);
  cache.put(CACHE_KEY_WARMED_UP, 'true', CACHE_EXPIRATION_SECONDS);
}

// =================================================
// 詳細ページ生成（差し替え版：isOwner 判定を追加）
// =================================================

function renderDetail(docId) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = CACHE_KEY_PREFIX_CAR + docId;

    if (cache.get(CACHE_KEY_WARMED_UP) === null) {
      warmUpCache();
    }

    let data = cache.get(cacheKey);
    if (data === null) {
      warmUpCache();
      data = cache.get(cacheKey);
      if (data === null) {
        throw new Error('指定された車両IDのデータが見つかりません: ' + docId);
      }
    }

    const targetCar = JSON.parse(data);

    // 表示用フィールドを再構築
    buildModelDisplays(targetCar);
    buildEngineDisplay(targetCar);

    // 写真URL変換
    fixPhotoUrls(targetCar);

    // ログインユーザーとOwnerEmailを比較して本人か判定
    var currentEmail = '';
    try {
      currentEmail = Session.getActiveUser().getEmail() || '';
    } catch (err) {
      currentEmail = '';
    }
    var ownerEmail = (targetCar.OwnerEmail || '').toString().trim();
    var isOwner = !!(currentEmail && ownerEmail && currentEmail === ownerEmail);

    // テンプレートへ
    const template = HtmlService.createTemplateFromFile('detail.html');
    template.carData   = targetCar;
    template.isOwner   = isOwner;
    template.scriptUrl = WEB_APP_URL;   // ★ ここも固定 URL

    return template.evaluate()
      .setTitle('車両詳細: ' + (targetCar.HandleName || ''))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    Logger.log(error);
    return HtmlService.createHtmlOutput('<pre>エラーが発生しました:\n' + error.message + '</pre>');
  }
}

// =================================================
// 編集フォーム表示
// =================================================

// =================================================
// 編集フォーム表示
// =================================================
function renderEdit() {
  const template = HtmlService.createTemplateFromFile('edit');
  template.scriptUrl = ScriptApp.getService().getUrl();

  return template
    .evaluate()
    .setTitle('Registro500Giappone - 編集フォーム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // ★ 追加
}

// =================================================
// 一覧ページ生成（シートから直接取得）
// =================================================

// =================================================
// 一覧ページ生成（シートから直接取得）
// =================================================
function renderIndex() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
    if (!sheet) throw new Error('シートが見つかりません: ' + SHEET_NAME_MASTER);

    const values = sheet.getDataRange().getValues();
    const headers = values.shift();
    const allCars = [];

    values.forEach(row => {
      const record = {};

      // まず全カラムを record に入れてしまう
      headers.forEach((header, idx) => {
        const colName = (header || '').toString().trim();
        if (!colName) return;
        record[colName] = row[idx];
      });

      if (!record[DOCUMENT_ID_COLUMN_NAME]) return;

      // A/B/Year などから Model_DisplayC を再計算
      buildModelDisplays(record);
      // （一覧では Engine_Display は今のところ使わないが、必要ならここで buildEngineDisplay も可）

      // 一覧テンプレートに渡すビュー用オブジェクトだけ抜き出す
      const viewCar = {};
      INDEX_VIEW_COLUMNS.forEach(col => {
        viewCar[col] = record[col] || '';
      });

      // メイン写真URL変換
      if (viewCar.PhotoMain) {
        viewCar.PhotoMain = fixSinglePhotoUrl(viewCar.PhotoMain);
      }

      allCars.push(viewCar);
    });

    const template = HtmlService.createTemplateFromFile('index.html');
    template.allCars = allCars;
    template.scriptUrl = ScriptApp.getService().getUrl();

    return template
      .evaluate()
      .setTitle('車両一覧')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // ★ ここを追加

  } catch (error) {
    Logger.log(error);
    return HtmlService.createHtmlOutput('<pre>エラーが発生しました:\n' + error.message + '</pre>');
  }
}

// =================================================
// Firebase Storage URL変換
// =================================================

function fixPhotoUrls(carData) {
  PHOTO_COLUMNS.forEach(function (col) {
    const url = carData[col];
    if (url) {
      carData[col] = fixSinglePhotoUrl(url);
    }
  });
  return carData;
}

function fixSinglePhotoUrl(url) {
  if (url && url.includes('appspot.com')) {
    const pathMatch = url.match(/\/o\/(.+)\?alt=media/);
    if (pathMatch && pathMatch[1]) {
      const filePath = pathMatch[1];
      return FIREBASE_STORAGE_BASE_URL + filePath + '?alt=media';
    }
  }
  return url;
}

// =================================================
// デバッグ用（任意）
// =================================================

function debugDetailRequest() {
  const TEST_DOC_ID = 'DOC_1';
  renderDetail(TEST_DOC_ID);
}

// =================================================
// フォームから受け取ったデータを cars シートに保存（新規登録）
// =================================================

function saveCarFromForm(formData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  if (!sheet) {
    throw new Error('シートが見つかりません: ' + SHEET_NAME_MASTER);
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  const docIdColIndex = headers.indexOf(DOCUMENT_ID_COLUMN_NAME);
  if (docIdColIndex === -1) {
    throw new Error('DocumentID 列が見つかりません。');
  }

  const lastRow = sheet.getLastRow();
  let nextNumber = 1;

  if (lastRow > 1) {
    const idValues = sheet
      .getRange(2, docIdColIndex + 1, lastRow - 1, 1)
      .getValues()
      .flat()
      .filter(String);

    idValues.forEach(function (id) {
      const m = /^DOC_(\d+)$/.exec(id);
      if (m) {
        const n = Number(m[1]);
        if (n >= nextNumber) {
          nextNumber = n + 1;
        }
      }
    });
  }

  const newDocId = 'DOC_' + nextNumber;
  const now = new Date();
  const userEmail = (Session.getActiveUser && Session.getActiveUser().getEmail()) || '';

  const record = {};

  headers.forEach(function (col) {
    switch (col) {
      case '_id':
        record[col] = '';
        break;
      case DOCUMENT_ID_COLUMN_NAME:
        record[col] = newDocId;
        break;
      case 'firebase_id':
        record[col] = '';
        break;
      case 'OwnerEmail':
        record[col] = userEmail;
        break;
      case 'record_id':
      case '🔐 Softr Record ID':
        record[col] = '';
        break;
      case 'createdAt':
      case 'updatedAt':
        record[col] = now;
        break;
      default:
        record[col] = (formData && formData[col] !== undefined) ? formData[col] : '';
        break;
    }
  });

  buildModelDisplays(record);
  buildEngineDisplay(record);

  const row = headers.map(function (col) {
    return record[col] !== undefined ? record[col] : '';
  });

  sheet.appendRow(row);

  return { DocumentID: newDocId };
}

// =================================================
// 既存データの Model_DisplayA/B/C, Engine_Display を一括で埋めるバックフィル
// =================================================

function backfillDisplayColumnsForAllRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  if (!sheet) {
    throw new Error('シートが見つかりません: ' + SHEET_NAME_MASTER);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) {
    Logger.log('データ行がありません。');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  const idxA  = headers.indexOf('Model_DisplayA');
  const idxB  = headers.indexOf('Model_DisplayB');
  const idxC  = headers.indexOf('Model_DisplayC');
  const idxEng = headers.indexOf('Engine_Display');

  if (idxA === -1 || idxB === -1 || idxC === -1 || idxEng === -1) {
    throw new Error('Model_DisplayA/B/C または Engine_Display 列が見つかりません。');
  }

  const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const values = range.getValues();

  values.forEach((row, r) => {
    const record = {};

    headers.forEach((header, c) => {
      const colName = (header || '').toString().trim();
      if (!colName) return;
      record[colName] = row[c];
    });

    if (!record[DOCUMENT_ID_COLUMN_NAME]) return;

    buildModelDisplays(record);
    buildEngineDisplay(record);

    row[idxA]  = record.Model_DisplayA || '';
    row[idxB]  = record.Model_DisplayB || '';
    row[idxC]  = record.Model_DisplayC || '';
    row[idxEng] = record.Engine_Display || '';

    values[r] = row;
  });

  range.setValues(values);
  Logger.log('Model_DisplayA/B/C と Engine_Display を再計算して書き込みました。');
}
