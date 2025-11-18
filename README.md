# Registro500 Giappone  
（プロジェクト概要・アーキテクチャ・作業ルール）

## 🎯 プロジェクト目的

クラシック Fiat 500（特に 110D / 110F / 126 系）オーナーのための  
**情報登録・公開プラットフォーム**を構築する。

- 全国の個体情報を一元管理し、オーナーやオーナー候補が知識を共有できる場を目指す。
- 登録内容：年式・モデル・ハンドルネーム・都道府県・写真・改造情報など（約 60 項目想定）。
- 一般閲覧者は「一覧」「詳細」ページを閲覧可。
- **登録・編集はログインしたオーナー本人のみ**行えるようにする。
- 重要：**Firebase＋Google Sheets＋Google Sites＋Google Apps Script（GAS）だけで「完全無料」運用**する。

---

## 🏗 全体構成（2025-11-18 時点）

### 1. データストア

#### 🔥 Firestore

- コレクション：`cars`
- 各車両レコード（row_001, row_002,…）を 1 ドキュメントとして保存。
- 主なフィールド：
  - DocumentID, OwnerEmail, HandleName, Prefecture, Year, Model*, Engine*, 画像パス など
  - createdAt, updatedAt などのメタ情報
- **基本構想：Firestore を「即時同期されるマスター」側とし、Sheets と常に整合させる。**

#### 💾 Firebase Storage

- 役割：**画像ファイル専用ストレージ**
- パス例：
  - `cars/row_002/PhotoMain.jpg`
  - `assets/logo_horizontal.png`, `assets/logo_vertical.png`, `assets/no_image_500.png`
- Web からは `https://firebasestorage.googleapis.com/...` の URL でアクセス。
- `.appspot.com` → `.firebasestorage.app` への変換は GAS 側ユーティリティで吸収。

#### 📊 Google Sheets

- シート：`cars`（マスターシート）
- Firestore の `cars` コレクションと **即時〜準即時同期するミラー** という位置づけ。
  - 現状：UI（index / detail / edit）は **このシートを直接参照**している。
- 表示用フィールド：
  - `Model_DisplayA / B / C`
  - `Engine_Display`
- 画像 URL 列：
  - `PhotoMain / PhotoFront / PhotoSide / PhotoRear / PhotoEngine / PhotoInterior / PhotoSteeringCluster`
- その他：
  - DocumentID, OwnerEmail, createdAt, updatedAt など、Apps Script 側で自動セットする項目を含む。

> ※ 現時点の実運用上は「Sheets が UI の事実上のマスター」「Firestore は同期先」状態。  
>  最終的な理想は **Firestore ⇄ Sheets の即時同期**（どちらで書き込んでももう一方に反映）だが、  
>  実装状況に応じて「どちらを正とするか」はその時点で決める。

### 2. Apps Script（GAS）

#### main.gs

- Web アプリ入口：
  - `doGet(e)`  
    - `mode=policy` → `policy.html`
    - `mode=howto` → `howto.html`
    - それ以外 → `doGetMain_(e)`
  - `doGetMain_(e)`  
    - `mode` / `doc` に応じて以下を呼び分け
      - `renderIndex()`    … 一覧
      - `renderDetail()`   … 詳細
      - `renderEdit(docId)`… 編集フォーム（新規 / 既存）

- 表示用フィールド生成：
  - `resolveSelectAndText(select, text)`  
    → select と text から表示値を決定（「その他」処理含む）
  - `buildModelDisplays(record)`  
    → Model_DisplayA / B / C を作る（C は「モデル名のみ」、年式は含めない）
  - `buildEngineDisplay(record)`  
    → Engine_Display を作る

- 画像 URL 変換：
  - `fixSinglePhotoUrl(url)`  
    → `.appspot.com` 形式を `.firebasestorage.app` 形式に変換
  - `fixPhotoUrls(carData)`  
    → `PHOTO_COLUMNS` 全てに `fixSinglePhotoUrl` を適用

- 一覧生成：
  - `renderIndex()`  
    → Sheets `cars` シートを読み込み、`INDEX_VIEW_COLUMNS` だけを抜き出して  
      `index.html` に `allCars` として渡す。

- 詳細生成：
  - `renderDetail(docId)`  
    → キャッシュ（`CacheService`）から 1 台分を取得し、  
      必要なら `warmUpCache()` で全件キャッシュを構築。  
      `isOwner` 判定（OwnerEmail vs Session.getActiveUser() ※将来見直し候補）を行い  
      `detail.html` に `carData` / `isOwner` / `scriptUrl` / `ownerAppUrl` を渡す。

- 編集用ヘルパー：
  - `getCarForEdit(documentId)`  
    → Sheets から DocumentID 一致行を探し、1 行分のオブジェクトにして返す。
  - `renderEdit(docId)`  
    → `edit.html` テンプレートに `initialDocId` と `initialCarData` を渡す。

- フォーム保存：
  - `saveCarFromForm(formData)`  
    → 新規登録。DocumentID 自動採番 / OwnerEmail = AuthEmail / createdAt, updatedAt をセットして追加。
  - `updateCarFromForm(formData)`  
    → 既存編集。OwnerEmail 一致 or ADMIN_EMAIL のときだけ更新。updatedAt 更新。

- Firestore ⇄ Sheets 同期（別ファイル `sync_firestore.gs` を想定）
  - 方針：  
    - トリガー or Webhook で Firestore 更新を検知し、Sheets に反映。  
    - 逆方向（Sheets → Firestore）も、編集 or バッチで同期させる構想。

#### HTML テンプレート

- `index.html`
  - 一覧カード型 UI（スマホ：2列 / PC：auto-fill）
  - 並び替えセレクト：`新規登録順（新しい順）/ 新規登録順（古い順）/ 年式が新しい順 / 年式が古い順`
  - 「めざせ 500 台！ 現在 n 台」カウンター
  - ログイン / 新規登録ボタン（今後の仕様で挙動を整理）
  - 「プライバシーポリシー / 利用規約」「はじめての方へ」へのリンク

- `detail.html`
  - 左：メイン写真＋ギャラリー
  - 右：車両スペック、エンジン関係、SNSリンクなど
  - 上下に「← 車両一覧に戻る」
  - ログイン & isOwner (= true) のときだけ「編集ボタン」を表示

- `edit.html`
  - ログイン状態表示
  - 新規 / 既存共通の入力フォーム（Fiat 500 の 60 項目）
  - Firebase Auth で Google ログイン → `AuthEmail` hidden フィールドに格納 → GAS に送信
  - 保存後は `mode=detail&doc=DOC_xxx` に遷移させる方針

- `policy.html`
  - プライバシーポリシー・利用規約（Glide 時代の文面をベースに調整）
  - 戻りリンク：`<?= scriptUrl ?>`（一覧に戻る）

- `howto.html`
  - はじめての方向け説明（登録の流れ・写真アップロードの注意など）
  - 戻りリンク：`<?= scriptUrl ?>`（一覧に戻る）

---

## 🌐 Web アプリ URL・リンク設計ルール

`scriptUrl = ScriptApp.getService().getUrl();` を前提に、以下のように統一する。

### 1. モード別 URL

- 一覧（index）  
  `scriptUrl`

- 詳細（detail）  
  `scriptUrl?mode=detail&doc=DOC_xxx`

- 編集（edit）  
  `scriptUrl?mode=edit`  
  ※ doc パラメータは edit 側 JS かサーバ側で扱う

- はじめての方へ（howto）  
  `scriptUrl?mode=howto`

- プライバシーポリシー / 利用規約（policy）  
  `scriptUrl?mode=policy`

### 2. 戻りリンクは「クエリなしの scriptUrl」に統一

- `index.html` / `detail.html` / `policy.html` / `howto.html` から一覧へ戻るリンクはすべて：

```html
<a href="<?= scriptUrl ?>">← 車両一覧に戻る</a>
