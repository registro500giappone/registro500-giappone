/***** =========================================================
 * Registro500 Giappone — spot.js
 * 出没スポット機能 フロントエンドJS
 * ========================================================= ****/

// =================================================
// グローバル変数
// =================================================
let map;
let markers = {};
let clickMarker = null;
let allSpots = [];
let myFavorites = [];
let currentUser = null;     // { uid, email, documentId, prefecture }
let selectedLatLng = null;
let supabaseClient = null;
let googleReady = false;
let activeMainTab = 'sectionSpots';

const CATEGORY_LABELS = {
  cafe: 'カフェ・飲食店',
  parking: '駐車場・PA/SA',
  photo: '撮影スポット',
  viewpoint: '展望スポット',
  workshop: '整備工場',
  meeting: '集合場所',
  drive: 'ドライブルート',
  other: 'その他'
};

const TIME_SLOT_LABELS = {
  morning: '朝',
  afternoon: '昼',
  evening: '夕方',
  night: '夜'
};

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function formatDateWithDay(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  var m = Number(parts[1]);
  var day = Number(parts[2]);
  var dow = DAY_NAMES[d.getDay()];
  return m + '/' + day + '（' + dow + '）';
}

function formatTimeSlot(slot) {
  return TIME_SLOT_LABELS[slot] || slot || '';
}

const CATEGORY_ICONS = {
  cafe: '☕', parking: '🅿️', photo: '📷', viewpoint: '🏔️',
  workshop: '🔧', meeting: '🤝', drive: '🛣️', other: '📍'
};

// 都道府県→中心座標マッピング
const PREF_CENTER = {
  '北海道':[43.06,141.35],'青森県':[40.82,140.74],'岩手県':[39.70,141.15],
  '宮城県':[38.27,140.87],'秋田県':[39.72,140.10],'山形県':[38.24,140.33],
  '福島県':[37.75,140.47],'茨城県':[36.34,140.45],'栃木県':[36.57,139.88],
  '群馬県':[36.39,139.06],'埼玉県':[35.86,139.65],'千葉県':[35.61,140.12],
  '東京都':[35.68,139.69],'神奈川県':[35.45,139.64],'新潟県':[37.90,139.02],
  '富山県':[36.70,137.21],'石川県':[36.59,136.63],'福井県':[36.07,136.22],
  '山梨県':[35.66,138.57],'長野県':[36.23,138.18],'岐阜県':[35.39,136.72],
  '静岡県':[34.98,138.38],'愛知県':[35.18,136.91],'三重県':[34.73,136.51],
  '滋賀県':[35.00,135.87],'京都府':[35.02,135.77],'大阪府':[34.69,135.52],
  '兵庫県':[34.69,135.18],'奈良県':[34.69,135.83],'和歌山県':[34.23,135.17],
  '鳥取県':[35.50,134.24],'島根県':[35.47,133.05],'岡山県':[34.66,133.93],
  '広島県':[34.40,132.46],'山口県':[34.19,131.47],'徳島県':[34.07,134.56],
  '香川県':[34.34,134.04],'愛媛県':[33.84,132.77],'高知県':[33.56,133.53],
  '福岡県':[33.61,130.42],'佐賀県':[33.25,130.30],'長崎県':[32.74,129.87],
  '熊本県':[32.79,130.74],'大分県':[33.24,131.61],'宮崎県':[31.91,131.42],
  '鹿児島県':[31.56,130.56],'沖縄県':[26.34,127.80]
};

// =================================================
// 初期化
// =================================================
document.addEventListener('DOMContentLoaded', function() {
  initSupabase();
  initMap();
  initGooglePlaces();
  initTabs();
  initAuth();
  loadSpots();
});

function initSupabase() {
  try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch(e) { console.warn('Supabase init failed:', e); }
}

function initGooglePlaces() {
  try {
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      googleReady = true;
    }
  } catch(e) { console.warn('Google Places not available, using Nominatim fallback'); }
}

function initMap() {
  var container = document.getElementById('spotMap');
  if (!container.offsetWidth || !container.offsetHeight) {
    container.style.minHeight = '400px';
  }

  map = L.map('spotMap', {
    maxBounds: [[15, 110], [55, 160]],
    maxBoundsViscosity: 1.0,
    minZoom: 5,
    zoomSnap: 0.5,
    zoomDelta: 0.5
  }).setView([36.5, 138], 6);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
    noWrap: true
  }).addTo(map);

  setTimeout(function() {
    map.invalidateSize();
    map.fitBounds([[31, 130], [45.5, 146]], { padding: [20, 20] });
  }, 300);

  // 地図クリック — 新規登録タブが表示中なら常に有効
  map.on('click', function(e) {
    if (activeMainTab !== 'sectionAdd') return;
    handleMapClick(e.latlng);
  });
}

// =================================================
// タブ制御
// =================================================
function initTabs() {
  // メインタブ
  document.querySelectorAll('.sidebar-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.sidebar-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.sidebar-section').forEach(function(s) { s.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.dataset.target;
      document.getElementById(target).classList.add('active');
      activeMainTab = target;

      // 登録タブ選択時のみ十字カーソル表示
      var crosshair = document.getElementById('crosshair');
      if (crosshair) crosshair.style.display = (target === 'sectionAdd') ? 'block' : 'none';

      // 出没予報タブを初回表示時に初期化
      if (target === 'sectionSchedule') initScheduleTab();
    });
  });

  // 登録タブ内のサブタブ
  document.querySelectorAll('.add-sub-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.add-sub-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.add-sub-section').forEach(function(s) { s.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });

  // 検索欄 Enter キー対応
  var searchInput = document.getElementById('searchPlaceName');
  if (searchInput) {
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); searchPlace(); }
    });
  }
}

// =================================================
// 認証
// =================================================
function initAuth() {
  if (typeof firebase === 'undefined' || !firebase.auth) return;
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      currentUser = { uid: user.uid, email: user.email, documentId: null, prefecture: null };
      lookupDocumentId(user.email);
      document.getElementById('authStatus').textContent = user.email;
      document.getElementById('btnLogin').style.display = 'none';
      document.getElementById('btnLogout').style.display = 'inline-block';
    } else {
      currentUser = null;
      document.getElementById('authStatus').textContent = 'ログインしていません';
      document.getElementById('btnLogin').style.display = 'inline-block';
      document.getElementById('btnLogout').style.display = 'none';
    }
  });
}

// Supabase で直接 cars テーブルから DocumentID と Prefecture を取得
async function lookupDocumentId(email) {
  if (!supabaseClient) return;

  try {
    var result = await supabaseClient
      .from('cars')
      .select('*')
      .eq('owner_email', email.toLowerCase())
      .limit(1);

    var data = result.data;
    if (!data || data.length === 0) return;

    var car = data[0];
    currentUser.documentId = car.document_id;

    // 都道府県があれば地図をズーム
    var pref = car.prefecture || car.Prefecture || null;
    if (pref && PREF_CENTER[pref]) {
      currentUser.prefecture = pref;
      map.setView(PREF_CENTER[pref], 10);
    }

    loadMyFavorites();
  } catch(e) {
    console.error('lookupDocumentId error:', e);
  }
}

// =================================================
// API呼び出し（GAS バックエンド用）
// =================================================
function apiGet(params) {
  var qs = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  return fetch(API_URL + '?' + qs).then(function(r) { return r.json(); });
}

function apiPost(action, data) {
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, data: data })
  }).then(function(r) { return r.json(); });
}

// =================================================
// スポット読み込み
// =================================================
function loadSpots() {
  var category = document.getElementById('filterCategory').value;
  var params = { mode: 'spots' };
  if (category) params.category = category;

  document.getElementById('spotList').innerHTML = '<div class="loading-spinner">読み込み中...</div>';

  apiGet(params).then(function(res) {
    if (!res.success) throw new Error(res.error);
    allSpots = res.data || [];
    renderSpotList(allSpots);
    renderSpotMarkers(allSpots);
  }).catch(function(err) {
    document.getElementById('spotList').innerHTML =
      '<div class="empty-state"><div class="empty-state-text">読み込みエラー: ' + err.message + '</div></div>';
  });
}

function renderSpotList(spots) {
  var container = document.getElementById('spotList');
  if (spots.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📍</div>'
      + '<div class="empty-state-text">スポットがまだありません</div></div>';
    return;
  }
  container.innerHTML = spots.map(function(s) {
    var icon = CATEGORY_ICONS[s.category] || '📍';
    var label = CATEGORY_LABELS[s.category] || s.category;
    return '<div class="spot-card" onclick="showSpotDetail(\'' + s.spot_id + '\')">'
      + '<div class="spot-card-name">' + icon + ' ' + escapeHtml(s.name) + '</div>'
      + '<div class="spot-card-meta">'
      + '<span class="spot-card-badge">' + label + '</span>'
      + '<span>' + (s.registration_count || 0) + '人登録</span>'
      + (s.address ? '<span>' + escapeHtml(s.address) + '</span>' : '')
      + '</div></div>';
  }).join('');
}

function renderSpotMarkers(spots) {
  Object.keys(markers).forEach(function(id) { map.removeLayer(markers[id]); });
  markers = {};

  spots.forEach(function(s) {
    if (!s.latitude || !s.longitude) return;
    var icon = L.divIcon({
      className: 'spot-marker-icon',
      html: CATEGORY_ICONS[s.category] || '📍',
      iconSize: [30, 30]
    });
    var marker = L.marker([s.latitude, s.longitude], { icon: icon })
      .addTo(map)
      .bindPopup('<b>' + escapeHtml(s.name) + '</b><br>'
        + (s.registration_count || 0) + '人登録<br>'
        + '<a href="#" onclick="showSpotDetail(\'' + s.spot_id + '\'); return false;">詳細を見る</a>');
    markers[s.spot_id] = marker;
  });
}

// =================================================
// 地図クリック処理
// =================================================
function handleMapClick(latlng) {
  selectedLatLng = latlng;

  // マーカー表示
  if (clickMarker) map.removeLayer(clickMarker);
  clickMarker = L.marker(latlng, {
    icon: L.divIcon({ className: 'spot-marker-icon', html: '📌', iconSize: [30, 30] })
  }).addTo(map);

  // hidden フィールドに座標セット
  document.getElementById('inputLat').value = latlng.lat.toFixed(6);
  document.getElementById('inputLng').value = latlng.lng.toFixed(6);

  // 位置表示を更新
  var posDisp = document.getElementById('clickPosDisplay');
  if (posDisp) {
    posDisp.textContent = '選択位置: ' + latlng.lat.toFixed(4) + ', ' + latlng.lng.toFixed(4);
    posDisp.style.color = 'green';
  }

  // 逆ジオコーディングで住所を取得
  reverseGeocode(latlng.lat, latlng.lng);

  // 近くの重複チェック
  showNearbyCheck(latlng.lat, latlng.lng);
}

// =================================================
// 逆ジオコーディング（住所自動入力）
// =================================================
function reverseGeocode(lat, lng) {
  var addressInput = document.getElementById('inputAddress');

  if (googleReady) {
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat: lat, lng: lng } }, function(results, status) {
      if (status === 'OK' && results && results[0]) {
        addressInput.value = results[0].formatted_address;
      }
    });
  } else {
    // Nominatim フォールバック
    fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng
      + '&format=json&accept-language=ja&zoom=18')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.display_name) {
          addressInput.value = data.display_name;
        }
      })
      .catch(function() {});
  }
}

// =================================================
// 施設名検索（Google Places / Nominatim フォールバック）
// =================================================
function searchPlace() {
  var query = document.getElementById('searchPlaceName').value.trim();
  if (!query) { alert('施設名を入力してください'); return; }

  var resultsDiv = document.getElementById('searchResults');
  resultsDiv.innerHTML = '<div class="loading-spinner">検索中...</div>';

  if (googleReady) {
    searchWithGoogle(query, resultsDiv);
  } else {
    searchWithNominatim(query, resultsDiv);
  }
}

// --- Google Places 検索 ---
function searchWithGoogle(query, resultsDiv) {
  var service = new google.maps.places.AutocompleteService();
  service.getPlacePredictions({
    input: query,
    componentRestrictions: { country: 'jp' },
    language: 'ja'
  }, function(predictions, status) {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions || predictions.length === 0) {
      // Google がエラーの場合 Nominatim にフォールバック
      console.warn('Google Places error (' + status + '), falling back to Nominatim');
      searchWithNominatim(query, resultsDiv);
      return;
    }
    resultsDiv.innerHTML = predictions.slice(0, 5).map(function(p) {
      return '<div class="spot-card" style="cursor:pointer" onclick="selectGooglePlace(\'' + escapeHtml(p.place_id) + '\')">'
        + '<div class="spot-card-name">📍 ' + escapeHtml(p.structured_formatting.main_text) + '</div>'
        + '<div class="spot-card-meta"><span>' + escapeHtml(p.description) + '</span></div>'
        + '</div>';
    }).join('');
  });
}

function selectGooglePlace(placeId) {
  var service = new google.maps.places.PlacesService(document.createElement('div'));
  service.getDetails({
    placeId: placeId,
    fields: ['geometry', 'formatted_address', 'name']
  }, function(place, status) {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !place) return;

    var lat = place.geometry.location.lat();
    var lng = place.geometry.location.lng();

    applySearchResult(lat, lng, place.formatted_address || '', place.name || '');
  });
}

// --- Nominatim 検索（フォールバック） ---
function searchWithNominatim(query, resultsDiv) {
  fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query)
    + '&format=json&limit=5&countrycodes=jp&addressdetails=1&accept-language=ja')
    .then(function(r) { return r.json(); })
    .then(function(results) {
      if (!results || results.length === 0) {
        resultsDiv.innerHTML = '<p style="font-size:0.82rem;color:var(--text-sub)">見つかりませんでした</p>';
        return;
      }
      // 結果をグローバルに保存（onclick で参照）
      window._nominatimResults = results;
      resultsDiv.innerHTML = results.map(function(r, i) {
        var shortName = r.display_name.split(',')[0];
        return '<div class="spot-card" style="cursor:pointer" onclick="selectNominatimResult(' + i + ')">'
          + '<div class="spot-card-name">📍 ' + escapeHtml(shortName) + '</div>'
          + '<div class="spot-card-meta"><span>' + escapeHtml(r.display_name) + '</span></div>'
          + '</div>';
      }).join('');
    }).catch(function(err) {
      resultsDiv.innerHTML = '<p style="font-size:0.82rem;color:var(--text-sub)">検索エラー: ' + escapeHtml(err.message) + '</p>';
    });
}

function selectNominatimResult(index) {
  var r = window._nominatimResults && window._nominatimResults[index];
  if (!r) return;

  var lat = parseFloat(r.lat);
  var lng = parseFloat(r.lon);
  var addr = r.display_name || '';
  var name = r.display_name.split(',')[0];

  applySearchResult(lat, lng, addr, name);
}

// --- 検索結果を地図・フォームに反映 ---
function applySearchResult(lat, lng, address, name) {
  selectedLatLng = L.latLng(lat, lng);
  document.getElementById('inputLat').value = lat.toFixed(6);
  document.getElementById('inputLng').value = lng.toFixed(6);
  if (address) document.getElementById('inputAddress').value = address;
  if (name) document.getElementById('inputName').value = name;

  // 地図を移動してマーカー表示
  map.setView([lat, lng], 15);
  if (clickMarker) map.removeLayer(clickMarker);
  clickMarker = L.marker([lat, lng], {
    icon: L.divIcon({ className: 'spot-marker-icon', html: '📌', iconSize: [30, 30] })
  }).addTo(map);

  document.getElementById('searchResults').innerHTML =
    '<p style="font-size:0.82rem;color:green">選択済み: ' + escapeHtml(name || address) + '</p>';

  showNearbyCheck(lat, lng);
}

// =================================================
// 近隣スポット重複チェック
// =================================================
function showNearbyCheck(lat, lng) {
  var nearbyDiv = document.getElementById('nearbyResults');
  nearbyDiv.innerHTML = '<div class="loading-spinner">近くのスポットを確認中...</div>';
  nearbyDiv.style.display = 'block';

  apiPost('findNearbySpots', { latitude: lat, longitude: lng, radius: 500 })
    .then(function(res) {
      if (!res.success || !res.data || res.data.length === 0) {
        nearbyDiv.innerHTML = '<p style="font-size:0.82rem;color:green">近くに重複スポットはありません</p>';
        return;
      }
      nearbyDiv.innerHTML = '<p style="font-size:0.82rem;color:#d97706;font-weight:600">近くに既存スポットがあります:</p>'
        + res.data.map(function(s) {
          return '<div style="font-size:0.82rem;padding:4px 0">'
            + (CATEGORY_ICONS[s.category] || '📍') + ' ' + escapeHtml(s.name)
            + ' (' + s.registration_count + '人登録)'
            + '</div>';
        }).join('');
    }).catch(function() {
      nearbyDiv.innerHTML = '';
    });
}

// =================================================
// スポット詳細モーダル
// =================================================
function showSpotDetail(spotId) {
  var modal = document.getElementById('detailModal');
  var body = document.getElementById('detailBody');
  body.innerHTML = '<div class="loading-spinner">読み込み中...</div>';
  modal.classList.add('show');

  apiGet({ mode: 'spot_detail', spot_id: spotId }).then(function(res) {
    if (!res.success) throw new Error(res.error);
    var s = res.data;
    var icon = CATEGORY_ICONS[s.category] || '📍';
    var label = CATEGORY_LABELS[s.category] || s.category;

    var html = '<h3>' + icon + ' ' + escapeHtml(s.name) + '</h3>'
      + '<p><span class="spot-card-badge">' + label + '</span> '
      + (s.registration_count || 0) + '人登録</p>'
      + (s.address ? '<p style="font-size:0.85rem;color:var(--text-sub)">' + escapeHtml(s.address) + '</p>' : '');

    // ストリートビュー
    if (s.latitude && s.longitude) {
      html += '<div style="margin:10px 0">'
        + '<iframe src="https://www.google.com/maps/embed/v1/streetview?key=' + FIREBASE_CONFIG.apiKey
        + '&location=' + s.latitude + ',' + s.longitude
        + '&heading=0&pitch=0&fov=90" width="100%" height="200" style="border:0;border-radius:8px" allowfullscreen loading="lazy"></iframe>'
        + '</div>';
    }

    // 出没登録ボタン（ログイン中のみ）
    if (currentUser && currentUser.documentId) {
      var myFav = myFavorites.find(function(f) { return f.spot_id === spotId; });
      if (myFav) {
        html += '<button class="btn-danger" style="margin:8px 0" onclick="removeFavorite(\'' + spotId + '\')">出没登録を解除</button>';
      } else {
        html += '<button class="btn-primary" style="margin:8px 0" onclick="addFavorite(\'' + spotId + '\')">出没スポットに登録</button>';
      }
    }

    // 登録者一覧
    if (s.favorites && s.favorites.length > 0) {
      html += '<h4 style="margin-top:16px;font-size:0.9rem">出没メンバー</h4>';
      s.favorites.forEach(function(f) {
        html += '<div class="schedule-card">'
          + '<div style="font-weight:600">' + escapeHtml(f.handle_name || f.owner_document_id) + '</div>'
          + (f.comment ? '<div class="schedule-meta">' + escapeHtml(f.comment) + '</div>' : '')
          + '</div>';
      });
    }

    // 出没予定
    if (s.schedules && s.schedules.length > 0) {
      html += '<h4 style="margin-top:16px;font-size:0.9rem">今後の出没予定</h4>';
      s.schedules.forEach(function(sc) {
        var dateLabel = formatDateWithDay(sc.visit_date);
        var timeLabel = formatTimeSlot(sc.visit_time_slot);
        html += '<div class="schedule-card">'
          + '<div class="schedule-date">' + dateLabel + (timeLabel ? ' ' + timeLabel : '') + '</div>'
          + '<div class="schedule-meta">' + escapeHtml(sc.handle_name || sc.owner_document_id)
          + (sc.comment ? ' — ' + escapeHtml(sc.comment) : '') + '</div>'
          + '</div>';
      });
    }

    body.innerHTML = html;
  }).catch(function(err) {
    body.innerHTML = '<div class="empty-state"><div class="empty-state-text">エラー: ' + err.message + '</div></div>';
  });
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('show');
}

// =================================================
// 出没スポット操作
// =================================================
function loadMyFavorites() {
  if (!currentUser || !currentUser.documentId) return;
  apiGet({ mode: 'my_favorites', owner_document_id: currentUser.documentId })
    .then(function(res) {
      if (!res.success) return;
      myFavorites = res.data || [];
      renderMyFavorites();
      schedUpdateSpotDropdown();
    }).catch(function() {});
}

function renderMyFavorites() {
  var container = document.getElementById('myFavList');
  if (myFavorites.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📍</div>'
      + '<div class="empty-state-text">出没スポットがありません</div></div>';
    return;
  }
  container.innerHTML = myFavorites.map(function(f) {
    var s = f.spot || {};
    var icon = CATEGORY_ICONS[s.category] || '📍';
    return '<div class="spot-card" onclick="showSpotDetail(\'' + f.spot_id + '\')">'
      + '<div class="spot-card-name">' + icon + ' ' + escapeHtml(s.name || f.spot_id) + '</div>'
      + '<div class="spot-card-meta">'
      + (f.comment ? '<span>' + escapeHtml(f.comment) + '</span>' : '')
      + (f.frequency ? '<span>' + f.frequency + '</span>' : '')
      + '</div></div>';
  }).join('');
}

function addFavorite(spotId) {
  if (!currentUser || !currentUser.documentId) { alert('ログインが必要です'); return; }
  apiPost('addFavoriteSpot', {
    owner_document_id: currentUser.documentId,
    spot_id: spotId
  }).then(function(res) {
    if (!res.success) throw new Error(res.error);
    loadMyFavorites();
    closeDetailModal();
  }).catch(function(err) { alert('エラー: ' + err.message); });
}

function removeFavorite(spotId) {
  if (!currentUser || !currentUser.documentId) return;
  var fav = myFavorites.find(function(f) { return f.spot_id === spotId; });
  if (!fav) return;
  apiPost('deleteFavoriteSpot', {
    favorite_id: fav.favorite_id,
    owner_document_id: currentUser.documentId
  }).then(function(res) {
    if (!res.success) throw new Error(res.error);
    loadMyFavorites();
    closeDetailModal();
  }).catch(function(err) { alert('エラー: ' + err.message); });
}

// =================================================
// 新規スポット登録
// =================================================
function submitNewSpot() {
  var name = document.getElementById('inputName').value.trim();
  var category = document.getElementById('inputCategory').value;
  var lat = document.getElementById('inputLat').value;
  var lng = document.getElementById('inputLng').value;
  var address = document.getElementById('inputAddress').value.trim();

  if (!name) { alert('スポット名を入力してください'); return; }
  if (!category) { alert('カテゴリを選択してください'); return; }
  if (!lat || !lng) { alert('施設を検索するか、地図をクリックして位置を選択してください'); return; }

  var btn = document.getElementById('btnSubmitSpot');
  btn.disabled = true;
  btn.textContent = '登録中...';

  apiPost('createSpot', {
    name: name, category: category,
    latitude: parseFloat(lat), longitude: parseFloat(lng),
    address: address || null
  }).then(function(res) {
    if (!res.success) throw new Error(res.error);
    alert('スポット「' + name + '」を登録しました！');
    resetForm();
    loadSpots();
  }).catch(function(err) {
    alert('登録エラー: ' + err.message);
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = 'スポットを登録';
  });
}

function resetForm() {
  document.getElementById('inputName').value = '';
  document.getElementById('inputCategory').value = '';
  document.getElementById('inputLat').value = '';
  document.getElementById('inputLng').value = '';
  document.getElementById('inputAddress').value = '';
  var searchInput = document.getElementById('searchPlaceName');
  if (searchInput) searchInput.value = '';
  var searchResults = document.getElementById('searchResults');
  if (searchResults) searchResults.innerHTML = '';
  document.getElementById('nearbyResults').style.display = 'none';
  var posDisp = document.getElementById('clickPosDisplay');
  if (posDisp) posDisp.textContent = '';
  if (clickMarker) { map.removeLayer(clickMarker); clickMarker = null; }
  selectedLatLng = null;
}

// =================================================
// ログイン/ログアウト
// =================================================
function doLogin() {
  if (typeof firebase === 'undefined') return;
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(function(err) {
    alert('ログインエラー: ' + err.message);
  });
}

function doLogout() {
  if (typeof firebase === 'undefined') return;
  firebase.auth().signOut();
  currentUser = null;
  myFavorites = [];
  renderMyFavorites();
}

// =================================================
// 出没予報（スケジュール）
// =================================================
var schedWeekStart = null;
var schedData = [];
var schedInitialized = false;
var SCHED_DAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];

function initScheduleTab() {
  if (schedInitialized) return;
  schedInitialized = true;
  schedWeekStart = getMonday(new Date());
  schedRenderWeek();
  schedLoadData();
  schedUpdateSpotDropdown();
}

function getMonday(d) {
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  var mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function schedFormatDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}

function schedChangeWeek(delta) {
  schedWeekStart.setDate(schedWeekStart.getDate() + delta * 7);
  schedRenderWeek();
  schedLoadData();
}

function schedRenderWeek() {
  var end = new Date(schedWeekStart);
  end.setDate(end.getDate() + 6);
  document.getElementById('schedWeekLabel').textContent =
    (schedWeekStart.getMonth() + 1) + '/' + schedWeekStart.getDate()
    + ' 〜 ' + (end.getMonth() + 1) + '/' + end.getDate();

  var grid = document.getElementById('schedWeekGrid');
  var today = schedFormatDate(new Date());
  var html = '';

  for (var i = 0; i < 7; i++) {
    var d = new Date(schedWeekStart);
    d.setDate(d.getDate() + i);
    var ds = schedFormatDate(d);
    var isToday = ds === today;
    var dayClass = (i === 6) ? 'sun' : (i === 5 ? 'sat' : '');

    html += '<div class="sched-day-cell' + (isToday ? ' today' : '') + '" onclick="openScheduleModal(\'' + ds + '\')">'
      + '<div class="sched-day-header">' + SCHED_DAY_NAMES[i] + '</div>'
      + '<div class="sched-day-number ' + dayClass + (isToday ? ' today' : '') + '">' + d.getDate() + '</div>'
      + '<div id="sched-day-' + ds + '"></div>'
      + '</div>';
  }
  grid.innerHTML = html;
}

function schedLoadData() {
  var dateFrom = schedFormatDate(schedWeekStart);
  var dateTo = schedFormatDate(new Date(schedWeekStart.getTime() + 6 * 86400000));

  apiGet({ mode: 'schedules', date_from: dateFrom, date_to: dateTo })
    .then(function(res) {
      if (!res.success) throw new Error(res.error);
      schedData = res.data || [];
      schedEnrichWithSpotNames(function() {
        schedFillCalendar();
        schedRenderList();
      });
    }).catch(function(err) {
      document.getElementById('scheduleList').innerHTML =
        '<div class="empty-state"><div class="empty-state-text">読み込みエラー: ' + err.message + '</div></div>';
    });
}

function schedEnrichWithSpotNames(callback) {
  var ids = [];
  schedData.forEach(function(sc) {
    if (ids.indexOf(sc.spot_id) === -1) ids.push(sc.spot_id);
  });
  if (ids.length === 0) { callback(); return; }

  apiGet({ mode: 'spots' }).then(function(res) {
    if (!res.success) { callback(); return; }
    var spotMap = {};
    (res.data || []).forEach(function(s) { spotMap[s.spot_id] = s; });
    schedData.forEach(function(sc) {
      var s = spotMap[sc.spot_id];
      if (s) { sc.spot_name = s.name; sc.spot_category = s.category; }
    });
    callback();
  }).catch(function() { callback(); });
}

function schedFillCalendar() {
  schedData.forEach(function(sc) {
    var cell = document.getElementById('sched-day-' + sc.visit_date);
    if (!cell) return;
    var icon = CATEGORY_ICONS[sc.spot_category] || '📍';
    cell.innerHTML += '<div class="sched-day-entry">'
      + icon + ' ' + escapeHtml(sc.spot_name || sc.spot_id)
      + '</div>';
  });
}

function schedRenderList() {
  var container = document.getElementById('scheduleList');
  if (schedData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div>'
      + '<div class="empty-state-text">この週の出没予定はありません</div></div>';
    return;
  }
  container.innerHTML = schedData.map(function(sc) {
    var icon = CATEGORY_ICONS[sc.spot_category] || '📍';
    var canDelete = currentUser && currentUser.documentId === sc.owner_document_id;
    var dateLabel = formatDateWithDay(sc.visit_date);
    var timeLabel = formatTimeSlot(sc.visit_time_slot);
    return '<div class="schedule-card">'
      + '<div class="schedule-date">' + dateLabel + (timeLabel ? ' ' + timeLabel : '') + '</div>'
      + '<div style="font-weight:600;margin:2px 0">' + icon + ' ' + escapeHtml(sc.spot_name || sc.spot_id) + '</div>'
      + '<div class="schedule-meta">' + escapeHtml(sc.handle_name || sc.owner_document_id)
      + (sc.visit_time_comment ? ' — ' + escapeHtml(sc.visit_time_comment) : '')
      + (sc.comment ? '<br>' + escapeHtml(sc.comment) : '') + '</div>'
      + (canDelete ? '<button class="btn-danger" style="margin-top:6px;font-size:0.72rem;padding:4px 10px" onclick="deleteSchedule(\'' + sc.schedule_id + '\')">削除</button>' : '')
      + '</div>';
  }).join('');
}

// --- 予定登録モーダル ---
function openScheduleModal(dateStr) {
  if (!currentUser || !currentUser.documentId) {
    alert('予定を登録するにはログインが必要です');
    return;
  }
  document.getElementById('schedDate').value = dateStr || schedFormatDate(new Date());
  schedUpdateSpotDropdown();
  document.getElementById('schedModal').classList.add('show');
}

function closeSchedModal() {
  document.getElementById('schedModal').classList.remove('show');
}

function schedUpdateSpotDropdown() {
  var sel = document.getElementById('schedSpot');
  if (!sel) return;
  sel.innerHTML = '<option value="">選択してください</option>';
  myFavorites.forEach(function(f) {
    var s = f.spot || {};
    var opt = document.createElement('option');
    opt.value = f.spot_id;
    opt.textContent = (CATEGORY_ICONS[s.category] || '📍') + ' ' + (s.name || f.spot_id);
    sel.appendChild(opt);
  });
}

function submitSchedule() {
  var spotId = document.getElementById('schedSpot').value;
  var date = document.getElementById('schedDate').value;
  if (!spotId) { alert('スポットを選択してください'); return; }
  if (!date) { alert('日付を選択してください'); return; }

  var btn = document.getElementById('btnSubmitSched');
  btn.disabled = true;
  btn.textContent = '登録中...';

  apiPost('createSchedule', {
    owner_document_id: currentUser.documentId,
    spot_id: spotId,
    visit_date: date,
    visit_time_slot: document.getElementById('schedTimeSlot').value || null,
    visit_time_comment: document.getElementById('schedTimeComment').value || null,
    expected_duration_minutes: parseInt(document.getElementById('schedDuration').value) || null,
    comment: document.getElementById('schedComment').value || null
  }).then(function(res) {
    if (!res.success) throw new Error(res.error);
    alert('出没予定を登録しました！');
    closeSchedModal();
    // リロード
    schedRenderWeek();
    schedLoadData();
  }).catch(function(err) {
    alert('エラー: ' + err.message);
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = '予定を登録';
  });
}

function deleteSchedule(scheduleId) {
  if (!confirm('この予定を削除しますか？')) return;
  apiPost('deleteSchedule', {
    schedule_id: scheduleId,
    owner_document_id: currentUser.documentId
  }).then(function(res) {
    if (!res.success) throw new Error(res.error);
    schedRenderWeek();
    schedLoadData();
  }).catch(function(err) { alert('エラー: ' + err.message); });
}

// =================================================
// ユーティリティ
// =================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
