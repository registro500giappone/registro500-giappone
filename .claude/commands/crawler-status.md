# クローラー実行状況の確認

py/ 配下のクローラー（パーツ収集・AI翻訳）の実行状況と、Supabase 上の最新更新状況を確認して報告する。

**ガードレール（必ず守る）:**
- このスキルは**確認・報告のみ**。クローラーの再実行・停止・コード修正は、ユーザーの明示承認なしに行わない（提案止まり）。
- ログは `tail` で末尾のみ読む。ログファイルの全文Readは禁止（フリーズ予防・CLAUDE.mdの運用規範に従う）。

## ステップ1: 実行中プロセスの確認

- `tasklist //FI "IMAGENAME eq python.exe" //FO CSV 2>&1 | head -20`
- プロセスがあればPID・メモリ使用量を記録。なければ「実行中プロセスなし」と記録して次へ。

## ステップ2: ログファイルの最新状況

- ログは**2箇所**にある。両方の直近更新を確認する：
  - `ls -lht C:/Users/akayu/Documents/registro500-giappone/py/*.log 2>&1 | head -10`（AI翻訳・個別実行系）
  - `ls -lht C:/Users/akayu/Desktop/*.log 2>&1 | head -10`（run_all.py オーケストレータ・並列クローラー系）
- 直近更新の上位2〜3本について末尾のみ確認（例）：
  - `tail -30 C:/Users/akayu/Documents/registro500-giappone/py/temp_ricambio.log`
  - `tail -30 C:/Users/akayu/Documents/registro500-giappone/py/temp_ai_translation.log`

**判定基準（曖昧にせずこの基準で分類する）:**
- ログ末尾に `Traceback` / `ERROR` / `エラー` → **異常終了の疑い**
- Pythonプロセスが存在するのに、対応するログが**10分以上更新されていない** → **ハング疑い**
- 完了メッセージ（「完了」「done」「finished」等）で終わっている → **正常完了**
- それ以外で更新が続いている → **実行中**

## ステップ3: Supabase 上の更新状況

コスト削減のため **db-checker サブエージェント（Haiku）への委譲を第一選択**とする。委譲できない場合のみ直接 `mcp__supabase__execute_sql` を実行。SQLは以下をそのまま使う（改変しない）：

```sql
-- 直近24時間の parts テーブル更新件数
SELECT COUNT(*) AS updated_24h
FROM parts
WHERE updated_at >= NOW() - INTERVAL '24 hours';

-- ショップ別の最新更新（列名は shop_name。shop ではない）
SELECT shop_name, COUNT(*) AS cnt, MAX(updated_at) AS latest
FROM parts
WHERE updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY shop_name
ORDER BY latest DESC;

-- AI翻訳未完（category IS NULL）の残件数
SELECT COUNT(*) AS untranslated FROM parts WHERE category IS NULL;
```

## ステップ4: レポート（この4項目を必ずこの順で）

1. 🟢 実行中プロセス（PID・対応スクリプト名。なければ「なし」）
2. 📊 ショップ別の更新件数・最新時刻（24時間更新ゼロのショップは明示）
3. 🔤 AI翻訳の残件数
4. ⚠️ エラー・ハング・異常停止の検出結果（ステップ2の判定基準で分類した根拠つき）

異常があった場合は「`batch-runner` エージェントで `run_all.py` / `ai_marathon_final_v9.py` を再実行しますか？」と**提案だけ**して、ユーザーの返事を待つ。
