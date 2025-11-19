# Registro500 Giappone

**プロジェクト概要・アーキテクチャ・スマホUIレギュレーション・作業ルール**
**v2025-11-19**

---

## 1. プロジェクト目的

クラシック Fiat 500（特に 110D / 110F / 126 系）オーナー向けに、
**完全無料で運用可能な車両登録・閲覧サイト**を構築する。

* 全国の個体情報を一元管理
* 登録項目は約 60 項目（モデル・年式・色・エンジン仕様・写真など）
* 一般ユーザー：一覧・詳細を閲覧可能
* オーナー：ログインして自身の車両のみ編集可能
* 使用サービスは **Firebase（Firestore/Storage）＋Google Sheets＋GAS＋Google Sites** のみ（完全無料）

---

## 2. システムアーキテクチャ

2025-11-19 時点の最新構成

---

### 2.1 Firestore（cars コレクション）

* 1 ドキュメント = 1 台の車両データ
* 主なフィールド

  * DocumentID
  * OwnerEmail（ログインアカウント）
  * HandleName
  * Prefecture
  * ModelSelect*, ModelText*, Model_DisplayA/B/C
  * Engine*, Engine_Display
  * PhotoMain〜PhotoSteeringCluster
  * createdAt / updatedAt
* 位置づけ

  * 将来的にはマスター
  * 現状は **Sheets の同期先**

---

### 2.2 Firebase Storage（画像ストレージ）

* パス例

  * `cars/row_003/PhotoMain.jpg`
  * `assets/logo_horizontal.png`
* GAS 側で `.appspot.com` → `.firebasestorage.app` に自動変換
* UI は Storage の公開 URL を参照

---

### 2.3 Google Sheets（cars シート）

* **現状 UI の実質的マスター**（index / detail / edit の表示元）
* Firestore と同期前提のデータミラー
* GAS 側で加工済フィールドを生成

  * Model_DisplayA/B/C
  * Engine_Display
* メタ項目

  * DocumentID
  * OwnerEmail
  * createdAt / updatedAt

---

## 3. Apps Script（GAS）

---

### 3.1 doGet(e) によるルーティング

* `mode=policy` → policy.html
* `mode=howto` → howto.html
* `mode=owner` → owner.html
* `mode=detail&doc=xxx` → renderDetail()
* `mode=edit&doc=xxx` → renderEdit()
* 未指定 → renderIndex()

---

### 3.2 主な処理内容

#### 一覧

* `renderIndex()`

  * cars シートを読み込み
  * 必要列だけ抽出
  * index.html に渡す

#### 詳細

* `renderDetail(documentId)`

  * CacheService 利用
  * isOwner 判定
  * detail.html に carData / isOwner / scriptUrl / ownerAppUrl を渡す

#### 編集

* `renderEdit(documentId)`
* `getCarForEdit(documentId)`

#### 保存

* `saveCarFromForm()`（新規）
* `updateCarFromForm()`（既存）

  * OwnerEmail の一致チェック
  * updatedAt 更新

#### 表示用加工

* resolveSelectAndText()
* buildModelDisplays()
* buildEngineDisplay()
* fixSinglePhotoUrl()

---

### 3.3 Firestore ⇄ Sheets 同期

* 別ファイル `sync_firestore.gs`（構想）
* 方向

  * Firestore → Sheets：Webhook またはトリガー
  * Sheets → Firestore：編集時に反映
* **現状：未完成（UI は Sheets のみ参照）**

---

## 4. HTML テンプレート仕様

---

### 4.1 index.html（一覧）

* スマホ：2列カード
* PC：auto-fill
* object-fit: contain
* ソート機能
* 「めざせ500台！」カウンター
* 利用規約 / プライバシーポリシー
* 「はじめての方へ」リンク
* ログインボタン・新規登録ボタン（今後整理）

---

### 4.2 detail.html（詳細）

* メイン写真＋ギャラリー
* スペック / エンジン / SNS
* 空欄フィールド自動非表示
* SNSは URL 形式を判定して自動リンク
* 上下に「← 車両一覧に戻る」
* isOwner のとき編集ボタン表示

---

### 4.3 edit.html（新規 / 編集）

* Firebase Auth で Google ログイン
* AuthEmail を hidden に格納
* 保存後は detail ページへ遷移
* 60項目入力フォーム

---

### 4.4 policy.html / howto.html

* 戻るリンク：`<?= scriptUrl ?>`
* policy：運営者名なし / Google アカウントのみ / 東京地裁管轄 / Cookie は現時点で未使用
* howto：登録方法・写真の推奨サイズなど

---

### 4.5 owner.html（ログイン前オーナーページ / 最新版）

* **2025-11-19 修正版でスマホ表示を完全最適化済**
* フォント

  * スマホ 28px
  * PC 18px
* スマホ幅は 100%（max-width 禁止）
* 左右 12px 余白
* 自然な位置での改行を追加（sp-only 利用）

正しい改行：

```
オーナーとして車両を登録・編集するには、Google アカウントでの
ログインが必要です。
```

---

## 5. URL 設計ルール

```
scriptUrl = ScriptApp.getService().getUrl();
```

### モード別 URL

* 一覧：`scriptUrl`
* 詳細：`scriptUrl?mode=detail&doc=DOC_xxx`
* 編集：`scriptUrl?mode=edit&doc=DOC_xxx`
* はじめての方へ：`scriptUrl?mode=howto`
* ポリシー：`scriptUrl?mode=policy`
* オーナーページ：`scriptUrl?mode=owner`

### 戻るリンクの原則

必ず「クエリなしの scriptUrl」

```
<a href="<?= scriptUrl ?>">← 車両一覧に戻る</a>
```

---

## 6. スマホ UI レギュレーション

**2025-11-19 時点の最新・確定版**

---

### 6.1 横幅（絶対条件）

* `body { padding: 0 12px; }`
* スマホは常に **width: 100%**
* **スマホでは max-width を禁止**
* max-width を使ってよいのは PC (`@media (min-width:1024px)`) のみ
* 親コンテナに勝手に width / max-width を付けない
* Google Sites の iframe 幅をそのまま使う

---

### 6.2 フォント

```
@media (max-width:1023px){
  html{ font-size:28px; }
}
@media (min-width:1024px){
  html{ font-size:18px; }
}
```

* 子要素は rem 指定を基本とする

---

### 6.3 スマホ専用改行（sp-only）

```
<br class="sp-only">
```

```
@media (min-width:1024px){
  .sp-only{ display:none; }
}
```

---

## 7. 作業ルール（開発フローの明文化）

1. 一気にコードを書かない
2. 常に「確認 → 設計 → コード」
3. 類推で進めない
4. スクショを精読して変更点を正確に把握
5. 小手先の修正ではなく「固まり単位」または「全文差し替え」
6. スマホ表示は index.html と owner.html を基準に統一
7. max-width を勝手に入れない（再発防止）

---

## 8. 現在の進捗（2025-11-19）

### 完了

* owner.html：スマホ UI 完成
* 改行位置の調整
* フォント修正
* 横幅レギュレーション確立
* デザイン FIX（スマホ・PC）

### 残作業

* edit.html のスマホ最適化
* detail / index の微調整
* policy / howto の文面調整
* owner（ログイン後）の追加
* Firestore ⇄ Sheets 同期の仕上げ

---

## 必要であれば作成可能な追加資料

* UI 仕様書（index / detail / edit / owner）
* アーキテクチャ図（PNG / SVG）
* GAS コーディング規約
* ディレクトリ構成案
* GitHub README 用テンプレート

