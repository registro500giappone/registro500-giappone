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
| 車両詳細 | `/exec?mode=detail&doc=DOC_xxx`   |

- Google Sites に `/exec...?mode=...` を iframe 埋め込みして公開
- `XFrameOptionsMode.ALLOWALL` で iframe 埋め込み許可済み

### 編集側（オーナー本人のみ）

| 状態                          | 表示される画面／ボタン                          |
|-------------------------------|--------------------------------------------------|
| detail で「編集する」を押下   | `isOwner` に応じて `edit` or `editGate` へ遷移 |
| オーナー本人（編集画面）      | `/exec?mode=edit&doc=DOC_xxx`                   |
| 未ログイン／他人（編集ゲート）| `/exec?mode=editGate&doc=DOC_xxx`               |

- 当面：detail の「編集ボタン表示/非表示」は Apps Script の ActiveUser ベース
- edit / editGate 内の実際のログイン判定は Firebase Auth（将来、こちらに統一）

### データ構成

- Google Sheets：`cars`（**唯一のマスターデータ**）
  - 主キー：`DocumentID`（例：`DOC_1`）
  - オーナー判定用：`OwnerEmail`
  - 画像 URL：`PhotoMain`, `PhotoFront`, `PhotoRear`, …（Firebase Storage の公開URL）
  - 表示補助：`Model_DisplayA/B/C`, `Engine_Display`
- Firebase Storage：
  - パス例：`cars/<row_xxx>/PhotoMain.jpg`（現状）
  - 今後：`cars/<DocumentID>/<フィールド名>/...` に整理予定
- Firestore Database：
  - コレクション：`cars`, `users` など
  - 現状：`cars` コレクションに row_xxx ドキュメントが存在
  - 役割：**Sheets のミラー／サブ**（将来の外部連携や SPA 用）
  - `sync_firestore.gs` による **Firestore → Sheets 同期スクリプトを仮接続済**  
    （日常運用では「Sheets をマスター」とする）

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

1. **作業は必ず一歩ずつ**
2. **不具合は類推せず、事実を必ず確認する**
3. **修正は原則「ファイル丸ごと」または「大きめの塊」**
4. **その場しのぎの小手先対応はしない**
5. **スマホ表示を常に最優先**
6. **スクショは細部まで確認する**
7. **最新の状態（前チャット・GitHub）を踏まえて判断する**

---

## ⚠ 補足①｜ログイン方式の最終方針

- 現状：
  - `edit.html` は Firebase Auth（`signInWithPopup`）を使用して  
    ログイン済みユーザーのメールアドレス（`AuthEmail`）を取得。
  - `saveCarFromForm` では `AuthEmail` を必須とし、  
    新規登録時に `OwnerEmail` として Sheets に保存。
  - `detail` の編集ボタン表示は Apps Script の ActiveUser（`Session.getActiveUser().getEmail()`）を暫定利用。

- 最終形（方針）：
  - **認証は Firebase Auth に一本化**し、  
    `OwnerEmail` と Firebase のログインメールを照合してオーナー判定する。
  - ActiveUser ベースの判定は将来的に撤廃し、  
    `detail` 側も Firebase Auth 情報を使う方向で整理する。

---

## ⚠ 補足②｜editGate（オーナーログイン画面）の方針

- 役割：  
  **「この車両の編集を開始する前のログイン状態確認」と「ログイン実行」専用の画面**

- 現状：
  - `owner_edit_gate.html` の UI（文言・ボタン）は作成済み。
  - ボタン押下で `?mode=edit&doc=DOC_xxx` に遷移するだけの **ダミー実装**。

- 今回合意した最終仕様（まだ未実装）：

  1. **未ログイン時**
     - 画面に「Google ログインが必要」「OwnerEmail と同じアドレスでログインして下さい」と案内。
     - 「Googleでログインして編集に進む」ボタン → `signInWithRedirect(GoogleAuthProvider)` を実行。
     - 「この車両の詳細ページに戻る」ボタンも常に表示。

  2. **ログイン済み時**
     - 上部に「現在 `xxx@example.com` でログイン中です」と表示。
     - ボタン：
       - 「このアカウントで編集画面へ進む」 → `?mode=edit&doc=DOC_xxx`
       - 「アカウントを切り替える」 → `auth.signOut()` → 未ログイン状態に戻す。
     - ※あえて「即自動リダイレクト」はせず、  
       画面上でアカウントを確認できるようにする。

  3. **Auth エラー時**
     - `getRedirectResult()` のエラーを検知し、
       - 画面に「ログイン中にエラーが発生しました／キャンセルされました」など簡易メッセージを表示。
       - 「詳細ページに戻る」ボタンで退避可能にする。
     - 真っ白画面にならないことを最優先。

---

## 📝 最新作業メモ（2025-11-21 時点）

※ここだけ毎回更新。それ以外の章は基本固定。

### ✅ 本日までに合意・整理できたこと

- **B①：edit 保存後の「白紙問題」の方針を確定**
  - `edit.html` の保存成功時は **自動リダイレクトを行わず**、
    フォームを「保存完了カード」に差し替え、
    「この車両の詳細ページに戻る」「車両一覧に戻る」のリンクを表示する方式で統一。
  - iPhone Safari + Sites + iframe + `window.location.href` の組み合わせによる
    白画面リスクを回避する設計として採用。

- **B②：editGate × Firebase Auth（signInWithRedirect）の UX 仕様を決定**
  - 未ログイン／ログイン済み／エラー時の挙動を上記のとおり整理。
  - 「ログイン済みなら即自動遷移」ではなく、
    画面上でログインメールを確認してから編集に進む設計。

- **B③：Google Sheets と Firestore の役割分担を確定**
  - Google Sheets `cars` シートを **唯一のマスター**とする。
  - Firestore `cars` コレクションは **ミラー／外部連携用サブデータ**として扱う。
  - `sync_firestore.gs` は「Firestore → Sheets の片方向同期スクリプト（復旧用）」として位置づけ、
    日常運用では常用しない。

- **B④：Storage 利用方針の大枠**
  - 写真はオーナーが Firebase Storage にアップロード。
  - `getDownloadURL()` で取得した URL を Sheets の `PhotoMain` 等に保存。
  - 将来、Sheets → Firestore 同期バッチで URL を Firestore 側にもミラー。
  - パスは `cars/<DocumentID>/<フィールド名>/...` に整理していく方針。

---

## 🧩 現在の未解決課題（変動する部分）

1. **editGate に Firebase Auth 実装（signInWithRedirect + 状態表示 + エラー処理）**
   - `owner_edit_gate.html` に Firebase SDK を組み込み、上記仕様どおりに動かす。

2. **detail 側のオーナー判定を Firebase Auth ベースに統一（中長期）**
   - 現在の ActiveUser ベース判定を段階的に廃止し、
     Firebase Auth のログインメールと `OwnerEmail` の一致で制御する。

3. **新規登録フロー（`doc` なし `mode=edit`）の完成**
   - `owner.html` からの導線設計。
   - 新規作成時の `DocumentID` 採番・Storage パス設計の確定。

4. **Sheets → Firestore の定期ミラー（GAS バッチ）**
   - `cars` シート → Firestore `cars` コレクションに上書き同期する処理。
   - 運用タイミング（手動トリガー／定期実行）を含めて設計。

5. **Storage 直接アップロード UI（edit.html）**
   - オーナーがブラウザから画像をアップロード → URL を自動で各項目に反映する仕組み。
   - 既存の「URL 手入力」運用からの移行プラン。

6. **GAS「Driveリクエスト集中」警告の原因調査**
   - Sheet 読み取り頻度の最適化（キャッシュ利用、範囲読みなど）。

7. **iPhone Safari 実機での再テスト**
   - 編集 → 保存 → 完了カード → detail / index への遷移が
     すべて問題なく動くことを確認。

---

## 🗂 進行ログ（メモ）

- 2025-11-20  
  - detail スマホレイアウト & CSS 反映問題を解決。  
  - README を「固定部分」と「最新作業メモ」に分離。
- 2025-11-21  
  - edit 保存後白紙問題の方針を確定（保存完了カード方式）。  
  - editGate × Firebase Auth の UX 仕様、Sheets/Firestore/Storage の役割分担を整理・合意。
