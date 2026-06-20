# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

今後はすべての説明、プラン、会話を日本語で行ってください。

---

## MCPサーバー構成

このプロジェクトでは以下のMCPサーバーを利用可能（`C:\Users\akayu\.claude.json` で管理）：

| MCPサーバー | 用途 | 認証 |
|------------|------|------|
| `supabase` | DB直接クエリ・テーブル確認 | SUPABASE_ACCESS_TOKEN |
| `github` | PR作成・コミット・Issue管理 | GITHUB_PERSONAL_ACCESS_TOKEN |
| `playwright` | ブラウザ自動操作・サイト確認 | 不要 |

> ⚠️ `.mcp.json`（プロジェクトルート）はgitignore済み。トークンが入っているため**絶対にgit addしない**。

---

## サブエージェント活用ガイド

Claude Code の Task ツールを活用した自動化パターン：

### よく使うタスクパターン

#### DBデータ確認（Supabase MCP使用）
```
「partsテーブルのPassione 500のデータ件数を確認して」
「Supabaseのcarsテーブルで car_type='126' のレコード数を教えて」
```

#### クローラー実行（Bash エージェント）
```
「py/run_all.py を実行してパーツデータを更新して」
「py/ai_marathon_final_v9.py を実行してAI翻訳を実行して」
```

#### デプロイ（git push → Cloudflare Pages 自動デプロイ）
```
「変更をコミットしてGitHubにプッシュして」
→ Cloudflare Pages が自動的にデプロイを行う（main ブランチへのプッシュで自動デプロイ）
```

#### サイト確認（Playwright MCP使用）
```
「本番サイト https://www.registro500.com/parts.html の表示を確認して」
「126サイト /126/ のページが正しく表示されているか確認して」
```

---

## コスト最適化方針

### 専用サブエージェント（`.claude/agents/`）
軽量タスクは専用エージェントに委譲してトークン消費を削減：

| エージェント | 用途 | モデル |
|-------------|------|-------|
| `batch-runner` | クローラー・AI翻訳実行 | haiku |
| `db-checker` | DB件数確認・統計クエリ | haiku |
| `git-ops` | コミット・プッシュ | haiku |

呼び出し方: 「batch-runnerエージェントでrun_all.pyを実行して」

### Taskツール直接呼び出し
```
model: "haiku"  // 軽量タスクはこれを指定
```

| タスク | 使うモデル |
|--------|-----------|
| DB件数確認・単純検索 | `haiku` |
| ファイル調査・コードベース探索 | `haiku` |
| コーディング・バグ修正・設計 | `sonnet`（メイン） |

---

## プロジェクト固有のコマンド

```bash
# クローラー実行（py/ディレクトリから）
python run_all.py              # 全ショップ並列実行 + AI翻訳
python ai_marathon_final_v9.py # AI翻訳のみ（category IS NULL を対象）

# Git操作
git status                     # 変更確認
git add -p                     # 変更を選択的にステージング
git commit -m "メッセージ"      # コミット
git push origin main           # Cloudflare Pages 自動デプロイがトリガーされる
```

---

## 重要なファイル・パス

- `MEMORY.md` → プロジェクト全体のナレッジベース（自動読み込み）
- `.mcp.json` → MCPサーバー設定（**gitignore済み・ローカルのみ**、トークンが含まれるためgit管理外）
- `.mcp.json.example` → トークンなしのテンプレート（gitに含む）
- `py/` → クローラースクリプト群（**GitHub Actions用にgit管理対象**、`*.py` / `*.md` はコミット必須。ログ・CSV・機密ファイルは `py/.gitignore` で除外）
- `126/index.html` → Fiat 126姉妹サイトのトップページ
- `.claude/agents/` → 専用サブエージェント定義（Haikuモデル）

---

## 残ミッションの俯瞰について（重要）

「残ミッションを確認したい」「残タスクは？」と聞かれた場合は、**特定の作業の途中経過だけでなく、進行中の全テーマを横断して俯瞰し、各テーマごとに残タスクを列挙する**こと。

俯瞰の素材は `MEMORY.md` の「## 進行中テーマ一覧 / 残ミッション」セクションを参照する。回答は以下の粒度で行う：

- テーマ名（例：パーツクローラー、126サイト、AI翻訳、デプロイ周りなど）ごとに見出しを立てる
- 各テーマの「現在の状態」と「次にやる残タスク」を1〜数行で示す
- 完了済みは省略してよいが、進行中テーマを取りこぼさないこと

狭い範囲の途中作業だけを答えて終わらせない。

### この台帳を「壊さない」ための保全ルール（重要）

過去に「残ミッションを俯瞰して答えられなくなる」事象が起きた。原因は俯瞰の素材（`MEMORY.md` の「進行中テーマ一覧 / 残ミッション」セクション）が欠落し、情報が各 `project_*.md` に分散していたこと。再発防止のため以下を厳守する：

- **俯瞰セクションが欠落・空になっていたら、各 `project_*.md` から再構築してから回答する**こと。「セクションが無いので答えられない」で済ませない。
- メモリディレクトリ（`C:\Users\akayu\.claude\projects\C--Users-akayu-Documents-registro500-giappone\memory\`）は**ローカルgit管理下**（2026-06-20初期化）。台帳を編集したら `git -C "<memoryパス>" add -A && git -C "<memoryパス>" commit -m "..."` でこまめにスナップショットを残す。壊しても `git -C "<memoryパス>" checkout` / reflog で復元できる。
- 台帳系ファイルは**全文上書き（Write）を避け、部分Editか日付付き追記で更新**する。過去の経緯（いつ・何を決めたか）を物理的に消さない。
- 数値・状態の「最新化」は上書きでなく `【YYYY-MM-DD 更新】` 形式の追記を優先する。

---

## コンテキスト圧縮ヒント（/compact 実行時に優先保持）

コンテキストが圧縮される場合、以下を優先して保持してください：
- **進行中の全テーマ一覧と、各テーマの残タスク（`MEMORY.md` の「進行中テーマ一覧 / 残ミッション」セクション）** ← 最優先
- パーツクローラーの9ショップ構成（py/README.md参照）
- Supabaseのparts/cars/eventsテーブルスキーマ
- 現在進行中のクローラー状態と残タスク

削除してよいもの：
- クローラーの詳細ログ出力
- wmicプロセスリスト全体
- 完了済みタスクの詳細（※ただし「どのテーマが完了したか」の一行サマリは残す）