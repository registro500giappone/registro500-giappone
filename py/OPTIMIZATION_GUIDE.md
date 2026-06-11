# クローラー高速化ガイド

> **【歴史的資料】** 本ガイドが参照する `crawler_optimizer.py` 等は `py/archive/` に移動済みです（実行禁止）。現行の運用は `py/README.md` を参照してください。

## 🎯 目標

**現在**: 24時間/ショップ
**改善後**: 8-12時間/ショップ（2-3倍高速化）

---

## 📊 高速化の内訳

| 最適化項目 | 効果 | 実装難易度 |
|-----------|------|----------|
| 1. ヘッドレスモード有効化 | **2倍高速化** | ★☆☆ 簡単 |
| 2. 画像読み込み無効化 | 30%高速化 | ★☆☆ 簡単 |
| 3. タイムアウト最適化 | 10-20%高速化 | ★☆☆ 簡単 |
| 4. 不要機能無効化 | 10%高速化 | ★☆☆ 簡単 |
| **合計** | **2-3倍高速化** | - |

---

## 🚀 実装手順

### 方法1: 最小限の変更（推奨）

各クローラースクリプトの `setup_driver()` 関数を以下に置き換えるだけ：

#### Before（現在）

```python
def setup_driver():
    options = Options()
    options.add_argument('--window-size=1280,1024')
    options.add_argument("--log-level=3")
    options.add_argument('--lang=en')
    options.add_argument(f'--user-agent={BOT_USER_AGENT}')
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)
```

#### After（最適化版）

```python
def setup_driver():
    options = Options()

    # ===== 高速化設定 =====
    options.add_argument('--headless=new')  # ★最重要！2倍高速化
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')

    # 画像読み込み無効化（30%高速化）
    prefs = {'profile.managed_default_content_settings.images': 2}
    options.add_experimental_option('prefs', prefs)

    # その他の設定
    options.add_argument('--window-size=1280,1024')
    options.add_argument("--log-level=3")
    options.add_argument('--lang=en')
    options.add_argument(f'--user-agent={BOT_USER_AGENT}')

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)

    # タイムアウト設定
    driver.set_page_load_timeout(30)
    driver.implicitly_wait(5)

    return driver
```

---

### 方法2: 共通モジュール使用（より整理）

#### 1. crawler_optimizer.py をインポート

各スクリプトの先頭に追加：

```python
from crawler_optimizer import setup_driver_optimized
```

#### 2. setup_driver() を置き換え

```python
# 削除または コメントアウト
# def setup_driver():
#     ...

# 代わりにこれを使用
def setup_driver():
    return setup_driver_optimized(BOT_USER_AGENT)
```

---

## 🧪 テスト手順

### ステップ1: 動作確認

```bash
cd C:\Users\akayu\Documents\registro500-giappone\py
python crawler_optimizer.py
```

期待される出力：
```
=== クローラー最適化テスト ===

1. 通常モードでテストサイトにアクセス...
   完了: 1.23秒

2. 超高速モードでテストサイトにアクセス...
   完了: 0.87秒

最適化完了！
```

---

### ステップ2: 1ショップでテスト

まず、Axel Gerstlのみ最適化して実行：

```bash
# バックアップ作成
cp axel_full_search.py axel_full_search_backup.py

# 最適化版を適用（後述）
# setup_driver()を置き換え

# TEST_MODE=Trueで動作確認
# axel_full_search.py の45行目を修正:
# TEST_MODE = True

python axel_full_search.py
```

**確認項目**:
- エラーなく実行されるか
- データが正しく取得できているか
- 実行時間が短縮されているか

---

### ステップ3: 全ショップに適用

動作確認後、以下のスクリプトすべてに適用：

- [x] axel_full_search.py
- [ ] parts_search_v2.py
- [ ] dangelo_recon.py
- [ ] euro_search.py
- [ ] passione_recon.py

---

## 📈 効果測定

### 実行時間の記録

| ショップ | 改善前 | 改善後 | 短縮率 |
|---------|-------|-------|-------|
| Axel Gerstl | 24時間 | ? 時間 | ? |
| FD Ricambi | 24時間 | ? 時間 | ? |
| D'Angelo | 24時間 | ? 時間 | ? |
| EuroItalia500 | 24時間 | ? 時間 | ? |
| Passione 500 | 24時間 | ? 時間 | ? |

---

## ⚠️ トラブルシューティング

### Q1: ヘッドレスモードでエラーが出る

**症状**: "unknown error: Chrome failed to start"

**対処**:
```python
# '--headless=new' の代わりに古い方式を試す
options.add_argument('--headless')
```

---

### Q2: 画像が必要な場合

**症状**: 画像URLが取得できない

**対処**:
画像無効化の設定を削除：
```python
# この行を削除またはコメントアウト
# prefs = {'profile.managed_default_content_settings.images': 2}
```

---

### Q3: JavaScriptが動かない

**症状**: ページが正しく表示されない

**対処**:
`setup_driver_ultra_fast()` ではなく `setup_driver_optimized()` を使用してください。

---

## 🎯 次のステップ

### フェーズ2: 並列処理（さらに5倍高速化）

5ショップを並列実行すれば、さらに高速化できます：

**現在**: 5ショップ × 12時間 = 60時間
**並列後**: max(12時間) = 12時間

**実装工数**: 1-2日

---

### フェーズ3: GitHub Actions 自動化

実行時間が6時間以内になれば、GitHub Actionsで無料自動化可能：

- 毎週日曜日 12:00 自動実行
- 完全無料
- 手作業ゼロ

---

**最終更新**: 2026-02-14
