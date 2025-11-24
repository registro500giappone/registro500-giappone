📌 Registro500 Giappone – プロジェクト概要・アーキテクチャ・作業ルール（2025-11-25 最新版）

⚠️ 開発者・AI への重要なお知らせ
本プロジェクトは 「Vercel (Frontend) + GAS (Backend API)」の分離構成 で稼働しています。

Frontend: Vercel (index.html, detail.html, edit.html, config.js)

Backend: GAS (main.gs)

Database: Google Sheets

Storage: Firebase Storage

絶対に旧構成（GAS単体でHTMLを返す方式）に戻さないでください。

1. 🎯 プロジェクト目的

日本国内のクラシック Fiat 500（110D / 110F / 126 系）個体を登録・蓄積し、オーナー／オーナー候補が情報共有できるオンラインガレージを作る。

一般ユーザーは 一覧・詳細 を自由閲覧。

登録・編集は オーナー本人のみ（Google アカウント認証に基づく）。

完全無料の運用 を前提とし、長期安定性を最優先とする。

2. 📝 作業ルール（厳守）

新しいチャットを開始するときは、必ずこのセクションを AI に読ませること。

一歩ずつ進める: 複雑な実装は一気にやらず、ステップごとに確認する。

小手先の修正禁止:

目の前のエラーを消すだけの対症療法（try-catchで握りつぶす、安易なリダイレクト回避など）は禁止。

「なぜ起きたか」の根本原因を特定してから修正する。

全体整合性を重視: コードの一部だけを見て修正しない。全体（Frontend/Backend）の整合性を見る。

コード修正は「全体差し替え」: 部分的な修正はミスの温床となるため、可能な限りファイル単位での全書き換えコードを提示する。

スクショ確認: ユーザーからスクリーンショットが提示されたら、隅々まで（URL、行数、エラー内容）確認してから回答する。

3. 🏗 アーキテクチャ（Headless構成）

レイヤー

技術スタック

役割

デプロイ/更新方法

Frontend

Vercel

HTML / CSS / JS のホスティング

GitHub の main ブランチに Push すると自動反映

Backend

GAS (API)

データ処理、権限チェック

main.gs を修正後、「デプロイを管理」→「新しく作成」

Database

Google Sheets

データ保存 (cars シート)

GAS からのみアクセス（直接編集不可）

Auth

Firebase Auth

Google ログイン (Popup)

edit.html でトークン取得 → GAS へ送信

Images

Firebase Storage

車両画像の保存

edit.html から直接アップロード (クライアント側圧縮あり)

📂 ファイル構成

config.js: 【重要】 API URLやFirebase設定を集約した共通ファイル。全HTMLから読み込む。

index.html: 車両一覧。スマホ/PCレスポンシブ対応済み。

detail.html: 車両詳細。URLパラメータ ?doc=DOC_xxx でデータ取得。

edit.html: 登録・編集・画像アップロード。Firebase Auth認証必須。

4. 🔐 認証・権限仕様

認証フロー

Client (edit.html): Firebase Auth で ID トークンを取得。

Request: formData と一緒に idToken を GAS API へ POST 送信。

Server (main.gs): verifyIdToken_ (Identity Toolkit API) でトークン検証。

Storage ルール

読み取り: 全員許可 (allow read: if true;)

書き込み: ログインユーザーのみ許可 (allow write: if request.auth != null;)

5. ✅ 現状のステータス (2025-11-25 完了)

稼働中: Vercel 上で全機能（一覧・詳細・編集・保存・削除・画像UP）が正常動作中。

画像機能:

スマホ写真のクライアント側自動圧縮 (最大1600px/JPEG) を実装済み。

ユーザーIDごとのフォルダ分け保存 (images/{uid}/...) を実装済み。

UI/UX:

全ページで スマホ最適化 (フォントサイズ16px基準、レイアウト調整) 完了。

index.html: ヘッダーデザイン刷新、リスト表示の視認性向上。

detail.html: スペック表のスマホ表示最適化（項目名折り返しなし）。

6. 🚀 今後の運用・課題

運用テスト: 実際のオーナーに使ってもらい、使用感をヒアリングする。

データのバックアップ: Google Sheets の定期的なダウンロード/バックアップを推奨。

機能追加（必要に応じて）:

車両検索機能

ページネーション（台数が増えた場合）

7. 📱 UI/UX レギュレーション（共通ルール）

viewport: <meta name="viewport" content="width=device-width, initial-scale=1.0">

文字サイズ: html { font-size: 16px; } (PC: 18px)

余白: スマホ下部は padding-bottom: 96px を確保（ボタン操作用）。

設定管理: 定数やURLは必ず config.js で管理し、HTMLに直書きしない。
