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
| EuroItalia500 (イタリア) | `euro_search.py` | 週3（crawl-euro.yml） |
| Passione 500 (イタリア) | `passione_recon.py` | 週2（crawl-passione.yml） |
| AutoBella Parts | `autobella_crawler.py` | 毎日（daily-parts-update.yml） |
| Ricambio | `ricambio_crawler.py` | 毎日（daily-parts-update.yml） |
| Mr Fiat | `mrfiat_crawler.py` | 毎日（daily-parts-update.yml） |
| 500Line | `500line_crawler.py` | ローカル実行のみ（run_all.py 経由） |

- `ai_marathon_final_v9.py` — AI翻訳（Gemini API）。各クロール後に実行され、`category IS NULL` のレコードを対象に name_ja / category を充足。
- `run_all.py` — ローカル手動実行用の統合スクリプト（9ショップ並列＋AI翻訳）。
- `check_all.py` — 健全性チェック（構文＋workflows参照＋crawlersリストの存在確認。ネットワークなし）。

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
