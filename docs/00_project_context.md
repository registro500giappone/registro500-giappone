# Registro500 Giappone（プロジェクト概要）

## 🎯 プロジェクト目的

クラシック Fiat 500（特に110D/110F/126系）オーナーのための
情報登録・公開プラットフォームを構築する。

- 全国の個体情報を一元管理し、オーナーやオーナー候補が知識を共有できる場を目指す。
- 登録内容：年式・モデル・ハンドルネーム・都道府県・写真・改造情報など（約60項目想定）
- 一般閲覧者はリスト／詳細ページを閲覧可、登録や編集はログインユーザーのみ。
- 重要：**すべてを無料サービス（Firebase＋Google Sheets＋Sites＋GAS）で構築**

## ⚙️ 現在の構成

- Google Sheets：cars シートをマスターとし、Firebaseデータと同期
- Apps Script：main.gs / index.html / detail.html
- Google Sites：HTML埋め込みにより一覧・詳細を公開
- Firebase：画像・メタデータを保存（Storage + Firestore）

## 🔁 今後の連携計画
- Firestore ⇄ Sheets 同期スクリプト（GAS）
- Google Sites 公開
- オーナー用UI開発

## 💾 管理方針（GitHub運用ルール）
- `gas/`：Apps Script のコードを保管（main.gs, index.html など）
- `docs/`：要件定義や引継ぎメモを保管
- 修正版コードは、動作確認後に手動でGitHubに反映
- Secrets情報（APIキー等）は**絶対にアップロードしない**
