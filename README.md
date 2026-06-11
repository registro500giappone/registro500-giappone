# Registro500 Giappone
**日本のクラシック FIAT 500 オーナーのためのオンライン・コミュニティ・プラットフォーム**

「めざせ500台！」を合言葉に、日本国内のチンクエチェント（Nuova 500）のオーナー情報を集約し、愛車の維持とオーナー同士の交流をサポートするサービスです。

- 本番URL: https://www.registro500.com/
- 姉妹サイト（Fiat 126）: https://www.registro500.com/126/

---

## 🌟 提供サービス
1. **Online Garage (車両名鑑)**  
   登録された車両の写真や詳細なスペック（エンジン、点火系、足回り、オイル等）を閲覧可能。
2. **Registro Mappa (オーナーズマップ)**  
   D3.jsを使用し、居住地分布を日本地図上で可視化。地域ごとの仲間を直感的に探せます。
3. **Statistics (統計データ)**  
   登録車両のモデル分布、ボディカラー、メンテナンスサイクルなどをリアルタイムで集計・グラフ表示。
4. **Eventi (イベント掲示板)**  
   オーナー主催のミーティングやイベントの告知、および参加表明管理機能。
5. **Comunicazione (オーナーコンタクト)**  
   プライバシーを保護しつつ、サイトを介して特定のオーナーへメッセージを送信できる機能。
6. **Parts Price Comparison (パーツ価格比較・公開済み)**  
   欧米の主要ショップからパーツ価格データを自動収集・比較し、維持コストの最適化を支援。
7. **News配信 / グッズ紹介 / スポット情報** ほか

---

## 🏗 システム構造 (Architecture)

2026年1月、サービス規模の拡大に伴い、基盤を Google Sheets から **Supabase** へ移行しました。
ビルドシステム（npm/バンドラ等）は使用しない4層構成です。

### フロントエンド (Frontend)
- **言語/フレームワーク**: HTML5, CSS3 (Bootstrap), Vanilla JavaScript（静的HTML約25ページ＋`config.js`＋`parts.js`＋`spot.js`＋`sw.js`）
- **ホスティング**: **Cloudflare Pages**（mainブランチへのpushで自動デプロイ）。Vercelはバックアップ。
- **データ可視化**: D3.js (Mappa), Chart.js (Statistics)
- **PWA**: `manifest.json`＋`sw.js`（Service Worker）。デプロイ時に `build.sh` が `sw.js` の `__BUILD_VERSION__` をコミットSHAに置換。
- 各ページがインラインJSで supabase-js を初期化し、Supabase に直接読み書き（書込はRLSで制御）。

### バックエンド (Backend / Managed Services)
- **Database**: **Supabase (PostgreSQL)**
  - 車両・イベント・参加者・お知らせ・パーツ・スポット等のマスター管理。
  - PostgreSQLトリガーにより、ID（DOC_xxx 等）の自動発番や計算項目の自動生成を実装。RLSあり。
- **Authentication**: Firebase Auth (Google Login)
- **Storage**: Firebase Storage (車両・イベント写真の保存)

### 外部連携・自動化 (External Integration)
- **Google Apps Script (GAS)**: `main.gs` を clasp で管理。Web API（イベントCRUD・問い合わせ・mycars）、日次ニュース配信（Brevo）、X投稿を担当。
- **GitHub Actions**: `py/` のクローラー群を定期実行し、欧米ショップのパーツ価格を Supabase に自動upsert（詳細は `py/README.md`）。
- **Brevo**: ニュースメール配信。

### データフロー

```
[欧米ショップ] --(GitHub Actions: py/クローラー)--> [Supabase parts] --(AI翻訳: Gemini)--> name_ja/category 充足
[ブラウザ] --(supabase-js + anon key)--> [Supabase cars/parts/news/spots...]
[ブラウザ] --(fetch API_URL)--> [GAS main.gs] --(service_role key)--> [Supabase] / [Brevo] / [Sheets]
[GAS 時間トリガー] --> sendDailyDigest() --> Brevoでニュースメール配信
```

---

## 📁 リポジトリ構成（主要）

```
/                  静的HTML・config.js・parts.js・spot.js・sw.js・_headers 等
/126/              Fiat 126 姉妹サイト（../config.js を相対参照）
/py/               パーツクローラー＋AI翻訳（GitHub Actionsで実行。py/README.md 参照）
/.github/workflows/ クローラーの定期実行定義
/docs/             ドキュメント（docs/refactor-baseline.md = 保全すべき既存挙動）
main.gs            GAS本体（claspでpush）
build.sh           Cloudflare Pagesビルド時のsw.jsバージョン置換（ローカル実行禁止）
```

> `docs/00_project_context.md` は Supabase 移行前（Google Sheets時代）の歴史的資料です。現行構成は本READMEを参照してください。
