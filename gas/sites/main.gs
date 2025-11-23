/***** =========================================================
 * Registro500 Giappone — main.gs (API Server Mode)
 * - Vercel等の外部フロントエンドからのリクエストを受け付けるAPI
 * - HTML出力機能は廃止し、JSONデータを返す
 * ========================================================= ****/

// =================================================
// 設定項目
// =================================================
const SHEET_NAME_MASTER = 'cars';
const DOCUMENT_ID_COLUMN_NAME = 'DocumentID';

// Firebase Storage のベースURL
const FIREBASE_STORAGE_BASE_URL =
  'https://firebasestorage.googleapis.com/v0/b/registro500giappone-93f98.firebasestorage.app/o/';

// 写真カラム
const PHOTO_COLUMNS = [
  'PhotoMain', 'PhotoFront', 'PhotoSide', 'PhotoRear',
  'PhotoEngine', 'PhotoInterior', 'PhotoSteeringCluster',
];

// 一覧表示に必要なカラム
const INDEX_VIEW_COLUMNS = [
  'PhotoMain', 'Model_DisplayC', 'Year', 'Prefecture', 'HandleName', 'DocumentID',
];

// 管理者メールアドレス
const ADMIN_EMAILS = ['registro500giappone@gmail.com'];

// =================================================
// CORS対応 & JSONレスポンス生成ヘルパー
// =================================================

/**
 * JSONを返す共通関数（CORSヘッダー付き）
 */
function createJsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * OPTIONSメソッド対応（プリフライトリクエスト用）
 * ※ これがないとブラウザからのfetchがブロックされる
 */
function doOptions(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// =================================================
// GETリクエスト処理 (データ取得系)
// =================================================

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const mode = params.mode || 'index'; // index, detail, edit_init
  const docId = params.doc || '';

  let resultData = {};

  try {
    if (mode === 'index') {
      // 一覧取得
      resultData = getIndexData();
    } else if (mode === 'detail') {
      // 詳細取得
      if (!docId) throw new Error('DocumentID is required');
      resultData = getDetailData(docId);
    } else if (mode === 'edit_init') {
      // 編集用データ取得
      if (docId) {
        resultData = getCarForEdit(docId);
      } else {
        resultData = {}; // 新規登録なら空
      }
    } else {
      throw new Error('Unknown mode');
    }

    // 成功レスポンス
    return createJsonOutput({ success: true, data: resultData });

  } catch (err) {
    // エラーレスポンス
    return createJsonOutput({ success: false, error: err.toString() });
  }
}

// =================================================
// POSTリクエスト処理 (保存・更新系)
// =================================================

function doPost(e) {
  try {
    // postData.contents に JSON 文字列が入ってくる想定
    if (!e.postData || !e.postData.contents) {
      throw new Error('No post data');
    }
    
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action; // save, update
    const formData = requestData.formData;

    if (!formData) throw new Error('No form data');

    let result = {};

    if (action === 'save') {
      result = saveCarFromForm(formData);
    } else if (action === 'update') {
      result = updateCarFromForm(formData);
    } else {
      throw new Error('Unknown action');
    }

    return createJsonOutput({ success: true, data: result });

  } catch (err) {
    return createJsonOutput({ success: false, error: err.toString() });
  }
}

// =================================================
// 内部ロジック：データ取得
// =================================================

function getIndexData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  if (!sheet) throw new Error('Sheet not found');

  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const allCars = [];

  values.forEach(row => {
    const record = {};
    headers.forEach((h, i) => { if(h) record[h.toString().trim()] = row[i]; });
    if (!record[DOCUMENT_ID_COLUMN_NAME]) return;

    buildModelDisplays(record);
    
    const viewCar = {};
    INDEX_VIEW_COLUMNS.forEach(col => { viewCar[col] = record[col] || ''; });
    if (viewCar.PhotoMain) viewCar.PhotoMain = fixSinglePhotoUrl(viewCar.PhotoMain);
    allCars.push(viewCar);
  });
  return allCars;
}

function getDetailData(docId) {
  const record = getCarForEdit(docId); // 再利用
  if (Object.keys(record).length === 0) throw new Error('Car not found');
  
  buildModelDisplays(record);
  buildEngineDisplay(record);
  fixPhotoUrls(record);
  
  // 詳細ページでは OwnerEmail はセキュリティのため隠すのが通例だが
  // フロントで本人判定に使うなら送る必要がある。
  // 今回は「編集権限チェック」はサーバー(POST時)でやるので、
  // 表示用にメアドを返すかどうかは要検討。一旦そのまま返します。
  return record;
}

function getCarForEdit(documentId) {
  const targetId = String(documentId).trim();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const colIndex = header.indexOf(DOCUMENT_ID_COLUMN_NAME);

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][colIndex]).trim() === targetId) {
      const record = {};
      header.forEach((h, c) => { if(h) record[h.toString().trim()] = values[r][c]; });
      return record;
    }
  }
  return {};
}

// =================================================
// 内部ロジック：保存・更新
// =================================================

function saveCarFromForm(formData) {
  // IDトークン検証
  const activeEmail = verifyIdToken_(formData.idToken);
  if (!activeEmail) throw new Error('認証エラー: 再ログインしてください');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const docIdColIndex = headers.indexOf(DOCUMENT_ID_COLUMN_NAME);

  // ID採番
  let nextNumber = 1;
  if (sheet.getLastRow() > 1) {
    const ids = sheet.getRange(2, docIdColIndex + 1, sheet.getLastRow() - 1, 1).getValues().flat();
    ids.forEach(id => {
      const m = /^DOC_(\d+)$/.exec(String(id));
      if (m && Number(m[1]) >= nextNumber) nextNumber = Number(m[1]) + 1;
    });
  }
  const newDocId = 'DOC_' + nextNumber;
  const now = new Date();

  const record = {};
  headers.forEach(col => {
    if (col === DOCUMENT_ID_COLUMN_NAME) record[col] = newDocId;
    else if (col === 'OwnerEmail') record[col] = activeEmail;
    else if (col === 'createdAt' || col === 'updatedAt') record[col] = now;
    else record[col] = (formData[col] !== undefined) ? formData[col] : '';
  });

  buildModelDisplays(record);
  buildEngineDisplay(record);

  sheet.appendRow(headers.map(col => record[col] !== undefined ? record[col] : ''));
  return { ok: true, DocumentID: newDocId };
}

function updateCarFromForm(formData) {
  const docId = formData.DocumentID;
  if (!docId) throw new Error('DocumentID is missing');

  // IDトークン検証
  const activeEmail = verifyIdToken_(formData.idToken);
  if (!activeEmail) throw new Error('認証エラー: 再ログインしてください');

  // 編集権限チェック
  if (!hasEditPermission(docId, activeEmail)) throw new Error('編集権限がありません');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const docIdColIndex = headers.indexOf(DOCUMENT_ID_COLUMN_NAME);
  const ownerEmailColIndex = headers.indexOf('OwnerEmail');

  const data = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][docIdColIndex]) === docId) {
      targetRow = i + 1;
      break;
    }
  }
  if (targetRow === -1) throw new Error('Target not found');

  const ownerEmail = String(data[targetRow - 1][ownerEmailColIndex]).trim();
  const now = new Date();
  const record = {};

  headers.forEach((col, idx) => {
    let val = data[targetRow - 1][idx];
    if (col === 'OwnerEmail') val = ownerEmail; // 維持
    else if (col === 'updatedAt') val = now;
    else if (col !== 'createdAt' && col !== DOCUMENT_ID_COLUMN_NAME && formData[col] !== undefined) {
      val = formData[col];
    }
    record[col] = val;
  });

  buildModelDisplays(record);
  buildEngineDisplay(record);

  sheet.getRange(targetRow, 1, 1, headers.length).setValues([headers.map(col => record[col])]);
  return { ok: true, DocumentID: docId };
}

// =================================================
// 共通ロジック (表示整形・検証)
// =================================================

function resolveSelectAndText(s, t) {
  s = (s || '').toString().trim();
  t = (t || '').toString().trim();
  if (s && s !== 'その他') return s;
  if (t) return t;
  return '';
}

function buildModelDisplays(record) {
  const modelA = resolveSelectAndText(record.ModelSelectA, record.ModelTextA);
  const modelB = resolveSelectAndText(record.ModelSelectB, record.ModelTextB);
  record.Model_DisplayA = modelA;
  record.Model_DisplayB = modelB;
  const parts = [];
  if (modelA) parts.push(modelA);
  if (modelB) parts.push(modelB);
  record.Model_DisplayC = parts.join(' ');
}

function buildEngineDisplay(record) {
  record.Engine_Display = resolveSelectAndText(record.EngineTypeSelect, record.EngineTypeText);
}

function fixPhotoUrls(carData) {
  PHOTO_COLUMNS.forEach(col => {
    if (carData[col]) carData[col] = fixSinglePhotoUrl(carData[col]);
  });
}

function fixSinglePhotoUrl(url) {
  if (url && url.includes('appspot.com')) {
    const m = url.match(/\/o\/(.+)\?alt=media/);
    if (m && m[1]) return FIREBASE_STORAGE_BASE_URL + m[1] + '?alt=media';
  }
  return url;
}

function verifyIdToken_(idToken) {
  if (!idToken) return null;
  const endpoint = 'https://oauth2.googleapis.com/tokeninfo';
  const options = {
    'method': 'post',
    'payload': { 'id_token': idToken },
    'muteHttpExceptions': true
  };
  try {
    const response = UrlFetchApp.fetch(endpoint, options);
    const content = JSON.parse(response.getContentText());
    if (content.error || content.error_description) return null;
    return content.email ? content.email.toLowerCase() : null;
  } catch (e) {
    return null;
  }
}

function hasEditPermission(docId, activeEmail) {
  if (!docId || !activeEmail) return false;
  if (isAdminEmail(activeEmail)) return true;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const docIdx = header.indexOf(DOCUMENT_ID_COLUMN_NAME);
  const ownerIdx = header.indexOf('OwnerEmail');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][docIdx]) === docId) {
      const owner = String(data[i][ownerIdx] || '').toLowerCase().trim();
      return owner === activeEmail;
    }
  }
  return false;
}

function isAdminEmail(email) {
  return ADMIN_EMAILS.some(a => a.toLowerCase() === email);
}
