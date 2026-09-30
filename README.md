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
- **言語/フレームワーク**: HTML5, CSS3 (Bootstrap), Vanilla JavaScript。静的HTMLは直下に約70ページ＋`126/`（姉妹サイト）＋`en/`・`it/`（英伊版）＋テーマ別ディレクトリ（`engine-simulator/`・`paint-notebook/`・`event/` ほか）。共通JSは `config.js`（接続情報の正本）・`fab-nav.js`・`rg-join-cta.js`・`parts.js`・`stats-*.js`・`wiring-*.js`・`sw.js`。
- **ホスティング**: **Cloudflare Pages**（mainブランチへのpushで自動デプロイ）。ドメイン登録だけ Vercel（Cloudflare Registrar へ移管予定）。
- **データ可視化**: D3.js (Mappa), Chart.js (Statistics)
- **PWA**: `manifest.json`＋`sw.js`（Service Worker）。デプロイ時に `build.sh` が `sw.js` の `__BUILD_VERSION__` をコミットSHAに置換し、共通CSS/JS（`style.css`・`fab-nav.js`・`rg-join-cta.js`）の参照に同じ値を `?v=` で付ける。
- 各ページがインラインJSで supabase-js（`@2.94.0`・SRI固定）を初期化し、Supabase に直接読み書き（書込はRLSで制御）。接続情報は `config.js` の `SUPABASE_URL` / `SUPABASE_ANON_KEY` から取る（直書きしない）。

### バックエンド (Backend / Managed Services)
- **Database**: **Supabase (PostgreSQL)**
  - 車両・イベント・参加者・お知らせ・パーツ・スポット等のマスター管理。
  - PostgreSQLトリガーにより、ID（DOC_xxx 等）の自動発番や計算項目の自動生成を実装。RLSあり。
- **Authentication**: Firebase Auth (Google Login)
- **Storage**: Firebase Storage (車両・イベント写真の保存)

### 外部連携・自動化 (External Integration)
- **GitHub Actions**（`.github/workflows/`・18本）: `py/` のスクリプトを定期実行。パーツ価格のクロール＋AI翻訳、朝のお知らせメール（`daily-digest.yml`）、週次レポート、イベント個別ページ・YouTubeポータル・壁紙スプライトの再生成、旅手帳の公開制御、ログイン統計の収集など。設定値は Secrets から `py/.env` に書き出し、`py/common.py` が読む。
- **Brevo**: ニュースメール配信（送信は `py/common.py` の `brevo_send` に集約）。
- **Google Apps Script**: 廃止済み（`main.gs` 等は残置のデッドコード。掘り起こさない）。

### データフロー

```
[欧米ショップ] --(GitHub Actions: py/クローラー)--> [Supabase parts] --(AI翻訳: Gemini)--> name_ja/category 充足
[ブラウザ] --(supabase-js + 公開キー)--> [Supabase cars/parts/news/events...]（RLS）
[GitHub Actions: py/send_digest.py] --(service_role)--> [Supabase news 等] --> Brevo でお知らせメール配信
```

---

## 📁 リポジトリ構成（主要）

```
/                  静的HTML・config.js・style.css・共通JS・sw.js・_headers・_redirects・sitemap.xml 等
/126/              Fiat 126 姉妹サイト（../config.js を相対参照）
/en/ /it/          英語・イタリア語版（engine-simulator の英伊は日本語版から生成＝engine-simulator/i18n/build_i18n.py）
/<テーマ>/         テーマ別の資材と正本（HANDOFF.md）＝ wiring-simulator/・engine-simulator/・equipment-notebook/・
                   events-portal/・youtube-portal/・wallpaper/・car-history/・paint-notebook/ など
/event/            イベント個別ページ（生成物。py/gen_event_pages.py の render() を直す）
/py/               クローラー・メール配信・レポート・各種生成スクリプト（py/README.md 参照）。共通部＝py/common.py
/.github/workflows/ 定期実行の定義（cron は UTC）
/docs/             ドキュメント（docs/refactor-baseline.md = 保全すべき既存挙動）
database_schema.sql 本番DB（public スキーマ）の写し。手で編集せず python py/dump_schema.py で再生成
build.sh           Cloudflare Pagesビルド時の sw.js バージョン置換と共通CSS/JS への ?v= 付与（ローカル実行禁止）
```

> `docs/00_project_context.md` は Supabase 移行前（Google Sheets時代）の歴史的資料です。現行構成は本READMEを参照してください。
> DBのスキーマ変更は migration（Supabase MCP `apply_migration`。SQLはテーマ別ディレクトリに日付付きで置く）で行い、当てたら `database_schema.sql` を再生成します。
