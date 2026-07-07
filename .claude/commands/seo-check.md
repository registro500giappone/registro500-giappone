# 新規/変更ページのSEOチェック

直近変更されたHTMLのSEO項目をチェックし、漏れがあれば修正案を提示する。メモリの `feedback_seo_checklist` も参照する（見つからなければ本ファイルのチェック項目だけで進めてよい）。

**ガードレール（必ず守る）:**
- HTMLの**全文Readは禁止**（1000行超のページが多い・フリーズ予防）。`<head>` 部は `Read` の limit（先頭80行程度）で、それ以外のタグは `Grep` で該当行だけ抽出する。
- 修正は**diff案を提示してユーザーの承認を得てから** Edit する。承認前に書き換えない。
- 日付の判定は**実行時の今日の日付**を使う（過去の日付をハードコードしない）。

## ステップ1: 対象ファイルを特定

優先順位: ①ユーザー指定があればそれ → ②なければ以下で自動特定

- `git diff --name-only HEAD~3 HEAD -- '*.html'` （直近コミットの変更HTML）
- `git status --short` （未コミット変更のHTML）

## ステップ2: 各ファイルのチェック（Grep/部分Readで）

### 必須チェック項目

| 項目 | 合格基準 |
|---|---|
| `<title>` | 具体的なキーワードを含む／内部ニックネーム（「比べ太郎」等）が露出していない／`〜 \| Registro500` 形式 |
| `<meta name="description">` | 存在する／120〜160文字程度／空虚な文言（「お知らせと更新履歴」等）でない |
| `<link rel="canonical">` | `https://www.registro500.com/...` 形式の正規URLが設定されている |
| `<meta name="robots">` | 会員限定・管理ページなら `noindex` がある |

### 会員限定ページの判定（正は robots.txt）

1. まず `robots.txt` の `Disallow` 一覧を確認する（`cat robots.txt`）— **これを判定の正とする**
2. 既知の noindex 必須ページ（参考）: `parts.html`／`parts-guide.html`／`edit.html`・`episode-edit.html` など `-edit.html` 系
3. 会員限定ページは追加で確認: `robots.txt` に `Disallow` があるか／`sitemap.xml` から除外されているか（`grep '<該当URL>' sitemap.xml` がヒット**しない**こと）

### 公開ページの場合

- `sitemap.xml` にエントリがあるか（`grep '<URL>' sitemap.xml`）
- 既存ページ更新時は `<lastmod>` が**今日の日付**に更新されているか
- 動画ページ系は `sitemap-videos.xml` 側も確認する

## ステップ3: レポート（ファイルごとにこの形式で）

- ✅ 問題なし項目（項目名のみ簡潔に）
- ⚠️ 要対応項目（現状の値 → あるべき値、の形で具体的に）

要対応があれば修正diff案を提示し、**ユーザーの承認を得てから** Edit を実行する。承認が得られない項目はスキップとして記録する。
