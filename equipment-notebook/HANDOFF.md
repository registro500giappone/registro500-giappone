# 装備手帳機能 — 実装ハンドオフ（正本）

対象サイト: registro500.com
起票: 2026-07-22

**設計思想の正本＝`design-original.md`**（元ハンドオフ全文）。本ファイルは確定事項・実装ログ・次タスクを管理する。確定済みの設計判断を勝手に変えない。

---

## 確定事項（2026-07-22 ユーザー確認済）

- **スコープの段取り＝土台優先**。最重要制約「項目マスターのIDを確定させてから回答を取る／後からIDが変わると回答が壊れる」を守るため、初手はDBスキーマ＋シードのID確定＋Supabase適用に絞った。UI・リコメンド・結果カードは次セッション以降。
- **7テーブルを最初に全部作成**（構造を先に固定。履歴書込などのロジックはフェーズ2でも器は先に用意）。
- **MVP初期はログイン必須**（Supabaseメール OTP）。匿名回答の器（`equipment_records.user_id`/`vehicle_id` nullable・`is_anonymous`）は最初から保持し、anonロールのINSERT開放はパイロット後のフェーズ2で追加。
- **命名は `equipment_` 接頭辞**。既存 `survey-results.html`（＝パーツ調達アンケート・別物）との混同を回避。

## 既存サイトのパターン（UI実装時に踏襲）

- DB＝Supabase（`@supabase/supabase-js@2.94.0`、`config.js` の `SUPABASE_URL`/`SUPABASE_ANON_KEY`）。認証＝Supabaseメール OTP（`edit.html` の `signInWithOtp` → `verifyOtp({type:'email'})`）。
- 書込の手本＝`garage_notes`（`garage-notes.html` L548-557、insert時に `user_id: currentUser.id`）。
- 車両紐付け＝`cars.owner_user_id`（=auth `user.id`）。`cars` から `.eq('owner_user_id', user.id)` で所有車両・handle_name を引く。
- 入力UIの手本＝`edit.html` の `.opt-section`（details/summary 折りたたみ）＋`.radio-group`（L36-52, L304-438）→「常時/随時」トグルに流用。
- 集計表示の手本＝`survey-results.html` の横棒グラフ `.bar-track`/`.bar-fill`。
- ラッパの手本＝`garage-notes.html` の `.page`+`.back-link`+`.brand-header`（系統B）。
- 結果カード画像化＝html2canvas未導入。`edit.html` の canvas `getContext('2d')`→`drawImage`→`toDataURL/toBlob`（L1197-1308）を自前実装 or html2canvas新規導入。
- GA4は `video.html` L322 の `track()` ラッパ方式（gtag未読込でもクラッシュしない）を踏襲。
- **注意**: `onAuthStateChange` 内の Supabase 呼び出しは `setTimeout(...,0)` / `.then()` でデッドロック回避（`edit.html` L630-632 の教訓）。update時に所有権列（user_id）を再送しない（所有権付け替え事故の回避）。

## スキーマ対応表（ハンドオフ案 → 採用テーブル）

| ハンドオフ案 | 採用テーブル | 役割 |
|---|---|---|
| survey_items | `equipment_items` | 項目マスター（id不変） |
| survey_responses | `equipment_records` | 手帳（回答セッション・親） |
| survey_answers | `equipment_entries` | 個別回答（最新状態・行なし=未搭載） |
| survey_answer_history | `equipment_entry_history` | 変更履歴（器のみ・書込はフェーズ2） |
| survey_category_status | `equipment_category_status` | カテゴリ完了フラグ |
| survey_custom_items | `equipment_custom_items` | 自由追加項目（名品昇格の種） |
| survey_experiences | `equipment_experiences` | 経験談（記事素材） |

集計は関数 `equipment_item_rates()`（SECURITY DEFINER・全体母数の積載率・個人特定なし・anon/authenticated 実行可）。

## 実装ログ

### 2026-07-22 タスク1（DB土台）＝完了
- migration `equipment_notebook_schema` 適用：7テーブル＋インデックス＋RLS＋集計関数 `equipment_item_rates()`。控え＝`schema.sql`。
- migration `equipment_notebook_seed_items` 適用：項目マスター**54件**投入（id 1〜54 明示・不変）。控え＝`seed_items.sql`。
  - 内訳: 工具13 / パーツ15 / ケミカル9 / 非常時対応12 / 洗車・その他5。※元ハンドオフ本文の「45項目」は概数、実データは54で確定。
  - `recommend_priority`・`affiliate_url` は全件 null で投入（後述の未確定事項で確定させる）。
- 検証: 件数・カテゴリ内訳・code全ユニーク・reason欠損0・集計関数動作（母数0でも除算エラーなし）を確認。
- advisor(security): `equipment_item_rates()` の SECURITY DEFINER 警告は「全体集計を公開する」意図通りで受容（個人特定情報を返さない。既存 `link_owner_car()` と同型）。
- **未コミット**（repo `equipment-notebook/` は作成済・push はユーザー指示待ち）。

### 2026-07-23 タスク2（recommend_priority 確定）＝完了
- migration `equipment_notebook_recommend_priority_v3` 適用（v1/v2は同日中に上書き）。控え＝`recommend_priority.sql`。上位**23件**付与。
- v3で追加した第4の軸＝**理想と現実のバランス**。「あった方がよい」が実際には積まれていない物を並べると、推奨リスト全体の現実味が落ちる。
  - 反射ベストを除外（日本では法定義務でなく搭載者がごく少数）／ロードサービス連絡先を除外（装備ではなく事前確認する情報。項目自体は残す）。
  - ヘッドライト・軍手ウエスを工具ブロック上位へ（暗所と手の汚れは出先整備の前提条件）。
  - 項目マスターの表記修正2件（**id不変・name/reasonは可変**）: id38「発煙筒・非常信号灯（LED可）」＝LED式は期限切れがない現実解／id23「燃料ホース（応急の短尺）＋ホースバンド」＝全長交換の装備という誤解を避け、50cm〜1mで裂けた区間を差し替える用途と明示。
- **序列の設計軸（ユーザー確定・以後この3軸で見直す）**:
  1. **非常時対応が最上位**。積むだけで手間ゼロ・三角表示板は法定義務・夜間の路肩は二次事故が命に直結。
  2. **次に工具**。パーツを積んでいても工具が無ければ現地で交換できない＝パーツ先行の序列は役に立たない。
  3. **パーツ／ケミカルは「現地修理の簡便性」順**。路肩で数分で終わるものほど積む価値が回収される。ワイヤー通しのような手間のかかるものは下位。
- 上位25件のみ付与、残29件は null（＝推奨対象外・統計フェーズの積載率に委ねる）。`recommend_priority` は id と違い**可変**（回答を壊さない）ため運用中の見直し可。
- 推奨から意図的に外した判断: デスビキャップ/ローター（あった方がよいが推奨までは不要）／スペアタイヤ・車載ジャッキ・携帯空気入れ（積んでいて当たり前＝指摘の新規性が薄い）／車検証・自賠責（法定だが推奨で返すのは失礼）。
- **派生要件**: 車載ジャッキは「何を積んでいるか」のバリエーションが興味を引くため、推奨とは別に**メモ収集の対象**とする（実装方針は下記「未確定」）。

### 2026-07-23 メモ収集の器＝完了
- migration `equipment_notebook_item_notes` 適用。控え＝`schema.sql`（該当列にmigration名を注記）。
- `equipment_items.note_prompt text` ＋ `equipment_entries.note text` を追加。**note_prompt に値がある項目だけ UI にメモ欄を出す**（全項目に出すと「照合に疲れて離脱する」設計原則に反する）。プロンプト文はプレースホルダを兼ねる。名品（`item_class='meihin'`）の収集路も兼ねる。
- 初期プロンプト2件: id9 車載ジャッキ「どんなジャッキ？（純正パンタ／油圧フロア／パンタ社外 など）」／id1 プラグレンチ「銘柄・仕様は？（薄肉／首振り／エクステンション付き など）」。反応を見て増やす。
- 表記修正: id13「軍手・ウエス／ペーパータオル」（出先では使い捨てが実態に近い）。

### 2026-07-23 タスク3（入力UI `equipment-edit.html`）＝実装完了・未デプロイ
- repoルートに `equipment-edit.html` を新規作成。`noindex`（個人の入力画面のため。集計ページ `equipment.html` は別途インデックス対象）。
- 構成: ログインOTPオーバーレイ（`edit.html` と同型・Googleログイン併設）／車両情報（所有車が2台以上のときだけ車両セレクタを表示・年式は `cars.year` からプリフィル）／カテゴリ5つを `details` 折りたたみ＋進捗 `n/m` 表示／項目行＝名前＋一行理由＋「常時・随時」トグル（同じボタン再押下で解除＝積んでいない）／`note_prompt` を持つ項目のみメモ欄（項目行の下に全幅）／カテゴリ末尾に自由追加行＋完了チェック／経験談／固定保存バー。
- **入力画面に編集部推奨バッジは出さない**（設計判断）。推奨を先に見せると「推奨されているから常時にしておこう」というバイアスで積載率データ自体が歪むため。気付きの動線は一行理由が担い、推奨は保存後の結果画面（次タスク）で返す。
- 保存: records は insert時のみ `user_id` を送り、**update では所有権列を送らない**（`edit.html` の事故経路の教訓）。entries は選択分を upsert（`onConflict: 'record_id,item_id'`）＋非選択分を delete、category_status は upsert、custom_items は総入れ替え、experiences は1件運用（空なら delete）。`onAuthStateChange` 内は `setTimeout(...,0)` でデッドロック回避。
- 派生migration `equipment_custom_items_category`: 自由追加欄はカテゴリ末尾に置く設計なのに `equipment_custom_items` にカテゴリ列が無く、どのカテゴリの穴かを記録できなかったため `category text` を追加（名品昇格時の配置先判断に使う）。
- 検証: JS構文チェック（node --check）／ローカルHTTPサーバ＋Playwright 390px幅で描画確認（項目54件の読み出し・トグル・メモ欄・自由追加・完了チェック・カテゴリ進捗・横スクロールなし=375px）。コンソールエラーはローカルの Cloudflare Analytics CORS のみで実装起因なし。**ログイン後の実データ保存はブラウザ実機での確認が必要（未実施）**。

### 2026-07-23 リコメンド設計の再定義（2層＋タイプ連動）＝ユーザー確定
- **問題認識（ユーザー起点）**: カーライフスタイルは「全部自分で直す〜ロードサービス丸投げ」のグラデーションであり、1本の推奨リスト（1〜23）は「自走復帰できるべき」という一点の価値観の押し付けになる。タイプ分類が最初から複数価値観を認めているのと矛盾するのはフェーズ1編集部推奨のみ。
- **確定した方式＝推奨を2層に分割**:
  - **第0層＝スタイル非依存の安全層**（三角表示板・発煙筒＋モバイルバッテリー・飲料水程度）。「路肩で救援を安全に待つ」はどのタイプにも共通に発生するため全員に返してよい。
  - **第1層＝スタイル相対の自走復帰層**（recommend_priority 3〜23 の工具/パーツ/ケミカルの梯子）。本人の回答バランス（工具・パーツの厚み）で表示を条件分岐。機械系が厚い人には梯子の欠けを返し、ほぼ空の人には**返さない**（「もし自走復帰に興味があれば→」の招待に留める）。
  - 判定材料は本人の回答＝統計不要＝**フェーズ1から実装可**。タスク3（リコメンド）とタスク4（タイプ分類）は自然に合流する。
  - **スキーマ変更不要**。recommend_priority=「自走復帰の梯子の順序」と再定義、安全層か否かはカテゴリ（非常時対応か否か）から導出。変わるのは結果画面の表示ロジックと文言のみ。
- **身軽型への態度＝肯定から入る（ユーザー確定）**。「あなたの割り切りは合理的です。最低限これだけ」と、割り切りを尊重する文言にする。推奨の口調は全タイプで「積むべき」でなく「あなたのスタイルなら」。

### 2026-07-23 タスク3+4（編集部推奨リコメンド＋タイプ分類）＝実装完了・未デプロイ
- 上記「リコメンド設計の再定義」どおり、`equipment-edit.html` に保存後の結果セクション（`#result-section`）として合流実装。新規ファイルは作らず、既存の入力画面に追記（保存後に自動スクロール表示・既存手帳がある場合は読み込み時にも表示）。
- タイプ判定 `classifyType()`：カテゴリ別搭載率から4タイプを判定（工具・パーツ平均＝mechScore、ケミカル比、非常時対応比、全体搭載数）。全体搭載数2以下は無条件で身軽型。統計閾値は使わず本人の回答のみで判定（フェーズ1はこれで十分・design-original.mdの「同型オーナー比較」はフェーズ2の統計リコメンドで実装）。
- リコメンド `renderResult()`：`recommend_priority` 昇順で未搭載項目を抽出し、非常時対応＝第0層（誰にでも常時表示）／それ以外＝第1層（工具+パーツの搭載数が3以上のときのみ「梯子」を最大5件表示。3未満は身軽型なら肯定文言のみ、それ以外はライダー1件だけを招待として提示）。
- `equipment_items` の select に `recommend_priority` を追加。
- 検証: 6スクリプトブロックすべて構文チェックOK（node --check相当）。分類ロジックをNodeで単体シミュレーション（工具/パーツ厚め→現地修理型、ケミカル厚め→予防整備型、非常時対応厚め→救援前提型、ほぼ空→身軽型の4パターンとも意図通り分岐）。**ブラウザでの実データ確認・実機Playwright確認は未実施**。
- 閾値（`MECH_THICK_THRESHOLD=3`など）はHANDOFF記載どおり実データが貯まってから調整可能な暫定値。

### 2026-07-23 タスク5（結果カード画像化）＝実装完了・未デプロイ
- html2canvas新規導入は見送り、`edit.html`のマスキングツールと同型のCanvas 2D自前描画を採用。理由＝`#result-section`はDOMそのままのスクショではなく「SNS共有用に再構成したカード」として設計する方が見栄えが良く、外部依存も増やさないため。
- タスク3+4の`renderResult()`から表示分岐（見出し文言・件数）を`computeResultData()`（本人回答から算出する共通データ）と`buildResultSections()`（安全層／梯子／招待文言のどれを出すかの分岐、DOM描画とCanvas描画の両方が参照）に切り出し、文言の二重管理・食い違いを防止。
- Canvas描画は2段階：まず計測用の一時canvasで文字幅を測りながら描画コマンド列と総高さを算出（`layoutResultContent`/`layoutSection`）→ その高さで実canvas（2倍スケールでRetina対応）を作って一括描画（`buildResultCanvas`）。日本語は分かち書きが無いため文字単位で折り返す簡易wrap（禁則処理はしない）。
- 「結果を画像で保存」ボタン押下で`canvas.toDataURL('image/png')`をdownload属性のaタグ経由でダウンロード（iOS Safariはdownload属性が効かず新規タブ表示になる想定・edit.htmlのマスキングツールと同じ制約を許容）。
- 検証：Playwright実機でSupabase実データ・実ログイン（OTP）→工具4点保存→現地修理型判定→画像ダウンロードまで確認。**初回実装ではセーフティ層最後の理由文と次見出し「自走復帰の備え、次の一手」が重なるレイアウトバグを発見**（セクション間の余白を`y+10`にしていたのが原因。テキストのbaseline間隔として不足）→`y+26`に統一して修正・再検証で解消を確認。身軽型（安全対応揃い＋招待文言のみ）・長文理由の2〜3行折り返しもモックデータ注入で追加確認、重なりなし。

### 2026-07-23 タスク6（集計表示 `equipment.html`）＝実装完了・未デプロイ
- リポジトリルートに新規ファイル `equipment.html` を作成。ログイン不要・全員向けの公開集計ページのため `equipment-edit.html` と異なり **noindexを付けず検索インデックス対象**（canonical=`https://www.registro500.com/equipment`）。`sitemap.xml` にも追加。
- `equipment_item_rates()` を `supabaseClient.rpc('equipment_item_rates')` で取得し、`CATEGORIES`（工具/パーツ/ケミカル/非常時対応/洗車・その他）でグルーピングしてカテゴリ別セクション表示。項目は積載率(`load_rate`)降順（0%の項目も「まだ誰も挙げていない」情報として表示）。
- 手本は `survey-results.html` の `.bar-track`/`.bar-fill`。常時/随時の内訳が分かるよう1本の`.bar-track`内に2色（常時=accent／随時=`--occasional`）のスタックバーに拡張。
- `total_records=0`（母数ゼロ）のフォールバック実装：「まだ記録がありません。最初の1件はあなたです」＋`equipment-edit.html`への導線。
- 検証: ローカルHTTPサーバ＋Playwright実機で本番Supabase実データ（検証時点 `total_records=1`）を390px幅で表示確認、コンソールエラーはローカル特有のCloudflare Analytics CORSのみ。母数ゼロパスは`renderRows([])`を直接呼び出して検証し、初回実装ではlegendと直前のカテゴリ描画がゼロ件表示時に残存するバグを発見・`renderEmpty()`でlegend非表示＋categories空化するよう修正して解消を確認。
- **これでMVP残タスク（次のタスク1〜6）が全て実装完了**。以後はコミット・デプロイ判断のみ。

## RLS 早見（現状＝MVP・ログイン必須）

- `equipment_items`：全員 SELECT 可。書込は service_role のみ。
- `equipment_records` ほか6テーブル：本人（`user_id = auth.uid()`、子は親record経由）のみ SELECT/INSERT/UPDATE/DELETE。他人の手帳は読めない。
- 集計の公開読み取りは `equipment_item_rates()` 経由のみ。生の他人レコードは非公開。
- 匿名 anon INSERT は未付与（フェーズ2で `is_anonymous=true` 限定ポリシーを追加）。

## 次のタスク（MVP残り・次セッション以降）

1. ~~**`recommend_priority` の編集部推奨順を確定**~~ ＝**2026-07-23 完了**（上記実装ログ参照）。
2. ~~入力UI `equipment-edit.html`~~ ＝**2026-07-23 完了**（上記実装ログ参照・未デプロイ）。
3. ~~編集部推奨リコメンド（フェーズ1）~~ ＝**2026-07-23 完了**（上記実装ログ「タスク3+4」参照・未デプロイ）。
4. ~~タイプ分類の表示~~ ＝**2026-07-23 完了**（同上・未デプロイ）。
5. ~~結果カード（本人保存用の1枚画像）~~ ＝**2026-07-23 完了**（上記実装ログ「タスク5」参照・未デプロイ）。
6. ~~集計表示 `equipment.html`（`equipment_item_rates()` を横棒グラフ表示）~~ ＝**2026-07-23 完了**（上記実装ログ「タスク6」参照・未デプロイ）。

**MVP実装は全6タスク完了**。残るはコミット・本番デプロイの判断のみ。

**フェーズ2**: 統計リコメンド自動切替／変更履歴の書込＋過去比較／ガレージ公開（is_public）／管理画面の名寄せ・名品昇格／匿名anon INSERT開放／セグメント別リコメンド。

## 未確定（実装前に確認）

- （なし。MVP6タスクは全て実装完了。次はコミット・本番デプロイの判断）
- パイロット2〜3名の先行記入は id 確定後にユーザーが実施（本番データに繰り入れ）。
