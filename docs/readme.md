# Registro500 Giappone  
クラシック Fiat 500 オーナー向け「完全無料」登録・公開プラットフォーム  
（Google Sheets × Apps Script × Firebase Storage × Firebase Auth）

---

## 🎯 プロジェクト概要

Registro500 Giappone は、  
クラシック FIAT 500（110D / 110F / 126 系）の **オーナー自身が登録／編集でき**、  
一般ユーザーは自由に閲覧できる **完全無料の Web プラットフォーム** です。

**技術スタック（完全無料・長期安定運用）**

- Google Sheets（マスターデータ）
- Apps Script WebApp（index / detail / edit / owner / policy / howto）
- Firebase Storage（画像保存）
- Firebase Auth（Googleログイン）
- Firebase Firestore Database（将来用のミラー・サブデータ）
- Google Sites（必要時のみ利用）

---

## 🏗 アーキテクチャ概要（最適解｜2025-11-21）

### 公開側（誰でも閲覧）

| 機能     | URL                              |
|----------|----------------------------------|
| 車両一覧 | `/exec`                          |
| 車両詳細 | `/exec?mode=detail&doc=DOC_xxx` |

- Google Sites に `/exec?...` を iframe 埋め込みして公開。
- `XFrameOptionsMode.ALLOWALL` で iframe 埋め込み許可済み。

### 編集側（オーナー本人のみ）

1. 一般ユーザーは `mode=detail` を自由に閲覧できる。
2. detail ページの「編集する」を押したとき：

   | 状態                       | 遷移先                                       |
   |----------------------------|----------------------------------------------|
   | オーナー本人（判定ロジックによる） | `/exec?mode=edit&doc=DOC_xxx`               |
   | 未ログイン／他人           | `/exec?mode=editGate&doc=DOC_xxx`           |

3. 実際の編集フォームは **edit.html（mode=edit）** が担当する。

- 現状：
  - detail の「編集ボタン表示／非表示」は Apps Script 側の判定（ActiveUser）も併用。
  - 実際のオーナー判定（OwnerEmail とログインメールの照合）は **edit.html 側で Firebase Auth を用いて行う**。
- 中長期：
  - 認証・オーナー判定ロジックは **Firebase Auth + OwnerEmail** に一本化し、
    ActiveUser 依存は段階的に縮小する方針。

### サイト公開（全体の流れ）

1. Web アプリ（/exec）を「自分として実行」「アクセスできるユーザー：全員」でデプロイ。
2. その URL を Google Sites に iframe として埋め込む。
3. 一般閲覧者はログイン不要で index/detail を閲覧。
4. 編集は editGate → edit.html → Firebase Auth → Sheets 書き込みの流れで実行。

---

## 🗂 データ構成（2025-11-21 時点の事実ベース）

### 1. Google Sheets：`cars`（**唯一のマスターデータ**）

主要カラム：

- `_id`：`row_002`〜`row_010` など  
  - Firestore や Softr 時代の内部ID。  
  - Firestore のドキュメントIDにも使用（`row_00X`）。
- `DocumentID`：`DOC_1`〜`DOC_12` など  
  - アプリ内での **主キー**。  
  - URL パラメータ `doc` として利用（例：`?doc=DOC_3`）。
- `OwnerEmail`：オーナーのメールアドレス  
  - Firebase Auth のログインメールと照合する前提の列。
- `HandleName`：ハンドルネーム
- `Model_DisplayA`, `Model_DisplayB`, `Model_DisplayC`：表示用に加工されたモデル名。
- `Year`, `BodyColor`, `Capacity` などスペック系
- 画像 URL 系：
  - `PhotoMain`, `PhotoFront`, `PhotoSide`, `PhotoRear`,  
    `PhotoEngine`, `PhotoInterior`, `PhotoSteeringCluster`
- `Prefecture`：表示用の都道府県
- `updatedAt`, `createdAt`：Firestore 由来の日付（今後活用予定）
- 過去ツール由来の列（一部）：
  - `🔐 Softr Record ID` など（将来整理候補）

運用上の区別：

- **1〜9行目（_id が row_002〜row_010）：本番データ**
- **10行目以降：開発中のダミーデータ（Firestore 未反映）**

### 2. Firebase Firestore Database

- コレクション：`cars`
- ドキュメントID：`row_002` など（Sheets の `_id` と連動）
- フィールドの中に `DocumentID` も保持。

> 方針：  
> - **Google Sheets `cars` シートを唯一のマスターとする。**  
> - Firestore `cars` コレクションは **ミラー／外部連携用のサブデータ** と位置づける。  
> - `sync_firestore.gs` は「Firestore → Sheets の片方向同期スクリプト（復旧用・特殊用途）」として保持し、  
>   日常運用では常用しない。

将来案：

- Sheets → Firestore の定期ミラー（GAS バッチ）を追加し、
  Firestore 側を読み取り用のサブデータとして更新していく。

### 3. Firebase Storage（画像）

- 主な保存パス例：
  - `cars/row_002/PhotoMain.jpg`
  - `cars/row_002/PhotoRear.jpg`
- Sheets の `PhotoMain` などの列には **Storage のダウンロードURL** が保存される。
- 表示側（index / detail）は、あくまで **URL ベースで画像表示**。

> 将来のアイデア（現時点では“案”）：  
> - `cars/DOC_001/PhotoMain/...` のように DocumentID ベースの階層に統一すると、  
>   データ移行や Firestore 連携がわかりやすくなる。  
> - 現在は `row_00X` ベースで問題なく動いているため、  
>   **当面は既存パスを継続利用する。**

---

## ⚠ スマホ表示とデプロイキャッシュについて（重要）

Apps Script WebApp 特有の強いキャッシュにより、  
**CSS 更新が反映されない／`?v=xxx` が効かない** ことがある。

**確認手順（確実性が高い順）**

1. **既存タブを閉じる → 新しいタブで URL を開き直す。**
2. `?v=xxx` を付けても効かない場合がある（過信しない）。
3. 反映まで数秒〜数分遅れることがある。
4. PC／スマホ両方で確認する（特に iPhone Safari）。

---

## 🔧 AI協業ルール（固定）

1. **作業は必ず一歩ずつ進める**  
   - 大きな変更は必ず「設計 → 実装」の順で行う。
2. **不具合は類推せず、事実を必ず確認する**  
   - 「こうなっているはず」で進めない。  
   - URL / スクショ / 実際のコードなど、確認できるものを必ず見る。
3. **修正は原則「ファイル丸ごと」または「大きめの塊」で行う**  
   - 1 行単位の差し替えはミスを生みやすいため、  
     可能な限り HTML 全文、関数単位、ブロック単位で差し替える。
4. **その場しのぎの小手先対応はしない**  
   - 目先のバグだけを消すのではなく、設計・データ構造を含めて整合性を取る。
5. **スマホ表示を常に最優先**  
   - PC で良くてもスマホで読めない UI は不可。  
   - 文字サイズ・行間・タップしやすさを最優先する。
6. **スクショは細部まで確認する**  
   - PC／スマホ両方のスクショをよく見て、  
     ボタンの有無・文言・余白など細部までチェックする。
7. **必要な情報が不足している場合は必ず確認する**  
   - 例：  
     - Google Sheets のカラム構成  
     - Firestore の実データ構造  
     - HTML / GAS の“最新版”（どのバージョンか）  
   - これらが無いと安全に進められない場合は、  
     まず「シートのスクショ／CSV／コード全文を見せてください」と依頼する。  
   - それでも情報が無い場合に限り、  
     「◯◯ という前提で仮に進めます」と明示した上で類推する。
8. **最新の状態（前チャット・GitHub・デプロイ）を踏まえて判断する**  
   - 古い方針やコード片を参照し続けない。  
   - 直近の README / GitHub / デプロイ状態を常に優先する。
9. **過去に似た不具合がある場合は、過去の“痕跡”（古いURL・古いデプロイ）を優先して洗い出す**。

---

## 🌐 URL・デプロイ関連ルール（重要）

10. **WebApp URL は 1 箇所で管理（`WEB_APP_URL` / `OWNER_WEB_APP_URL`）**  
    - HTML 内に生の `https://script.google.com/...` を直書きしない。
11. **HTML のリンクは必ずテンプレート変数経由で記述**  
    - 例：  
      `href="<?= scriptUrl ?>"`  
      `href="<?= scriptUrl ?>?mode=detail&doc=<?= documentId ?>"`  
      `href="<?= ownerAppUrl ?>?mode=edit&doc=<?= documentId ?>"` など。
12. **URLまわりの不具合は、推測で修正せず、まず“URL全棚卸し”を行う**  
    - main.gs の `WEB_APP_URL` / `OWNER_WEB_APP_URL`  
    - 各 HTML テンプレ内の `scriptUrl` / `ownerAppUrl`  
    - ハードコードされた URL が紛れていないか確認する。
13. **Webアプリのデプロイ時は毎回、次を確認する**  
    - 実行するユーザー：**自分**  
    - アクセスできるユーザー：**全員**
14. **白画面などが出た場合、まず返ってきた HTML（view-source）を確認する**  
    - Apps Script システムメッセージか、テンプレ側の不備かを切り分ける。
15. **URLを変更した場合、README の該当箇所も同時に更新する**  
    - READMEと実際の構成が乖離しないようにする。

---

## 📱 スマホ最優先 UI ルール（固定）

16. **スマホでは横幅 100%。白い箱（狭い枠）を作らない**  
    - Sites の iframe の内側であっても、body / wrapper は `width:100%` を基本とする。
17. **重要テキストは大きめ、補足テキストは小さめでメリハリを付ける**
18. **ボタンは大きめ＆余白広めで、押し間違えを避ける**
19. **PC の見え方は壊さないが、優先順位は常に“スマホ > PC”**
20. **CSS 変更の確認は「タブを閉じる → 新タブで開く」で行う**  
    - `?v=xxx` だけに頼らない。

---

## ⚠ 補足①｜認証方式の最終方針（edit.html に一本化）

### 現状

- 認証の本体は **edit.html** に置く方針で設計・実装済み。
- edit.html では：
  - Firebase SDK（`firebase-app-compat.js` / `firebase-auth-compat.js`）を読み込み。
  - `firebaseConfig` を用いて `firebase.initializeApp(...)`。
  - `auth.onAuthStateChanged(user)` でログイン状態を監視し、  
    ログイン済みユーザーのメールアドレス（`user.email`）を取得。
  - `OwnerEmail` と `user.email` を比較し、一致しない場合は編集を許可しない。

- `saveCarFromForm(formData)`（GAS 側）：
  - `AuthEmail`（Firebase Auth のメール）を必須として受け取る前提。
  - **新規登録時**：`OwnerEmail` に `AuthEmail` を保存してオーナー紐付け。

### 方針（確定）

- **認証・オーナー判定ロジックは edit.html に一本化**する。
- editGate はあくまで「説明＋edit.html への導線ページ」とする。
- 将来的に：
  - detail 側のオーナー判定（ActiveUser ベース）も  
    Firebase Auth + OwnerEmail に統一していく。

---

## ⚠ 補足②｜editGate（owner_edit_gate.html）の役割

### 現状

- テンプレート：`owner_edit_gate.html`
- 役割：
  - 「この車両の編集には OwnerEmail と同じ Google アカウントでログインが必要です」と説明する。
  - ボタン：
    - 「編集画面へ進む」  
      → `?mode=edit&doc=DOC_xxx` へ遷移（認証は edit.html 側で実行）。
    - 「車両の詳細ページに戻る」

### 方針（確定）

- **editGate は「説明 + edit.html への導線ページ」に限定**する。
- Firebase Auth 処理は **edit.html 側のみ** で行う。  
  （editGate に Firebase SDK を二重実装しない）
- README の記述もこの方針に揃える  
  （「editGate に Firebase Auth を入れる予定」という記述は使用しない）。

---

## 📝 最新作業メモ（2025-11-21 時点）

※この枠だけ毎回更新。それ以外の章は基本固定。

### ✅ 本日までに合意・整理できたこと

1. **edit 保存後の「白紙問題」の方針を確定**
   - `edit.html` の保存成功時は **自動リダイレクトを行わない**。
   - 代わりに：
     - フォームを「保存完了カード」に差し替え、
     - 「この車両の詳細ページに戻る」「車両一覧に戻る」のリンクを表示。
   - iPhone Safari + Sites + iframe + `window.location` の組み合わせによる白画面リスクを回避するため。

2. **Google Sheets `cars` シートの実データ構造をCSVで確認**
   - `_id`, `DocumentID`, `OwnerEmail`, `PhotoMain` などのカラム構成を事実ベースで把握。
   - DocumentID ベース Storage パス案は将来案として保留し、現状は `row_00X` ベースを継続。

3. **「情報不足のまま類推で進めない」ルールを追加**
   - AI協業ルールに情報要求の優先を正式追加。
   - Sheets / Firestore / コードが不明な状態での推測実装を禁止。

4. **認証の主戦場を再確認：edit.html**
   - 過去に浮上した「editGateにFirebase Authをまとめる案」は不採用。
   - 認証・オーナー判定は **edit.html に一本化**する方針を再確認。

5. **Sheets / Firestore / Storage の役割分担を明文化**
   - Sheets：唯一のマスター
   - Firestore：ミラー／外部連携用サブデータ
   - Storage：`row_00X` ベース既存パスを継続利用

---

## 🧩 現在の未解決課題（変動する部分）

1. **edit.html 内の Firebase Auth 実装の微調整**
   - ログイン状態の扱い、OwnerEmail との照合、未ログイン時の UI などを整理。
   - iPhone Safari / PC 両方での UX（ログイン→編集）を安定させる。

2. **detail 側のオーナー判定ロジックの統一**
   - 現在残っている ActiveUser ベース部分を、  
     中長期的に Firebase Auth + OwnerEmail へ統一。

3. **新規登録フロー（`doc` なし `mode=edit`）の完成**
   - `owner.html` から「新しい車両を登録する」導線。
   - `DocumentID` 採番ルールの確定。
   - Storage との紐付けルール（`row_00X` / `DocumentID`）の整理。

4. **Sheets → Firestore ミラー処理（GAS バッチ）の設計**
   - `cars` シート内容を Firestore `cars` に同期する処理。
   - 手動 or 定期トリガーの運用設計。

5. **Storage 直接アップロード UI（edit.html）の実装**
   - オーナーがブラウザから画像アップロード → Storage → downloadURL を取得 →  
     `PhotoMain` などのフォーム項目に自動セットするフロー。

6. **GAS「Driveリクエスト集中」警告の原因調査**
   - Sheets 読み取り頻度・範囲の見直し。  
   - CacheService 活用などの最適化。

7. **iPhone Safari 実機での総合テスト**
   - detail → edit → 保存 → 完了カード → detail / index への復帰まで、  
     白画面なく動作するかの実機確認。

---

## 🗂 進行ログ（メモ）

- 2025-11-20  
  - detail スマホレイアウト & CSS 反映問題を解決。  
  - README を「固定部分」と「最新作業メモ」に分離する方針を決定。
- 2025-11-21  
  - edit 保存後白紙問題の方針を再確認（保存完了カード方式を正式採用）。  
  - Sheets / Firestore / Storage の役割分担を「Sheets マスター」で確定。  
  - cars シートの実データ構造（_id, DocumentID, OwnerEmail, PhotoXXX など）を CSV ベースで確認。  
  - 「情報不足のまま類推で進めない」ルールを AI協業ルールに追加。  
  - 認証の主戦場を edit.html に一本化し、editGate は説明 & 導線ページに限定する方針で整理。

---
