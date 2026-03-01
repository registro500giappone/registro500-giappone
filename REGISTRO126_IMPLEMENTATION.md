# Registro126 実装ドキュメント

**最終更新**: 2026-02-18
**ステータス**: Phase 1-3 完了、Phase 4 準備中

---

## 📌 プロジェクト概要

### 目的
Fiat 126 専用の姉妹サイト「Registro126」を構築し、Fiat 500 オーナーと同様のサービスを Fiat 126 オーナーにも提供する。

### 基本方針
- **同一リポジトリ**: registro500-giappone リポジトリ内に 126 ディレクトリを作成
- **同一 Supabase**: データベースに `car_type` 列を追加して 500/126 を区別
- **入り口分離**: `index.html` は 500/126 で分離、他のページは共通化
- **ブランドカラー**: #D4541A（実車写真から採用）

---

## ✅ Phase 1: データベース拡張（完了）

### 実施日: 2026-02-17
### コミット: `082f31c`

### 実装内容

#### 1. cars テーブル
```sql
ALTER TABLE public.cars
ADD COLUMN car_type VARCHAR(10) DEFAULT '500' NOT NULL;

ALTER TABLE public.cars
ADD CONSTRAINT check_car_type CHECK (car_type IN ('500', '126'));

CREATE INDEX idx_cars_car_type ON public.cars(car_type);
```

**確認済み**: ✅ Supabase で car_type 列存在確認（2026-02-18）

#### 2. events テーブル
```sql
ALTER TABLE public.events
ADD COLUMN target_car_type VARCHAR(20) DEFAULT 'both' NOT NULL;

ALTER TABLE public.events
ADD CONSTRAINT check_target_car_type CHECK (target_car_type IN ('both', '500', '126'));
```

- `both`: 500/126 共通イベント
- `500`: 500 専用イベント
- `126`: 126 専用イベント

#### 3. news テーブル
```sql
ALTER TABLE public.news
ADD COLUMN target_car_type VARCHAR(20) DEFAULT 'both' NOT NULL;
```

同様に `both`, `500`, `126` で区別。

### マイグレーションファイル
- `126_migration.sql`（リポジトリに保存済み）

---

## ✅ Phase 2: 126/index.html 作成（完了）

### 実施日: 2026-02-17
### ファイル: `126/index.html`

### 実装内容
- ブランドカラー: `#D4541A`
- ロゴ: `logo_horizontal126.png` / `logo_vertical126.png`
- Supabase クエリに `.eq('car_type', '126')` フィルタ追加
- 500 サイトへのリンク追加
- レスポンシブ対応

### URL構成（予定）
- **500 サイト**: https://www.registro500.com/
- **126 サイト**: https://www.registro500.com/126/

---

## ✅ Phase 3: edit.html 改修（完了）

### 実施日: 2026-02-17

### 実装内容

#### 車両タイプ選択
```html
<input type="radio" name="car_type" value="500" checked> Fiat 500
<input type="radio" name="car_type" value="126"> Fiat 126
```

#### 126 車種リスト（16種類）
1. Fiat 126 (594cc)
2. Fiat 126 (650cc)
3. Fiat 126E
4. Fiat 126 DeLuxe
5. Fiat 126 Personal
6. Fiat 126 Personal 4
7. Polski Fiat 126p
8. Polski Fiat 126p FL
9. Polski Fiat 126 BIS
10. Polski Fiat 126 EL
11. Polski Fiat 126 ELX
12. Polski Fiat Maluch
13. Fiat 126 Cabriolet
14. Steyr-Puch 126
15. Nikki 126
16. その他

#### 動的フィルタリング
車両タイプ切り替え時に、対応する車種リストのみを表示。

---

## ✅ Phase 4: parts.html の 126 対応（完了）

### 完了済み
- ✅ 車種フィルターに「126 (All)」チェックボックス追加（L909）
- ✅ AI翻訳で target_cars に「Fiat 126」を正しく抽出（2026-02-18確認）
- ✅ ショップ名の表記ゆれ修正（Euro Italia 500 → EuroItalia500）

### 検証結果（2026-02-18 最終版）

#### 126対応パーツ件数（ショップ別）

| ショップ | 126対応件数 |
|---------|------------|
| Axel Gerstl | 1,877件 |
| Ricambio | 1,555件 |
| EuroItalia500 | 1,137件 |
| AutoBella Parts | 468件 |
| FD Ricambi | 418件 |
| D'Angelo Motori | 327件 |
| Mr Fiat | 100件 |
| **Passione 500** | **69件** ✅ |

**合計**: 5,951件

#### 600対応パーツ件数（ショップ別）

| ショップ | 600対応件数 |
|---------|------------|
| Axel Gerstl | 867件 |
| Ricambio | 854件 |
| EuroItalia500 | 548件 |
| FD Ricambi | 462件 |
| AutoBella Parts | 235件 |
| Mr Fiat | 220件 |
| Passione 500 | 28件 |
| D'Angelo Motori | 23件 |

**合計**: 3,237件

#### 検証SQL
```sql
-- 126 を含むパーツの件数（ショップ別）
SELECT shop_name, COUNT(*) as count_126
FROM parts
WHERE target_cars ILIKE '%126%'
GROUP BY shop_name
ORDER BY count_126 DESC;
```

**実行日**: 2026-02-18
**結果**: ✅ AI翻訳が正常に動作、8ショップ中7ショップで126対応パーツを確認

---

## 🔄 Phase 5: その他ページの対応（未実施）

### 対応予定のページ
- [ ] event.html: target_car_type でフィルタリング
- [ ] stats.html: car_type 別の統計表示
- [ ] mappa.html: car_type 別のマップ表示
- [ ] detail.html: 126 車両の詳細表示対応

### 対応方針
- URL パラメータまたはローカルストレージで car_type を判定
- クエリに `.eq('car_type', '126')` または `.in('target_car_type', ['both', '126'])` を追加

---

## 🌐 デプロイ状況

### 確認が必要
- [ ] 126/index.html が本番環境にデプロイされているか
  - URL: https://www.registro500.com/126/
- [ ] Vercel の設定で 126/ ディレクトリがルーティングされているか

### 確認方法
ブラウザで https://www.registro500.com/126/ にアクセス

---

## 📊 データ状況

### 既存データ
- **cars テーブル**: 既存データはすべて `car_type='500'`（マイグレーション時のデフォルト値）
- **126 車両データ**: まだ登録されていない可能性が高い

### parts テーブル
- **target_cars**: AI翻訳で「Fiat 126」が正しく抽出されているか検証中
- **現在進行中**: Axel Gerstl の 4,739件を AI翻訳で再処理中

---

## 🎯 次のアクション

### 優先度 🔴 高
1. ✅ **AI翻訳完了**（2026-02-18完了）
2. ✅ **126 パーツデータの検証**（2026-02-18完了）
3. **parts.html の8ショップ対応をデプロイ**
   - 変更ファイル: config.js, parts.html, parts-guide.html, parts.js
   - git commit & push

### 優先度 🟡 中
4. **126/index.html のデプロイ確認**
   - URL: https://www.registro500.com/126/ が表示されるか確認
5. **event.html/stats.html の 126 対応**

### 優先度 🟢 低
6. **126 専用ドメイン検討**（registro126.com の取得など）
7. **マーケティング・集客施策**

---

## 🔧 技術仕様

### アーキテクチャ
- **リポジトリ**: 単一リポジトリ（registro500-giappone）
- **データベース**: 単一 Supabase（car_type 列で区別）
- **ホスティング**: Vercel（単一プロジェクト）

### ディレクトリ構成
```
registro500-giappone/
├── index.html          # 500 専用
├── 126/
│   └── index.html      # 126 専用
├── parts.html          # 共通
├── event.html          # 共通（car_type でフィルタ）
├── edit.html           # 共通（car_type 選択可）
└── ...
```

### データベーススキーマ
```
cars:
  - car_type: '500' | '126'

events:
  - target_car_type: 'both' | '500' | '126'

news:
  - target_car_type: 'both' | '500' | '126'

parts:
  - target_cars: "Fiat 500 N/D/F/L/R, Fiat 126, Fiat 600" （テキスト）
```

---

## 💡 設計判断の理由

### なぜ同一リポジトリ？
- コード重複を避ける
- 共通機能（parts.html など）を共有
- デプロイ・メンテナンスが容易

### なぜ同一 Supabase？
- インフラコストの削減
- データ管理の一元化
- 500/126 間でのデータ連携が容易（将来的に統計比較など）

### なぜ car_type 列を追加？
- 500/126 のデータを明確に区別
- クエリで簡単にフィルタリング可能
- 将来的に 600 なども追加可能

---

## 📚 関連ドキュメント
- `126_migration.sql`: データベースマイグレーション
- `MEMORY.md`: プロジェクト全体のメモ
- `PARTS_OPTIMIZATION_PLAN.md`: パーツ機能の最適化計画

---

## ✍️ 更新履歴
- 2026-02-18: ドキュメント作成、Phase 1-3 完了を記録
- 2026-02-17: Phase 1-3 実装完了（コミット 082f31c）
