# refactor-instructions.md — Registro500 Giappone リファクタリング指示書

作成日: 2026-06-11 ／ 作成者: 分析担当モデル（Claude）
最終更新: 2026-06-11 — オーナーが事前質問5件を全件承認（§5.1に反映済み）。本指示書は単独で完遂可能。
対象リポジトリ: `C:\Users\akayu\Documents\registro500-giappone`（git管理・mainブランチ）

---

## 1. Objective（目的）

既存の挙動・公開URL・データを一切壊さずに、以下を達成する。

1. `py/` に堆積した旧世代スクリプト（死コード）を整理し、「いま動いているもの」が一目で分かる状態にする
2. クローラー9本に重複しているボイラープレート（env読込・Supabaseクライアント生成・upsert・リトライ）を共通モジュールに抽出する
3. ドキュメント（README等）の記述を現実のアーキテクチャに一致させる
4. 明確に壊れている・誤解を招く小さな箇所を修正する

**見た目の綺麗さは目的ではない。** 「次に変更する人が安全に変更できる状態」が目的である。
大規模な再設計（フロントエンドの共通化、GAS分割、スキーマ変更）は本指示書のスコープ外であり、提案までに留めること。

---

## 2. Project Understanding（プロジェクト理解）

### 2.1 何のサービスか

日本のクラシック Fiat 500 / 126 オーナー向けコミュニティプラットフォーム。
車両名鑑（Online Garage）・オーナーズマップ・統計・イベント掲示板・オーナー間連絡・パーツ価格比較（欧米9ショップ）・ニュース配信・グッズ紹介を提供。本番URLは `https://www.registro500.com/`（姉妹サイト `/126/`）。

### 2.2 アーキテクチャ（4層・ビルドシステムなし）

| 層 | 実体 | 備考 |
|---|---|---|
| **フロントエンド** | ルート直下の静的HTML 約25ページ＋`config.js`＋`parts.js`＋`spot.js`＋`sw.js` | Vanilla JS。各ページがインラインJSで supabase-js を初期化し Supabase に直接読み書き。npm/バンドラ/トランスパイラは**存在しない** |
| **DB** | Supabase (PostgreSQL) | cars / parts / events / news / spots系 / weekly_metrics 等。トリガーでID自動発番（DOC_xxx, SPOT_xxx…）。RLSあり |
| **GAS** | `main.gs`（1504行）＋`spots_api.gs`＋`appsscript.json` | clasp（`.clasp.json`/`.claspignore`）でpush。Web API（events・問い合わせ・mycars）＋日次ニュース配信（Brevo）＋X投稿＋管理メニューが**1ファイルに同居** |
| **バッチ** | `py/` クローラー9本＋AI翻訳 | GitHub Actions（`.github/workflows/`）で定期実行し、partsテーブルへ直接upsert |

- **ホスティング**: Cloudflare Pages（mainへのpushで自動デプロイ）。Vercelはバックアップ。READMEの「Vercel」記載は古い。
- **認証**: Firebase Auth（Googleログイン）。写真は Firebase Storage。
- **デプロイ時処理**: `build.sh` が `sw.js` 内の `__BUILD_VERSION__` をコミットSHAに置換（Service Workerのバージョン管理）。
- **キャッシュ**: `_headers` で HTML/JS/CSS/manifest/sw.js を全て no-cache 指定。`sw.js` がオフライン用キャッシュを担当。

### 2.3 データフロー

```
[欧米9ショップ] --(GitHub Actions: py/クローラー)--> [Supabase parts] --(py/ai_marathon_final_v9.py: Gemini翻訳)--> name_ja/category 充足
[ブラウザ] --(supabase-js + anon key)--> [Supabase cars/parts/news/spots...]  ※書込はRLSで制御
[ブラウザ] --(fetch API_URL)--> [GAS main.gs] --(service_role key)--> [Supabase] / [Brevo] / [Sheets]
[GAS 時間トリガー] --> sendDailyDigest() --> Brevoでニュースメール配信
```

### 2.4 アクティブな実行スクリプト（GitHub Actionsが呼ぶもの＝正本）

`.github/workflows/*.yml` が参照するのは以下の**10本だけ**。これが「生きているコード」の証拠である。

- `py/axel_full_search.py`（Axel Gerstl・週1）
- `py/parts_search_v2.py`（FD Ricambi・手動のみ。Actions IPがブロックされるため）
- `py/dangelo_recon.py`（D'Angelo Motori・週2）
- `py/euro_search.py`（EuroItalia500・週3）
- `py/passione_recon.py`（Passione 500・週2）
- `py/autobella_crawler.py`・`py/ricambio_crawler.py`・`py/mrfiat_crawler.py`（毎日 daily-parts-update.yml）
- `py/ai_marathon_final_v9.py`（AI翻訳・各クロール後）
- ローカル手動実行用: `py/run_all.py`（9本並列＋翻訳。`py/500line_crawler.py` を含む）

その他にローカル運用で使われる現役ユーティリティ: `py/gen_report.py`（成長レポート・2026-06実装直後）、`py/brevo_stats.py`、`py/license_plate_masking.py`。

### 2.5 検証手段の現状

**テスト・lint・型チェックは一切存在しない。** `package.json` もない。検証は以下に限られる:

- `python -m py_compile <file>` による構文チェック
- ローカルHTTPサーバー（`python -m http.server 8765`）でのページ表示確認（`file://` 不可）
- クローラーは GitHub Actions の `workflow_dispatch` 手動実行で実地検証
- git diff の目視レビュー

---

## 3. Behaviors To Preserve（絶対に壊してはいけない既存挙動）

1. **公開URL**: 全HTMLのファイル名・パスは変更禁止。ニュースメール・SNS・サイトマップ・外部リンクから直接参照されている。
2. **`config.js` のグローバル定数名**: `API_URL` / `NO_IMAGE_URL` / `LOGO_URL` / `FIREBASE_CONFIG` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `ADMIN_EMAIL` / `CONFIG`。全ページがこの名前に依存している。値・名前とも変更禁止。
3. **`sw.js` の `__BUILD_VERSION__` プレースホルダ**: `build.sh` が置換する契約。文字列を変えるとSW更新検知が壊れる。
4. **partsテーブルへの upsert 規約**: `on_conflict="product_no"`。各クローラーが出力するレコードのキー構成（shop_name, product_no, oem_no, name_en, price_euro, stock_status, image_url, page_url, target_cars）。AI翻訳は `category IS NULL` のレコードを対象とする前提。
5. **GAS API の呼び出し契約**: `doGet` の mode（index / detail / edit_init / events / mycars）、`doPost` の action（inquiry / save_event / delete_event / toggle_participation）と各レスポンス形式。フロントの複数ページが依存。
6. **DBスキーマ・トリガー・RLSポリシー**: 一切変更しない。
7. **GitHub Actions のスケジュールと依存関係**（daily-parts-update.yml のジョブ依存含む）。
8. **クローラーのリトライ挙動**: 特に `dangelo_recon.py` の外部リトライ（待機 3,5,5,10分＝合計23分の猶予）。これは「Store APIが202を9分以上返す」実地障害への対策として意図的に設計されたもの（運用知見あり）。短縮・簡略化してはならない。
9. **クローラーの対サーバー礼節**: `BOT_USER_AGENT`（Registro500Bot/1.0…）とページ間 `time.sleep` を維持。リクエスト頻度を上げない。
10. **`_headers` のキャッシュ指定**と PWA（manifest.json・icon類）。
11. **126サイト**（`126/index.html`）は `../config.js` を相対参照している。config.jsの移動禁止。

---

## 4. Non-Negotiables（交渉不可の制約）

- 作業開始時に最初に `git status` を確認し、結果を記録する。
- **既存の未コミット変更と自分の変更を混ぜない。** 現在 `py/dangelo_recon.py` に未コミットのコメント変更（1行）が存在する（→ Stop-and-Ask 参照）。
- `.mcp.json` / `py/.env` / 各種トークン・APIキーを**絶対にgit addしない**。`.gitignore` を緩める変更をしない。
- 編集前に各フェーズのbaseline検証結果（§6）を記録する。
- 変更は小さく戻しやすい単位（1関心事=1コミット）。クローラーの共通化は**1ファイルずつ**。
- 無関係な整形・命名変更・「ついで」のリファクタリングをしない。HTMLのインデント整形等は差分レビューを不可能にするので厳禁。
- 既存挙動を勝手に変えない。挙動が変わる可能性のある変更は事前に質問する。
- 正しさがコードから判断できない場合は実装を止めて質問する。
- 証拠なく大きな削除・全面書き換えをしない。削除候補は必ず「被参照ゼロの証拠（grep結果・workflow参照なし）」を提示してから。
- コミットしてもよいが、**`git push` は人間の明示的な承認があるまで実行しない**（pushはCloudflare Pagesの本番デプロイを直接トリガーするため）。
- ユーザーとのやり取りはすべて日本語。

---

## 5. Stop And Ask Conditions（実装を止めて質問する条件）

### 5.1 承認済み事項（2026-06-11 オーナー回答済み・再質問不要）

以下の4点は**人間の承認を取得済み**。指示書どおりに実装してよい。

1. **`py/dangelo_recon.py` の未コミット変更（コメント `# = 3`）は誤りであり、破棄が承認された。** Phase 0 で `git checkout -- py/dangelo_recon.py` により破棄すること（正: `len([3,5,5,10]) + 1 = 5`、コミット済みの `# = 5` が正しい）。
2. **GAS spot API は廃止済み。`spots_api.gs`・`spots_api.js`（完全に同一内容）の両方をリポジトリから削除してよい。** 根拠: `spot.js`・`spot_schedule.html` は Supabase 直アクセスに移行済みでGAS経由のspot呼び出しはフロントに存在せず、`spots_api.gs` は `main.gs` に定義のない `SUPABASE_ANON_KEY` を参照しており呼ばれれば ReferenceError になる状態だった。**注意: 削除後に clasp push はしない**（GASプロジェクト側の整理は人間が行う）。
3. **未参照の大容量画像（`100dai1.png`・`100dai2.png`・`logo_horizontal100.png`・`logo_horizontal101.png`・`logo_horizontal2026.png`・`logo_vertical2026.png`・`map.png`）の `git rm` が承認された。** 参照されている `logo_horizontal.png`・`logo_vertical.png`・icon類・126系ロゴは削除対象外。削除直前に各ファイルの被参照ゼロをgrepで再確認してから実行すること。
4. **`py/ai_translation_v10.py` と `py/ai_translation_improved.py` は破棄された試作として扱ってよい。** 本番はv9（`ai_marathon_final_v9.py`）のまま。D1のアーカイブ対象に含める。
5. **py/旧世代スクリプトの整理方法は「削除」ではなく `py/archive/` への `git mv`（移動）で承認された。**（D1のリスト全体が対象）

### 5.2 引き続き質問が必要な条件

以下に該当したら実装せず、根拠を添えて人間に質問すること。

1. **公開API・DBスキーマ・保存済みデータ・認証・課金（Stripe）・メール配信（Brevo/GAS digest）・外部連携に影響しうる変更**すべて。
2. **HTMLページの削除**: 一見未参照のページ（`survey-results.html`・`report20260215.html`・`sw-unregister.html`・`howto-homescreen.html` 等）も、過去のニュースメールから直リンクされている可能性が高い。削除提案は質問とセットでのみ。
3. テスト（存在しないが、検証手順）と実装が矛盾しているように見える場合。
4. この指示書と実際のコードが食い違う場合（指示書作成後にコードが変わった可能性）。**コードを正とし、作業を止めて報告する。**
5. 承認済み事項（§5.1）であっても、実行時の再確認（grep等）で前提が崩れていた場合（例: 削除対象画像への新たな参照が見つかった）。

---

## 6. Baseline Commands（基準計測コマンド）

各フェーズの**編集前**に実行し、結果を記録する。

```powershell
# 1. 作業ツリーの状態（最初に必ず）
git status
git log --oneline -5

# 2. Python全ファイルの構文チェック（現状ベースライン）
python -m compileall py -q

# 3. ローカルプレビューサーバー（HTML確認用。file:// は不可）
python -m http.server 8765
# → http://127.0.0.1:8765/index.html 等をブラウザ/Playwrightで確認
# 終了: Ctrl+C（または taskkill）

# 4. 参照確認の基本形（削除候補の証拠取り）
# 例: grep -rn "対象ファイル名" *.html *.js *.json main.gs 126/
```

**注意**: `build.sh` はローカルで実行しないこと（`sw.js` を直接書き換えてしまう。これはCloudflare Pagesビルド時専用）。

---

## 7. Debt Map（技術的負債マップ）

凡例 — 実装可否: ✅今回実装してよい ／ ⚠️承認後に実装 ／ 💡提案のみ（実装禁止）
※ 2026-06-11 のオーナー承認（§5.1）により、D1・D3・D4・D8 は ✅（実装可）に昇格済み。

### D1. `py/` の旧世代スクリプト堆積 ✅（§5.1で承認済み）

- **根拠**: workflows・`run_all.py`・ドキュメントのいずれからも参照されないファイルが多数tracked: `run_all_v2.py`, `run_parallel.py`, `run_with_cache.py`, `run_with_notification.py`, `orchestrator.py`, `crawler_optimizer.py`, `sync_csv_to_cloud.py`（py/README.md自身が「廃止予定」と明記）, `passione_recon_v2.py`, `passione_test_v2.py`, `test_detect.py`, `ai_translation_improved.py`, `ai_translation_v10.py`（破棄された試作と確認済み・§5.1）。`crawler_utils.py` は廃止候補の `passione_recon_v2.py`・`run_parallel.py` からしか import されていない。
- **なぜ負債か**: 「どれが本物か」が分からず、誤って旧版を実行・修正するリスクが常在する。
- **影響範囲**: py/のみ。本番HTMLやDBへの影響なし。
- **変更リスク**: 低（削除ではなく `py/archive/` への移動なら実質ゼロ。workflowsは明示パス参照なので無影響）。
- **改善案**: 上記リストの全ファイルを `py/archive/` へ `git mv`（承認済み・§5.1）。`py/README.md` に「archive/は歴史的資料・実行禁止」と明記。
- **検証**: 移動後に `python -m compileall py -q`、workflows内の参照パスをgrepで再確認、`run_all.py` の crawlers リストのファイルが全て存在することを確認。
- **実装可否**: ✅（移動前に各ファイルの被参照ゼロをgrepで再確認すること）

### D2. クローラー9本のボイラープレート重複 ⚠️

- **根拠**: `dangelo_recon.py`・`500line_crawler.py` 等、全クローラーが同じコードを各自コピーしている: dotenv読込→`create_client`、`BOT_USER_AGENT` 定義、`detect_target_cars()`、`batch_upsert()`（`on_conflict="product_no"`）、指数バックオフ。既存の `crawler_utils.py` は実質未使用。
- **なぜ負債か**: 修正（例: UA変更、upsert仕様変更）が9箇所への同時パッチになり、漏れが事故になる。
- **影響範囲**: py/クローラー全部＝本番データ更新パイプライン。
- **変更リスク**: **中〜高**。クローラーは外部サイト相手で、完全なローカル検証ができない。
- **改善案**: `py/crawler_common.py` を新設（env読込＋client生成＋`BOT_USER_AGENT`＋`batch_upsert`＋`detect_target_cars` のみ。ショップ固有ロジックは入れない）。**1クローラーずつ移行**し、各移行ごとに1コミット。最初は `dangelo_recon.py`（構造が最も単純なStore API型）。
- **検証**: 各移行後に (a) `python -m py_compile`、(b) `git diff` で挙動同一性をレビュー（リトライ秒数・sleep・キー名が1文字も変わっていないこと）、(c) 可能なら人間に `workflow_dispatch` 手動実行を依頼し、件数が前回実行と同水準であることを確認してから次へ進む。
- **実装可否**: ⚠️（共通モジュール新設＋dangelo 1本の移行までは実装可。2本目以降は1本目の実地検証成功を確認してから）
- **注意**: 各クローラーの**リトライ・待機時間・判定条件は1つも変えない**。共通化はあくまで「同一コードの置き場所移動」。

### D3. `spots_api.gs` の未定義変数参照（壊れている疑い） ✅（§5.1で削除承認済み）

- **根拠**: `spots_api.gs:18-19` が `SUPABASE_ANON_KEY` を参照。`main.gs` は2026年の改修で `SUPABASE_KEY`（スクリプトプロパティのservice_role）に移行済みで、GASプロジェクト内に `SUPABASE_ANON_KEY` の定義が存在しない。
- **なぜ負債か**: 呼ばれれば ReferenceError。呼ばれないなら死コード。どちらにせよ現状は「壊れたコードがデプロイされている」状態。
- **影響範囲**: GAS（spot系API）。フロントの `spot.js`/`spot_schedule.html` は Supabase 直アクセスに移行済みで依存なし（grep確認済み）。
- **変更リスク**: 中（GASデプロイ実体の確認が必要）。
- **改善案**: 廃止確定（§5.1）。`spots_api.gs`・`spots_api.js` をリポジトリから `git rm`。**clasp push はしない**（デプロイ済みGASプロジェクト側の整理は人間が行う）。
- **実装可否**: ✅

### D4. `spots_api.js` ＝ `spots_api.gs` の完全重複 ✅（§5.1で削除承認済み）

- **根拠**: `diff spots_api.js spots_api.gs` → IDENTICAL。両方git管理。`.claspignore` は `.gs` のみpush対象なので `.js` 版はGASにも行かず、HTMLからも未参照。
- **なぜ負債か**: 片方だけ直す事故の温床（実際、過去コミットは `.js` 側を修正している）。
- **改善案**: D3とセットで両ファイルとも削除。
- **実装可否**: ✅（D3と同時・同一コミット）

### D5. `main.js`（ルート・gitignore済みの旧GASコード） ✅記録のみ

- **根拠**: `main.js`(1423行) は `main.gs` の旧版コピー（anonキー時代）。`.gitignore` に `main.js` が登録済みでgit管理外。HTMLから未参照。
- **なぜ負債か**: ルートに置かれた58KBの紛らわしいローカルファイル。誤って編集・参照する危険。
- **改善案**: git管理外のユーザーローカルファイルなので**実装担当は削除しない**。報告書に「人間がローカルで削除推奨」と記載するのみ。
- **実装可否**: ✅（報告のみ。ファイル操作禁止）

### D6. `spot.js` 内の死んだ `apiGet`/`apiPost` ✅

- **根拠**: `spot.js:371-396` に定義があるが、spot.js内・spot.html・spot_schedule.html のどこからも呼ばれていない（grep確認済み）。データ取得は全て supabaseClient 直アクセス。
- **なぜ負債か**: 「spot機能はGAS経由」という誤解を生む。
- **影響範囲**: spot.js のみ。
- **変更リスク**: 低。ただし削除前に**呼び出しゼロを自分で再確認**すること（`grep -n "apiGet\|apiPost" spot.js *.html`）。
- **検証**: ローカルサーバーで spot.html・spot_schedule.html を開き、コンソールエラーがないこと・地図とスポット一覧が描画されることを確認。
- **実装可否**: ✅

### D7. ドキュメントと現実の乖離 ✅

- **根拠**:
  - `README.md`: 40行目「**Go」で途切れている。ホスティングを「Vercel」と記載（実際はCloudflare Pages本番・Vercelバックアップ）。パーツ比較を「開発中」と記載（公開済み）。
  - `py/README.md`: 「5ショップ」（実際9）、「GitHub Actions自動化（予定）」（導入済み）、「AutoBella追加（予定）」（追加済み）、`run_all.bat` 前提の手順（batはgitignore）。
  - `docs/00_project_context.md`: Google Sheets＋GAS時代の構成説明（Supabase移行前）。
  - `CLAUDE.md`: 「`py/` … GitHub Actions用にgit管理対象」と正しい記述に更新済みだが、README類が追随していない。
- **なぜ負債か**: 新しい作業者（人間・AIとも）が古い構成を信じて壊す。
- **改善案**: README.md をリポジトリ内の証拠（本指示書§2相当）に基づき修正。`py/README.md` を現行9ショップ＋Actions運用に更新。`docs/00_project_context.md` は削除せず冒頭に「【歴史的資料】2026-01のSupabase移行前の構成です。現行構成はREADME.md参照」と追記。
- **変更リスク**: 低（ドキュメントのみ）。ただし**推測で書かない**こと。確認できない事実（例: 将来計画）は書かずに既存記述を残す。
- **検証**: 記述内の全ファイルパス・コマンドが実在することをgrep/lsで確認。
- **実装可否**: ✅

### D8. 未参照の大容量バイナリがgit管理・本番デプロイされている ✅（§5.1で削除承認済み）

- **根拠**: `100dai1.png`(8.4MB)・`logo_horizontal100.png`(7MB)・`logo_horizontal101.png`(6.5MB)・`logo_horizontal2026.png`(4.6MB)・`logo_vertical2026.png`(4.1MB)・`100dai2.png`・`map.png` — いずれもリポジトリ内から未参照（grep確認済み）でgit tracked。
- **なぜ負債か**: リポジトリ肥大＋全部Cloudflare Pagesにデプロイされる。
- **変更リスク**: 低〜中（削除承認済み。削除直前に被参照ゼロをgrepで再確認すること）。
- **改善案**: 上記7ファイルを `git rm`（§5.1で承認済み）。git履歴からの除去（filter-repo等）は**やらない**（破壊的・スコープ外）。
- **実装可否**: ✅

### D9. フロントエンド: 19ページ各自がSupabase初期化・共通処理をインライン重複 💡

- **根拠**: `createClient` 呼び出しが19ファイルに分散。ヘッダー/ナビ/認証チェック/escapeHtml等も各ページにコピーされている。
- **なぜ負債か**: 横断修正（例: 認証フロー変更）が毎回約20ファイルパッチになる。実際、過去の「owner_user_id紐づけ」処理が index.html と edit.html に重複している（`index.html:887` / `edit.html:572`）。
- **なぜ今やらないか**: ビルドシステムがなく、Service Worker＋PWAキャッシュの相互作用があり、全ページ一斉変更は回帰リスクが極めて高い。検証手段（自動テスト）が存在しない状態での一斉改修は事故になる。
- **改善案（提案のみ）**: 将来、`common.js`（Supabase初期化＋認証ヘルパーのみ）を新設し、ページを1枚ずつ移行する計画を別途立案。**本リファクタリングでは実装禁止。**
- **実装可否**: 💡

### D10. GAS `main.gs` の責務混在（Web API＋配信＋SNS＋管理UI） 💡

- **根拠**: `main.gs` 1504行に doGet/doPost ルーティング、イベントCRUD、Brevo配信（sendDailyDigest）、X投稿、スプレッドシートメニューが同居。
- **なぜ今やらないか**: GASはファイル分割しても全てグローバルスコープで実害が小さい一方、配信系は過去にサイレント障害（2026-04-29不達インシデント）を起こした繊細な領域。動いているものを触る理由が弱い。
- **改善案（提案のみ）**: 将来 `digest.gs`・`api.gs` 等への分割案を提示するに留める。
- **実装可否**: 💡

### D11. セキュリティ境界の既知問題（**触らない**） 💡

- **根拠**: (a) cars テーブルの `owner_email` が匿名selectで取得可能（既知・未是正。是正は owner_user_id 移行という中規模改修であり、雑なREVOKEは本番停止を招くと判明済み）。(b) spot系RLSがクライアント設定可能な `x-owner-document-id` ヘッダーに依存。(c) 管理者判定が `ADMIN_EMAIL` のクライアントサイド比較。
- **なぜ今やらないか**: いずれも修正は挙動変更・スキーマ変更を伴うプロダクト判断案件。**リファクタリングの「ついで」に触ると本番停止リスク。**
- **実装可否**: 💡（報告書で「既知問題として認識済み」と言及するのみ。コード変更禁止）

### D12. 細かい修正 ✅

- `py/dangelo_recon.py:153` のコメント `# = 5`（コミット済み版）はコードと一致しており正しい。未コミットの `# = 3` への変更が誤り → 破棄が承認済み（§5.1）。Phase 0 で `git checkout -- py/dangelo_recon.py` を実行して破棄する。
- `run_all.py` docstring「8ショップ」と本文ログ「9ショップ」の不一致（実際は9本起動）→ docstringを9に修正 ✅。

---

## 8. Implementation Phases（実装フェーズ）

**各フェーズの完了条件＝検証パス＋コミット＋結果記録。前フェーズが未検証のまま次へ進まない。**

### Phase 0: 現状確認とクリーンな出発点の確保
1. `git status` / `git log --oneline -5` を記録。
2. 未コミット変更 `py/dangelo_recon.py`（コメント1行のみの変更であることを `git diff` で確認した上で）を `git checkout -- py/dangelo_recon.py` で破棄する（§5.1で承認済み）。差分が「コメント1行」以外を含んでいた場合は破棄せず質問する。
3. `python -m compileall py -q` のbaseline結果を記録。
4. ローカルサーバーで index.html / parts.html / spot.html / edit.html を開き、コンソールエラーの有無をbaselineとして記録（Supabase接続エラーは環境依存なので「エラーの種類」を記録）。

### Phase 1: 安全網の整備（追加のみ・既存ファイル変更なし）
1. `py/check_all.py`（または .md手順書）を新設: 全pyの `compileall` ＋ workflows参照スクリプトの存在チェックを行う簡易スクリプト。ネットワークアクセスはしない。
2. 本指示書 §3 Behaviors To Preserve を `docs/refactor-baseline.md` として保存し、以後の各フェーズで照合。

### Phase 2: 明らかに安全な整理 ✅
1. D7: ドキュメント修正（README.md / py/README.md / docs/00_project_context.md への注記）。
2. D12: `run_all.py` docstring修正。
3. D6: `spot.js` の死んだ `apiGet`/`apiPost` 削除（削除前に被参照ゼロを再確認）。
- 検証: compileall・ローカルサーバーで spot.html / spot_schedule.html 表示確認・git diff目視。

### Phase 3: 承認済みの削除・アーカイブの実施 ✅（§5.1で全件承認済み）
1. D1: py/旧世代スクリプト（D1記載の12ファイル＋`crawler_utils.py`）を `py/archive/` へ `git mv`。
2. D3+D4: `spots_api.gs`・`spots_api.js` を `git rm`（clasp pushはしない）。
3. D8: 未参照画像7ファイルを `git rm`。
- 各削除・移動の**直前**に被参照ゼロをgrepで再確認すること（§5.2-5: 前提が崩れていたら停止して質問）。
- 検証: compileall・workflows参照grep・`run_all.py` のcrawlersリスト存在確認・ローカルサーバーで主要ページ表示確認。
- コミットは「アーカイブ移動」「spots_api削除」「画像削除」の3つに分ける。

### Phase 4: クローラー共通化（小さな責務分離） ⚠️
1. `py/crawler_common.py` 新設（env/client/UA/batch_upsert/detect_target_cars）。
2. `dangelo_recon.py` のみ移行 → diffレビューで「挙動同一」を確認 → 人間に workflow_dispatch 実地検証を依頼。
3. 実地検証成功の確認後、残りのクローラーを1本ずつ移行（各1コミット）。実地検証が得られない場合はdangelo 1本で停止し、残りは提案として報告。

### Phase 5: 提案書の作成（実装しない） 💡
- D9（フロント共通化）・D10（GAS分割）・D11（セキュリティ境界）について、現状証拠と段階的移行案を `docs/refactor-proposals.md` にまとめる。**コードは一切変更しない。**

---

## 9. Verification Requirements（検証要件）

- 各フェーズ完了時に必ず: `git status`（意図しない変更がないこと）／`python -m compileall py -q`／変更したHTMLページのローカル表示確認。
- クローラー変更（Phase 4）は、構文チェック＋diffレビューでは**完了とみなさない**。実地実行（workflow_dispatch）の成功と取得件数の妥当性確認をもって完了とする。
- 検証に失敗したら、そのフェーズの変更を revert してから報告する。失敗を抱えたまま先へ進まない。
- 「テストが通った」と報告する場合は、実行したコマンドと出力をそのまま添付する。

## 10. Reporting Format（報告形式）

各フェーズ終了ごとに以下を日本語で報告する:

```
## Phase N 報告
- 実施内容: （変更ファイルと要旨）
- 実行した検証コマンドと結果: （コマンド＋出力の要約。失敗は失敗と明記）
- コミット: （ハッシュとメッセージ）
- 未解決・質問: （あれば）
- 次フェーズに進んでよいか: 要承認 / 自動続行
```

最終報告には、実行した全コマンド一覧・全コミット一覧・「提案のみに留めた項目」の一覧を含める。

## 11. Out-of-scope Items（スコープ外・実装禁止）

- owner_email → owner_user_id 移行、RLS・GRANTの変更（別プロジェクト）
- DBスキーマ・トリガー・マイグレーション全般
- GAS配信ロジック（sendDailyDigest系）・Brevo連携・Stripe（support.html）
- フロントエンド19ページの共通モジュール化（提案のみ）
- sw.js のキャッシュ戦略・`_headers` の変更
- デザイン・文言・UXの変更
- git履歴の書き換え（filter-repo等）
- `git push`（人間の承認後のみ）
- クローラーの取得頻度・リトライ時間・sleep間隔の変更
- 新機能の追加
