# Registro500 パーツ価格比較 データ更新スクリプト

このディレクトリには、欧州5ショップからパーツデータをクローリング・翻訳・Supabase同期するスクリプトが含まれています。

---

## 📋 対象ショップ

1. **Axel Gerstl** (ドイツ) - axel_full_search.py
2. **FD Ricambi** (イタリア) - parts_search_v2.py
3. **D'Angelo Motori** (イタリア) - dangelo_recon.py
4. **EuroItalia500** (イタリア) - euro_search.py
5. **Passione 500** (イタリア) - passione_recon.py

---

## 🚀 使い方

### 方法1: ワンクリック実行（推奨）

`run_all.bat` をダブルクリックして実行してください。

**実行内容**:
1. 全ショップクローリング（5ショップ）
2. AI翻訳（Gemini API）

**実行時間**: 約30-60分

---

### 方法2: コマンドライン実行

```bash
cd C:\Users\akayu\Documents\registro500-giappone\py
python run_all.py
```

---

## 📁 ファイル構成

```
py/
├── run_all.py                  # 統合実行スクリプト（NEW）
├── run_all.bat                 # Windows用バッチファイル（NEW）
├── README.md                   # このファイル（NEW）
├── .env                        # APIキー設定
├── axel_full_search.py         # Axel Gerstl クローラー
├── parts_search_v2.py          # FD Ricambi クローラー
├── dangelo_recon.py            # D'Angelo Motori クローラー
├── euro_search.py              # EuroItalia500 クローラー
├── passione_recon.py           # Passione 500 クローラー
├── ai_marathon_final_v9.py     # AI翻訳（Gemini API）
└── sync_csv_to_cloud.py        # CSV→Supabase同期（廃止予定）
```

---

## ⚙️ 環境設定

### 必須

`.env` ファイルに以下を設定してください：

```env
SUPABASE_URL=https://ttlttclfovuzafvghvaq.supabase.co
SUPABASE_KEY=your_supabase_key
GEMINI_API_KEY=your_gemini_api_key
```

### 依存ライブラリ

```bash
pip install selenium pandas requests supabase python-dotenv webdriver-manager google-generativeai
```

---

## 🔄 実行フロー

### 従来（手作業）

```
1. axel_full_search.py を実行 → CSV生成
2. parts_search_v2.py を実行 → CSV生成
3. dangelo_recon.py を実行 → CSV生成
4. euro_search.py を実行 → CSV生成
5. passione_recon.py を実行 → CSV生成
6. ai_marathon_final_v9.py を実行 → AI翻訳
7. sync_csv_to_cloud.py を実行 → Supabase同期
```

**手作業**: 7ステップ、約1時間

---

### 改善後（run_all.py）

```
1. run_all.py を実行
   ├─ 全ショップクローリング（自動）
   └─ AI翻訳（自動）
```

**手作業**: 1ステップ、約1時間（自動実行）

---

## 📊 実行結果

実行後、以下が表示されます：

```
============================================================
実行結果サマリー
============================================================

総実行時間: 45.3分

  ✅ 成功  Axel Gerstl
  ✅ 成功  FD Ricambi
  ✅ 成功  D'Angelo Motori
  ✅ 成功  EuroItalia500
  ✅ 成功  Passione 500
  ✅ 成功  AI翻訳

成功: 6/6

✅ 全タスクが正常に完了しました！
ℹ️  Supabaseでデータを確認してください
```

---

## ⚠️ エラー対処

### よくあるエラー

#### 1. "ModuleNotFoundError: No module named 'selenium'"

**原因**: 依存ライブラリ未インストール

**対処**:
```bash
pip install selenium pandas requests supabase python-dotenv webdriver-manager google-generativeai
```

---

#### 2. "KeyError: 'SUPABASE_URL'"

**原因**: `.env` ファイルが正しく設定されていない

**対処**:
1. `.env` ファイルの存在確認
2. `SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY` の設定確認

---

#### 3. "Timeout Error"

**原因**: ショップサイトの応答が遅い

**対処**:
- run_all.py は自動的に次のショップに進みます
- 失敗したショップのみ再実行したい場合は、個別スクリプトを実行：
  ```bash
  python axel_full_search.py
  ```

---

#### 4. "429 Too Many Requests"

**原因**: Gemini APIのレート制限

**対処**:
- ai_marathon_final_v9.py は自動的に60秒待機してリトライします
- それでも失敗する場合は、しばらく待ってから再実行

---

## 🔧 個別スクリプト実行

特定のショップのみ再実行したい場合：

```bash
# Axel Gerstl のみ
python axel_full_search.py

# FD Ricambi のみ
python parts_search_v2.py

# D'Angelo Motori のみ
python dangelo_recon.py

# EuroItalia500 のみ
python euro_search.py

# Passione 500 のみ
python passione_recon.py

# AI翻訳のみ
python ai_marathon_final_v9.py
```

---

## 📅 推奨実行頻度

- **週1回**（日曜日など）
- 理由: ショップサイトへの負荷軽減、データの鮮度維持

---

## 🆕 次のステップ（予定）

### ステップ2: GitHub Actions 自動化（予定）

完全自動化により、手作業ゼロで毎週更新されます。

- 毎週日曜日 12:00 に自動実行
- 完全無料（GitHub Actions）
- エラー時にメール通知

### ステップ3: 新規ショップ追加（予定）

- **AutoBella Parts** (イギリス) - Shopify製、高速クローリング可能

---

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. `.env` ファイルの設定
2. 依存ライブラリのインストール
3. インターネット接続
4. Supabaseの接続状況

それでも解決しない場合は、エラーログ全体を保存してください。

---

**最終更新**: 2026-02-14
**作成者**: Claude + Registro500 開発チーム
