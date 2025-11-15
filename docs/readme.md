# Registro500 Giappone（プロジェクト概要・リンク実装メモ・作業ルール）

## 🎯 プロジェクト目的

クラシック Fiat 500（特に 110D / 110F / 126 系）オーナーのための  
**情報登録・公開プラットフォーム**を構築する。

- 全国の個体情報を一元管理し、オーナーやオーナー候補が知識を共有できる場を目指す。
- 登録内容：年式・モデル・ハンドルネーム・都道府県・写真・改造情報など（約 60 項目想定）。
- 一般閲覧者は「一覧」「詳細」ページを閲覧可。
- **登録・編集はログインしたオーナー本人のみ**行えるようにする。
- 重要：**Firebase＋Google Sheets＋Google Sites＋Google Apps Script（GAS）だけで「完全無料」運用**する。

---

## 🏗 現在の構成（2025-11-15 時点）

### データ・ストレージ周り

- **Firestore**
  - コレクション：`cars`
  - 各車両ドキュメントのメタデータを保存予定（createdAt / updatedAt なども含む）

- **Firebase Storage**
  - パス例：`cars/row_00x/PhotoMain.jpg`
  - メイン写真＋サブ写真（Front / Side / Rear / Engine / Interior / SteeringCluster）
  - public 読み出し用の URL は `.appspot.com` → `.firebasestorage.app` へ変換して使用

- **Google Sheets**
  - シート：`cars`（マスターシート）
  - Firestore から同期されたデータを保持
  - 表示用フィールド：
    - `Model_DisplayA / B / C`
    - `Engine_Display`
  - 画像 URL 列：
    - `PhotoMain / PhotoFront / PhotoSide / PhotoRear / PhotoEngine / PhotoInterior / PhotoSteeringCluster`

### Apps Script（GAS）

- `main.gs`
  - 一覧・詳細ページ生成（`renderIndex() / renderDetail()`）
  - 表示用フィールド生成：
    - `buildModelDisplays(record)`
    - `buildEngineDisplay(record)`
  - 画像 URL 変換：
    - `fixSinglePhotoUrl(url)`（`.appspot.com` → `.firebasestorage.app`）
  - フォーム保存ロジック：
    - `saveCarFromForm(formData)`（DocumentID 採番 / OwnerEmail / createdAt / updatedAt 設定）
  - Web アプリ入口：
    - `doGet(e)`：`mode=policy / howto` を振り分け + 通常画面は `doGetMain_` に委譲
    - `doGetMain_(e)`：一覧・詳細・編集（`mode` / `doc`）を処理

- HTML テンプレート（`gas/` 配下）
  - `index.html`：一覧画面（カード型ギャラリー、スマホ 2 列／PC 3 列想定）
  - `detail.html`：詳細画面（左：写真＋ギャラリー／右：スペック＋SNS）
  - `edit.html`：今後実装予定の編集フォーム
  - `policy.html`：プライバシーポリシー・利用規約ページ
  - `howto.html`：はじめての方へ（使い方・写真アップロードの注意など）

### 公開

- **Google Sites**
  - Web アプリ（`/exec`）を埋め込みして公開
  - GAS 側では `setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` を設定して埋め込み許可
- **GitHub**
  - リポジトリ：`registro500-giappone`
  - `gas/`：Apps Script 関連ファイル
  - `docs/`：要件定義・引き継ぎメモなど

---

## 🌐 Web アプリの画面と URL モード

GAS Web アプリの基本 URL（実際はデプロイごとに変わる）：

- `scriptUrl = ScriptApp.getService().getUrl();`
- 以降は **この `scriptUrl` を基準にリンクを組み立てる**。

### モード別の役割

- `scriptUrl`（クエリなし）
  - 一覧画面（index）  
  - `doGetMain_()` → `renderIndex()`

- `scriptUrl?mode=detail&doc=DOC_xxx`
  - 車両詳細画面（detail）
  - `doc` パラメータで `DocumentID` 指定

- `scriptUrl?mode=edit`
  - 編集画面（今後実装予定）

- `scriptUrl?mode=howto`
  - 「はじめての方へ」ページ（`howto.html`）

- `scriptUrl?mode=policy`
  - 「プライバシーポリシー・利用規約」ページ（`policy.html`）

---

## 🔗 リンク実装ルール（重要・再発防止メモ）

今後「戻る／リンク」まわりでハマらないためのルール。

### 1. 一覧への戻りは **必ず `scriptUrl`**

- 一覧に戻るリンクは、どの画面からでも **クエリなしの `scriptUrl` に戻す**。
- 例：

```html
<a href="<?= scriptUrl ?>">← 一覧に戻る</a>
````

* `exec?...` のフル URL を **テンプレートにベタ書きしない**。

  * 理由：デプロイ URL が変わるたびに全部書き換えになるため。

### 2. howto / policy からの戻りも `scriptUrl` にする

* `?mode=howto` / `?mode=policy` から一覧へ戻るリンクも、**クエリなしの `scriptUrl`** を使う。

```html
<!-- howto.html / policy.html 共通イメージ -->
<div class="rg-back">
  <a href="<?= scriptUrl ?>">← 一覧に戻る</a>
</div>
```

* 戻り先に `?mode=xxx` を付け直さないこと。
  → 無限ループや「真っ白画面」の原因になりうる。

### 3. テンプレートで `scriptUrl` を使うときは、GAS 側で必ず渡す

* `policy.html` / `howto.html` / `detail.html` / `index.html` などで `<?= scriptUrl ?>` を使う場合、
  **GAS 側で `template.scriptUrl = ScriptApp.getService().getUrl();` を忘れずにセットする。**

```javascript
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var mode = params.mode || '';
  var scriptUrl = ScriptApp.getService().getUrl();  // 一覧（exec）のURL

  // ?mode=policy → policy.html
  if (mode === 'policy') {
    var tPolicy = HtmlService.createTemplateFromFile('policy');
    tPolicy.scriptUrl = scriptUrl;  // ★ ここが重要
    return tPolicy
      .evaluate()
      .setTitle('Registro500 Giappone')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // ?mode=howto → howto.html
  if (mode === 'howto') {
    var tHowto = HtmlService.createTemplateFromFile('howto');
    tHowto.scriptUrl = scriptUrl;  // ★ ここも同じ
    return tHowto
      .evaluate()
      .setTitle('Registro500 Giappone')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // それ以外（index/detail/edit）は元の処理へ
  return doGetMain_(e);
}
```

### 4. detail.html から一覧に戻るリンク

* detail ページの上下に「一覧に戻る」を設置するときも **scriptUrl を利用**。

```html
<!-- 上部 -->
<div class="rg-back mb-2">
  <a href="<?= scriptUrl ?>">← 車両一覧に戻る</a>
  <!-- 編集ボタンは別途 -->
</div>

<!-- 下部 -->
<div class="rg-footer-back mt-3 rg-back">
  <a href="<?= scriptUrl ?>">← 車両一覧に戻る</a>
</div>
```

### 5. 外部サイト／メールリンクのルール

* 外部サイトは基本 `target="_blank" rel="noopener"` を付ける。

```html
<a href="https://w.atwiki.jp/fiat500-onlinemanual/" target="_blank" rel="noopener">
  https://w.atwiki.jp/fiat500-onlinemanual/
</a>
```

* メールは `mailto:` を使用。

```html
<a href="mailto:registro500giappone@gmail.com">registro500giappone@gmail.com</a>
```

---

## 💾 GitHub 管理方針（運用ルール）

* ディレクトリ構成（例）：

  * `gas/`

    * `main.gs`
    * `index.html`
    * `detail.html`
    * `edit.html`
    * `policy.html`
    * `howto.html`
    * （Firestore⇄Sheets 同期用スクリプトがあれば `sync_firestore.gs` など）
  * `docs/`

    * `README.md`（このドキュメント）
    * その他メモや要件定義

* 修正版コードは：

  1. GAS 側で動作確認
  2. 問題なければ GitHub に手動で反映（コピペで OK）

* 秘密情報の扱い：

  * サービスアカウント JSON、API キー、トークンなどは **絶対にリポジトリに含めない**。
  * それらが必要なコードには「ここにキーを貼る」コメントだけ残す。

---

## 🤝 このチャットでの進め方ルール（AI との協業メモ）

1. **作業は一歩一歩、質疑応答を重ねながら。**
   いきなりゴールまで走らず、「次の 1 ステップ」を確認してから進める。

2. **勝手にコードを書いて先に進めない。**
   私が「ここまで OK」「次へ」と言うまで、大きなコード変更案は出さない。

3. **不具合時に“類推だけで”決めない。**
   エラー文・ログ・スクショなど事実を確認してから判断する。

4. **コード修正はなるべく「全体」か「関数単位」で。**
   1 行だけの修正指示は最小限にし、できるだけ
   `「この関数まるごと差し替え」` の形で提案する。

5. **小手先対応ではなく、プロジェクト全体の目的を意識する。**
   一時しのぎではなく、長期的に破綻しない構成になっているか一緒に考える。

6. **回答は必ず、チャット履歴と最新コードを踏まえて。**
   過去の指示との矛盾がないかをチェックしたうえで回答する。

7. **スクショをアップしたら、必ず隅々まで確認する。**
   ファイルパス、モード（`?mode=xxx`）、エラー文の細部などをよく読む。

---

## 📌 このチャットでやりたいこと（随時更新）

* スマホ／PC 両対応の UI 調整（一覧・詳細）
* 画像表示まわりの安定化（Storage URL・サイズ・Google Sites との相性）
* Firestore ⇄ Sheets 同期フローの整理
* ログイン／編集導線（`edit.html`）の実装
* テキスト（はじめての方へ／ポリシー等）のメンテナンス


