# Registro500 Giappone – 開発状況＆引継ぎメモ (2025-11-24)

> **⚠️ 重要：アーキテクチャ変更 (2025-11-24)**
> 以前の「GAS WebApp 単体構成」は廃止されました。
> 現在は **「Vercel (Frontend) + GAS (Backend API)」の分離構成** で稼働しています。

---

## 🏗 新アーキテクチャ概要

「完全無料・永続運用・Google Sheets 管理」という要件を維持しつつ、GAS 特有の不具合（403エラー等）を回避するための構成。

| レイヤー | 技術スタック | 役割 | 備考 |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Vercel** | HTML / CSS / JS のホスティング | GitHub 連携で自動デプロイ |
| **Backend** | **GAS (API化)** | データ処理、権限チェック | `doGet`, `doPost` で JSON を返す |
| **Database** | **Google Sheets** | データ保存 (`cars` シート) | GAS からのみアクセス |
| **Auth** | **Firebase Auth** | ユーザー認証 (Google ログイン) | **Identity Toolkit API** で検証 |
| **Storage** | **Firebase Storage** | 画像保存 | (次回以降実装予定) |

---

## 🕒 経緯と変更理由 (History)

### ❌ 旧構成：GAS WebApp (Monolithic)
* **構成:** GAS の `HtmlService` で HTML を出力し、`google.script.run` で通信。
* **直面した課題:**
    1.  **403 Forbidden の頻発:** ユーザーが複数の Google アカウントにログインしていると、GAS の仕様によりアクセス権限エラーが発生（回避不能）。
    2.  **デプロイ地獄:** コード修正のたびに「デプロイを管理 → 新しいバージョン作成」が必要で、反映ラグやキャッシュにより開発効率が著しく低下。
    3.  **認証の不安定さ:** リダイレクト時のセッション切れや、`tokeninfo` エンドポイントの相性問題（Invalid Value）が発生。

### ✅ 現構成：Headless (Separated)
* **解決策:** 表示層（HTML）を GAS から切り離し、Vercel に委譲。GAS は純粋な API サーバーとして稼働。
* **成果:**
    * 403 エラーの完全根絶（サイト自体は Google サーバー外にあるため）。
    * GitHub に Push するだけで即時反映される高速な開発サイクル。
    * Firebase Identity Toolkit を用いた堅牢なトークン検証により、保存処理が安定。

---

## 📂 リポジトリ構造とデプロイ手順

### 1. Frontend (GitHub / Vercel)
* **場所:** リポジトリのルート (`/`)
* **ファイル:** `index.html`, `detail.html`, `edit.html`, `policy.html`, `howto.html` 等
* **デプロイ:**
    * GitHub の `main` ブランチに Push (またはファイル作成/編集) すると、Vercel が自動検知してデプロイ。
    * **注意:** `gas/sites/` 以下のファイルは現在使用していない（Vercel 設定はルートを参照）。

### 2. Backend (Google Apps Script)
* **場所:** `main.gs` (GAS エディタ上)
* **デプロイ:**
    * コード修正後は必ず **「デプロイ」→「デプロイを管理」→「バージョン：新しく作成」** が必要。
    * API URL: `https://script.google.com/macros/s/AKfycb.../exec`

---

## ✅ 現状のステータス (Current Status)

* [x] **一覧表示:** Vercel から GAS API を叩き、JSON データを取得して表示成功。
* [x] **詳細表示:** クエリパラメータ (`?doc=DOC_xxx`) で遷移し、個別データを表示成功。
* [x] **ログイン:** Firebase Auth (Popup) による Google ログイン実装完了。
* [x] **編集/保存:**
    * フロントから ID Token を POST 送信。
    * GAS 側で `identitytoolkit.googleapis.com` を使用してトークン検証（Invalid Value 問題解決済み）。
    * スプレッドシートへの書き込み・更新成功。

---

## 🚀 次回の作業 (Next Steps)

新しいチャットで再開する際は、以下のタスクから着手する。

1.  **画像アップロード機能の実装**
    * 現在、画像欄は URL 直打ちのみ。
    * Firebase Storage へのアップロード UI を `edit.html` に追加する。
2.  **コードの整理**
    * `index.html` や `edit.html` 内の JavaScript が長くなっているため、必要に応じて `js/app.js` 等に切り出す検討。
3.  **UI/UX の微調整**
    * 読み込み中のローディング表示の改善など。

---

### 🔑 認証ロジックの重要メモ（開発者向け）

GAS 側の `verifyIdToken_` 関数は、過去の `tokeninfo` (v1/v2) ではなく、**Firebase Identity Toolkit API** を使用しています。
安易に古いメソッド（`UrlFetchApp.fetch(oauth2...)`）に戻さないこと。

```javascript
// 成功パターン（現在の実装）
const endpoint = '[https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=](https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=)' + FIREBASE_API_KEY;
// ... payload は JSON で送信
