# Registro500 Giappone
**日本のクラシック FIAT 500 オーナーのためのオンライン・コミュニティ・プラットフォーム**

「めざせ500台！」を合言葉に、日本国内のチンクエチェント（Nuova 500）のオーナー情報を集約し、愛車の維持とオーナー同士の交流をサポートするサービスです。

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
6. **Parts Price Comparison (パーツ価格比較 - 開発中)**  
   国内外の主要ショップからパーツ価格データを収集・比較し、維持コストの最適化を支援。

---

## 🏗 システム構造 (Architecture)
2026年1月、サービス規模の拡大に伴い、基盤を Google Sheets から **Supabase** へ移行しました。

### フロントエンド (Frontend)
- **言語/フレームワーク**: HTML5, CSS3 (Bootstrap), Vanilla JavaScript
- **ホスティング**: Vercel
- **データ可視化**: D3.js (Mappa), Chart.js (Statistics)

### バックエンド (Backend / Managed Services)
- **Database**: **Supabase (PostgreSQL)**
  - 車両・イベント・参加者・お知らせ・パーツデータのマスター管理。
  - PostgreSQLトリガーにより、ID（DOC_xxx）の自動発番や計算項目の自動生成を実装。
- **Authentication**: Firebase Auth (Google Login)
- **Storage**: Firebase Storage (車両・イベント写真の保存)

### 外部連携・自動化 (External Integration)
- **Go
