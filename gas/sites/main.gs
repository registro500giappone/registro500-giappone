
/***** =========================================================
 *  Registro500 Giappone — main.gs
 *  - cars シートをマスターにした一覧／詳細表示
 *  - Model_DisplayA/B/C, Engine_Display 自動生成
 *  - 2025-11-20: ログイン＆権限チェックを Session.getActiveUser ベースに統一
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

// ★ オーナー用 Web アプリの URL
//   ひとまず PUBLIC と同じでOK。あとで「オーナー専用デプロイ」を作ったら
//   その exec URL に差し替えます。
const OWNER_WEB_APP_URL = WEB_APP_URL;

// 管理者（運営者）メールアドレス（複数想定）
const ADMIN_EMAILS = [
  'registro500giappone@gmail.com', // 必要なら追加・変更可
];

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
// ログイン＆権限まわりの共通関数
// =================================================

/**
 * 現在ログイン中のユーザーのメールアドレスを取得（小文字・前後空白カット）
 * ログインしていない場合は空文字を返す
 */
function getActiveEmail() {
  var email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (err) {
    email = '';
  }
  return email.toString().trim().toLowerCase();
}

/**
 * 管理者メールかどうか判定
 */
function isAdminEmail(email) {
  if (!email) return false;
  var norm = email.toString().trim().toLowerCase();
  return ADMIN_EMAILS.some(function (admin) {
    return admin && admin.toString().trim().toLowerCase() === norm;
  });
}

/**
 * 指定の DocumentID を「編集してよいか」を判定
 * - ログインしていない → false
 * - 管理者メール → true
 * - cars シートの OwnerEmail と一致 → true
 */
function hasEditPermission(docId) {
  var activeEmail = getActiveEmail();
  if (!activeEmail) return false;
  if (isAdminEmail(activeEmail)) return true;
  if (!docId) return false;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  if (!sheet) {
    throw new Error('hasEditPermission: シートが見つかりません: ' + SHEET_NAME_MASTER);
  }

  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return false;
  }

  var header = values[0];
  var idxDoc = header.indexOf(DOCUMENT_ID_COLUMN_NAME);
  var idxOwner = header.indexOf('OwnerEmail');

  if (idxDoc === -1 || idxOwner === -1) {
    throw new Error('hasEditPermission: DocumentID または OwnerEmail 列が見つかりません。');
  }

  var targetId = String(docId).trim();

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var idInRow = String(row[idxDoc]).trim();
    if (idInRow === targetId) {
      var ownerEmail = (row[idxOwner] || '').toString().trim().toLowerCase();
      return !!(ownerEmail && ownerEmail === activeEmail);
    }
  }

  return false;
}

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
 * - Model_DisplayC は「A + B」のみ（Year は含めない）
 */
function buildModelDisplays(record) {
  const modelA = resolveSelectAndText(record.ModelSelectA, record.ModelTextA);
  const modelB = resolveSelectAndText(record.ModelSelectB, record.ModelTextB);

  record.Model_DisplayA = modelA;
  record.Model_DisplayB = modelB;

  const parts = [];
  if (modelA) parts.push(modelA);
  if (modelB) parts.push(modelB);

  // ★ 年式は入れず、純粋にモデル名だけ
  const display = parts.join(' ');

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
  const params = (e && e.parameter) ? e.parameter : {};
  const mode   = params.mode || '';
  const docId  = params.doc  || '';

  // 1) 既存車両の「オーナーログイン（編集ゲート）」
  //    detail.html から ownerAppUrl?mode=editGate&doc=DOC_xxx で呼び出す
  if (mode === 'editGate' && docId) {
    return renderOwnerEditGate_(docId);
  }

  // 2) 編集フォーム
  //    ?mode=edit&doc=DOC_xxx   → 既存編集
  //    ?mode=edit               → 新規登録
  if (mode === 'edit') {
    return renderEdit(docId);
  }

  // 3) 詳細表示
  if (mode === 'detail') {
    if (!docId) {
      return HtmlService.createHtmlOutput('エラー: 車両ID(doc)が指定されていません。');
    }
    return renderDetail(docId);
  }

  // 4) mode 未指定 or 'index' → 一覧
  return renderIndex();
}

// ★ policy / howto / owner を足した外側の doGet
function doGet(e) {
  var params    = (e && e.parameter) ? e.parameter : {};
  var mode      = params.mode || '';
  var scriptUrl = WEB_APP_URL;  // ★ 絶対にこの URL だけを使う

  try {
    // 1) ?mode=policy → policy.html
    if (mode === 'policy') {
      var tPolicy = HtmlService.createTemplateFromFile('policy');
      tPolicy.scriptUrl = scriptUrl;  // 戻り先URL
      return tPolicy
        .evaluate()
        .setTitle('Registro500 Giappone')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // 2) ?mode=howto → howto.html
    if (mode === 'howto') {
      var tHowto = HtmlService.createTemplateFromFile('howto');
      tHowto.scriptUrl = scriptUrl;
      return tHowto
        .evaluate()
        .setTitle('Registro500 Giappone')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // 3) ?mode=owner → オーナーページ
    if (mode === 'owner') {
      return renderOwnerPage_();
    }

    // 4) それ以外（index/detail/edit）は、元の処理に任せる
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
// 詳細ページ生成（isOwner 判定つき）
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

    // ログインユーザーとOwnerEmailを比較して本人か判定（小文字比較）
    var currentEmail = '';
    try {
      currentEmail = Session.getActiveUser().getEmail() || '';
    } catch (err) {
      currentEmail = '';
    }
    var ownerEmailRaw = (targetCar.OwnerEmail || '').toString().trim();
    var currentEmailNorm = currentEmail.toString().trim().toLowerCase();
    var ownerEmailNorm   = ownerEmailRaw.toString().trim().toLowerCase();
    var isOwner = !!(currentEmailNorm && ownerEmailNorm && currentEmailNorm === ownerEmailNorm);

    // テンプレートへ
    const template = HtmlService.createTemplateFromFile('detail.html');
    template.carData     = targetCar;
    template.isOwner     = isOwner;
    template.scriptUrl   = WEB_APP_URL;
    template.ownerAppUrl = OWNER_WEB_APP_URL; // ★ 編集・新規登録用リンク

    return template.evaluate()
      .setTitle('車両詳細: ' + (targetCar.HandleName || ''))
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    Logger.log(error);
    return HtmlService.createHtmlOutput('<pre>エラーが発生しました:\n' + error.message + '</pre>');
  }
}

// =================================================
// 編集用：DocumentID から 1件分のレコードを取得（edit.html から呼び出し）
// =================================================

/**
 * cars マスターシートを取得する共通ヘルパー
 */
function getMasterSheetForCars_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  if (!sheet) {
    throw new Error('マスターシート \"' + SHEET_NAME_MASTER + '\" が見つかりません。');
  }
  return sheet;
}

/**
 * 編集フォーム用：DocumentID で 1 行だけ取得して返す
 *  - 1行目をヘッダーとして {列名: 値} のオブジェクトに変換
 *  - DocumentID の前後空白は無視して比較
 */
// =================================================
// 編集フォーム用：DocumentID から 1 行だけ取得して返す
//   - このプロジェクトの他の処理と同じく
//     「cars シート（SHEET_NAME_MASTER）」だけを見る
// =================================================
function getCarForEdit(documentId) {
  if (!documentId) {
    Logger.log('getCarForEdit: documentId が空です');
    return {};
  }

  // DocumentID は前後の空白を削って比較
  var targetId = String(documentId).trim();
  Logger.log('getCarForEdit: targetId = ' + targetId);

  // ★ 他の関数と同じルート：
  // SpreadsheetApp.getActiveSpreadsheet() → SHEET_NAME_MASTER（cars）
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  if (!sheet) {
    throw new Error('getCarForEdit: シートが見つかりません: ' + SHEET_NAME_MASTER);
  }

  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    Logger.log('getCarForEdit: データ行がありません');
    return {};
  }

  var header = values[0];
  var colIndex = header.indexOf(DOCUMENT_ID_COLUMN_NAME); // "DocumentID"
  if (colIndex === -1) {
    throw new Error('getCarForEdit: 列 "' + DOCUMENT_ID_COLUMN_NAME + '" が見つかりません');
  }

  // 2 行目以降を走査して DocumentID 一致行を探す
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var idInRow = String(row[colIndex]).trim();

    if (idInRow === targetId) {
      var record = {};

      for (var c = 0; c < header.length; c++) {
        var key = String(header[c]);
        if (!key) continue;
        record[key] = row[c];
      }

      Logger.log(
        'getCarForEdit HIT: ' + targetId +
        ' / HandleName=' + (record.HandleName || '') +
        ' / OwnerEmail=' + (record.OwnerEmail || '')
      );

      return record;
    }
  }

  // 見つからなかった場合
  Logger.log('getCarForEdit NOT FOUND: ' + targetId);
  return {};
}

// =================================================
// 編集フォーム表示（新規 / 既存編集 両対応）
// =================================================
function renderEdit(docId) {
  // ★重要★
  // ここではサーバー側でログイン判定・オーナー判定を行わない。
  // 認証および OwnerEmail との照合は edit.html 内の Firebase Auth ロジックに一本化する。
  // （ログインしていない場合のメッセージも edit.html 側で制御する）

  const template = HtmlService.createTemplateFromFile('edit');

  // 他の画面と同じく scriptUrl を渡す
  template.scriptUrl = WEB_APP_URL;

  // URL から来た DocumentID（空のこともある）
  template.initialDocId = docId || '';

  // サーバ側で事前にレコードを取得しておく（ログイン有無に関係なく）
  let initialCarData = null;
  if (docId) {
    try {
      const record = getCarForEdit(docId);
      if (record && Object.keys(record).length > 0) {
        initialCarData = record;
      } else {
        Logger.log('renderEdit: getCarForEdit でレコードが見つからず: ' + docId);
      }
    } catch (err) {
      Logger.log('renderEdit: getCarForEdit エラー: ' + err);
    }
  }

  // テンプレート変数として渡す
  template.initialCarData = initialCarData;  // null またはレコードオブジェクト

  return template
    .evaluate()
    .setTitle('Registro500Giappone - 編集フォーム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

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

      // Model_DisplayC を再計算
      buildModelDisplays(record);

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
    template.allCars    = allCars;
    template.scriptUrl  = WEB_APP_URL;
    template.ownerAppUrl = OWNER_WEB_APP_URL;  // ★ ログイン／新規登録リンク用

    return template
      .evaluate()
      .setTitle('車両一覧')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

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
//  - AuthEmail には依存せず、サーバ側のログインユーザーを OwnerEmail に保存
// =================================================

function saveCarFromForm(formData) {

  // サーバ側で現在のログインユーザーを取得（未ログインならエラー）
  var activeEmail = getActiveEmail();
  if (!activeEmail) {
    throw new Error('Google アカウントでログインしてから保存してください。');
  }

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
        // 現在ログイン中のユーザーをオーナーとして保存
        record[col] = activeEmail;
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

  // キャッシュを軽く無効化（次回アクセスで再構築させる）
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEY_PREFIX_CAR + newDocId);
  cache.remove(CACHE_KEY_WARMED_UP);

  return {
    ok: true,
    DocumentID: newDocId
  };
}

// =================================================
// フォームから受け取ったデータで既存行を更新（編集）
// ・AuthEmail には依存せず、サーバ側のログインユーザー＆シートの OwnerEmail / 管理者で判定
// =================================================

function updateCarFromForm(formData) {

  // --- DocumentID の取得とチェック ---
  const docId = (formData && formData.DocumentID) ? String(formData.DocumentID) : '';

  if (!docId) {
    throw new Error('DocumentID が指定されていません。');
  }

  // 現在ログイン中のユーザー確認（未ログインならエラー）
  var activeEmail = getActiveEmail();
  if (!activeEmail) {
    throw new Error('Google アカウントでログインしてから保存してください。');
  }

  // オーナー or 管理者かをサーバ側で確認
  if (!hasEditPermission(docId)) {
    throw new Error('この車両を編集できるのは、登録したオーナー本人（または管理者）のみです。');
  }

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  if (!sheet) {
    throw new Error('シートが見つかりません: ' + SHEET_NAME_MASTER);
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) {
    throw new Error('データ行がありません。');
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  const docIdColIndex      = headers.indexOf(DOCUMENT_ID_COLUMN_NAME);
  const ownerEmailColIndex = headers.indexOf('OwnerEmail');

  if (docIdColIndex === -1) {
    throw new Error('DocumentID 列が見つかりません。');
  }
  if (ownerEmailColIndex === -1) {
    throw new Error('OwnerEmail 列が見つかりません。');
  }

  // --- 対象行を探す（DocumentID が一致する行） ---
  const idValues = sheet
    .getRange(2, docIdColIndex + 1, lastRow - 1, 1)
    .getValues()
    .flat();

  let targetRow = -1;  // シート上の行番号（1始まり）
  idValues.forEach(function (id, idx) {
    if (String(id) === docId && targetRow === -1) {
      targetRow = idx + 2; // データは2行目から
    }
  });

  if (targetRow === -1) {
    throw new Error('指定された車両IDの行が見つかりません: ' + docId);
  }

  // --- 既存のオーナー情報を取得（値はそのまま維持する） ---
  const ownerEmailCell = sheet.getRange(targetRow, ownerEmailColIndex + 1).getValue();
  const ownerEmail     = (ownerEmailCell || '').toString().trim();

  // --- 既存の行データを取得 ---
  const currentRowValues = sheet.getRange(targetRow, 1, 1, lastCol).getValues()[0];
  const record = {};
  const now = new Date();

  headers.forEach(function (header, idx) {
    const colName = (header || '').toString().trim();
    if (!colName) return;

    let value = currentRowValues[idx]; // デフォルトは現在の値

    switch (colName) {
      case DOCUMENT_ID_COLUMN_NAME:
      case '_id':
      case 'firebase_id':
      case 'record_id':
      case '🔐 Softr Record ID':
        // これらは既存値を維持
        break;

      case 'OwnerEmail':
        // オーナーは既存値（ownerEmail）で固定
        value = ownerEmail;
        break;

      case 'createdAt':
        // 作成日時はそのまま
        break;

      case 'updatedAt':
        // 更新日時だけ現在時刻に更新
        value = now;
        break;

      default:
        // フォームから値が来ていれば上書き、なければ既存値
        if (formData && Object.prototype.hasOwnProperty.call(formData, colName)) {
          value = formData[colName];
        }
        break;
    }

    record[colName] = value;
  });

  // 表示用フィールドを再計算
  buildModelDisplays(record);
  buildEngineDisplay(record);

  // シートに書き戻し
  const newRowValues = headers.map(function (col) {
    return record[col] !== undefined ? record[col] : '';
  });

  sheet.getRange(targetRow, 1, 1, lastCol).setValues([newRowValues]);

  // キャッシュを軽く無効化（次回アクセスで再構築させる）
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEY_PREFIX_CAR + docId);
  cache.remove(CACHE_KEY_WARMED_UP);

  // クライアント側に返す（saveCarFromForm と同じ形）
  return {
    ok: true,
    DocumentID: docId   // ★ ここが重要：必ず docId を返す
  };
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

// ===== デバッグ専用：DOC_1 / DOC_2 / DOC_15 を取得してログに出す =====

function debugGetCar_DOC_1() {
  const r = getCarForEdit('DOC_1');
  Logger.log('DOC_1 = ' + JSON.stringify(r, null, 2));
}

function debugGetCar_DOC_2() {
  const r = getCarForEdit('DOC_2');
  Logger.log('DOC_2 = ' + JSON.stringify(r, null, 2));
}

function debugGetCar_DOC_15() {
  const r = getCarForEdit('DOC_15');
  Logger.log('DOC_15 = ' + JSON.stringify(r, null, 2));
}

/**
 * 特定車両のオーナー向け「編集ログインゲート」
 * - ?mode=editGate&doc=DOC_xxx で呼び出し
 */
function renderOwnerEditGate_(docId) {
  if (!docId) {
    return HtmlService.createHtmlOutput('エラー: 車両ID(doc)が指定されていません。');
  }

  var t = HtmlService.createTemplateFromFile('owner_edit_gate'); // さきほど作ったHTML
  t.scriptUrl   = WEB_APP_URL;       // 公開側 scriptUrl（戻り先などに使用）
  t.ownerAppUrl = OWNER_WEB_APP_URL; // 将来オーナー専用URLに分けるときのために一応
  t.documentId  = docId;             // この車両の DOC_xxx

  return t
    .evaluate()
    .setTitle('Registro500 Giappone - オーナーログイン（編集）')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * オーナーページ（mode=owner）
 * - このページ自体ではシート更新はしない
 * - ログイン状態だけ isLoggedIn でテンプレートに渡す
 */
function renderOwnerPage_() {
  var t = HtmlService.createTemplateFromFile('owner'); // owner.html テンプレート

  // 一覧などに戻るときの URL（既存どおり）
  t.scriptUrl   = WEB_APP_URL;
  t.ownerAppUrl = OWNER_WEB_APP_URL;

  // ★ ログイン状態だけ判定（メールアドレス文字列はテンプレートに渡さない）
  var email = '';
  var isLoggedIn = false;
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (err) {
    email = '';
  }
  if (email) {
    isLoggedIn = true;
  }
  t.isLoggedIn = isLoggedIn;

  return t
    .evaluate()
    .setTitle('Registro500 Giappone - オーナーページ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
