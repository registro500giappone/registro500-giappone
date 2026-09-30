# Registro500 パーツ価格比較 データ更新スクリプト

このディレクトリには、欧米9ショップからパーツデータをクローリング・AI翻訳し、Supabase（partsテーブル）へ直接upsertするスクリプトが含まれています。

**本番運用は GitHub Actions（`.github/workflows/`）による定期実行です。** ローカル実行は再実行・デバッグ用です。

---

## 📋 対象ショップとアクティブなスクリプト（正本）

`.github/workflows/*.yml` が参照するスクリプトが「生きているコード」です。

| ショップ | スクリプト | 実行頻度 |
|---|---|---|
| Axel Gerstl (ドイツ) | `axel_full_search.py` | 週1（crawl-axel.yml） |
| FD Ricambi (イタリア) | `parts_search_v2.py` | 手動のみ（crawl-fd.yml。Actions IPがブロックされるため workflow_dispatch） |
| D'Angelo Motori (イタリア) | `dangelo_recon.py` | 週2（crawl-dangelo.yml） |
| EuroItalia500 (イタリア) | `euroitalia500_recon.py` | 週3（crawl-euro.yml） |
| Passione 500 (イタリア) | `passione_recon.py` | 週2（crawl-passione.yml） |
| AutoBella Parts | `shopify_crawler.py autobella` | 毎日（daily-parts-update.yml） |
| Ricambio | `shopify_crawler.py ricambio` | 毎日（daily-parts-update.yml） |
| Mr Fiat | `shopify_crawler.py mrfiat` | 毎日（daily-parts-update.yml） |
| 500Line | `shopify_crawler.py 500line` | ローカル実行のみ（run_all.py 経由） |

- `shopify_crawler.py` — Shopify 系4店の共通クローラー（2026-09-30 に旧4本を統合）。店ごとの違い（通貨・SKU接頭辞・URL・判定列）は冒頭の `SHOPS` 表だけ。`--dump out.json` で DB に書かずに upsert 内容を確かめられる。

- `ai_marathon_final_v9.py` — AI翻訳（Gemini API）。各クロール後に実行され、`category IS NULL` のレコードを対象に name_ja / category を充足。
- `run_all.py` — ローカル手動実行用の統合スクリプト（9ショップ並列＋AI翻訳）。
- `crawler_common.py` — 全クローラー共通のボイラープレート（env読込・Supabaseクライアント・UA・batch_upsert・detect_target_cars）。
- `check_all.py` — 健全性チェック（構文＋workflows参照＋crawlersリストの存在確認。ネットワークなし）。

### アーカイブ

- `archive/` — 旧世代スクリプト（run_all_v2.py・orchestrator.py・crawler_utils.py 等）。**歴史的資料であり実行禁止**。workflows・run_all.py からは参照されていない。

### 共通部（クローラー以外のスクリプト）

- `common.py` — 標準ライブラリだけの共通部。`py/.env`→環境変数の順で設定を読む `cfg`/`require`、Supabase REST の `sb_select`（Range ページング）・`sb_rpc`・`sb_upsert`・`sb_patch`、Brevo 送信 `brevo_send`。send_digest / send_report / gen_report / find_events / collect_daily_logins / build_wallpaper_sprite / dump_schema が使う（クローラーは `crawler_common.py`＝別物）。
- `dump_schema.py` — 本番DB（public）の写し `../database_schema.sql` を再生成（DB 関数 `schema_snapshot()`）。migration を当てたら回す。

### その他の現役ユーティリティ（ローカル運用）

- `gen_report.py` — 成長レポート生成（2026-06実装）
- `brevo_stats.py` — Brevo配信統計
- `license_plate_masking.py` — ナンバープレートマスキング

---

## 🚀 使い方（ローカル実行）

```bash
cd py
python run_all.py              # 全9ショップ並列＋AI翻訳（数時間かかる）
python dangelo_recon.py        # 個別ショップのみ再実行
python ai_marathon_final_v9.py # AI翻訳のみ
python check_all.py            # 健全性チェック（ネットワークなし）
```

本番の再実行は GitHub Actions の **workflow_dispatch**（手動トリガー）を推奨します。

---

## ⚙️ 環境設定

### 必須（ローカル実行時）

`py/.env` に以下を設定（**gitignore済み。絶対にコミットしない**）：

```env
SUPABASE_URL=...
SUPABASE_KEY=...
GEMINI_API_KEY=...
```

GitHub Actions では同名の Secrets を使用します。

### 依存ライブラリ

```bash
pip install selenium pandas requests supabase python-dotenv webdriver-manager google-generativeai
```

---

## 📐 重要な規約（変更禁止）

- partsテーブルへのupsertは `on_conflict="product_no"`。レコードキー: shop_name, product_no, oem_no, name_en, price_euro, stock_status, image_url, page_url, target_cars。
- `BOT_USER_AGENT`（Registro500Bot/1.0…）とページ間 `time.sleep` を維持。リクエスト頻度を上げない。
- `dangelo_recon.py` の外部リトライ（待機3,5,5,10分＝計23分）は実地障害（Store APIが202を9分以上返す）への対策。短縮しない。

詳細は `docs/refactor-baseline.md` を参照。

---

## ⚠️ エラー対処

1. **ModuleNotFoundError** → 上記の依存ライブラリをインストール
2. **KeyError: 'SUPABASE_URL'** → `py/.env` の設定を確認
3. **Timeout / クローラー失敗** → `py/logs/` のショップ別ログを確認し、個別スクリプトを再実行（または workflow_dispatch）
4. **429 Too Many Requests（Gemini）** → `ai_marathon_final_v9.py` は自動リトライする。それでも失敗する場合は時間をおいて再実行

---

**最終更新**: 2026-06-11
