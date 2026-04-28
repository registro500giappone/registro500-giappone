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
const SENDER_EMAIL = "news@registro500.com";
const SENDER_NAME = "Registro500 Giappone";
const REPLY_TO_EMAIL = "registro500giappone@gmail.com";

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
    const data = requestData.data;
    let result = {};

    if (action === 'inquiry') result = sendOwnerInquiry(formData);
    else if (action === 'save_event') result = saveEventFromForm(formData);
    else if (action === 'delete_event') result = deleteEvent(formData);
    else if (action === 'toggle_participation') result = toggleEventParticipation(formData);
    else throw new Error('Unknown action');
    return createJsonOutput({ success: true, data: result });
  } catch (err) { return createJsonOutput({ success: false, error: err.message }); }
}

function createJsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
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
// 通知機能 (Daily Digest: お知らせ + 新車 + イベント)
// =================================================
function sendDailyDigest() {
  // 二重実行防止: スクリプトロックを取得（10秒待って取れなければスキップ）
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('⚠️ sendDailyDigest: 別のインスタンスが実行中のためスキップ');
    return;
  }
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayISO = yesterday.toISOString();

    Logger.log('sendDailyDigest 開始: ' + now);

    // 1. 未送信お知らせ（sent_at IS NULL を全件）
    const unsentNews = getUnsentNewsAll_();

    // 2. 新車チェック
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

    // 3. 新規イベントチェック
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

    // 4. 新規ストーリー（マイ500/126ストーリー）チェック
    const newEpisodesData = supabaseQuery_('car_episodes', 'id,car_id,type,title,created_at,notification_sent,is_published', {
      'notification_sent': 'eq.false',
      'is_published': 'eq.true',
      'created_at': `gte.${yesterdayISO}`,
      'order': 'created_at.asc'
    });
    if (!Array.isArray(newEpisodesData)) {
      throw new Error('newEpisodesData が配列ではありません: ' + JSON.stringify(newEpisodesData));
    }
    // ストーリーのハンドル名を取得（car_idからcarsを引く）
    let epCarMap = {};
    if (newEpisodesData.length > 0) {
      const epCarIds = [...new Set(newEpisodesData.map(ep => ep.car_id))];
      const carsForEps = supabaseQuery_('cars', 'document_id,handle_name,car_type', {
        'document_id': `in.(${epCarIds.map(id => `"${id}"`).join(',')})`
      });
      (carsForEps || []).forEach(c => { epCarMap[c.document_id] = c; });
    }
    const newEpisodes = newEpisodesData.map(ep => ({
      Id: ep.id,
      Title: ep.title || '(無題)',
      Owner: (epCarMap[ep.car_id] && epCarMap[ep.car_id].handle_name) || 'オーナー',
      CarType: (epCarMap[ep.car_id] && epCarMap[ep.car_id].car_type) || '500'
    }));

    if (unsentNews.length === 0 && newCars.length === 0 && newEvents.length === 0 && newEpisodes.length === 0) {
      Logger.log('配信対象なし');
      return;
    }

    // 5. 件名・本文作成（順番: 新しい仲間 → 新しいイベント → 新しいストーリー → お知らせ）
    const subjectParts = [];
    if (newCars.length > 0) subjectParts.push(`新着車両${newCars.length}台`);
    if (newEvents.length > 0) subjectParts.push(`新着イベント${newEvents.length}件`);
    if (newEpisodes.length > 0) subjectParts.push(`新着ストーリー${newEpisodes.length}件`);
    if (unsentNews.length > 0) subjectParts.push('お知らせ');
    const subject = `【Registro500/126 Giappone】${subjectParts.join('・')}`;

    let body = `Registro500 / Registro126 Giappone オーナーの皆様\n\nおはようございます。\n`;

    if (newCars.length > 0) {
      body += `\n■ 🚗 新しい仲間 (${newCars.length}台)\n`;
      newCars.forEach(c => {
        body += `・${c.Model} (${c.Name}様)\n　https://www.registro500.com/detail.html?doc=${c.ID}\n`;
      });
    }

    if (newEvents.length > 0) {
      body += `\n■ 📅 新しいイベント (${newEvents.length}件)\n`;
      newEvents.forEach(e => {
        body += `・${e.Date}開催: ${e.Name} (by ${e.Owner}様)\n　場所: ${e.Loc}\n　詳細: https://www.registro500.com/event.html\n`;
      });
    }

    if (newEpisodes.length > 0) {
      body += `\n■ 📖 新しいストーリー (${newEpisodes.length}件)\n`;
      newEpisodes.forEach(e => {
        body += `・「${e.Title}」(${e.Owner}様)\n　https://www.registro500.com/episode.html?ep=${e.Id}\n`;
      });
      body += `\n一覧: https://www.registro500.com/stories.html\n`;
    }

    if (unsentNews.length > 0) {
      body += `\n■ 📢 お知らせ\n`;
      unsentNews.forEach(n => {
        body += `\n【${n.title}】\n${n.content}\n`;
      });
      body += `\n詳細: https://www.registro500.com/news.html\n`;
    }

    body += `\n---------------------------------------------------------\nRegistro500 / Registro126 Giappone\nhttps://www.registro500.com/\n※このメールは毎朝6〜7時頃に自動配信されます。`;

    // 5. 一斉送信（成功数を記録してフラグ更新の根拠とする）
    const recipients = getAllExistingOwnerEmails_();
    let sentChunks = 0;
    let failedChunks = 0;
    if (recipients.length > 0) {
      const chunkSize = 90;
      for (let i = 0; i < recipients.length; i += chunkSize) {
        const chunk = recipients.slice(i, i + chunkSize);
        try {
          sendBroadcastViaBrevo(chunk, subject, body);
          sentChunks++;
          Utilities.sleep(1000);
        } catch (e) {
          failedChunks++;
          Logger.log('メール送信エラー (chunk ' + i + '): ' + e);
        }
      }
    }

    // 6. フラグ更新（1件以上 chunk 送信に成功した場合のみ。全滅ならフラグ据え置きで次回再送を担保）
    if (sentChunks === 0) {
      Logger.log('❌ 全chunk送信失敗（成功:0, 失敗:' + failedChunks + '）→ フラグ更新スキップ。次回の定期実行で再送されます。');
      return;
    }
    if (failedChunks > 0) {
      Logger.log('⚠️ 一部chunk送信失敗（成功:' + sentChunks + ', 失敗:' + failedChunks + '）→ 送信済みフラグを更新します（同一メール重複送信を避けるため）。');
    }

    newCars.forEach(car => {
      try { supabaseUpdate_('cars', car.DbId, { notification_sent: true }); } catch (e) {}
    });
    newEvents.forEach(evt => {
      try { markEventNotificationSent_(evt.DbId); } catch (e) { Logger.log('events フラグ更新エラー: ' + e); }
    });
    newEpisodes.forEach(ep => {
      try { supabaseUpdate_('car_episodes', ep.Id, { notification_sent: true }); } catch (e) { Logger.log('car_episodes フラグ更新エラー: ' + e); }
    });
    unsentNews.forEach(n => {
      try { markNewsAsSent_(n.id); } catch (e) { Logger.log('❌ markNewsAsSent_ エラー (id=' + n.id + '): ' + e); }
    });

    Logger.log(`メール配信完了: お知らせ${unsentNews.length}件、車両${newCars.length}台、イベント${newEvents.length}件、ストーリー${newEpisodes.length}件（送信chunk ${sentChunks}成功/${failedChunks}失敗）`);
  } catch (error) {
    Logger.log('❌ sendDailyDigest エラー: ' + error);
    Logger.log('スタックトレース: ' + error.stack);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

// 未送信のお知らせを取得（直近14日以内 かつ 最大5件）
// ※ 古い積み残しが一気に送信されないよう日付フィルター＋上限を設ける
function getUnsentNewsAll_() {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const url = SUPABASE_URL + '/rest/v1/news?sent_at=is.null'
      + '&created_at=gte.' + encodeURIComponent(fourteenDaysAgo)
      + '&order=id.asc&limit=5';
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    const response = UrlFetchApp.fetch(url, { method: 'get', headers: headers, muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());
    return Array.isArray(data) ? data : [];
  } catch (e) {
    Logger.log('getUnsentNewsAll_ error: ' + e);
    return [];
  }
}

// Brevo & Utils
function sendBroadcastViaBrevo(bccEmailList, subject, textBody) {
  const url = "https://api.brevo.com/v3/smtp/email";
  const bccObjects = bccEmailList.map(email => ({ "email": email }));
  const payload = {
    "sender": { "name": SENDER_NAME, "email": SENDER_EMAIL },
    "replyTo": { "name": SENDER_NAME, "email": REPLY_TO_EMAIL },
    "to": [{ "email": REPLY_TO_EMAIL }],
    "bcc": bccObjects, "subject": subject,
    "textContent": textBody,
    "htmlContent": textToHtml_(textBody),
    "trackClicks": true,
    "trackOpens": true
  };
  const options = {
    "method": "post", "headers": { "api-key": getBrevoApiKey_(), "Content-Type": "application/json", "accept": "application/json" },
    "payload": JSON.stringify(payload), "muteHttpExceptions": true
  };
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    const bodyText = response.getContentText();
    throw new Error('Brevo API error: HTTP ' + code + ' / ' + bodyText);
  }
  return response;
}

function textToHtml_(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const linked = escaped.replace(
    /https?:\/\/[^\s<>"]+/g,
    function(u) { return '<a href="' + u + '" style="color:#c0392b;">' + u + '</a>'; }
  );
  const body = linked.replace(/\n/g, '<br>\n');
  return '<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:14px;line-height:1.8;color:#333;max-width:600px;margin:0 auto;padding:20px;">' + body + '</body></html>';
}
function getAllExistingOwnerEmails_() {
  // is_sold=true のオーナーは配信対象から除外
  const carsData = supabaseQuery_('cars', 'owner_email', { is_sold: 'is.false' });
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
    .addItem('📧 今日のまとめを今すぐ送信（緊急用）', 'menuSendDailyDigestNow')
    .addItem('📧 未送信者に補送信', 'menuSendToMissing')
    .addItem('𝕏 X投稿', 'menuPostToTwitter')
    .addItem('📋 配信ログを表示', 'showDeliveryLog')
    .addSeparator()
    .addItem('⚙️ 設定を確認', 'showSettings')
    .addSeparator()
    .addItem('📖 ストーリー紹介許諾依頼を4名に送信', 'sendStoryConsentRequests')
    .addItem('【一時】お詫びメール送信', 'sendApologyEmail')
    .addToUi();
}

// 緊急時の手動実行（お知らせ＋新着車両＋イベントを今すぐまとめ送信）
function menuSendDailyDigestNow() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    '📧 まとめメールを今すぐ送信します\n\n未送信のお知らせ＋新着車両＋新着イベント＋新着ストーリーをまとめて全オーナーに送信します。\n\n※通常は毎朝6〜7時頃に自動送信されます。緊急時のみ使用してください。\n\nよろしいですか？',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) {
    ui.alert('キャンセルしました。');
    return;
  }
  try {
    sendDailyDigest();
    logDelivery('email（手動）', '-', 'まとめ送信', '成功');
    ui.alert('✅ 送信完了しました。');
  } catch (e) {
    logDelivery('email（手動）', 0, 'まとめ送信', 'エラー: ' + e);
    ui.alert('❌ エラー: ' + e);
  }
}


function menuSendToMissing() {
  const result = sendToMissingRecipients();
  if (result.success) {
    Logger.log(`✅ 未送信者へのメール送信完了！ ${result.count}人のオーナーに送信しました。`);
    logDelivery('email（補送）', result.count, result.newsTitle, '成功');
    try { SpreadsheetApp.getUi().alert(`✅ 未送信者へのメール送信完了！\n\n${result.count}人のオーナーに送信しました。`); } catch(e) {}
  } else {
    Logger.log(`❌ エラー: ${result.error}`);
    logDelivery('email（補送）', 0, '（エラー）', result.error);
    try { SpreadsheetApp.getUi().alert(`❌ エラー: ${result.error}`); } catch(e) {}
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
    // sent_at IS NULL（未送信）のニュースのみ取得。再送防止。
    const url = SUPABASE_URL + '/rest/v1/news?sent_at=is.null&order=id.desc&limit=1';
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

function markNewsAsSent_(newsId) {
  try {
    const url = SUPABASE_URL + '/rest/v1/news?id=eq.' + newsId;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
    const options = { method: 'patch', headers: headers, payload: JSON.stringify({ sent_at: new Date().toISOString(), email_sent: true }), muteHttpExceptions: true };
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.error('markNewsAsSent_ error:', e);
  }
}

// SECURITY DEFINER RPC経由でeventsのnotification_sentをtrueに更新（RLSバイパス）
function markEventNotificationSent_(eventId) {
  try {
    const url = SUPABASE_URL + '/rest/v1/rpc/mark_event_notification_sent';
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    const options = { method: 'post', headers: headers, payload: JSON.stringify({ p_event_id: eventId }), muteHttpExceptions: true };
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log('markEventNotificationSent_ error: ' + e);
  }
}

function getOwnerEmails() {
  try {
    // is_sold=true のオーナーは配信対象から除外
    const url = SUPABASE_URL + '/rest/v1/cars?select=owner_email&is_sold=is.false';
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


function sendToMissingRecipients() {
  try {
    const news = getLatestNews();
    if (!news) return { success: false, count: 0, newsTitle: '', error: '未送信のニュースがありません' };
    const missingEmails = getMissingOwnerEmails();
    if (missingEmails.length === 0) return { success: false, count: 0, newsTitle: news.title, error: '未送信者がいません' };
    const subject = `【Registro500 Giappone】${news.title}`;
    const body = `Registro500 Giappone ニュースレター\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 日付: ${news.date}\n📰 タイトル: ${news.title}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${news.content}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nこのメールはRegistro500 Giappone登録オーナーに自動送信されています。\n詳細はこちら: https://www.registro500.com/news.html`;
    const chunkSize = 90;
    for (let i = 0; i < missingEmails.length; i += chunkSize) {
      const chunk = missingEmails.slice(i, i + chunkSize);
      sendBroadcastViaBrevo(chunk, subject, body);
      Utilities.sleep(1000);
    }
    markNewsAsSent_(news.id);
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
// 【一時】お詫びメール送信（実行後に削除すること）
// =================================================
function sendApologyEmail() {
  const subject = '【お詫びと再送】昨日お送りしたメールについて';
  const body = `Registro500 / Registro126 Giappone オーナーの皆様

おはようございます。

昨日（3月8日）朝にお送りしたメールについてお詫び申し上げます。

メールシステムの不具合により、過去のお知らせが大量に積み重なった状態で
1通のメールとして配信されてしまいました。
非常に長く読みにくいメールをお送りしてしまい、大変失礼いたしました。

今後は同様の事態が起きないよう対処いたしました。

---

※ 以下は誤メールに紛れてしまった最新情報です

■ 📢 お知らせ

【ガレージノートをはじめました】

送料・関税の実績、通関の手順、見つけた代替品、国内での入手先——
オーナーの生きた経験は、次に同じ道を歩く人にとって何より頼りになる情報です。

そういった記録をオーナー同士で積み重ねていく場所をつくりました。
その名も「ガレージノート」。

第1弾のテーマは「パーツ購入の記録」です。
ハンドルネームで、あなたの記録をぜひ残してください。

→ https://www.registro500.com/garage-notes.html

---------------------------------------------------------
Registro500 / Registro126 Giappone
https://www.registro500.com/`;

  try {
    const recipients = getAllExistingOwnerEmails_();
    const chunkSize = 90;
    for (let i = 0; i < recipients.length; i += chunkSize) {
      sendBroadcastViaBrevo(recipients.slice(i, i + chunkSize), subject, body);
      Utilities.sleep(1000);
    }

    logDelivery('email（お詫び）', recipients.length, 'お詫びと再送', '成功');
    Logger.log('✅ お詫びメール送信完了: ' + recipients.length + '人に送信しました。');
  } catch (e) {
    logDelivery('email（お詫び）', 0, 'お詫びと再送', 'エラー: ' + e);
    Logger.log('❌ エラー: ' + e);
    throw e;
  }
}

// =================================================
// グッズアンケート リマインダー（2026/03/28 締切）
// ※GASエディタから手動実行すること
// =================================================
function sendGoodsSurveyReminder() {
  const subject = '【締め切り2日前】グッズアンケートのお願い';
  const body = `Registro500/126をご利用のみなさんへ

先日お送りしたアンケートの締め切りが 3月28日（土） に迫っています。

まだご回答いただいていない方は、ぜひご協力をお願いします！

▼ アンケートはこちら（2分で終わります）
https://forms.gle/8R6HJYDbukWQvTau6

みなさんのご意見をもとに、サイトで役立つグッズ紹介ページを作る予定です。

---------------------------------------------------------
Registro500/126 Giappone
https://www.registro500.com/`;

  try {
    const recipients = getAllExistingOwnerEmails_();
    if (recipients.length === 0) {
      Logger.log('送信先なし');
      return;
    }
    const chunkSize = 90;
    for (let i = 0; i < recipients.length; i += chunkSize) {
      sendBroadcastViaBrevo(recipients.slice(i, i + chunkSize), subject, body);
      Utilities.sleep(1000);
    }
    Logger.log('✅ グッズアンケートリマインダー送信完了: ' + recipients.length + '件');
  } catch (e) {
    Logger.log('❌ エラー: ' + e);
    throw e;
  }
}

// =================================================
// ストーリー紹介許諾依頼メール（個別To送信・2026-04-28追加）
// =================================================
function sendStoryConsentRequests() {
  const ui = SpreadsheetApp.getUi();

  const requests = [
    { handleName: 'fiat_takeshi',  email: 'takeshi.wakao301@gmail.com', episodeTitle: '私と水色FIAT500との出会い♪' },
    { handleName: 'MEX',           email: 'mex06takemex@gmail.com',     episodeTitle: '『出会えてよかったチンクエチェント』' },
    { handleName: 'nice guy KENGO', email: '1641ngk@gmail.com',          episodeTitle: '「空冷のチンクが欲しい」' },
    { handleName: '近江商人',       email: 'kasuzen@gmail.com',          episodeTitle: '愛すべきnap姐さんの作品' }
  ];

  const list = requests.map(r => `・${r.handleName}（${r.email}）`).join('\n');
  const confirm = ui.alert(
    '📖 ストーリー紹介許諾依頼を送信',
    `以下4名に個別メールを送信します。\n\n${list}\n\n実行しますか？`,
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) {
    ui.alert('キャンセルしました。');
    return;
  }

  let success = 0;
  const failed = [];
  requests.forEach(req => {
    try {
      sendStoryConsentEmailToOne_(req.email, req.handleName, req.episodeTitle);
      success++;
      Utilities.sleep(500);
    } catch (e) {
      failed.push(`${req.handleName}: ${e}`);
      Logger.log('❌ ' + req.handleName + ' 送信失敗: ' + e);
    }
  });

  const status = failed.length === 0 ? '成功' : `一部失敗(${failed.length}件)`;
  logDelivery('story-consent', success, '4オーナー宛', status);

  let msg = `✅ 送信完了\n\n成功: ${success} / ${requests.length}`;
  if (failed.length > 0) msg += `\n\n失敗:\n${failed.join('\n')}`;
  ui.alert(msg);
}

// CLI/Apps Script直接実行用（UIなし・ヘッドレス）
function sendStoryConsentRequestsHeadless() {
  const requests = [
    { handleName: 'fiat_takeshi',  email: 'takeshi.wakao301@gmail.com', episodeTitle: '私と水色FIAT500との出会い♪' },
    { handleName: 'MEX',           email: 'mex06takemex@gmail.com',     episodeTitle: '『出会えてよかったチンクエチェント』' },
    { handleName: 'nice guy KENGO', email: '1641ngk@gmail.com',          episodeTitle: '「空冷のチンクが欲しい」' },
    { handleName: '近江商人',       email: 'kasuzen@gmail.com',          episodeTitle: '愛すべきnap姐さんの作品' }
  ];
  let success = 0;
  const failed = [];
  requests.forEach(req => {
    try {
      sendStoryConsentEmailToOne_(req.email, req.handleName, req.episodeTitle);
      success++;
      Logger.log('✅ ' + req.handleName + ' (' + req.email + ') 送信成功');
      Utilities.sleep(500);
    } catch (e) {
      failed.push(req.handleName + ': ' + e);
      Logger.log('❌ ' + req.handleName + ' 送信失敗: ' + e);
    }
  });
  const status = failed.length === 0 ? '成功' : 'failed_' + failed.length;
  logDelivery('story-consent', success, '4オーナー宛(headless)', status);
  Logger.log('完了: 成功 ' + success + '/' + requests.length + (failed.length ? ' / 失敗: ' + failed.join('; ') : ''));
  return { success: success, total: requests.length, failed: failed };
}

function sendStoryConsentEmailToOne_(toEmail, handleName, episodeTitle) {
  const subject = '【Registro500】公式Xでのストーリー紹介についてのお願い';
  const textBody = buildStoryConsentBody_(handleName, episodeTitle);
  const url = 'https://api.brevo.com/v3/smtp/email';
  const payload = {
    sender:  { name: SENDER_NAME, email: SENDER_EMAIL },
    replyTo: { name: SENDER_NAME, email: REPLY_TO_EMAIL },
    to:      [{ email: toEmail, name: handleName }],
    subject: subject,
    textContent: textBody,
    htmlContent: textToHtml_(textBody),
    trackClicks: true,
    trackOpens: true
  };
  const options = {
    method: 'post',
    headers: { 'api-key': getBrevoApiKey_(), 'Content-Type': 'application/json', 'accept': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Brevo API ' + code + ': ' + response.getContentText());
  }
}

function buildStoryConsentBody_(handleName, episodeTitle) {
  return `${handleName} さま

いつも Registro500 にご登録・ご投稿いただきありがとうございます。
管理人です。

このたびご投稿いただきました
「${episodeTitle}」
を、Registro500 公式X（@registro500）にて紹介させていただきたく、
ご連絡いたしました。

【紹介イメージ】
　・タイトルと ${handleName} さんのお名前
　・本文の冒頭80字程度の引用
　・カバー写真をX側に直接添付
　・記事ページへのリンク
　・ハッシュタグ（#フィアット500 #チンクエチェント #fiat500）

未登録のオーナーや旧車ファンの方々にもストーリーを届けたく、
ぜひお力をお貸しいただければ幸いです。

ご許諾いただける場合、ご返信は不要です。
ご都合悪い・修正希望などございましたら、本メールから3日以内に
ご返信ください。それ以降に投稿を進めさせていただきます。

なお、今後はストーリー投稿時に「公式SNSでの紹介をデフォルト許諾」とし、
ご希望でないオーナーは設定でオフにできる仕組みを準備中です（数週間以内に
別途ご案内予定）。

引き続き Registro500 をどうぞよろしくお願いいたします🚗

Registro500 Giappone
管理人
news@registro500.com`;
}

