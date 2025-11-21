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

| 機能     | URL                                 |
|----------|-------------------------------------|
| 車両一覧 | `/exec`                            |
| 車両詳細 | `/exec?mode=detail&doc=DOC_xxx`    |

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

---

## 🗂 データ構成（2025-11-21 時点の事実ベース）

### 1. Google Sheets：`cars`（**唯一のマスターデータ**）

列構成（主要カラム）：

- `_id`：`row_002`〜`row_010` など  
  - Firestore や Softr 時代の内部ID。  
  - Firestore のドキュメントIDにも使用されている（`row_00X`）。
- `DocumentID`：`DOC_1`〜`DOC_12` など  
  - アプリ内での **主キー**。  
  - URL パラメータ `doc` として利用（例：`?doc=DOC_3`）。
- `OwnerEmail`：オーナーのメールアドレス  
  - Firebase Auth のログインメールと照合する前提の列。
- `HandleName`：ハンドルネーム
- `Model_DisplayA`, `Model_DisplayB`, `Model_DisplayC`：  
  表示用に加工されたモデル名。
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

今後検討：

- Sheets → Firestore の定期ミラー（GAS バッチ）を追加し、
  Firestore 側を読み取り用のサブデータとして更新していく。

### 3. Firebase Storage（画像）

- 現状の主な保存パス例：
  - `cars/row_002/PhotoMain.jpg`
  - `cars/row_002/PhotoRear.jpg`
- Sheets の `PhotoMain` などの列には **storage のダウンロードURL** が保存される。
- 表示側（index / detail）は、あくまで **URL ベースで画像表示**しているため、  
  物理パス（`row_00X` か `DOC_xxx` か）は直接は参照しない。

> 将来のアイデア（現時点では“案”であり、まだ採用していない）：  
> - `cars/DOC_001/PhotoMain/...` のように DocumentID ベースの階層に統一すると、  
>   データ移行や Firestore 連携がわかりやすくなる。  
> - ただし現在は `row_00X` ベースで問題なく動いているため、  
>   **当面は既存パスをそのまま使い続ける。**  
> - 新規設計・移行が必要になったタイミングで改めて検討する。

---

## ⚠ スマホ表示とデプロイキャッシュについて（重要）

Apps Script WebApp 特有の強いキャッシュにより、  
**CSS 更新が反映されない／`?v=xxx` が効かない** ことがある。

**確認手順（確実性が高い順）**

1. **既存タブを閉じる → 新しいタブで URL を開き直す**
2. `?v=xxx` を付けても効かない場合がある（過信しない）
3. 反映まで数秒〜数分遅れることがある
4. PC／スマホ両方で確認する（特に iPhone Safari）

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
8. **最新の状態（前チャット・GitHub）を踏まえて判断する**  
   - 古い方針やコード片を参照し続けない。  
   - 直近の README / GitHub / デプロイ状態を常に優先する。

---

## ⚠ 補足①｜認証方式の最終方針（edit.html に一本化）

### 現状（2025-11-21 時点）

- 認証の本体は **edit.html** に置く方針で設計されている。
- edit.html では：
  - Firebase SDK（`firebase-app-compat.js` / `firebase-auth-compat.js`）を読み込み。
  - `firebaseConfig` を用いて `firebase.initializeApp(...)`。
  - `auth.onAuthStateChanged(user)` でログイン状態を監視し、
    ログイン済みユーザーのメールアドレス（`user.email`）を取得。
  - `OwnerEmail` と `user.email` を比較し、一致しない場合は編集を許可しない
    （index に戻すなど）。

- `saveCarFromForm(formData)`（GAS 側）では：
  - `AuthEmail`（Firebase Auth で取得したメール）を必須パラメータとして受け取る前提。
  - **新規登録時**：`OwnerEmail` に `AuthEmail` を保存してオーナーを紐付ける。

### 方針（合意事項）

- **認証・オーナー判定ロジックは edit.html に一本化する。**
- editGate はあくまで「説明＋edit.html への導線ページ」に留め、  
  Firebase Auth の処理を二重に持たせない。
- 中長期的には：
  - detail 側のオーナー判定（ActiveUser ベース）も  
    Firebase Auth + OwnerEmail に統一していく方向で整理する。

---

## ⚠ 補足②｜editGate（オーナーログイン画面）の役割

### 現状

- テンプレート：`owner_edit_gate.html`
- 画面の役割：
  - 「この車両の編集には OwnerEmail と同じ Google アカウントでログインが必要です」  
    といった説明文。
  - ボタン：
    - 「Googleでログインして編集に進む」  
      → 現状は **`?mode=edit&doc=DOC_xxx` に遷移するだけ**（Firebase Authはここでは実行しない）。
    - 「車両の詳細ページに戻る」

### 重要な整理（ここまでの経緯を踏まえた方針）

- 過去のチャットで一度、  
  「editGate に Firebase Auth（signInWithRedirect）を組み込み、  
  認証の入口を editGate にまとめる案」が出たが、  
  **最終的にこれは採用しない方針に戻した。**
- 理由：
  - 過去に合意した「認証は edit.html で完結させる」という設計と、  
    現行コード（edit.html に Firebase Auth 実装）を優先するため。
  - 認証ロジックを editGate と edit.html の二箇所に分散させると、  
    将来の保守が難しくなるため。

### 今後の扱い

- **editGate は「説明 + edit.html への導線ページ」に限定する。**
- Firebase Auth 関連の処理は **edit.html 側のみで行う**。  
  （editGate に Firebase を入れない）
- README の補足②は上記方針と現行実装に合わせた記述とし、  
  「editGate に Firebase Auth を入れる予定」という文言は使わない。

---

## 📝 最新作業メモ（2025-11-21 時点）

※ここだけ毎回更新。それ以外の章は基本固定。

### ✅ 本日までに合意・整理できたこと

1. **edit 保存後の「白紙問題」の方針を確定（再確認）**
   - `edit.html` の保存成功時は **自動リダイレクトを行わず**、
     - フォームを「保存完了カード」に差し替え、
     - 「この車両の詳細ページに戻る」「車両一覧に戻る」のリンクを表示する方式で統一。
   - iPhone Safari + Sites + iframe + `window.location.href` の組み合わせによる
     白画面リスクを避ける設計として採用。
   - この方針に基づくコードはすでに適用済みで、  
     「成功パスにおける白紙問題」は設計上は解決済と判断。

2. **Google Sheets `cars` シートの実データ構造を確認**
   - `_id`（`row_00X`）、`DocumentID`（`DOC_xxx`）、`OwnerEmail`、`PhotoMain` などのカラム構成を  
     CSV ベースで確認し、  
     これを前提に設計・提案を行う方針に修正。
   - DocumentID ベースの Storage パス案は「将来のアイデア」として残しつつ、  
     現行運用は `row_00X` ベースのまま維持することを明示。

3. **「情報不足のまま類推で進めない」ルールを追加**
   - AI協業ルールに「必要な情報が不足している場合は必ず確認する」を追加。
   - 例：  
     - Sheets の列構成  
     - Firestore の実データ  
     - HTML / GAS の最新版  
     が不明な場合は、まずスクショ／CSV／コード全文の提示を依頼する。

4. **認証の主戦場を再確認：editGate ではなく edit.html**
   - 過去の設計のとおり、**認証とオーナー判定は edit.html で完結させる**ことで合意。  
   - 一時的に浮上した「editGate に Firebase Auth を移す案」は採用しない方針に整理。
   - README の補足②を修正し、  
     「editGate は説明と導線」「edit.html が認証本体」という現実に揃えた。

5. **Sheets / Firestore / Storage の役割分担を再確認**
   - Sheets `cars` シートを **唯一のマスター**として扱うことを確定。
   - Firestore `cars` コレクションは **ミラー・サブデータ**として位置づけ、  
     日常運用では直接書き込まない前提にする。
   - Storage は `row_00X` ベースの既存構成を当面維持し、  
     DocumentID ベース移行は将来の検討事項とする。

---

## 🧩 現在の未解決課題（変動する部分）

1. **edit.html 内の Firebase Auth 実装の微調整・整理**
   - 現行コードの再確認（ログイン状態の扱い、OwnerEmail との照合、未ログイン時の挙動）。
   - iPhone Safari / PC 両方での UX（ログイン→編集）を安定させる。

2. **detail 側のオーナー判定の統一**
   - 現在は ActiveUser ベースの暫定ロジックが残っている可能性があるため、  
     将来的に Firebase Auth + OwnerEmail に一本化するリファクタリング。

3. **新規登録フローの完成（`doc` なし `mode=edit`）**
   - `owner.html` から「新しい車両を登録する」導線をどうするか。
   - 新規作成時の `DocumentID` 採番ルールの確定。  
   - Storage との紐付け方（`row_00X` / `DocumentID`）の扱い。

4. **Sheets → Firestore のミラー処理（GAS バッチ）**
   - `cars` シートの内容を Firestore `cars` コレクションに上書き同期する処理の設計。  
   - 実行タイミング（手動／定期トリガー）を含めた運用設計。

5. **Storage 直接アップロード UI（edit.html）**
   - オーナーがブラウザから画像をアップロード → Storage → downloadURL を取得 →  
     `PhotoMain` などのフォーム項目に自動セットする流れの実装。
   - 既存の「URL を手入力」運用からの移行計画。

6. **GAS「Driveリクエスト集中」警告の原因調査**
   - Sheets の読み取り回数・範囲を最適化し、  
     キャッシュ利用や範囲指定読み (`getRange().getValues()`) の見直し。

7. **iPhone Safari 実機での総合テスト**
   - detail → edit → 保存 → 完了カード → detail / index への復帰まで、  
     一連の流れが白画面なく動くかを再確認する。

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
