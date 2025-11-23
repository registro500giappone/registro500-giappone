/***** =========================================================
 * Registro500 Giappone — main.gs (Firebase Identity Toolkit Ver)
 * - 2025-11-24: 認証をFirebase公式REST APIに変更（Invalid Valueの根本解決）
 * ========================================================= ****/

// =================================================
// 設定項目
// =================================================
const SHEET_NAME_MASTER = 'cars';
const DOCUMENT_ID_COLUMN_NAME = 'DocumentID';

// Firebase設定（サーバー側での検証に使用）
// edit.html にあるものと同じ API Key です
const FIREBASE_API_KEY = "AIzaSyCNCNsu61S3DIQ2pcmK2Ic_vqCINlZB9nk";

const FIREBASE_STORAGE_BASE_URL =
  'https://firebasestorage.googleapis.com/v0/b/registro500giappone-93f98.firebasestorage.app/o/';

const PHOTO_COLUMNS = [
  'PhotoMain', 'PhotoFront', 'PhotoSide', 'PhotoRear',
  'PhotoEngine', 'PhotoInterior', 'PhotoSteeringCluster',
];

const INDEX_VIEW_COLUMNS = [
  'PhotoMain', 'Model_DisplayC', 'Year', 'Prefecture', 'HandleName', 'DocumentID',
];

const ADMIN_EMAILS = ['registro500giappone@gmail.com'];

// =================================================
// CORS & JSON Response
// =================================================

function createJsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// =================================================
// Routing (GET/POST)
// =================================================

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const mode = params.mode || 'index';
  const docId = params.doc || '';

  let resultData = {};
  try {
    if (mode === 'index') resultData = getIndexData();
    else if (mode === 'detail') resultData = getDetailData(docId);
    else if (mode === 'edit_init') resultData = docId ? getCarForEdit(docId) : {};
    else throw new Error('Unknown mode');
    
    return createJsonOutput({ success: true, data: resultData });
  } catch (err) {
    return createJsonOutput({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) throw new Error('No post data');
    
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const formData = requestData.formData;

    if (!formData) throw new Error('No form data');

    let result = {};
    if (action === 'save') result = saveCarFromForm(formData);
    else if (action === 'update') result = updateCarFromForm(formData);
    else throw new Error('Unknown action');

    return createJsonOutput({ success: true, data: result });
  } catch (err) {
    return createJsonOutput({ success: false, error: err.message });
  }
}

// =================================================
// ★ 新・認証ロジック (Firebase Identity Toolkit)
// =================================================

function getActiveEmail() {
  try { return (Session.getActiveUser().getEmail() || '').toLowerCase(); } 
  catch (err) { return ''; }
}

/**
 * IDトークンを検証し、メールアドレスを返す
 */
function getAuthEmailFromFormData_(formData) {
  // 1. IDトークンがある場合（最優先）
  if (formData && formData.idToken) {
    const result = verifyFirebaseToken_(formData.idToken);
    if (result.email) return result.email;
    if (result.error) throw new Error(result.error);
  }

  // 2. トークンがない場合（従来セッション）
  const sessionEmail = getActiveEmail();
  if (sessionEmail) return sessionEmail;

  return ''; 
}

/**
 * Firebase 公式 API (Identity Toolkit) を使ってトークンを検証
 * JSONで通信するため、文字化けや形式エラーが起きにくい
 */
function verifyFirebaseToken_(idToken) {
  if (!idToken) return { error: 'トークンが空です' };
  
  // Firebase Identity Toolkit エンドポイント
  const endpoint = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY;
  
  const payload = {
    idToken: idToken
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json', // JSONとして送信
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(endpoint, options);
    const content = JSON.parse(response.getContentText());
    
    // エラー判定
    if (content.error) {
      // エラー詳細を返す（400 Bad Request等）
      return { error: 'Firebase認証エラー: ' + content.error.message };
    }
    
    // 成功時：users配列の最初の要素に情報が入っている
    if (content.users && content.users.length > 0) {
      const user = content.users[0];
      return { email: user.email.toLowerCase() };
    }
    
    return { error: 'ユーザー情報が見つかりませんでした' };
    
  } catch (e) {
    return { error: '通信エラー: ' + e.toString() };
  }
}

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.some(a => a.toLowerCase() === email);
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

// =================================================
// データ処理 (Save/Update/Get)
// =================================================

function saveCarFromForm(formData) {
  const activeEmail = getAuthEmailFromFormData_(formData);
  if (!activeEmail) throw new Error('ログイン情報が見つかりません。再ログインしてください。');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const docIdColIndex = headers.indexOf(DOCUMENT_ID_COLUMN_NAME);

  let nextNumber = 1;
  if (sheet.getLastRow() > 1) {
    const idValues = sheet.getRange(2, docIdColIndex + 1, sheet.getLastRow() - 1, 1).getValues().flat();
    idValues.forEach(id => {
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
  clearCache(newDocId);
  return { ok: true, DocumentID: newDocId };
}

function updateCarFromForm(formData) {
  const docId = formData.DocumentID;
  if (!docId) throw new Error('DocumentID がありません');

  const activeEmail = getAuthEmailFromFormData_(formData);
  if (!activeEmail) throw new Error('ログイン情報が見つかりません');
  
  if (!hasEditPermission(docId, activeEmail)) throw new Error('編集権限がありません（オーナーと異なります）');

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
  if (targetRow === -1) throw new Error('対象データが見つかりません');

  const ownerEmail = String(data[targetRow - 1][ownerEmailColIndex] || '').trim();
  const now = new Date();
  const record = {};

  headers.forEach((col, idx) => {
    let val = data[targetRow - 1][idx];
    if (col === 'OwnerEmail') val = ownerEmail;
    else if (col === 'updatedAt') val = now;
    else if (col !== 'createdAt' && col !== DOCUMENT_ID_COLUMN_NAME && formData[col] !== undefined) {
      val = formData[col];
    }
    record[col] = val;
  });

  buildModelDisplays(record);
  buildEngineDisplay(record);

  sheet.getRange(targetRow, 1, 1, headers.length).setValues([headers.map(col => record[col])]);
  clearCache(docId);
  return { ok: true, DocumentID: docId };
}

function getIndexData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
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
  const record = getCarForEdit(docId);
  if (Object.keys(record).length === 0) throw new Error('Car not found');
  buildModelDisplays(record);
  buildEngineDisplay(record);
  fixPhotoUrls(record);
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
// Helpers
// =================================================

function resolveSelectAndText(s, t) {
  s = (s || '').toString().trim();
  t = (t || '').toString().trim();
  return (s && s !== 'その他') ? s : t;
}

function buildModelDisplays(record) {
  const modelA = resolveSelectAndText(record.ModelSelectA, record.ModelTextA);
  const modelB = resolveSelectAndText(record.ModelSelectB, record.ModelTextB);
  record.Model_DisplayA = modelA;
  record.Model_DisplayB = modelB;
  record.Model_DisplayC = [modelA, modelB].filter(Boolean).join(' ');
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

function clearCache(docId) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('car_' + docId);
    cache.remove('cache_warmed_up');
  } catch (e) {}
}
