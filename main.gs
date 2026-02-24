/**
 * =========================================================
 * Registro500 Giappone — main.gs (Complete 2026-01-05)
 * =========================================================
 */

// =================================================
// 設定項目
// =================================================
const SHEET_NAME_MASTER = 'cars';
const SHEET_NAME_EVENTS = 'events';
const SHEET_NAME_PARTICIPANTS = 'event_participants';
const DOCUMENT_ID_COLUMN_NAME = 'DocumentID';
const CACHE_KEY_ALL_CARS = 'all_cars_json_v7'; // キャッシュキー更新

// Firebase設定
const FIREBASE_API_KEY = "AIzaSyCNCNsu61S3DIQ2pcmK2Ic_vqCINlZB9nk";
const FIREBASE_STORAGE_BASE_URL = 'https://firebasestorage.googleapis.com/v0/b/registro500giappone-93f98.firebasestorage.app/o/';

// Supabase設定
const SUPABASE_URL = 'https://ttlttclfovuzafvghvaq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt';

// Brevo設定（APIキーはプロパティストアから取得）
function getBrevoApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY');
}
const SENDER_EMAIL = "registro500giappone@gmail.com";
const SENDER_NAME = "Registro500 Giappone";

const ADMIN_EMAILS = ['registro500giappone@gmail.com'];

const PHOTO_COLUMNS = ['PhotoMain', 'PhotoFront', 'PhotoSide', 'PhotoRear', 'PhotoEngine', 'PhotoInterior', 'PhotoSteeringCluster'];
const INDEX_VIEW_COLUMNS = ['PhotoMain', 'Model_DisplayC', 'Year', 'Prefecture', 'HandleName', 'DocumentID', 'updatedAt', 'BodyColor', 'EngineCC'];

// =================================================
// Web API ルーティング
// =================================================
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const mode = params.mode || 'index';
  const docId = params.doc || '';

  try {
    let resultData = {};
    if (mode === 'index') resultData = getIndexData();
    else if (mode === 'detail') resultData = getDetailData(docId);
    else if (mode === 'edit_init') resultData = docId ? getCarForEdit(docId) : {};
    else if (mode === 'events') resultData = getEventsData();
    else if (mode === 'mycars') resultData = getMyCarsList(params.idToken);
    // spot機能はSupabase直接アクセスのため、GAS経由のルーティングは削除
    else throw new Error('Unknown mode');
    return createJsonOutput({ success: true, data: resultData });
  } catch (err) { return createJsonOutput({ success: false, error: err.toString() }); }
}

function doPost(e) {
  try {
    if (!e.postData) throw new Error('No post data');
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const formData = requestData.formData;
    let result = {};

    if (action === 'save') result = saveCarFromForm(formData);
    else if (action === 'update') result = updateCarFromForm(formData);
    else if (action === 'inquiry') result = sendOwnerInquiry(formData);
    else if (action === 'save_event') result = saveEventFromForm(formData);
    else if (action === 'delete_event') result = deleteEvent(formData);
    else if (action === 'toggle_participation') result = toggleEventParticipation(formData);
    // spot機能はSupabase直接アクセスのため、GAS経由のルーティングは削除
    else throw new Error('Unknown action');
    return createJsonOutput({ success: true, data: result });
  } catch (err) { return createJsonOutput({ success: false, error: err.message }); }
}

// 許可されたオリジン（本番環境のみ）
const ALLOWED_ORIGIN = 'https://www.registro500.com';

function createJsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function doOptions(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// =================================================
// イベント機能 (Events & Participation)
// =================================================

function getEventsData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAME_EVENTS);
  const partSheet = ss.getSheetByName(SHEET_NAME_PARTICIPANTS);
  
  if (!eventSheet || eventSheet.getLastRow() < 2) return [];

  const eData = eventSheet.getDataRange().getValues();
  eData.shift(); 
  
  let participantsMap = {}; 
  if (partSheet && partSheet.getLastRow() >= 2) {
    const pData = partSheet.getDataRange().getValues();
    pData.shift();
    pData.forEach(row => {
      const eid = row[0];
      if (!participantsMap[eid]) participantsMap[eid] = [];
      participantsMap[eid].push({
        OwnerID: row[1],
        HandleName: row[2]
      });
    });
  }

  const events = eData.map(row => {
    const eid = row[0];
    return {
      EventID: eid,
      EventName: row[1],
      EventDate: row[2],
      Location: row[3],
      Fee: row[4],
      URL: row[5],
      Description: row[6],
      OwnerID: row[7],
      OwnerName: row[8],
      CreatedAt: row[9],
      Participants: participantsMap[eid] || []
    };
  });

  events.sort((a, b) => new Date(a.EventDate) - new Date(b.EventDate));
  return events;
}

function toggleEventParticipation(formData) {
  const auth = verifyFirebaseToken_(formData.idToken);
  if (auth.error) throw new Error("認証エラー");
  
  const myCars = getMyCarsList(formData.idToken);
  let myName = "";
  let myDocId = "";

  if (myCars.length > 0) {
    myDocId = myCars[0].DocumentID;
    myName = myCars[0].HandleName;
  } else if (isAdminEmail(auth.email)) {
    myDocId = "ADMIN";
    myName = "管理人";
  } else {
    throw new Error("参加表明するにはオーナー登録が必要です");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_PARTICIPANTS);
  const data = sheet.getDataRange().getValues();
  const eventId = formData.EventID;
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === eventId && String(data[i][1]) === myDocId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
    return { status: "removed", message: "参加を取り消しました" };
  } else {
    sheet.appendRow([eventId, myDocId, myName, new Date()]);
    return { status: "added", message: "参加表明しました！" };
  }
}

// イベント保存（新規・編集共通）
function saveEventFromForm(formData) {
  const auth = verifyFirebaseToken_(formData.idToken);
  if (auth.error) throw new Error("認証エラー");
  
  const myCars = getMyCarsList(formData.idToken);
  let selectedCar = myCars.find(c => c.DocumentID === formData.OwnerID);
  
  // 管理者特権
  const isAdmin = isAdminEmail(auth.email);
  if (!selectedCar && isAdmin) {
    selectedCar = { DocumentID: 'ADMIN', HandleName: '管理人' };
  }
  
  // 編集時の権限チェック用に、元の投稿者かどうかも確認したいが
  // ここではシンプルに「自分の持ち車リストにあるID」または「管理者」なら操作OKとする
  if (!selectedCar) throw new Error("権限がありません。");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_EVENTS);
  const data = sheet.getDataRange().getValues();
  
  // 編集モード判定 (EventIDがあるなら編集)
  let targetRow = -1;
  const eventID = formData.EventID;

  if (eventID) {
    // 既存データの検索
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === eventID) {
        // 権限チェック: 投稿者本人 または 管理者のみ編集可
        // ※formData.OwnerID は「今回選択した投稿者名義」なので、
        // 元のデータのOwnerIDと一致するか、あるいは管理者が操作しているか確認
        const originalOwner = String(data[i][7]);
        // 自分の持っている車IDリストに含まれているか
        const isMyPost = myCars.some(c => c.DocumentID === originalOwner);
        
        if (!isMyPost && !isAdmin && originalOwner !== 'ADMIN') {
           throw new Error("他人のイベントは編集できません");
        }
        
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error("編集対象のイベントが見つかりません");
  }

  // データの準備
  // [ID, Name, Date, Loc, Fee, URL, Desc, OwnerID, OwnerName, CreatedAt, Notification]
  const saveId = eventID || ('EVT_' + new Date().getTime());
  const createdAt = (targetRow !== -1) ? data[targetRow-1][9] : new Date();
  const notifSent = (targetRow !== -1) ? data[targetRow-1][10] : 'FALSE';

  const rowData = [
    saveId,
    formData.EventName,
    formData.EventDate,
    formData.Location,
    formData.Fee,
    formData.URL,
    formData.Description,
    selectedCar.DocumentID,
    selectedCar.HandleName,
    createdAt,
    notifSent
  ];

  if (targetRow !== -1) {
    // 上書き
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // 新規追加
    sheet.appendRow(rowData);
  }
  
  return { ok: true };
}

// イベント削除
function deleteEvent(formData) {
  const auth = verifyFirebaseToken_(formData.idToken);
  if (auth.error) throw new Error("認証エラー");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_EVENTS);
  const data = sheet.getDataRange().getValues();
  
  const myCars = getMyCarsList(formData.idToken);
  const isAdmin = isAdminEmail(auth.email);

  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === formData.EventID) {
      // 権限チェック
      const originalOwner = String(data[i][7]);
      const isMyPost = myCars.some(c => c.DocumentID === originalOwner);
      
      if (!isMyPost && !isAdmin && originalOwner !== 'ADMIN') {
         throw new Error("削除権限がありません");
      }
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) throw new Error("削除対象が見つかりません");
  
  sheet.deleteRow(targetRow);
  return { ok: true };
}

function getMyCarsList(idToken) {
  const result = verifyFirebaseToken_(idToken);
  if (result.error) throw new Error(result.error);
  const userEmail = result.email;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailIdx = headers.indexOf('OwnerEmail');
  const docIdx = headers.indexOf(DOCUMENT_ID_COLUMN_NAME);
  const nameIdx = headers.indexOf('HandleName');
  const modelIdx = headers.indexOf('Model_DisplayC'); 

  const myCars = [];
  for (let i = 1; i < data.length; i++) {
    const rowEmail = String(data[i][emailIdx] || '').toLowerCase().trim();
    if (rowEmail === userEmail) {
      myCars.push({
        DocumentID: data[i][docIdx],
        HandleName: data[i][nameIdx],
        Model: data[i][modelIdx] || 'FIAT 500'
      });
    }
  }
  return myCars;
}

// =================================================
// Supabase ヘルパー関数
// =================================================
function supabaseQuery_(table, select, filters) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (filters) {
    Object.keys(filters).forEach(key => {
      url += `&${key}=${encodeURIComponent(filters[key])}`;
    });
  }
  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    muteHttpExceptions: true
  };

  Logger.log('Supabase Query URL: ' + url);
  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();
  const statusCode = response.getResponseCode();

  Logger.log('Supabase Response Code: ' + statusCode);
  Logger.log('Supabase Response: ' + responseText);

  if (statusCode !== 200) {
    throw new Error('Supabase API Error: ' + responseText);
  }

  return JSON.parse(responseText);
}

function supabaseUpdate_(table, id, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const options = {
    method: 'patch',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(url, options);
}

// =================================================
// 通知機能 (Daily Digest: 新車 + イベント)
// =================================================
function sendDailyDigest() {
  try {
    // 過去24時間の基準時刻（ISO 8601形式）
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayISO = yesterday.toISOString();

    Logger.log('sendDailyDigest 開始: ' + now);
    Logger.log('基準時刻（過去24時間）: ' + yesterdayISO);

    // 1. 新車チェック（Supabase）
    const newCarsData = supabaseQuery_('cars', 'id,document_id,handle_name,model_display_c,notification_sent,created_at', {
      'notification_sent': 'eq.false',
      'created_at': `gte.${yesterdayISO}`,
      'order': 'created_at.asc'
    });

    if (!Array.isArray(newCarsData)) {
      throw new Error('newCarsData が配列ではありません: ' + JSON.stringify(newCarsData));
    }

    const newCars = newCarsData.map(car => ({
    ID: car.document_id,
    Name: car.handle_name,
    Model: car.model_display_c || 'FIAT 500',
    DbId: car.id
  }));

  // 2. 新規イベントチェック（Supabase）
  const newEventsData = supabaseQuery_('events', 'id,event_name,event_date,owner_name,location,notification_sent,created_at', {
    'notification_sent': 'eq.false',
    'created_at': `gte.${yesterdayISO}`,
    'order': 'created_at.asc'
  });

  const newEvents = newEventsData.map(evt => {
    const d = new Date(evt.event_date);
    return {
      Name: evt.event_name,
      Date: `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`,
      Owner: evt.owner_name,
      Loc: evt.location,
      DbId: evt.id
    };
  });

  if (newCars.length === 0 && newEvents.length === 0) {
    Logger.log("配信対象なし");
    return;
  }

  // 3. メール本文作成
  const subject = `【Registro500/126 Giappone】新着情報のお知らせ（車両・イベント）`;
  let body = `Registro500 / Registro126 Giappone オーナーの皆様\n\nおはようございます。\n新たに登録された車両・イベントのお知らせです。\n`;

  if (newEvents.length > 0) {
    body += `\n■ 📅 新しいイベント (${newEvents.length}件)\n`;
    newEvents.forEach(e => {
      body += `・${e.Date}開催: ${e.Name} (by ${e.Owner}様)\n　場所: ${e.Loc}\n　詳細: https://www.registro500.com/event.html\n`;
    });
  }

  if (newCars.length > 0) {
    body += `\n■ 🚗 新しい仲間 (${newCars.length}台)\n`;
    newCars.forEach(c => {
      body += `・${c.Model} (${c.Name}様)\n　https://www.registro500.com/detail.html?doc=${c.ID}\n`;
    });
  }

  body += `\n---------------------------------------------------------\nRegistro500 / Registro126 Giappone\nhttps://www.registro500.com/\n※このメールは新着があった日の午前6時に配信されます。`;

  // 4. 一斉送信
  const recipients = getAllExistingOwnerEmails_();
  if (recipients.length > 0) {
    const chunkSize = 90;
    for (let i = 0; i < recipients.length; i += chunkSize) {
      const chunk = recipients.slice(i, i + chunkSize);
      try {
        sendBroadcastViaBrevo(chunk, subject, body);
        Utilities.sleep(1000);
      } catch (e) { Logger.log('メール送信エラー: ' + e); }
    }
  }

  // 5. Supabase の notification_sent フラグを更新
  newCars.forEach(car => {
    try { supabaseUpdate_('cars', car.DbId, { notification_sent: true }); } catch (e) {}
  });
  newEvents.forEach(evt => {
    try { supabaseUpdate_('events', evt.DbId, { notification_sent: true }); } catch (e) {}
  });

    Logger.log(`メール配信完了: 車両${newCars.length}台、イベント${newEvents.length}件`);
  } catch (error) {
    Logger.log('❌ sendDailyDigest エラー: ' + error);
    Logger.log('スタックトレース: ' + error.stack);
    throw error;
  }
}

// Brevo & Utils
function sendBroadcastViaBrevo(bccEmailList, subject, textBody) {
  const url = "https://api.brevo.com/v3/smtp/email";
  const bccObjects = bccEmailList.map(email => ({ "email": email }));
  const payload = {
    "sender": { "name": SENDER_NAME, "email": SENDER_EMAIL },
    "to": [{ "email": SENDER_EMAIL }],
    "bcc": bccObjects, "subject": subject, "textContent": textBody
  };
  const options = {
    "method": "post", "headers": { "api-key": getBrevoApiKey_(), "Content-Type": "application/json", "accept": "application/json" },
    "payload": JSON.stringify(payload), "muteHttpExceptions": true
  };
  UrlFetchApp.fetch(url, options);
}
function getAllExistingOwnerEmails_() {
  const carsData = supabaseQuery_('cars', 'owner_email', {});
  const emailSet = new Set();
  carsData.forEach(car => {
    const val = String(car.owner_email || '').trim();
    if (val && val.includes('@')) emailSet.add(val.toLowerCase());
  });
  return Array.from(emailSet);
}
function verifyFirebaseToken_(idToken) {
  if (!idToken) return { error: 'トークンが空です' };
  const endpoint = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY;
  const payload = { idToken: idToken };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(endpoint, options);
    const content = JSON.parse(response.getContentText());
    if (content.error) return { error: content.error.message };
    if (content.users && content.users.length > 0) return { email: content.users[0].email.toLowerCase() };
    return { error: 'ユーザー情報なし' };
  } catch (e) { return { error: e.toString() }; }
}
function getActiveEmail() { try { return (Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (err) { return ''; } }
function isAdminEmail(email) { if (!email) return false; return ADMIN_EMAILS.some(a => a.toLowerCase() === email); }
function getIndexData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_ALL_CARS);
  if (cached != null) return JSON.parse(cached);
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
  try { cache.put(CACHE_KEY_ALL_CARS, JSON.stringify(allCars), 21600); } catch (e) {}
  return allCars;
}
function getDetailData(docId) { 
  const record = getCarForEdit(docId);
  if (Object.keys(record).length === 0) throw new Error('Car not found');
  buildModelDisplays(record); buildEngineDisplay(record); fixPhotoUrls(record); return record;
}
function getCarForEdit(docId) { 
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const colIndex = header.indexOf(DOCUMENT_ID_COLUMN_NAME);
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][colIndex]).trim() === String(docId).trim()) {
      const record = {}; header.forEach((h, c) => { if(h) record[h.toString().trim()] = values[r][c]; }); return record;
    }
  }
  return {};
}
function resolveSelectAndText(s, t) { s = (s || '').toString().trim(); t = (t || '').toString().trim(); return (s && s !== 'その他') ? s : t; }
function buildModelDisplays(record) {
  const modelA = resolveSelectAndText(record.ModelSelectA, record.ModelTextA);
  const modelB = resolveSelectAndText(record.ModelSelectB, record.ModelTextB);
  record.Model_DisplayA = modelA; record.Model_DisplayB = modelB; record.Model_DisplayC = [modelA, modelB].filter(Boolean).join(' ');
}
function buildEngineDisplay(record) { record.Engine_Display = resolveSelectAndText(record.EngineTypeSelect, record.EngineTypeText); }
function fixPhotoUrls(carData) { PHOTO_COLUMNS.forEach(col => { if (carData[col]) carData[col] = fixSinglePhotoUrl(carData[col]); }); }
function fixSinglePhotoUrl(url) { if (url && url.includes('appspot.com')) { const m = url.match(/\/o\/(.+)\?alt=media/); if (m && m[1]) return FIREBASE_STORAGE_BASE_URL + m[1] + '?alt=media'; } return url; }
function clearCache(docId) { try { const cache = CacheService.getScriptCache(); cache.remove('car_' + docId); cache.remove(CACHE_KEY_ALL_CARS); cache.remove('cache_warmed_up'); } catch (e) {} }
function getAuthEmailFromFormData_(formData) { if (formData && formData.idToken) { const result = verifyFirebaseToken_(formData.idToken); if (result.email) return result.email; if (result.error) throw new Error(result.error); } return getActiveEmail(); }
function hasEditPermission(docId, activeEmail) { if (!docId || !activeEmail) return false; if (isAdminEmail(activeEmail)) return true;
  const ss = SpreadsheetApp.getActiveSpreadsheet(); const sheet = ss.getSheetByName(SHEET_NAME_MASTER); const data = sheet.getDataRange().getValues();
  const header = data[0]; const docIdx = header.indexOf(DOCUMENT_ID_COLUMN_NAME); const ownerIdx = header.indexOf('OwnerEmail');
  for (let i = 1; i < data.length; i++) { if (String(data[i][docIdx]) === docId) { const owner = String(data[i][ownerIdx] || '').toLowerCase().trim(); return owner === activeEmail; } } return false;
}
function saveCarFromForm(formData) { const activeEmail = getAuthEmailFromFormData_(formData); if (!activeEmail) throw new Error('ログイン情報が見つかりません。'); const lock = LockService.getScriptLock(); try { lock.waitLock(30000); } catch (e) { throw new Error('サーバー混雑中'); } try { const ss = SpreadsheetApp.getActiveSpreadsheet(); const sheet = ss.getSheetByName(SHEET_NAME_MASTER); const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; const colIdx = {}; headers.forEach((h, i) => { colIdx[h] = i; }); const lastRow = sheet.getLastRow(); if (lastRow > 1) { /*重複チェック略*/ } let nextNumber = 1; if (lastRow > 1) { const idValues = sheet.getRange(2, colIdx[DOCUMENT_ID_COLUMN_NAME] + 1, lastRow - 1, 1).getValues().flat(); idValues.forEach(id => { const m = /^DOC_(\d+)$/.exec(String(id)); if (m && Number(m[1]) >= nextNumber) nextNumber = Number(m[1]) + 1; }); } const newDocId = 'DOC_' + nextNumber; const now = new Date(); const record = {}; headers.forEach(col => { if (col === DOCUMENT_ID_COLUMN_NAME) record[col] = newDocId; else if (col === 'OwnerEmail') record[col] = activeEmail; else if (col === 'createdAt' || col === 'updatedAt') record[col] = now; else record[col] = (formData[col] !== undefined) ? formData[col] : ''; }); buildModelDisplays(record); buildEngineDisplay(record); sheet.appendRow(headers.map(col => record[col] !== undefined ? record[col] : '')); clearCache(newDocId); sendNotifications(record); sendAdminNotification(record); return { ok: true, DocumentID: newDocId }; } finally { lock.releaseLock(); } }
function updateCarFromForm(formData) { const docId = formData.DocumentID; if (!docId) throw new Error('DocumentID がありません'); const activeEmail = getAuthEmailFromFormData_(formData); if (!activeEmail) throw new Error('ログイン情報が見つかりません'); if (!hasEditPermission(docId, activeEmail)) throw new Error('編集権限がありません'); const lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch(e) {} try { const ss = SpreadsheetApp.getActiveSpreadsheet(); const sheet = ss.getSheetByName(SHEET_NAME_MASTER); const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; const colIdx = {}; headers.forEach((h, i) => { colIdx[h] = i; }); const data = sheet.getDataRange().getValues(); let targetRow = -1; for (let i = 1; i < data.length; i++) { if (String(data[i][colIdx[DOCUMENT_ID_COLUMN_NAME]]) === docId) { targetRow = i + 1; break; } } if (targetRow === -1) throw new Error('対象データが見つかりません'); const ownerEmail = String(data[targetRow - 1][colIdx['OwnerEmail']] || '').trim(); const now = new Date(); const record = {}; headers.forEach((col, idx) => { let val = data[targetRow - 1][idx]; if (col === 'OwnerEmail') val = ownerEmail; else if (col === 'updatedAt') val = now; else if (col !== 'createdAt' && col !== DOCUMENT_ID_COLUMN_NAME && formData[col] !== undefined) val = formData[col]; record[col] = val; }); buildModelDisplays(record); buildEngineDisplay(record); sheet.getRange(targetRow, 1, 1, headers.length).setValues([headers.map(col => record[col])]); clearCache(docId); return { ok: true, DocumentID: docId }; } finally { lock.releaseLock(); } }
function sendNotifications(record) { const currentOwnerEmail = (record.OwnerEmail || '').toLowerCase(); if (currentOwnerEmail) { try { MailApp.sendEmail({ to: currentOwnerEmail, subject: `【Registro500】愛車の登録が完了しました`, body: `${record.HandleName} 様\n\n登録ありがとうございます。\nhttps://registro500-giappone.vercel.app/detail.html?doc=${record.DocumentID}\n`, name: SENDER_NAME }); } catch (e) {} } }

function sendAdminNotification(record) {
  const subject = `【新着】Registro500に登録がありました！`;
  const body = `
新しい車両が登録されました。SNSで紹介しましょう！

■車両情報
モデル: ${record.Model_DisplayC}
年式: ${record.Year}
都道府県: ${record.Prefecture}
オーナー: ${record.HandleName}

■詳細ページ
https://registro500-giappone.vercel.app/detail.html?doc=${record.DocumentID}

■管理画面（スプレッドシート）
https://docs.google.com/spreadsheets/d/your-spreadsheet-id/edit
  `;

  if (ADMIN_EMAILS.length > 0) {
    try { MailApp.sendEmail({ to: ADMIN_EMAILS[0], subject: subject, body: body }); } catch (e) {}
  }
}

// =================================================
// 不足していた通知・問い合わせ機能 (Notification / Inquiry)
// =================================================

// 1. 新規登録時のサンクスメール送信
function sendNotifications(record) {
  const currentOwnerEmail = (record.OwnerEmail || '').toLowerCase();
  if (currentOwnerEmail) {
    const subject = `【Registro500】愛車の登録が完了しました`;
    const body = `
${record.HandleName} 様

Registro500 Giappone へのご登録、誠にありがとうございます。
登録が完了いたしました。

■あなたの愛車ページ
https://registro500-giappone.vercel.app/detail.html?doc=${record.DocumentID}

※他のオーナー様へのお知らせは、毎朝の「新着まとめメール」にて配信されます。
---------------------------------------------------------
Registro500 Giappone 運営事務局
    `;
    try {
      MailApp.sendEmail({
        to: currentOwnerEmail,
        subject: subject,
        body: body,
        name: SENDER_NAME
      });
      console.log(`新規オーナー(${currentOwnerEmail})へGmailでサンクスメール送信`);
    } catch (e) {
      console.error('本人通知エラー(Gmail):', e);
    }
  }
}

// 2. オーナーへの問い合わせメール転送
function sendOwnerInquiry(formData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const docIdx = headers.indexOf(DOCUMENT_ID_COLUMN_NAME);
  const emailIdx = headers.indexOf('OwnerEmail');
  const nameIdx = headers.indexOf('HandleName');
  const acceptIdx = headers.indexOf('AcceptInquiry');

  let targetEmail = "";
  let targetName = "";
  let isAccepting = true;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][docIdx]) === formData.targetDocId) {
      targetEmail = String(data[i][emailIdx] || '').trim();
      targetName = data[i][nameIdx];
      if (acceptIdx !== -1) {
        const val = String(data[i][acceptIdx]).toUpperCase();
        if (val === 'FALSE') isAccepting = false;
      }
      break;
    }
  }

  if (!targetEmail) throw new Error("送信先が見つかりません。");
  if (!isAccepting) throw new Error("このオーナーは問い合わせを受け付けていません。");

  // 送信元のチェック
  const replyToEmail = String(formData.senderEmail || '').trim();
  if (!replyToEmail || !replyToEmail.includes('@')) {
    throw new Error("あなたのメールアドレスが正しく取得できていません。ログインし直してください。");
  }

  const subject = `【Registro500】${formData.senderName}様からのお問い合わせ`;
  const body = `
${targetName} 様

Registro500のあなたの車両ページを見て、メッセージが届いています。
このメールにそのまま「返信」すると、相手の方に直接メールが届きます。
（※返信すると、あなたのメールアドレスが相手に伝わりますのでご注意ください）

--------------------------------------------------
送信者: ${formData.senderName} 様
連絡先: ${replyToEmail}

【メッセージ】
${formData.message}
--------------------------------------------------
※このメールは Registro500 経由で転送されました。
  `;

  try {
    MailApp.sendEmail({
      to: targetEmail,
      subject: subject,
      body: body,
      replyTo: replyToEmail,
      name: SENDER_NAME
    });
    return { success: true };
  } catch(e) {
    throw new Error("メール送信に失敗しました: " + e.message);
  }
}

// =================================================
// ニュースレター & X投稿機能
// =================================================

// Twitter OAuth 1.0a
const TWITTER_API_KEY = PropertiesService.getScriptProperties().getProperty('TWITTER_API_KEY');
const TWITTER_API_SECRET = PropertiesService.getScriptProperties().getProperty('TWITTER_API_SECRET');
const TWITTER_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('TWITTER_ACCESS_TOKEN');
const TWITTER_ACCESS_SECRET = PropertiesService.getScriptProperties().getProperty('TWITTER_ACCESS_SECRET');

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📮 ニュースレター')
    .addItem('📧 メール送信', 'menuSendNewsletter')
    .addItem('📧 未送信者に補送信', 'menuSendToMissing')
    .addItem('𝕏 X投稿', 'menuPostToTwitter')
    .addItem('📋 配信ログを表示', 'showDeliveryLog')
    .addSeparator()
    .addItem('⚙️ 設定を確認', 'showSettings')
    .addToUi();
}

function menuSendNewsletter() {
  const result = sendNewsletterEmail();
  if (result.success) {
    SpreadsheetApp.getUi().alert(`✅ メール送信完了！\n\n${result.count}人のオーナーに送信しました。`);
    logDelivery('email', result.count, result.newsTitle, '成功');
  } else {
    SpreadsheetApp.getUi().alert(`❌ エラー: ${result.error}`);
    logDelivery('email', 0, '（エラー）', result.error);
  }
}

function menuSendToMissing() {
  const result = sendToMissingRecipients();
  if (result.success) {
    SpreadsheetApp.getUi().alert(`✅ 未送信者へのメール送信完了！\n\n${result.count}人のオーナーに送信しました。`);
    logDelivery('email（補送）', result.count, result.newsTitle, '成功');
  } else {
    SpreadsheetApp.getUi().alert(`❌ エラー: ${result.error}`);
    logDelivery('email（補送）', 0, '（エラー）', result.error);
  }
}

function menuPostToTwitter() {
  const news = getLatestNews();
  if (!news) {
    SpreadsheetApp.getUi().alert('❌ ニュースがありません');
    return;
  }

  const postUrl = 'registro500.com/news';
  const titleLine = `【${news.title}】`;
  const charLimit = 140;
  const reservedChars = titleLine.length + postUrl.length + 3; // タイトル + URL + 改行
  const summaryMaxLength = charLimit - reservedChars;

  const summary = news.content.substring(0, Math.max(summaryMaxLength, 20));
  const postText = `${titleLine}\n${summary}\n${postUrl}`;

  // 確認ダイアログ
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    `📋 以下の内容でX（Twitter）に投稿します。よろしいですか？\n\n------\n${postText}\n------`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('投稿がキャンセルされました。');
    return;
  }

  // 投稿実行
  const result = postToTwitter();
  if (result.success) {
    SpreadsheetApp.getUi().alert(`✅ X投稿完了！\n\n投稿内容:\n${result.postText}\n\nTweet ID: ${result.tweetId}`);
    logDelivery('twitter', 1, result.newsTitle, '成功');
  } else {
    SpreadsheetApp.getUi().alert(`❌ エラー: ${result.error}`);
    logDelivery('twitter', 0, '（エラー）', result.error);
  }
}

function showSettings() {
  const news = getLatestNews();

  let newsInfo = '❌ ニュースなし';
  if (news) {
    newsInfo = `📰 最新ニュース\n━━━━━━━━━━━━━━━━━━\n📅 日付: ${news.date}\n📝 タイトル: ${news.title}\n📄 内容: ${news.content.substring(0, 100)}${news.content.length > 100 ? '...' : ''}\n`;
  }

  const twitterInfo = `\n🐦 Twitter設定状況\n━━━━━━━━━━━━━━━━━━\n🔑 API Key: ${TWITTER_API_KEY ? '✅ 設定済み' : '❌ 未設定'}\n🔑 API Secret: ${TWITTER_API_SECRET ? '✅ 設定済み' : '❌ 未設定'}\n🔑 Access Token: ${TWITTER_ACCESS_TOKEN ? '✅ 設定済み' : '❌ 未設定'}\n🔑 Access Secret: ${TWITTER_ACCESS_SECRET ? '✅ 設定済み' : '❌ 未設定'}`;

  const msg = newsInfo + twitterInfo;
  SpreadsheetApp.getUi().alert(msg);
}

function showDeliveryLog() {
  const sheet = getOrCreateLogSheet();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
  SpreadsheetApp.getUi().alert('配信ログシートを開きました。');
}

function getLatestNews() {
  try {
    const url = SUPABASE_URL + '/rest/v1/news?order=date.desc&limit=1';
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    const options = { method: 'get', headers: headers, muteHttpExceptions: true };
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    if (data && data.length > 0) return data[0];
    return null;
  } catch (e) {
    console.error('getLatestNews error:', e);
    return null;
  }
}

function getOwnerEmails() {
  try {
    const url = SUPABASE_URL + '/rest/v1/cars?select=owner_email';
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    const options = { method: 'get', headers: headers, muteHttpExceptions: true };
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    if (!data || data.length === 0) return [];
    const emailSet = new Set();
    data.forEach(row => {
      const email = String(row.owner_email || '').trim().toLowerCase();
      if (email && email.includes('@')) emailSet.add(email);
    });
    return Array.from(emailSet);
  } catch (e) {
    console.error('getOwnerEmails error:', e);
    return [];
  }
}

function getEmailsFromGoogleSheets() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME_MASTER);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIdx = headers.indexOf('OwnerEmail');
    if (emailIdx === -1) return [];
    const emailSet = new Set();
    for (let i = 1; i < data.length; i++) {
      const email = String(data[i][emailIdx] || '').trim().toLowerCase();
      if (email && email.includes('@')) emailSet.add(email);
    }
    return Array.from(emailSet);
  } catch (e) {
    console.error('getEmailsFromGoogleSheets error:', e);
    return [];
  }
}

function getMissingOwnerEmails() {
  try {
    const gsEmails = getEmailsFromGoogleSheets();
    const supabaseEmails = getOwnerEmails();
    const gsEmailSet = new Set(gsEmails);
    const missingEmails = supabaseEmails.filter(email => !gsEmailSet.has(email));
    return missingEmails;
  } catch (e) {
    console.error('getMissingOwnerEmails error:', e);
    return [];
  }
}

function sendNewsletterEmail() {
  try {
    const news = getLatestNews();
    if (!news) return { success: false, count: 0, newsTitle: '', error: 'ニュースがありません' };
    const emails = getOwnerEmails();
    if (emails.length === 0) return { success: false, count: 0, newsTitle: news.title, error: 'オーナーのメールアドレスがありません' };
    const subject = `【Registro500 Giappone】${news.title}`;
    const body = `Registro500 Giappone ニュースレター\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 日付: ${news.date}\n📰 タイトル: ${news.title}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${news.content}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nこのメールはRegistro500 Giappone登録オーナーに自動送信されています。\n詳細はこちら: https://registro500-giappone.vercel.app/news.html`;
    emails.forEach(email => {
      try {
        MailApp.sendEmail(email, subject, body);
      } catch (e) {
        console.error('Failed to send to ' + email + ':', e);
      }
    });
    return { success: true, count: emails.length, newsTitle: news.title, timestamp: new Date().toLocaleString('ja-JP') };
  } catch (e) {
    return { success: false, count: 0, newsTitle: '', error: e.toString() };
  }
}

function sendToMissingRecipients() {
  try {
    const news = getLatestNews();
    if (!news) return { success: false, count: 0, newsTitle: '', error: 'ニュースがありません' };
    const missingEmails = getMissingOwnerEmails();
    if (missingEmails.length === 0) return { success: false, count: 0, newsTitle: news.title, error: '未送信者がいません' };
    const subject = `【Registro500 Giappone】${news.title}`;
    const body = `Registro500 Giappone ニュースレター\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 日付: ${news.date}\n📰 タイトル: ${news.title}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${news.content}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nこのメールはRegistro500 Giappone登録オーナーに自動送信されています。\n詳細はこちら: https://registro500-giappone.vercel.app/news.html`;
    missingEmails.forEach(email => {
      try {
        MailApp.sendEmail(email, subject, body);
      } catch (e) {
        console.error('Failed to send to ' + email + ':', e);
      }
    });
    return { success: true, count: missingEmails.length, newsTitle: news.title, timestamp: new Date().toLocaleString('ja-JP') };
  } catch (e) {
    return { success: false, count: 0, newsTitle: '', error: e.toString() };
  }
}

function postToTwitter() {
  try {
    if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
      return { success: false, postText: '', newsTitle: '', error: 'Twitter認証情報が設定されていません' };
    }

    const news = getLatestNews();
    if (!news) return { success: false, postText: '', newsTitle: '', error: 'ニュースがありません' };

    const postUrl = 'registro500.com/news';
    const titleLine = `【${news.title}】`;
    const charLimit = 140;
    const reservedChars = titleLine.length + postUrl.length + 3; // タイトル + URL + 改行
    const summaryMaxLength = charLimit - reservedChars;

    const summary = news.content.substring(0, Math.max(summaryMaxLength, 20));
    const postText = `${titleLine}\n${summary}\n${postUrl}`;

    // Twitter API v1.1 statuses/update endpoint
    const url = 'https://api.twitter.com/1.1/statuses/update.json';
    const params = {
      status: postText
    };

    // OAuth 1.0a署名を生成
    const signature = getOAuth1Signature('POST', url, params);

    const payload = Object.keys(params)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
      .join('&');

    const options = {
      method: 'post',
      headers: {
        'Authorization': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const result = JSON.parse(responseText);
      return {
        success: true,
        postText: postText,
        newsTitle: news.title,
        tweetId: result.id_str,
        timestamp: new Date().toLocaleString('ja-JP')
      };
    } else {
      const errorMsg = `Twitter API Error (${responseCode}): ${responseText}`;
      console.error(errorMsg);
      return {
        success: false,
        postText: postText,
        newsTitle: news.title,
        error: errorMsg
      };
    }
  } catch (e) {
    return { success: false, postText: '', newsTitle: '', error: e.toString() };
  }
}

function getOAuth1Signature(method, url, params) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = Utilities.getUuid().replace(/-/g, '');

  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: TWITTER_ACCESS_TOKEN,
    oauth_version: '1.0'
  };

  // Merge params for signature
  const allParams = { ...params, ...oauthParams };
  const paramStr = Object.keys(allParams)
    .sort()
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(allParams[key]))
    .join('&');

  const baseString = method + '&' + encodeURIComponent(url) + '&' + encodeURIComponent(paramStr);
  const signingKey = encodeURIComponent(TWITTER_API_SECRET) + '&' + encodeURIComponent(TWITTER_ACCESS_SECRET);

  const signature = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, signingKey, baseString);
  const signatureB64 = Utilities.base64Encode(signature);

  // Build Authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => encodeURIComponent(key) + '="' + encodeURIComponent(oauthParams[key]) + '"')
    .concat('oauth_signature="' + encodeURIComponent(signatureB64) + '"')
    .join(', ');

  return authHeader;
}

function getOrCreateLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('配信ログ');
  if (!sheet) {
    sheet = ss.insertSheet('配信ログ');
    sheet.appendRow(['時刻', 'タイプ', 'ニュースタイトル', '件数/結果', 'ステータス']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function logDelivery(type, count, newsTitle, status) {
  try {
    const sheet = getOrCreateLogSheet();
    const timestamp = new Date().toLocaleString('ja-JP');
    let typeLabel = '𝕏 X投稿';
    if (type.includes('email')) {
      typeLabel = '📧 メール' + (type.includes('補') ? '（補送）' : '');
    }
    const resultText = count > 0 ? count + '件' : status;
    sheet.appendRow([timestamp, typeLabel, newsTitle, resultText, status]);
  } catch (e) {
    console.error('logDelivery error:', e);
  }
}

// =================================================
// アンケートリマインダー（2026/02/20 締切）
// ※GASエディタから手動実行すること
// =================================================
function sendSurveyReminder() {
  const subject = '【本日締切】パーツ調達アンケートへのご協力をお願いします';
  const body = `Registro500 Giappone オーナーのみなさま

2/12にご案内した「パーツ調達の知恵袋アンケート」の締切が
本日（2/20・金）となっております。

まだご回答いただいていない方は、ぜひこの機会にお声をお聞かせください！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 アンケートはこちら（所要時間：約5分）
https://forms.gle/1NEuj8ym6RoZhHNy6

⏰ 締切：本日 2026年2月20日（金）中

【ご回答特典】
欧州パーツ通販サイトの横断価格比較ツール
「Fiat 500 パーツ価格比較」ベータ版への優先招待

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

お一人おひとりの小さな工夫が、
誰かの500を救う大きな力になります。
どうぞよろしくお願いいたします。

Registro500 Giappone 運営事務局
https://www.registro500.com/`;

  const recipients = getAllExistingOwnerEmails_();
  if (recipients.length === 0) {
    Logger.log('送信先なし');
    return;
  }

  const chunkSize = 90;
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    sendBroadcastViaBrevo(chunk, subject, body);
    Utilities.sleep(1000);
  }

  Logger.log(`アンケートリマインダー送信完了: ${recipients.length}件`);
}

// =================================================
// アンケート結果公開通知（全オーナー宛）
// GASエディタから手動実行すること
// =================================================
function sendSurveyResultsNotification() {
  const subject = 'アンケート結果を公開しました';
  const body =
`登録オーナー各位

平素より Registro500 Giappone をご利用いただきありがとうございます。

先週末より実施しておりました「日本のFiat 500オーナー実態調査」に
33件のご回答をいただきました。誠にありがとうございました。

アンケート結果を下記ページにてご覧いただけます。

▼ アンケート結果
https://www.registro500.com/survey-results.html
（ログインが必要です）

今後ともよろしくお願いいたします。

Registro500 Giappone 運営チーム`;

  const recipients = getAllExistingOwnerEmails_();
  if (recipients.length === 0) {
    Logger.log('送信先なし');
    return;
  }
  Logger.log(`アンケート結果通知 送信先: ${recipients.length}件`);

  const chunkSize = 90;
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    sendBroadcastViaBrevo(chunk, subject, body);
    Utilities.sleep(1000);
  }

  Logger.log(`アンケート結果通知送信完了: ${recipients.length}件`);
}

// =================================================
// βテスト招待メール（アンケート希望者宛）
// GASエディタから手動実行すること
// フォームの回答スプレッドシートから自動取得
// =================================================
function sendBetaTestInvitation() {
  const subject = '【Registro500】パーツ価格比較ツール βテストのご案内';
  const body =
`βテスト希望者各位

平素より Registro500 Giappone をご利用いただきありがとうございます。

アンケートにてパーツ価格比較ツールのβテストご希望をいただき
ありがとうございました。

このたび、「どっちが安いか比べ太郎」のβ版をご利用いただける
ようになりました。

▼ パーツ価格比較 β版
https://www.registro500.com/parts.html
（ログインするとご利用いただけます）

現在は海外8ショップのパーツ価格を比較できます。
ご意見・ご要望がございましたらお気軽にお知らせください。

今後ともよろしくお願いいたします。

Registro500 Giappone 運営チーム`;

  const recipients = getBetaTestOptInEmails_();
  if (recipients.length === 0) {
    Logger.log('βテスト希望者なし');
    return;
  }
  Logger.log(`βテスト招待メール 送信先: ${recipients.length}件`);

  const chunkSize = 90;
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    sendBroadcastViaBrevo(chunk, subject, body);
    Utilities.sleep(1000);
  }

  Logger.log(`βテスト招待メール送信完了: ${recipients.length}件`);
}

function getBetaTestOptInEmails_() {
  try {
    // アンケートフォームに紐づいたスプレッドシートを自動取得
    const FORM_ID = '1Ect20oaaxoiWkINY1UT4Ew6TqDrSmBCm5rHXIjMG1FM';
    const form = FormApp.openById(FORM_ID);
    const spreadsheetId = form.getDestinationId();
    if (!spreadsheetId) {
      Logger.log('スプレッドシートが見つかりません。フォームにスプレッドシートが紐づいているか確認してください。');
      return [];
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0].map(h => String(h));
    Logger.log('ヘッダー: ' + JSON.stringify(headers));

    // メールアドレス列を探す（B列が通常メールアドレス）
    let emailIdx = 1;
    headers.forEach((h, i) => {
      if (h.includes('メールアドレス') || h.toLowerCase().includes('email')) emailIdx = i;
    });

    // βテスト希望列を探す
    let betaIdx = -1;
    headers.forEach((h, i) => {
      if (h.includes('βテスト') || h.includes('ベータ') || h.toLowerCase().includes('beta') || h.includes('価格比較')) betaIdx = i;
    });

    Logger.log(`メール列: ${emailIdx}, βテスト列: ${betaIdx}`);

    const emailSet = new Set();
    for (let i = 1; i < data.length; i++) {
      const email = String(data[i][emailIdx] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;

      if (betaIdx !== -1) {
        const betaVal = String(data[i][betaIdx] || '').trim();
        // 「いいえ」「No」「否」の場合は除外
        if (betaVal.includes('いいえ') || betaVal.includes('否') || betaVal.toLowerCase() === 'no') continue;
      }

      emailSet.add(email);
    }

    Logger.log(`βテスト希望者: ${emailSet.size}件`);
    return Array.from(emailSet);
  } catch (e) {
    Logger.log('getBetaTestOptInEmails_ エラー: ' + e);
    return [];
  }
}