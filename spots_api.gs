/***** =========================================================
 * Registro500 Giappone — spots_api.gs
 * お気に入りスポット機能 API
 * ========================================================= ****/

// =================================================
// Supabase 接続設定は main.gs で定義
// SUPABASE_URL, SUPABASE_ANON_KEY を使用
// =================================================

/**
 * Supabase REST API 共通リクエスト
 */
function supabaseRequest_(endpoint, method, payload, extraHeaders) {
  const url = SUPABASE_URL + '/rest/v1/' + endpoint;

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
  };

  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function(key) {
      headers[key] = extraHeaders[key];
    });
  }

  const options = {
    method: method,
    headers: headers,
    muteHttpExceptions: true
  };

  if (payload && (method === 'POST' || method === 'PATCH')) {
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const text = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Supabase error (' + code + '): ' + text);
  }

  return text ? JSON.parse(text) : null;
}

// =================================================
// ヘルパー: DocumentID → HandleName 変換
// =================================================
function resolveHandleNames_(ownerDocIds) {
  if (!ownerDocIds || ownerDocIds.length === 0) return {};

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_MASTER);
  var data = sheet.getDataRange().getValues();
  var header = data[0];
  var docIdx = header.indexOf('DocumentID');
  var nameIdx = header.indexOf('HandleName');

  if (docIdx === -1 || nameIdx === -1) return {};

  var nameMap = {};
  for (var i = 1; i < data.length; i++) {
    var docId = String(data[i][docIdx]);
    if (ownerDocIds.indexOf(docId) !== -1) {
      nameMap[docId] = String(data[i][nameIdx] || '').trim() || docId;
    }
  }
  return nameMap;
}

// =================================================
// 1. createSpot — スポット新規登録
// =================================================
/**
 * @param {Object} data
 *   - name {string} 必須
 *   - category {string} 必須
 *   - latitude {number} 必須
 *   - longitude {number} 必須
 *   - place_id {string} 任意
 *   - address {string} 任意
 * @returns {Object} { spot_id: "SPOT_001" }
 */
function createSpot(data) {
  if (!data.name) throw new Error('スポット名は必須です');
  if (!data.category) throw new Error('カテゴリは必須です');
  if (data.latitude == null || data.longitude == null) {
    throw new Error('緯度・経度は必須です');
  }

  var payload = {
    name: String(data.name).substring(0, 200),
    category: String(data.category).substring(0, 50),
    latitude: Number(data.latitude),
    longitude: Number(data.longitude)
  };

  if (data.place_id) payload.place_id = String(data.place_id);
  if (data.address) payload.address = String(data.address);

  var result = supabaseRequest_('spots', 'POST', payload, {
    'Prefer': 'return=representation'
  });

  var row = (result && result.length > 0) ? result[0] : result;
  return { spot_id: row.spot_id };
}

// =================================================
// 2. getSpots — スポット一覧取得
// =================================================
/**
 * @param {Object} params
 *   - category {string} カテゴリでフィルタ（任意）
 *   - prefecture {string} 都道府県でフィルタ（address部分一致、任意）
 *   - limit {number} 取得件数（デフォルト: 50、最大200）
 *   - offset {number} オフセット（デフォルト: 0）
 * @returns {Array} スポット一覧
 */
function getSpots(params) {
  params = params || {};
  var limit = Math.min(Number(params.limit) || 500, 500);
  var offset = Number(params.offset) || 0;

  // ソート順の決定
  var order = 'registration_count.desc,created_at.desc';
  if (params.sort === 'newest') {
    order = 'created_at.desc';
  }

  var query = 'spots?order=' + order
    + '&limit=' + limit
    + '&offset=' + offset;

  // カテゴリフィルタ
  if (params.category) {
    query += '&category=eq.' + encodeURIComponent(params.category);
  }

  // 都道府県フィルタ（addressカラムの部分一致）
  if (params.prefecture) {
    query += '&address=like.*' + encodeURIComponent(params.prefecture) + '*';
  }

  var result = supabaseRequest_(query, 'GET', null, null);
  return result || [];
}

// =================================================
// 3. getSpotDetail — スポット詳細取得
// =================================================
/**
 * @param {string} spotId - スポットID
 * @returns {Object} スポット詳細 + favorites一覧 + 今後のschedules
 */
function getSpotDetail(spotId) {
  if (!spotId) throw new Error('spot_id は必須です');

  // スポット基本情報
  var spots = supabaseRequest_(
    'spots?spot_id=eq.' + encodeURIComponent(spotId) + '&limit=1',
    'GET', null, null
  );
  if (!spots || spots.length === 0) throw new Error('スポットが見つかりません');
  var spot = spots[0];

  // お気に入り登録者一覧（公開のみ）
  spot.favorites = supabaseRequest_(
    'favorite_spots?spot_id=eq.' + encodeURIComponent(spotId)
      + '&visibility=eq.public&order=created_at.desc',
    'GET', null, null
  ) || [];

  // 今後の出没予定（公開のみ）
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  spot.schedules = supabaseRequest_(
    'spot_schedules?spot_id=eq.' + encodeURIComponent(spotId)
      + '&visibility=eq.public&visit_date=gte.' + today
      + '&order=visit_date.asc&limit=20',
    'GET', null, null
  ) || [];

  // ハンドルネーム解決
  var allOwnerIds = [];
  spot.favorites.forEach(function(f) {
    if (allOwnerIds.indexOf(f.owner_document_id) === -1) allOwnerIds.push(f.owner_document_id);
  });
  spot.schedules.forEach(function(sc) {
    if (allOwnerIds.indexOf(sc.owner_document_id) === -1) allOwnerIds.push(sc.owner_document_id);
  });
  var nameMap = resolveHandleNames_(allOwnerIds);
  spot.favorites.forEach(function(f) {
    f.handle_name = nameMap[f.owner_document_id] || f.owner_document_id;
  });
  spot.schedules.forEach(function(sc) {
    sc.handle_name = nameMap[sc.owner_document_id] || sc.owner_document_id;
  });

  return spot;
}

// =================================================
// 4. addFavoriteSpot — お気に入り登録
// =================================================
/**
 * @param {Object} data
 *   - owner_document_id {string} 必須
 *   - spot_id {string} 必須
 *   - comment, time_slots, weekdays, frequency, duration_minutes, visibility 任意
 * @returns {Object} { favorite_id: "FAV_001" }
 */
function addFavoriteSpot(data) {
  if (!data.owner_document_id) throw new Error('owner_document_id は必須です');
  if (!data.spot_id) throw new Error('spot_id は必須です');

  var payload = {
    owner_document_id: String(data.owner_document_id),
    spot_id: String(data.spot_id)
  };
  if (data.comment != null)          payload.comment = String(data.comment);
  if (data.time_slots)               payload.time_slots = data.time_slots;
  if (data.time_comment)             payload.time_comment = String(data.time_comment).substring(0, 100);
  if (data.weekdays)                 payload.weekdays = data.weekdays;
  if (data.frequency)                payload.frequency = String(data.frequency);
  if (data.duration_minutes != null) payload.duration_minutes = Number(data.duration_minutes);
  if (data.visibility)               payload.visibility = String(data.visibility);
  if (data.photos)                   payload.photos = data.photos;

  var result = supabaseRequest_('favorite_spots', 'POST', payload, {
    'Prefer': 'return=representation'
  });
  var row = (result && result.length > 0) ? result[0] : result;

  // スポットの登録人数をインクリメント
  try {
    var spotData = supabaseRequest_(
      'spots?spot_id=eq.' + encodeURIComponent(data.spot_id) + '&select=registration_count',
      'GET', null, null
    );
    if (spotData && spotData.length > 0) {
      var currentCount = spotData[0].registration_count || 0;
      supabaseRequest_(
        'spots?spot_id=eq.' + encodeURIComponent(data.spot_id),
        'PATCH',
        { registration_count: currentCount + 1 },
        null
      );
    }
  } catch(e) {
    // カウント更新に失敗しても favorite_spots の登録は成功
  }

  return { favorite_id: row.favorite_id };
}

// =================================================
// 5. updateFavoriteSpot — お気に入り更新
// =================================================
/**
 * @param {Object} data
 *   - favorite_id {string} 必須
 *   - owner_document_id {string} 必須（権限チェック）
 *   - 更新可能: comment, time_slots, time_comment, weekdays, frequency, duration_minutes, visibility, photos
 * @returns {Object} 更新後のレコード
 */
function updateFavoriteSpot(data) {
  if (!data.favorite_id) throw new Error('favorite_id は必須です');
  if (!data.owner_document_id) throw new Error('owner_document_id は必須です');

  var payload = { updated_at: new Date().toISOString() };
  if (data.comment !== undefined)          payload.comment = data.comment;
  if (data.time_slots !== undefined)       payload.time_slots = data.time_slots;
  if (data.time_comment !== undefined)     payload.time_comment = data.time_comment;
  if (data.weekdays !== undefined)         payload.weekdays = data.weekdays;
  if (data.frequency !== undefined)        payload.frequency = data.frequency;
  if (data.duration_minutes !== undefined) payload.duration_minutes = data.duration_minutes;
  if (data.visibility !== undefined)       payload.visibility = data.visibility;
  if (data.photos !== undefined)           payload.photos = data.photos;

  var endpoint = 'favorite_spots?favorite_id=eq.' + encodeURIComponent(data.favorite_id)
    + '&owner_document_id=eq.' + encodeURIComponent(data.owner_document_id);

  var result = supabaseRequest_(endpoint, 'PATCH', payload, {
    'Prefer': 'return=representation'
  });
  if (!result || result.length === 0) throw new Error('更新対象が見つかりません');
  return result[0];
}

// =================================================
// 6. deleteFavoriteSpot — お気に入り削除
// =================================================
/**
 * @param {Object} data
 *   - favorite_id {string} 必須
 *   - owner_document_id {string} 必須（権限チェック）
 * @returns {Object} { ok: true }
 */
function deleteFavoriteSpot(data) {
  if (!data.favorite_id) throw new Error('favorite_id は必須です');
  if (!data.owner_document_id) throw new Error('owner_document_id は必須です');

  var endpoint = 'favorite_spots?favorite_id=eq.' + encodeURIComponent(data.favorite_id)
    + '&owner_document_id=eq.' + encodeURIComponent(data.owner_document_id);

  // 削除前に spot_id を取得（登録人数をデクリメントするため）
  var favData = supabaseRequest_(endpoint + '&select=spot_id', 'GET', null, null);
  var spotId = favData && favData.length > 0 ? favData[0].spot_id : null;

  supabaseRequest_(endpoint, 'DELETE', null, null);

  // スポットの登録人数をデクリメント
  if (spotId) {
    try {
      var spotData = supabaseRequest_(
        'spots?spot_id=eq.' + encodeURIComponent(spotId) + '&select=registration_count',
        'GET', null, null
      );
      if (spotData && spotData.length > 0) {
        var currentCount = spotData[0].registration_count || 0;
        supabaseRequest_(
          'spots?spot_id=eq.' + encodeURIComponent(spotId),
          'PATCH',
          { registration_count: Math.max(0, currentCount - 1) },
          null
        );
      }
    } catch(e) {
      // カウント更新に失敗してもレコード削除は成功
    }
  }

  return { ok: true };
}

// =================================================
// 7. getMyFavorites — マイお気に入り一覧
// =================================================
/**
 * @param {string} ownerDocId - オーナーのDocumentID
 * @returns {Array} お気に入り一覧（スポット情報結合済み）
 */
function getMyFavorites(ownerDocId) {
  if (!ownerDocId) throw new Error('owner_document_id は必須です');

  var favorites = supabaseRequest_(
    'favorite_spots?owner_document_id=eq.' + encodeURIComponent(ownerDocId)
      + '&order=created_at.desc',
    'GET', null, null
  ) || [];

  if (favorites.length === 0) return [];

  // スポット情報を一括取得して結合
  var ids = [];
  favorites.forEach(function(f) {
    if (ids.indexOf(f.spot_id) === -1) ids.push(f.spot_id);
  });
  var spots = supabaseRequest_(
    'spots?spot_id=in.(' + ids.map(encodeURIComponent).join(',') + ')',
    'GET', null, null
  ) || [];

  var spotMap = {};
  spots.forEach(function(s) { spotMap[s.spot_id] = s; });

  return favorites.map(function(fav) {
    fav.spot = spotMap[fav.spot_id] || null;
    return fav;
  });
}

// =================================================
// 8. createSchedule — 出没予定登録
// =================================================
/**
 * @param {Object} data
 *   - owner_document_id {string} 必須
 *   - spot_id {string} 必須
 *   - visit_date {string} 必須 (yyyy-MM-dd)
 *   - visit_time_slot, visit_time_comment, expected_duration_minutes, comment, visibility 任意
 * @returns {Object} { schedule_id: "SCHED_001" }
 */
function createSchedule(data) {
  if (!data.owner_document_id) throw new Error('owner_document_id は必須です');
  if (!data.spot_id) throw new Error('spot_id は必須です');
  if (!data.visit_date) throw new Error('visit_date は必須です');

  var payload = {
    owner_document_id: String(data.owner_document_id),
    spot_id: String(data.spot_id),
    visit_date: String(data.visit_date)
  };
  if (data.visit_time_slot)                  payload.visit_time_slot = String(data.visit_time_slot);
  if (data.visit_time_comment)               payload.visit_time_comment = String(data.visit_time_comment).substring(0, 50);
  if (data.expected_duration_minutes != null) payload.expected_duration_minutes = Number(data.expected_duration_minutes);
  if (data.comment != null)                  payload.comment = String(data.comment);
  if (data.visibility)                       payload.visibility = String(data.visibility);

  var result = supabaseRequest_('spot_schedules', 'POST', payload, {
    'Prefer': 'return=representation'
  });
  var row = (result && result.length > 0) ? result[0] : result;
  return { schedule_id: row.schedule_id };
}

// =================================================
// 9. deleteSchedule — 出没予定削除
// =================================================
/**
 * @param {Object} data
 *   - schedule_id {string} 必須
 *   - owner_document_id {string} 必須（権限チェック）
 * @returns {Object} { ok: true }
 */
function deleteSchedule(data) {
  if (!data.schedule_id) throw new Error('schedule_id は必須です');
  if (!data.owner_document_id) throw new Error('owner_document_id は必須です');

  var endpoint = 'spot_schedules?schedule_id=eq.' + encodeURIComponent(data.schedule_id)
    + '&owner_document_id=eq.' + encodeURIComponent(data.owner_document_id);

  supabaseRequest_(endpoint, 'DELETE', null, null);
  return { ok: true };
}

// =================================================
// 10. getSchedules — 出没予定一覧取得
// =================================================
/**
 * @param {Object} params
 *   - spot_id {string} 任意
 *   - date_from {string} 任意 (yyyy-MM-dd、デフォルト: 今日)
 *   - date_to {string} 任意
 *   - limit {number} デフォルト50、最大200
 * @returns {Array} 出没予定一覧
 */
function getSchedules(params) {
  params = params || {};
  var limit = Math.min(Number(params.limit) || 50, 200);
  var dateFrom = params.date_from
    || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

  var query = 'spot_schedules?visibility=eq.public'
    + '&visit_date=gte.' + dateFrom
    + '&order=visit_date.asc&limit=' + limit;

  if (params.date_to) {
    query += '&visit_date=lte.' + encodeURIComponent(params.date_to);
  }
  if (params.spot_id) {
    query += '&spot_id=eq.' + encodeURIComponent(params.spot_id);
  }

  var schedules = supabaseRequest_(query, 'GET', null, null) || [];

  // ハンドルネーム解決
  var ownerIds = [];
  schedules.forEach(function(sc) {
    if (ownerIds.indexOf(sc.owner_document_id) === -1) ownerIds.push(sc.owner_document_id);
  });
  var nameMap = resolveHandleNames_(ownerIds);

  // スポット名取得
  var spotIds = [];
  schedules.forEach(function(sc) {
    if (spotIds.indexOf(sc.spot_id) === -1) spotIds.push(sc.spot_id);
  });
  var spotNameMap = {};
  if (spotIds.length > 0) {
    var spots = supabaseRequest_(
      'spots?spot_id=in.(' + spotIds.map(encodeURIComponent).join(',') + ')&select=spot_id,name,category',
      'GET', null, null
    ) || [];
    spots.forEach(function(s) { spotNameMap[s.spot_id] = { name: s.name, category: s.category }; });
  }

  schedules.forEach(function(sc) {
    sc.handle_name = nameMap[sc.owner_document_id] || sc.owner_document_id;
    var sp = spotNameMap[sc.spot_id];
    if (sp) { sc.spot_name = sp.name; sc.spot_category = sp.category; }
  });

  return schedules;
}

// =================================================
// 11. findNearbySpots — 半径内スポット検索
// =================================================
/**
 * 指定座標から半径内のスポットを検索（矩形近似）
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @param {number} radiusM - 半径メートル（デフォルト: 500）
 * @returns {Array} 近隣スポット一覧
 */
function findNearbySpots(lat, lng, radiusM) {
  if (lat == null || lng == null) throw new Error('緯度・経度は必須です');

  lat = Number(lat);
  lng = Number(lng);
  radiusM = Number(radiusM) || 500;
  var radiusKm = radiusM / 1000;

  var dLat = radiusKm / 111.0;
  var dLng = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180));

  var query = 'spots?latitude=gte.' + (lat - dLat)
    + '&latitude=lte.' + (lat + dLat)
    + '&longitude=gte.' + (lng - dLng)
    + '&longitude=lte.' + (lng + dLng)
    + '&order=registration_count.desc&limit=20';

  return supabaseRequest_(query, 'GET', null, null) || [];
}
