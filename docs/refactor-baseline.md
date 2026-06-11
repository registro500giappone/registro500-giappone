# refactor-baseline.md — 絶対に壊してはいけない既存挙動

2026-06 リファクタリング時に `refactor-instructions.md` §3 から抽出した保全リスト。
以後 py/ やドキュメントを変更する際は、変更前に本リストと照合すること。

1. **公開URL**: 全HTMLのファイル名・パスは変更禁止。ニュースメール・SNS・サイトマップ・外部リンクから直接参照されている。
2. **`config.js` のグローバル定数名**: `API_URL` / `NO_IMAGE_URL` / `LOGO_URL` / `FIREBASE_CONFIG` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `ADMIN_EMAIL` / `CONFIG`。全ページがこの名前に依存している。値・名前とも変更禁止。
3. **`sw.js` の `__BUILD_VERSION__` プレースホルダ**: `build.sh` が置換する契約。文字列を変えるとSW更新検知が壊れる。
4. **partsテーブルへの upsert 規約**: `on_conflict="product_no"`。各クローラーが出力するレコードのキー構成（shop_name, product_no, oem_no, name_en, price_euro, stock_status, image_url, page_url, target_cars）。AI翻訳は `category IS NULL` のレコードを対象とする前提。
5. **GAS API の呼び出し契約**: `doGet` の mode（index / detail / edit_init / events / mycars）、`doPost` の action（inquiry / save_event / delete_event / toggle_participation）と各レスポンス形式。フロントの複数ページが依存。
6. **DBスキーマ・トリガー・RLSポリシー**: 一切変更しない。
7. **GitHub Actions のスケジュールと依存関係**（daily-parts-update.yml のジョブ依存含む）。
8. **クローラーのリトライ挙動**: 特に `dangelo_recon.py` の外部リトライ（待機 3,5,5,10分＝合計23分の猶予）。これは「Store APIが202を9分以上返す」実地障害への対策として意図的に設計されたもの（運用知見あり）。短縮・簡略化してはならない。
9. **クローラーの対サーバー礼節**: `BOT_USER_AGENT`（Registro500Bot/1.0…）とページ間 `time.sleep` を維持。リクエスト頻度を上げない。
10. **`_headers` のキャッシュ指定**と PWA（manifest.json・icon類）。
11. **126サイト**（`126/index.html`）は `../config.js` を相対参照している。config.jsの移動禁止。
