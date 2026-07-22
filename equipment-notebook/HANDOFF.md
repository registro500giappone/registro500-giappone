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

## RLS 早見（現状＝MVP・ログイン必須）

- `equipment_items`：全員 SELECT 可。書込は service_role のみ。
- `equipment_records` ほか6テーブル：本人（`user_id = auth.uid()`、子は親record経由）のみ SELECT/INSERT/UPDATE/DELETE。他人の手帳は読めない。
- 集計の公開読み取りは `equipment_item_rates()` 経由のみ。生の他人レコードは非公開。
- 匿名 anon INSERT は未付与（フェーズ2で `is_anonymous=true` 限定ポリシーを追加）。

## 次のタスク（MVP残り・次セッション以降）

1. **`recommend_priority` の編集部推奨順を確定**（Vベルト最優先は確定。他の推奨対象と序列をユーザーと1回すり合わせ → UPDATE）。
2. 入力UI `equipment-edit.html`（カテゴリ単位一覧・スマホ主体・タップ完結・「常時/随時」トグル・自由追加行・経験談・車両情報セクション）。保存はSupabase直書き（garage_notes手本）。
3. 編集部推奨リコメンド（フェーズ1・母数閾値未満は編集部推奨を返す）。
4. タイプ分類の表示（現地修理型/予防整備型/救援前提型/身軽型・カテゴリ別搭載率で判定）。
5. 結果カード（本人保存用の1枚画像）。
6. 集計表示 `equipment.html`（`equipment_item_rates()` を横棒グラフ表示）。

**フェーズ2**: 統計リコメンド自動切替／変更履歴の書込＋過去比較／ガレージ公開（is_public）／管理画面の名寄せ・名品昇格／匿名anon INSERT開放／セグメント別リコメンド。

## 未確定（実装前に確認）

- `recommend_priority` の序列（上記タスク1）。
- パイロット2〜3名の先行記入は id 確定後にユーザーが実施（本番データに繰り入れ）。
