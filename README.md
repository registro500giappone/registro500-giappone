# 引継ぎメモ｜Registro500 Giappone（GAS × Google Sites）

**2025-11-20 版**

---

## 🎯 プロジェクト目的（再確認）

* クラシック FIAT 500（特に 110D / 110F / 126 系）オーナー向けの
  **登録・閲覧サイト**を、Google の無料サービスだけで構築する。
* 一般ユーザー：

  * 車両一覧（index）／詳細（detail）を自由に閲覧できる。
* オーナー本人：

  * Google ログインのうえで **新規登録・編集ができるのは本人のみ**。
* 技術スタック：

  * **Google Sheets + Apps Script（GAS） + Firebase（Auth / Storage） + Google Sites**
  * できる限り「完全無料」で長期運用を目指す。

---

## 🏗 現在の技術構成

### データ

* Google Sheets

  * シート名：`cars`（マスター）
  * 主キー：`DocumentID`（DOC_1, DOC_2 …）
  * 補助表示カラム：`Model_DisplayA/B/C`, `Engine_Display`
  * オーナー判定用：`OwnerEmail`
  * 写真 URL：`PhotoMain` ほか 7 カラム（Firebase Storage の URL）

* Firebase

  * Storage：`cars/row_xxx/PhotoMain.jpg` 等
  * Auth：Google ログイン用（Firebase Auth）

### Apps Script プロジェクト

* `main.gs`

  * `WEB_APP_URL`：公開用 WebApp の exec URL（固定）
  * `OWNER_WEB_APP_URL`：オーナー用 WebApp URL（現在は `WEB_APP_URL` と同じ）
  * `doGet(e)`：`mode` によるルーティング

    * `policy` → `policy.html`
    * `howto` → `howto.html`
    * `owner` → `renderOwnerPage_()`（オーナートップ）
    * それ以外 → `doGetMain_(e)`
  * `doGetMain_(e)`：

    * `mode=index` or 未指定 → `renderIndex()`
    * `mode=detail&doc=DOC_xxx` → `renderDetail(doc)`
    * `mode=edit&doc=DOC_xxx` → `renderEdit(doc)`（オーナー用編集フォーム）
  * `renderIndex()`：`cars` シートから一覧用データを作成
  * `renderDetail(docId)`：

    * Cache から車両データ取得 → 表示用フィールド組み立て
    * `Session.getActiveUser().getEmail()` と `OwnerEmail` を比較し `isOwner` 判定
    * `detail.html` に `carData / isOwner / scriptUrl / ownerAppUrl` を渡す
  * `renderEdit(docId)`：

    * `getCarForEdit(docId)` で 1 行取得（`cars` シートのみ）
    * `initialDocId`, `initialCarData`, `scriptUrl` を `edit.html` に渡す
  * `saveCarFromForm(formData)`：

    * 新規登録用。`AuthEmail` を `OwnerEmail` に保存し、`DocumentID` を採番
  * `updateCarFromForm(formData)`：

    * 既存編集用。
    * `AuthEmail` と `OwnerEmail` / `ADMIN_EMAIL` を比較して本人 or 管理者のみ更新
  * `renderOwnerPage_()`：

    * `owner.html` テンプレートに `isLoggedIn` だけを渡す（メールアドレス文字列は渡さない）

### HTML テンプレート

* `index.html`：一覧（PC 3列 / スマホ 2列, 大きめフォント）
* `detail.html`：詳細画面

  * ギャラリー写真：メイン＋サムネ（PC/スマホ対応済）
  * ラベルは `dt` を `white-space: nowrap;` 指定で折り返し防止
  * 右上ボタン：

    * 未ログイン or 他人：
      「この車両のオーナーの方はログインして編集」→ `owner_edit_gate?doc=DOC_xxx`
    * オーナー本人：
      「この車両の情報を編集」→ 直接 `?mode=edit&doc=DOC_xxx`
* `policy.html`：利用規約＋プライバシーポリシー
* `howto.html`：使い方
* `owner.html`：オーナートップ（ログイン状態に応じた案内／ボタン）
* `owner_edit_gate.html`：**オーナーログイン（この車両の編集）** 説明ページ
* `edit.html`：新規／編集フォーム（Firebase Auth 付き）

---

## 🔁 画面遷移とログイン／編集の考え方

### 公開側（誰でも閲覧）

1. `scriptUrl?mode=index`

   * 一覧表示（カード型）
2. 任意の車両をクリック

   * `scriptUrl?mode=detail&doc=DOC_xxx` で詳細表示
3. 詳細右上のボタン

   * **オーナー本人のとき**

     * 「この車両の情報を編集」
     * → `scriptUrl?mode=edit&doc=DOC_xxx`
   * **それ以外（未ログイン or 他人）**

     * 「この車両のオーナーの方はログインして編集」
     * → `OWNER_WEB_APP_URL?mode=editGate&doc=DOC_xxx`
       （`owner_edit_gate.html` を表示）

### オーナー用フロー

#### A. すでにログイン済みのオーナーが自分の車両を編集

1. 一般ユーザーと同じく一覧 → 詳細を開く。
2. `detail.html` 内で

   * `Session.getActiveUser().getEmail()` と `OwnerEmail` が一致 → `isOwner = true`
3. 右上ボタンが **直接 edit** になる：

   * `scriptUrl?mode=edit&doc=DOC_xxx`
4. `edit.html`

   * Firebase Auth でもログイン確認
   * `INITIAL_CAR_DATA` からフォーム初期値を自動セット
   * 送信すると `updateCarFromForm()` が呼ばれ、保存後 `detail?doc=` に戻る。

#### B. 詳細画面からオーナーでログインして編集（editGate 経由）

1. 詳細右上ボタン → `mode=editGate&doc=DOC_xxx`
2. `owner_edit_gate.html`

   * 「オーナーログイン（この車両の編集）」の説明
   * 「Googleでログインして編集に進む」ボタン（今はダミー実装）
3. 将来の理想仕様

   * このボタンで Google ログイン（Firebase Auth or Apps Script）を実行
   * ログイン後、自動で `mode=edit&doc=DOC_xxx` に遷移してフォーム表示
   * 現時点では、直接 `edit?doc=` を開けば動作するところまで完了。

#### C. 新規登録

* 将来的には

  * owner.html（オーナートップ）から「新しい車両を登録」
  * `scriptUrl?mode=edit`（DocumentID なし）で `edit.html` を新規モードとして使用
  * `saveCarFromForm()` を呼び出して `DOC_xxx` を採番
* ここは **まだ実装途中**。現状は既存車両の編集が優先。

---

## ✅ 今日やったこと（2025-11-20）

### 1. detail.html レイアウト調整

* ギャラリー写真

  * PC／スマホ共通でサムネイルを **縦横 1/2 に縮小**。
    メイン写真は現状サイズを維持。
* スマホの見出し

  * メイン写真下の **年式・車両名・ハンドルネーム** のフォントを一回り拡大。
* ラベル折り返し対策

  * `dt` に `white-space: nowrap;` を追加し、
    「トランスミッション」などのラベルが途中で改行されないようにした。
* 「駆動系・足回り」だけ幅が広くなる問題を避けるため、
  他のセクションと同じ幅になるようにレイアウトを揃えた。

### 2. owner_edit_gate.html（オーナーログイン案内ページ）の確定

* デザインを統一しつつ、スマホでも読みやすいように調整。
* 内容：

  * このページが **「この車両を編集する前のログイン案内ページ」** であることを明示。
  * OwnerEmail と Google アカウントのメールアドレスが一致した場合のみ編集可能であると説明。
  * 利用規約・プライバシーポリシーへのリンクを掲載。
  * 「車両の詳細ページに戻る」ボタン配置。
* 「Googleでログインして編集に進む」ボタンは **まだダミー処理**
  （`console.log` のみ。将来ここにログイン処理をつなぐ想定）。

### 3. main.gs のログイン／編集関連を整理

* `WEB_APP_URL` / `OWNER_WEB_APP_URL` を定数化。
* `doGet(e)` で `mode=policy/howto/owner` を振り分け、それ以外は `doGetMain_` に統一。
* `renderDetail(docId)`：

  * `Session.getActiveUser().getEmail()` と `OwnerEmail` の小文字比較で `isOwner` 判定。
  * `detail.html` に `isOwner`, `scriptUrl`, `ownerAppUrl` を渡す。
* `getCarForEdit(documentId)`：

  * `cars` シートから `DocumentID` 一致レコードを取得する専用関数に整理。
* `renderEdit(docId)`：

  * `initialDocId`, `initialCarData`, `scriptUrl` をテンプレートに渡す。
  * 事前に `getCarForEdit()` で 1レコードを取得して `edit.html` 初期化に使う。
* `renderOwnerPage_()`：

  * `owner.html` 用に `isLoggedIn` を渡す（メールアドレス文字列は非公開）。

### 4. edit.html の「完全差し替え」

* 目的：

  * PC／スマホ共通で安定して動く編集フォーム。
  * Firebase Auth での Google ログイン必須。
  * サーバ側 `saveCarFromForm / updateCarFromForm` との連携。
* 主な内容：

  * ページ上部に「ログインカード」を配置（状態表示＋ログイン／ログアウトボタン）。
  * `AuthEmail` hidden フィールドに **Firebase Auth のログインメール** をセット。
  * `INITIAL_CAR_DATA` からフォームへの自動反映 (`fillFormFromRecord`)。
  * `ModelSelectA/B`, `EngineTypeSelect` の「その他」選択時に追加入力欄表示。
  * `handleSubmit()`：

    * `FormData` → plain object に変換。
    * `AuthEmail` がない場合は送信せずアラート。
    * `currentDocId` の有無で `updateCarFromForm` / `saveCarFromForm` を切り替え。
    * `google.script.run.withSuccessHandler/withFailureHandler` で結果受信。
    * 正常時：`detail?doc=...` に同タブで遷移。
    * エラー時：メッセージ表示＋場合によって `index` or `detail` に戻す。
* PC でのテスト：

  * 既存車両（DOC_1 等）の編集 → 保存 → Google Sheets 反映を確認。

---

## ⚠ 現在の問題点・次回の宿題

1. **スマホ（iPhone Safari）で編集後「白紙のまま止まる」**

   * 事象：

     * 編集フォームで送信すると、データ自体は Google Sheets に保存されるが、
       スマホ画面が白いまま遷移しない（alert 等も見えない）。
   * 推測：

     * `google.script.run` のコールバック動作とスマホ版 Apps Script UI の相性？
     * iframe 内でのリダイレクト処理がブロックされている可能性。
   * 次回やりたいこと：

     * スマホ実機で alert が出ているかどうか確認用の簡易テスト。
     * `window.location.href` ではなく `top.location.href` など、遷移方法を切り替えて検証。
     * それでもダメなら、スマホ用だけ「保存完了メッセージ＋手動でリンクタップ」に変更も検討。

2. **「Google ドライブ ファイルへのリクエストが集中」の警告**

   * Apps Script エディタや WebApp 実行中に
     「Google ドライブ ファイルへのリクエストが集中しています。混雑が解消されるまでお待ちください。」
     というメッセージが頻発。
   * 懸念：

     * シートの `getDataRange()` の呼び出しが多い？
     * デプロイ直後のテストで連続アクセスしている影響？
   * 次回：

     * シートアクセス回数の洗い出し。
     * 可能なら `CacheService` の活用範囲を広げて負荷軽減を検討。

3. **owner_edit_gate.html のログインボタンはまだダミー**

   * 現状：

     * ボタン押下で `console.log` だけ。実際のログイン処理は未接続。
   * 将来：

     * Firebase Auth の `signInWithRedirect` or Apps Script でのログインフローを接続し、
       ログイン後に `mode=edit&doc=DOC_xxx` へ自動遷移させる。

4. **新規登録フロー（DocumentID なしの edit.html 利用）**

   * まだ設計途中。
   * owner.html から「新規登録」ボタン → `mode=edit`（doc なし）で開き、
     `saveCarFromForm()` を使う形で確定させる予定。

---

## 🔧 作業ルール（AI へのお願い・再掲）

次チャットでも守ってほしいルール：

1. **作業は一歩一歩**

   * いきなり大量のコードを書かず、「方針 → 小さな変更 → テスト」の順で進める。
2. **事実確認を優先**

   * 不具合時に「こうだろう」と類推で決めない。
     画面のスクショや実際のコードを必ず確認してから判断。
3. **コード修正は原則「まとまり単位」**

   * 1行だけの修正指示はミスが増えるため、
     可能な限り **ファイル全体差し替え** かセクション単位で提示してほしい。
4. **小手先での応急処置をしない**

   * 目の前のバグだけ直すのではなく、
     「このプロジェクトの目的・構造」と整合しているかを常に俯瞰して考える。
5. **チャット履歴とスクショをよく読む**

   * 既に説明した経緯や設計がある場合、そこを踏まえて回答する。
   * スクショをアップしたときは、内容を隅々まで確認した上で回答する。
6. **スマホ表示を特に重視**

   * フォントサイズ・レイアウトなど、必ずスマホ（想定）を意識して提案する。

---

次のチャットでは、

* 「スマホで編集実行後に白画面で止まる問題」の再現条件整理
* 遷移方法の変更（`window.location` / `top.location` など）を小さく試す
* 必要ならテスト用の極小フォームを作って挙動確認

あたりから始める想定です。
