# スポット機能 デプロイ手順書

## 前提条件
- Google Apps Script プロジェクトへのアクセス権
- clasp がインストール済み（`npm install -g @google/clasp`）
- Supabase ダッシュボードへのアクセス権

---

## 1. GAS プロジェクトに spots_api.gs を追加

### 方法A: GAS エディタから手動追加

1. https://script.google.com にアクセス
2. Registro500 のプロジェクトを開く
3. 左メニュー「ファイル」→「+」→「スクリプト」
4. ファイル名を `spots_api` に設定
5. `spots_api.gs` の内容をコピー＆ペースト
6. 保存（Ctrl+S）

### 方法B: clasp でデプロイ

```bash
# 1. プロジェクトのクローン（初回のみ）
clasp clone <SCRIPT_ID>

# 2. spots_api.gs をプロジェクトフォルダにコピー
cp spots_api.gs ./

# 3. アップロード
clasp push

# 4. 新バージョンをデプロイ
clasp deploy --description "v2: スポット機能追加"
```

### 方法C: main.gs の更新も含む場合

```bash
# main.gs と spots_api.gs を両方プッシュ
clasp push

# デプロイ（既存のデプロイを更新）
clasp deploy -i <DEPLOYMENT_ID> --description "v2: スポット機能追加"
```

---

## 2. Supabase セットアップ

### テーブル作成
Supabase ダッシュボード → SQL Editor で実行:

```bash
# 1. テーブル作成
database_schema.sql の内容を実行

# 2. RLS ポリシー設定
rls_policies.sql の内容を実行

# 3. テストデータ投入
test_data.sql の内容を実行
```

---

## 3. デプロイ後のテスト

### GAS Web App URL
デプロイ後に取得した URL を使用:
```
https://script.google.com/macros/s/<DEPLOY_ID>/exec
```

### テストコマンド

**スポット一覧取得:**
```bash
curl -s "https://script.google.com/macros/s/<DEPLOY_ID>/exec?mode=spots" | python -m json.tool
```

**カテゴリでフィルタ:**
```bash
curl -s "https://script.google.com/macros/s/<DEPLOY_ID>/exec?mode=spots&category=cafe" | python -m json.tool
```

**スポット詳細取得:**
```bash
curl -s "https://script.google.com/macros/s/<DEPLOY_ID>/exec?mode=spot_detail&spot_id=SPOT_001" | python -m json.tool
```

**マイお気に入り:**
```bash
curl -s "https://script.google.com/macros/s/<DEPLOY_ID>/exec?mode=my_favorites&owner_document_id=DOC_1" | python -m json.tool
```

**出没予定一覧:**
```bash
curl -s "https://script.google.com/macros/s/<DEPLOY_ID>/exec?mode=schedules" | python -m json.tool
```

**スポット新規登録:**
```bash
curl -s -X POST \
  "https://script.google.com/macros/s/<DEPLOY_ID>/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "createSpot",
    "data": {
      "name": "テスト駐車場",
      "category": "parking",
      "latitude": 35.6812,
      "longitude": 139.7671,
      "address": "東京都千代田区丸の内1-1"
    }
  }' | python -m json.tool
```

**お気に入り登録:**
```bash
curl -s -X POST \
  "https://script.google.com/macros/s/<DEPLOY_ID>/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "addFavoriteSpot",
    "data": {
      "owner_document_id": "DOC_1",
      "spot_id": "SPOT_001",
      "comment": "テスト登録",
      "frequency": "weekly"
    }
  }' | python -m json.tool
```

**近隣スポット検索:**
```bash
curl -s -X POST \
  "https://script.google.com/macros/s/<DEPLOY_ID>/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "findNearbySpots",
    "data": {
      "latitude": 35.648,
      "longitude": 139.700,
      "radius": 1000
    }
  }' | python -m json.tool
```

---

## 4. チェックリスト

- [ ] GAS に spots_api.gs を追加
- [ ] main.gs の doGet/doPost 更新を反映
- [ ] 新バージョンをデプロイ
- [ ] Supabase に database_schema.sql を実行
- [ ] Supabase に rls_policies.sql を実行
- [ ] Supabase に test_data.sql を実行
- [ ] curl で各エンドポイントの動作確認
- [ ] config.js の API_URL が最新デプロイIDを指しているか確認
