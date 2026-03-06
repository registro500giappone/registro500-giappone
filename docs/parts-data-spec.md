# パーツ比較機能 データ仕様書

最終更新: 2026-03-06

---

## 1. システム概要

8つの海外ショップのパーツデータを定期的にクロールし、Supabase（PostgreSQL）に蓄積。
フロントエンド（parts.html + parts.js）がSupabaseに直接クエリして検索・表示する。

```
各ショップサイト
    ↓ クローラー（GitHub Actions スケジュール実行）
Supabase parts テーブル
    ↓ AI翻訳（name_jp / category を自動生成）
    ↓ Supabase JS SDK（anon key、ブラウザ直接接続）
parts.html（フロントエンド）
```

---

## 2. データストア：parts テーブル（Supabase）

### 主要カラム

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid | 主キー（自動生成） |
| `product_no` | text | 商品番号（**UNIQUE**、upsertのキー） |
| `shop_name` | text | ショップ名（後述の8ショップ） |
| `name_en` | text | 英語商品名（クローラーが取得） |
| `name_jp` | text | 日本語商品名（AI翻訳で生成） |
| `category` | text | カテゴリ（AI翻訳で生成） |
| `price_euro` | float | 価格（EUR・DB格納値の意味はショップにより異なる） |
| `stock_status` | text | 在庫状況（「在庫あり」「在庫なし」） |
| `oem_no` | text | OEM番号（N/A の場合あり） |
| `image_url` | text | 商品画像URL |
| `page_url` | text | ショップ商品ページURL |
| `target_cars` | text | 対象車種（「Fiat 500」「Fiat 126」「Fiat 600」の組み合わせ） |
| `search_keywords_jp` | text | AI生成の日本語検索補助キーワード |
| `specs` | text | AI生成のスペック情報 |
| `updated_at` | timestamptz | 最終更新日時（**BEFORE UPDATE トリガーで自動更新**） |
| `created_at` | timestamptz | 初回登録日時 |

### updated_at トリガー（Supabase Migration: `add_updated_at_trigger_to_parts`）

クロールのたびに価格変更がなくてもupdated_at が更新されるよう、DBトリガーで制御。

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON parts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### RLS（Row Level Security）

- INSERT / UPDATE: `true`（クローラーがanon keyで書き込めるよう意図的に開放）
- 読み取り: 全ユーザー公開

---

## 3. 8ショップ構成

### 3-1. 各ショップ詳細

| ショップ名 | サイトURL | クローラー | 方式 | DB価格の意味 | VAT率 |
|---|---|---|---|---|---|
| FD Ricambi | fdricambi.com | `parts_search_v2.py` | requests+BS4 | 税抜き | - |
| Axel Gerstl | webshop.fiat500126.com | `axel_full_search.py` | requests+BS4 | 税込み | 19%（独） |
| EuroItalia500 | euroitalia500-commerce.it | `euro_search.py` | requests+BS4 | 税込み | 22%（伊） |
| Passione 500 | passione500.it | `passione_recon.py` | requests+BS4 | 税込み | 22%（伊） |
| D'Angelo Motori | dangelomotori.it | `dangelo_recon.py` | requests+BS4 | 税抜き | - |
| AutoBella Parts | autobellaparts.com | `autobella_crawler.py` | Shopify JSON API | 税込み | 20%（英） |
| Ricambio | ricambio.co.uk | `ricambio_crawler.py` | Shopify JSON API | 税込み | 20%（英） |
| Mr Fiat | mrfiat.com | `mrfiat_crawler.py` | Shopify JSON API | 税抜き（USD） | - |

### 3-2. クローラーの共通仕様

- **upsert方式**: `on_conflict="product_no"` で既存データを上書き
- **AI翻訳データ保護**: `name_jp` / `category` をupsertのdictに**含めない** → 既存翻訳データが上書きされない
- **バッチサイズ**: 50件まとめてSupabaseに送信
- **sleep**: リクエスト間に 0.3〜1.0秒のランダム待機

### 3-3. URL収集方式

| ショップ | URL収集方法 |
|---|---|
| Axel Gerstl | sitemap.xml → `/en/` + 深さ3以上をフィルタ |
| Passione 500 | sitemap_index.xml → product系サイトマップ → `/en/`URLを収集 |
| D'Angelo Motori | sitemap_index.xml → product系サイトマップ → `/en/`URLを収集 |
| EuroItalia500 | DBの既存 `page_url` からカテゴリスラグを抽出 → カテゴリページをページネーション |
| FD Ricambi | sitemap.xml → `/en/` URLを収集（Shopware） |
| AutoBella / Ricambio / Mr Fiat | Shopify Products JSON API（`/products.json?page=N`） |

---

## 4. GitHub Actions スケジュール

全スクリプトは `py/` ディレクトリに配置。GitHub Actionsが ubuntu-latest で実行。

| ワークフロー | ショップ | スケジュール（JST） | timeout |
|---|---|---|---|
| `daily-parts-update.yml` | AutoBella / Ricambio / Mr Fiat（並列） | 毎日 03:00 | 120分 |
| `crawl-axel.yml` | Axel Gerstl | 毎週日曜 21:00 | 300分 |
| `crawl-passione.yml` | Passione 500 | 月・木 21:00 | 240分 |
| `crawl-fd.yml` | FD Ricambi | 水・土 21:00 | 240分 |
| `crawl-euro.yml` | EuroItalia500 | 月・水・金 21:00 | 120分 |
| `crawl-dangelo.yml` | D'Angelo Motori | 火・土 21:00 | 180分 |

**全ワークフロー共通の手順:**
1. `actions/checkout@v4`
2. `actions/setup-python@v5` (Python 3.11)
3. `pip install -r py/requirements.txt`
4. `.env` 作成（`SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`）
5. クローラー実行
6. AI翻訳実行（クロール成功時のみ: `if: success()`）

**GitHub Secrets（必須）:**
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GEMINI_API_KEY`

---

## 5. AI翻訳（`ai_marathon_final_v9.py`）

- 対象: `category IS NULL` のレコードを全件処理
- 処理内容: `name_en` をもとにGemini APIで `name_jp` / `category` / `search_keywords_jp` / `specs` を生成
- クロール後に自動実行されるため、新規追加レコードは翌日以降に日本語で検索可能になる

---

## 6. フロントエンド（parts.js）

### データ取得フロー

1. ユーザーが検索条件を入力（キーワード / カテゴリ / 車種 / ショップ選択）
2. 選択ショップごとに**並列**でSupabaseクエリ（`Promise.all`）
3. 各ショップ最大 **500件** 取得（上限到達時は警告バナーを表示）
4. 結果をマージして一覧表示

### 検索条件の仕様

| 条件 | 検索対象フィールド |
|---|---|
| キーワード（ILIKE） | `name_en`, `name_jp`, `oem_no`, `product_no`, `search_keywords_jp`, `category`, `specs` |
| 同義語（自動展開） | `name_en`, `name_jp`, `search_keywords_jp` |
| カテゴリ（完全一致） | `category`（キーワードがある場合は無視） |
| 車種 | `target_cars`（ILIKE %500%、%126% 等）。NULL or 空文字は全車種共通として常に含める |
| ショップ | `shop_name`（完全一致） |

### 価格計算

フロントエンドでは**税抜きEUR → 円換算**に統一して比較表示する。

```
表示価格（円） = price_euro ÷ (1 + vat_rate) × currentRate
※ is_price_ex_vat = true のショップは ÷ 1（そのまま）
```

**為替レート**: `open.er-api.com/v6/latest/EUR` からJPYレートを取得。APIエラー時は `165`（ハードコード）を使用。

### 検索条件の保存

`sessionStorage` に保存（有効期限1時間）。ページリロード後も検索状態を復元。

### 同義語辞書（config.js に定義）

日本語・英語・イタリア語の対応を `synonymGroups` 配列で管理。例:
- 「ブレーキ」→ brake, freno
- 「キャブレター」→ carburetor, carburettor, carburatore

---

## 7. 依存ライブラリ（`py/requirements.txt`）

```
requests==2.32.5
supabase==2.27.1
python-dotenv==1.2.1
google-generativeai==0.8.6
selenium==4.39.0        # AutoBella/Ricambio/Mr Fiatの旧コード互換のため残存
webdriver-manager==4.0.2
beautifulsoup4==4.14.3
```

---

## 8. ファイル構成

```
registro500-giappone/
├── parts.html                    # パーツ比較UI
├── parts.js                      # 検索・表示ロジック
├── config.js                     # ショップ設定・Supabase URL等
├── .github/workflows/
│   ├── daily-parts-update.yml    # 毎日実行（AutoBella/Ricambio/MrFiat）
│   ├── crawl-axel.yml
│   ├── crawl-passione.yml
│   ├── crawl-fd.yml
│   ├── crawl-euro.yml
│   └── crawl-dangelo.yml
└── py/                           # クローラー（ローカル・GitHub Actions両用）
    ├── requirements.txt
    ├── axel_full_search.py
    ├── passione_recon.py
    ├── parts_search_v2.py        # FD Ricambi
    ├── euro_search.py            # EuroItalia500
    ├── dangelo_recon.py          # D'Angelo Motori
    ├── autobella_crawler.py
    ├── ricambio_crawler.py
    ├── mrfiat_crawler.py
    ├── run_all.py                # 全ショップ並列実行（ローカル用）
    └── ai_marathon_final_v9.py   # AI翻訳
```
