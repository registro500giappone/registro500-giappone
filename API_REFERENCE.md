# Spot API リファレンス

Base URL: `https://script.google.com/macros/s/...YOUR_DEPLOY_ID.../exec`

---

## GET エンドポイント

### getSpots — スポット一覧取得

```
GET ?mode=spots
GET ?mode=spots&category=cafe
GET ?mode=spots&prefecture=神奈川県
GET ?mode=spots&category=parking&limit=20&offset=0
```

**パラメータ:**
| 名前 | 必須 | 説明 |
|------|------|------|
| mode | Yes | `spots` 固定 |
| category | No | カテゴリ (cafe, parking, photo 等) |
| prefecture | No | 都道府県 (address部分一致) |
| limit | No | 取得件数 (デフォルト50, 最大200) |
| offset | No | オフセット (デフォルト0) |

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "spot_id": "SPOT_001",
      "name": "代官山T-SITE",
      "category": "cafe",
      "latitude": 35.648765,
      "longitude": 139.700342,
      "address": "東京都渋谷区猿楽町17-5",
      "registration_count": 3,
      "created_at": "2026-02-08T12:00:00+09:00"
    }
  ]
}
```

---

### spot_detail — スポット詳細取得

```
GET ?mode=spot_detail&spot_id=SPOT_001
```

**パラメータ:**
| 名前 | 必須 | 説明 |
|------|------|------|
| mode | Yes | `spot_detail` 固定 |
| spot_id | Yes | スポットID |

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "spot_id": "SPOT_001",
    "name": "代官山T-SITE",
    "category": "cafe",
    "latitude": 35.648765,
    "longitude": 139.700342,
    "registration_count": 3,
    "favorites": [
      {
        "favorite_id": "FAV_001",
        "owner_document_id": "DOC_1",
        "comment": "週末の朝によく行きます"
      }
    ],
    "schedules": [
      {
        "schedule_id": "SCHED_001",
        "owner_document_id": "DOC_1",
        "visit_date": "2026-03-15",
        "visit_time_slot": "morning"
      }
    ]
  }
}
```

---

### my_favorites — マイお気に入り一覧

```
GET ?mode=my_favorites&owner_document_id=DOC_1
```

**パラメータ:**
| 名前 | 必須 | 説明 |
|------|------|------|
| mode | Yes | `my_favorites` 固定 |
| owner_document_id | Yes | 自分のDocumentID |

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "favorite_id": "FAV_001",
      "spot_id": "SPOT_001",
      "comment": "週末の朝によく行きます",
      "time_slots": ["morning"],
      "weekdays": ["sat", "sun"],
      "frequency": "weekly",
      "spot": {
        "spot_id": "SPOT_001",
        "name": "代官山T-SITE",
        "category": "cafe",
        "latitude": 35.648765,
        "longitude": 139.700342
      }
    }
  ]
}
```

---

### schedules — 出没予定一覧

```
GET ?mode=schedules
GET ?mode=schedules&spot_id=SPOT_001
GET ?mode=schedules&date_from=2026-03-01&date_to=2026-03-31
```

**パラメータ:**
| 名前 | 必須 | 説明 |
|------|------|------|
| mode | Yes | `schedules` 固定 |
| spot_id | No | スポットIDでフィルタ |
| date_from | No | 開始日 yyyy-MM-dd (デフォルト: 今日) |
| date_to | No | 終了日 yyyy-MM-dd |
| limit | No | 取得件数 (デフォルト50, 最大200) |

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "schedule_id": "SCHED_001",
      "owner_document_id": "DOC_1",
      "spot_id": "SPOT_001",
      "visit_date": "2026-03-15",
      "visit_time_slot": "morning",
      "visit_time_comment": "10時頃到着予定",
      "comment": "コーヒー飲みながらまったり"
    }
  ]
}
```

---

## POST エンドポイント

すべて `Content-Type: application/json` でリクエスト。

### createSpot — スポット新規登録

```json
{
  "action": "createSpot",
  "data": {
    "name": "道の駅 箱根峠",
    "category": "parking",
    "latitude": 35.1934,
    "longitude": 139.0267,
    "place_id": "ChIJ...",
    "address": "神奈川県足柄下郡箱根町箱根381-22"
  }
}
```

**data フィールド:**
| 名前 | 必須 | 型 | 説明 |
|------|------|----|------|
| name | Yes | string | スポット名 (最大200文字) |
| category | Yes | string | カテゴリ (最大50文字) |
| latitude | Yes | number | 緯度 |
| longitude | Yes | number | 経度 |
| place_id | No | string | Google Place ID |
| address | No | string | 住所 |

**レスポンス:**
```json
{ "success": true, "data": { "spot_id": "SPOT_004" } }
```

---

### addFavoriteSpot — お気に入り登録

```json
{
  "action": "addFavoriteSpot",
  "data": {
    "owner_document_id": "DOC_1",
    "spot_id": "SPOT_001",
    "comment": "週末の朝によく行きます",
    "time_slots": ["morning"],
    "weekdays": ["sat", "sun"],
    "frequency": "weekly",
    "visibility": "public"
  }
}
```

**data フィールド:**
| 名前 | 必須 | 型 | 説明 |
|------|------|----|------|
| owner_document_id | Yes | string | 自分のDocumentID |
| spot_id | Yes | string | スポットID |
| comment | No | string | コメント |
| time_slots | No | array | 時間帯 ["morning","afternoon","evening","night"] |
| time_comment | No | string | 時間補足 (最大100文字) |
| weekdays | No | array | 曜日 ["mon","tue","wed","thu","fri","sat","sun"] |
| frequency | No | string | 頻度 (daily, weekly, monthly, rarely) |
| duration_minutes | No | number | 滞在時間（分） |
| visibility | No | string | 公開設定 (public/private, デフォルト: public) |
| photos | No | array | 写真URL配列 |

**レスポンス:**
```json
{ "success": true, "data": { "favorite_id": "FAV_004" } }
```

---

### updateFavoriteSpot — お気に入り更新

```json
{
  "action": "updateFavoriteSpot",
  "data": {
    "favorite_id": "FAV_001",
    "owner_document_id": "DOC_1",
    "comment": "更新後のコメント",
    "visibility": "private"
  }
}
```

**data フィールド:**
| 名前 | 必須 | 説明 |
|------|------|------|
| favorite_id | Yes | 更新対象のID |
| owner_document_id | Yes | 権限チェック用 |
| その他 | No | addFavoriteSpot と同じフィールド |

**レスポンス:**
```json
{ "success": true, "data": { "favorite_id": "FAV_001", "comment": "更新後のコメント", "..." } }
```

---

### deleteFavoriteSpot — お気に入り削除

```json
{
  "action": "deleteFavoriteSpot",
  "data": {
    "favorite_id": "FAV_001",
    "owner_document_id": "DOC_1"
  }
}
```

**レスポンス:**
```json
{ "success": true, "data": { "ok": true } }
```

---

### createSchedule — 出没予定登録

```json
{
  "action": "createSchedule",
  "data": {
    "owner_document_id": "DOC_1",
    "spot_id": "SPOT_001",
    "visit_date": "2026-03-15",
    "visit_time_slot": "morning",
    "visit_time_comment": "10時頃到着予定",
    "expected_duration_minutes": 120,
    "comment": "コーヒー飲みながらまったり"
  }
}
```

**data フィールド:**
| 名前 | 必須 | 型 | 説明 |
|------|------|----|------|
| owner_document_id | Yes | string | 自分のDocumentID |
| spot_id | Yes | string | スポットID |
| visit_date | Yes | string | 訪問日 (yyyy-MM-dd) |
| visit_time_slot | No | string | 時間帯 (morning/afternoon/evening/night) |
| visit_time_comment | No | string | 時間補足 (最大50文字) |
| expected_duration_minutes | No | number | 予定滞在時間（分） |
| comment | No | string | コメント |
| visibility | No | string | 公開設定 (デフォルト: public) |

**レスポンス:**
```json
{ "success": true, "data": { "schedule_id": "SCHED_004" } }
```

---

### deleteSchedule — 出没予定削除

```json
{
  "action": "deleteSchedule",
  "data": {
    "schedule_id": "SCHED_001",
    "owner_document_id": "DOC_1"
  }
}
```

**レスポンス:**
```json
{ "success": true, "data": { "ok": true } }
```

---

### findNearbySpots — 近隣スポット検索

```json
{
  "action": "findNearbySpots",
  "data": {
    "latitude": 35.648,
    "longitude": 139.700,
    "radius": 500
  }
}
```

**data フィールド:**
| 名前 | 必須 | 型 | 説明 |
|------|------|----|------|
| latitude | Yes | number | 中心緯度 |
| longitude | Yes | number | 中心経度 |
| radius | No | number | 半径メートル (デフォルト: 500) |

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "spot_id": "SPOT_001",
      "name": "代官山T-SITE",
      "latitude": 35.648765,
      "longitude": 139.700342,
      "registration_count": 3
    }
  ]
}
```

---

## エラーレスポンス

すべてのエンドポイントで共通:

```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

**主なエラーパターン:**

| エラー | 原因 |
|--------|------|
| `スポット名は必須です` | createSpot で name が未指定 |
| `カテゴリは必須です` | createSpot で category が未指定 |
| `緯度・経度は必須です` | 座標系パラメータが未指定 |
| `owner_document_id は必須です` | 認証系パラメータが未指定 |
| `spot_id は必須です` | スポットID未指定 |
| `スポットが見つかりません` | spot_detail で存在しないspot_id |
| `更新対象が見つかりません` | updateFavoriteSpot で不正なIDまたは権限なし |
| `Supabase error (4xx): ...` | DB側のエラー（重複登録等） |
| `Unknown mode` | doGet で不正なmode |
| `Unknown action` | doPost で不正なaction |

---

## カテゴリ一覧（推奨値）

| 値 | 表示名 |
|----|--------|
| cafe | カフェ・飲食店 |
| parking | 駐車場・PA/SA |
| photo | 撮影スポット |
| workshop | 整備工場・ガレージ |
| meeting | 集合場所 |
| drive | ドライブルート |
| other | その他 |
