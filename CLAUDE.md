# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

今後はすべての説明、プラン、会話を日本語で行ってください。

---

## MCPサーバー構成

このプロジェクトでは以下のMCPサーバーを利用可能（.mcp.json で管理）：

| MCPサーバー | 用途 | 認証 |
|------------|------|------|
| `supabase` | DB直接クエリ・テーブル確認 | SUPABASE_ACCESS_TOKEN |
| `github` | PR作成・コミット・Issue管理 | GITHUB_TOKEN |
| `playwright` | ブラウザ自動操作・サイト確認 | 不要 |

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

#### デプロイ（git push → Vercel 自動デプロイ）
```
「変更をコミットしてGitHubにプッシュして」
→ Vercel が自動的にデプロイを行う（main ブランチへのプッシュで自動デプロイ）
```

#### サイト確認（Playwright MCP使用）
```
「本番サイト https://www.registro500.com/parts.html の表示を確認して」
「126サイト /126/ のページが正しく表示されているか確認して」
```

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
git push origin main           # Vercel自動デプロイがトリガーされる
```

---

## 重要なファイル・パス

- `MEMORY.md` → プロジェクト全体のナレッジベース（自動読み込み）
- `.mcp.json` → MCPサーバー設定（**gitignore済み・ローカルのみ**、トークンが含まれるためgit管理外）
- `.mcp.json.example` → トークンなしのテンプレート（gitに含む）
- `py/` → クローラースクリプト群（ローカルのみ、git未管理）
- `126/index.html` → Fiat 126姉妹サイトのトップページ
