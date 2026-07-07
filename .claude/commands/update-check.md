# Claude Code 最新機能チェック & 自動設定

Claude Code の新機能を調査し、このプロジェクトに有効な未設定機能があれば提案する。

**ガードレール（必ず守る）:**
- `settings.json` の変更は**提案のみ**。ユーザーが明示的に承認した項目だけを適用する（このプロジェクトは「settings変更はユーザー手動」が原則）。承認前に書き換えない。
- 拒否された提案は無理に再提案せず「見送り」として報告に残す。
- フック（hooks）の自動注入系は過去にトラブル源となった経緯があるため、**提案時に必ずその旨を注記**する。

## ステップ1: 最新情報を調査

1. **第一情報源**: WebFetch で公式 changelog を読む
   `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`
2. 補助: WebSearch（検索語には**実行時点の年**を含める。過去の年をハードコードしない）
   - 例: "Claude Code changelog <今年> new features"
3. 公式ドキュメントも必要に応じて確認する

## ステップ2: 現在の設定を確認

以下を読んで現在の設定状況を把握する：
- `C:/Users/akayu/Documents/registro500-giappone/.claude/settings.json`
- `.claude/agents/` 配下のエージェント定義（4ファイル）
- `.claude/commands/` 配下のスキル定義

## ステップ3: 差分分析

調査結果と現在の設定を比較して、**まだ設定されていない有効な機能**をリストアップする。

このプロジェクトのコンテキスト（提案の判断基準）：
- Fiat 500/126パーツ情報サイト（静的HTML + Supabase DB）
- Cloudflare Pagesでデプロイ（git push → 自動デプロイ）
- MCP: Supabase・GitHub・Playwright を使用（**MCPの追加は慎重に**。過去にツール過多でコンテキスト肥大→軽量化した経緯あり）
- Pythonクローラーで定期的にパーツデータを収集・AI翻訳
- 運営者は非エンジニアのため、自動化・安全装置が特に有効

## ステップ4: 提案 & 設定

有効な機能が見つかった場合、機能ごとに：
1. 何が嬉しいのか日本語で簡潔に説明する（1〜3行）
2. 変更内容のdiff案を提示する
3. **ユーザーの承認を得てから** `settings.json` を更新する

新機能がなければ「現時点で追加できる設定はありません」と報告する。

## ステップ5: 実行日を記録（新機能の有無にかかわらず必須）

本日の日付を以下のファイルに書き込む。これによりSessionStart hookが次回7日後に再発火する：

```
C:/Users/akayu/Documents/registro500-giappone/.claude/last_update_check.txt
```

内容は `YYYY-MM-DD` 形式1行のみ。**このステップを飛ばして終了しない。**
