# refactor-proposals.md — 将来リファクタリング提案（実装していない）

作成日: 2026-06-11（2026-06リファクタリング Phase 5 成果物）

本ドキュメントは **提案のみ** であり、コードは一切変更していない。
実装する場合は別プロジェクトとして計画し、`docs/refactor-baseline.md` の保全リストと照合すること。

---

## P1. フロントエンド共通モジュール化（旧D9）

### 現状の証拠
- `createClient`（supabase-js初期化）を含むHTMLが **19ファイル**: detail / edit / episode-edit / episode / event / garage-notes / goods / index / indexsub / mappa / news / parts-guide / parts-shops / parts / report20260215 / spot_schedule / stats / stories / 126/index。
- ヘッダー・ナビ・認証チェック・escapeHtml 等も各ページにインラインコピー。
- 過去の「owner_user_id紐づけ」処理が index.html と edit.html に重複（`index.html:887` / `edit.html:572` 付近）。

### なぜ今やらなかったか
ビルドシステムがなく、Service Worker＋PWAキャッシュとの相互作用があるため、全ページ一斉変更は回帰リスクが極めて高い。自動テストが存在しない状態での一斉改修は事故になる。

### 段階的移行案
1. `common.js` を新設（**Supabase初期化＋認証ヘルパーのみ**。UIは含めない）。`config.js` のグローバル定数名は変更しない。
2. トラフィックの少ないページ1枚（例: stats.html）から `<script src="common.js">` 化し、本番で1〜2週間観察。
3. 問題なければ1ページずつ移行（1ページ=1コミット=1デプロイ）。sw.js のキャッシュ対象に common.js が含まれるかを毎回確認。
4. 全ページ完了後にインライン重複を削除。

---

## P2. GAS main.gs の責務分割（旧D10）

### 現状の証拠
`main.gs`（1504行）に doGet/doPost ルーティング・イベントCRUD・Brevo配信（sendDailyDigest）・X投稿・スプレッドシートメニューが同居。

### なぜ今やらなかったか
GASはファイル分割してもグローバルスコープを共有するため実害が小さい一方、配信系は過去にサイレント障害（2026-04-29不達インシデント）を起こした繊細な領域。動いているものを触る理由が弱い。

### 分割案（実施するなら）
- `api.gs`: doGet/doPost ルーティング＋イベントCRUD＋問い合わせ
- `digest.gs`: sendDailyDigest・Brevo連携・X投稿
- `admin.gs`: スプレッドシートメニュー
- 分割は clasp push 単位で一括反映されるため、push前に必ず全関数名の重複チェックと、push直後の手動 sendDailyDigest テスト（テスト用リストへ）を行う。

---

## P3. セキュリティ境界の既知問題（旧D11・認識済み・コード変更禁止）

1. cars テーブルの `owner_email` が匿名selectで取得可能（既知・未是正）。是正は owner_user_id 移行という中規模改修であり、雑なREVOKEは本番停止を招くと判明済み。
2. spot系RLSがクライアント設定可能な `x-owner-document-id` ヘッダーに依存。
3. 管理者判定が `ADMIN_EMAIL` のクライアントサイド比較。

いずれも修正は挙動変更・スキーマ変更を伴うプロダクト判断案件。リファクタリングの「ついで」に触らないこと。

---

## P4. クローラー共通化の残り（D2の続き・実地検証待ち）

`crawler_common.py` 新設と `dangelo_recon.py` の移行は実施済み（2026-06-11）。
**dangelo の workflow_dispatch 実地検証が成功するまで、2本目以降は移行しない。**

成功後の推奨順序（構造が単純な順）:
1. `euro_search.py`・`passione_recon.py`（dangelo類似のAPI型。ただし passione の `detect_target_cars` は正規表現が異なる＝`500` に語境界なし。**統一せず差異を保持**すること）
2. `autobella_crawler.py`・`ricambio_crawler.py`・`mrfiat_crawler.py`・`500line_crawler.py`（短形式UA `BOT_USER_AGENT_SHORT` を使用）
3. `axel_full_search.py`・`parts_search_v2.py`（Selenium型・最後）

各移行は1本=1コミットとし、py_compile＋diff目視＋workflow_dispatch実地検証（取得件数が前回と同水準）をもって完了とする。

---

## P5. その他の報告事項

### main.js（ルート直下・git管理外）— 人間がローカルで削除推奨
`main.js`（約1400行）は `main.gs` の旧版コピー（anonキー時代）。`.gitignore` 登録済みでgit管理外・HTMLから未参照。紛らわしいため**人間がローカルで削除することを推奨**（実装担当はユーザーローカルファイルに触れない方針のため未削除）。

### 【要回答】D3/D4（spots_api.gs / spots_api.js の削除）は前提矛盾のため未実施
§5.1-2 で削除承認済みだったが、実行前の再確認で承認根拠の一部が崩れていたため §5.2-5 に従い**削除を見送り、質問とする**。

- 崩れた前提: 「spot_schedule.html は Supabase 直アクセスに移行済みで GAS経由のspot呼び出しはフロントに存在せず」→ 実際には spot_schedule.html が今も GAS に `mode=schedules` / `mode=spots` / `mode=my_favorites` を fetch している。
- ただし削除の安全性自体は成立している: (1) main.gs（リポジトリ版・デプロイ版とも）は spot系mode をルーティングしておらず、本番GASが「Unknown mode」を返すことをライブ確認済み＝spots_api.gs の関数群は本番でも到達不能、(2) spots_api.gs は未定義の `SUPABASE_ANON_KEY` を参照（main.gs内に定義0件）、(3) `.js` 版は `.gs` 版と完全同一（diff IDENTICAL）でHTML未参照、(4) clasp push しない限りデプロイ済みGASに影響なし。
- **質問**: この状況を踏まえ、spots_api.gs / spots_api.js を削除してよいか？（削除しても実挙動は変わらないが、spot_schedule.html の扱い〔下記〕とセットで判断するのが自然）

### spot_schedule.html が壊れている（既存事象・今回のリファクタリングとは無関係）
- spot_schedule.html は GAS に `mode=schedules` / `mode=spots` / `mode=my_favorites` を fetch しているが、`main.gs` の doGet は index / detail / edit_init / events / mycars しかルーティングしておらず、「読み込みエラー: Error: Unknown mode」が表示される（ローカル検証で確認）。
- どのページからもリンクされていない孤児ページ（spot.js 内の一致は Supabase の `spot_schedules` テーブル名であり、ページへのリンクではない）。
- 対応案: (a) ページ削除（過去ニュースメールからの直リンク有無の確認が必要）、(b) spot.html 同様の Supabase 直アクセスに改修、(c) 放置。**プロダクト判断が必要**。

### .claude/agents/batch-runner.md の古い参照 — 人間が更新推奨
`py/run_parallel.py`・`py/orchestrator.py`（いずれも `py/archive/` へ移動済み）を担当タスクとして記載している。編集権限が拒否されたため未修正。「全8ショップ」の記載も実際は9ショップ。

### CLAUDE.md の古い記述 — 人間が更新推奨
コンテキスト圧縮ヒントの「orchestrator.pyの完了状況」は archive 移動済みのため不要。
