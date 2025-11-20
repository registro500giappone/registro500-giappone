
# 📘 **GitHub README 最適化版（2025-11-20 更新）**

**Registro500 Giappone — クラシック Fiat 500 オーナー向け Web プラットフォーム**

以下は **GitHub の README.md としてそのまま使える最適化フォーマット**です。
今後この種の「プロジェクト概要・アーキテクチャ・ルール文書」を作る時は **すべてこの README 構造で統一**します。

---

# Registro500 Giappone

**クラシック Fiat 500（110D / 110F / 126 系）オーナー向け “完全無料” Web プラットフォーム**

---

## 🎯 プロジェクト目的

クラシック Fiat 500 の個体情報を全国から集約し、
**オーナー自身が登録／編集できて、誰でも閲覧できる**情報サイトを構築する。

* 登録内容：車両基本情報、エンジン、足回り、こだわりポイント、写真、SNS 等（60項目以上）
* 誰でも一覧／詳細閲覧が可能
* 編集は **Google アカウントでログインした本人のみ**（管理者は全車両編集可能）
* **完全無料で長期運用**できるアーキテクチャを採用

---

# 🏁 アーキテクチャ（最適解｜2025-11-20）

この構成は「過去のしがらみ」ではなく、
**ゼロベースで見ても合理的で、最も安定して無料運用が可能**な形です。

---

## 🌐 1. Web サイト本体

### ✔ Apps Script Webアプリ（/exec）を “本体サイト” とする

**Google Sites 埋め込みは使用しない。**

メリット：

* PC/スマホで正しいサイズ表示
* ポップアップ認証問題ゼロ
* タブ増殖なし
* iframe が原因の UI 崩れなし
* 遷移が高速・安定

---

## 🔐 2. ログイン方式

### ✔ Firebase Auth は完全に廃止

Apps Script 標準認証に一本化：

```js
Session.getActiveUser().getEmail()
```

* ログインポップアップなし
* どの端末でも安定
* 二重ログイン解消
* edit.html のコードが大幅に簡素化
* ミス発生率が激減

### 権限仕様

* **オーナー本人**：`OwnerEmail === activeUserEmail` のとき編集可
* **管理者**：`ADMIN_EMAILS = ['あなたのgmail']`
  → 全車両編集可能

---

## 📊 3. データ構成（維持）

### Google Sheets（cars シート）

* 全車両のマスター
* DocumentID（DOC_1, DOC_2…）
* Model_DisplayA/B/C、Engine_Display（表示用）
* OwnerEmail
* PhotoMain ほか写真 URL

### Firebase Storage

* `cars/row_xxx/PhotoMain.jpg`
* 画像の CDN URL は `.firebasestorage.app`

（Firestore の復活は必要な時に追加できる）

---

## 🧩 4. Webアプリ構成（URL ルーティング）

| 画面     | URL                                 | 説明         |
| ------ | ----------------------------------- | ---------- |
| 一覧     | `scriptUrl`                         | デフォルト表示    |
| 詳細     | `scriptUrl?mode=detail&doc=DOC_xxx` | 車両詳細       |
| 編集（既存） | `scriptUrl?mode=edit&doc=DOC_xxx`   | 権限チェック後に編集 |
| 編集（新規） | `scriptUrl?mode=edit`               | 新規登録       |
| ポリシー   | `scriptUrl?mode=policy`             | 利用規約       |
| HowTo  | `scriptUrl?mode=howto`              | 初めての人向け    |

---

## 🔗 5. リンク仕様（再発防止の鉄則）

### ✔ 一覧に戻るリンクは必ずこれ

```html
<a href="<?= scriptUrl ?>">← 一覧に戻る</a>
```

### ✔ policy / howto からの戻りも同じ

```html
<a href="<?= scriptUrl ?>">← 一覧に戻る</a>
```

### ✔ scriptUrl は GAS 側で必ず渡す

```js
template.scriptUrl = ScriptApp.getService().getUrl();
```

### ✔ 外部リンク

```html
<a href="https://..." target="_blank" rel="noopener">...</a>
```

---

# 📁 6. GitHub 運用ルール

```
registro500-giappone/
├── gas/
│   ├── main.gs
│   ├── index.html
│   ├── detail.html
│   ├── edit.html
│   ├── howto.html
│   ├── policy.html
│   └── （必要に応じて同期スクリプト）
├── docs/
│   ├── README.md（← この文書）
│   └── その他仕様書・メモ
```

### 方針

* GAS 側で動くことを確認してから GitHub へ反映
* API キー等の秘匿情報は絶対に保存しない（コメントのみ残す）

---

# 🤝 7. このプロジェクトでの AI 協業ルール

1. **一歩ずつ進める**（勝手に大量のコードを出さない）
2. **不具合は必ず事実ベースで確認**
3. **部分修正ではなく、基本「関数単位」「ファイル単位」差し替え**
4. **UIはスクショで確認してから判断**
5. **プロジェクト目的に基づいて判断（小手先対応しない）**
6. **過去の経緯に影響されず、常に最適解を選ぶ**

---

# 🚀 8. 今後のロードマップ

* edit.html の「Apps Script 版ログイン」で完全再構築
* index/detail/edit のスマホ最適化（再設計済み）
* 画像アップロードまわりの改善（Storage 連携）
* 新規登録フロー（`?mode=edit` の完成）
* HowTo / Policy の整備

---

# ✨ Conclusion

この README によって、
**プロジェクトの全貌・アーキテクチャ・リンクルール・運用ルールが一つに統一されました。**

今後はこれを基準に **必ず最適解から迷わず進められる体制**になります。

