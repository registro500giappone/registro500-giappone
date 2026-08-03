-- ============================================================
-- 装備手帳フェーズB 適用確認クエリ
-- 2026-08-03 作成 / ★読み取りのみ・DBを一切変更しない★
--
-- 使い方: ローカルのSupabase MCPセッションで ①②③ を順に実行し、
--         「判定」列がすべて ✅ になっていることを確認する。
--         ❌ が出たブロックだけ、対応するmigrationを適用すればよい。
--
-- 対応表:
--   ① ❌ → equipment-notebook/public_read_2026-08-03.sql を適用
--   ② ❌ → equipment-notebook/items_feedback_2026-08-03.sql を適用（A/B部分）
--   ③ ❌ → 同上（D部分）／テーブル自体が無い場合は stop_modes_schema.sql から
-- ============================================================


-- ------------------------------------------------------------
-- ① フェーズB公開読み取り（public_read_2026-08-03.sql）
--    ★最重要★ この5本のポリシーが無いと、公開設定にした手帳が
--    他人（未ログイン含む）から見えない＝フェーズBの機能が成立しない。
-- ------------------------------------------------------------
select
  '公開SELECTポリシー（必須）' as 確認項目,
  count(*)::text || ' / 5' as 実測,
  case when count(*) = 5 then '✅ 適用済み' else '❌ 未適用' end as 判定
from pg_policies
where schemaname = 'public'
  and policyname in (
    'equipment_records_select_public',
    'equipment_entries_select_public',
    'equipment_catstatus_select_public',
    'equipment_custom_select_public',
    'equipment_exp_select_public')
union all
select
  '集計ビュー（フロント未使用）',
  count(*)::text || ' / 2',
  -- equipment.html は既存の equipment_item_rates() を使っており、
  -- このビュー2本はどのページからも参照していない。無くても表示は壊れない。
  case when count(*) = 2 then '✅ 適用済み' else '⚠️ 未適用（実害なし）' end
from pg_views
where schemaname = 'public'
  and viewname in ('equipment_item_stats', 'equipment_records_total')
union all
select
  '公開中の手帳（参考値）',
  (select count(*) from public.equipment_records where is_public)::text || ' 件',
  'ℹ️ 参考';


-- ------------------------------------------------------------
-- ② migration第2弾のうち 項目マスター分（items_feedback_2026-08-03.sql の A・B）
--    ※ 旧C「想定原因(cause)29件」は commit 4212852（結果画面の簡素化）で
--      不採用・SQLから削除済み。レビュー対象としては存在しない。
-- ------------------------------------------------------------
select
  'A. id4 スパナに8mm追加' as 確認項目,
  (select name from public.equipment_items where id = 4) as 実測,
  case when (select name from public.equipment_items where id = 4)
            = 'スパナ・メガネ（主要サイズ 8/10/11/13/17mm）'
       then '✅ 適用済み' else '❌ 未適用' end as 判定
union all
select
  'A. id9 油圧パンタに修正',
  (select note_prompt from public.equipment_items where id = 9),
  case when (select note_prompt from public.equipment_items where id = 9) like '%油圧パンタ%'
       then '✅ 適用済み' else '❌ 未適用' end
union all
select
  'B. 工具sort_order再割当',
  '先頭 id4=' || coalesce((select sort_order from public.equipment_items where id = 4)::text, '?')
    || ' ／ 末尾 id64=' || coalesce((select sort_order from public.equipment_items where id = 64)::text, '項目なし'),
  case when (select sort_order from public.equipment_items where id = 4) = 10
        and (select sort_order from public.equipment_items where id = 64) = 230
       then '✅ 適用済み' else '❌ 未適用' end;


-- ------------------------------------------------------------
-- ③ migration第2弾のうち 止まり方マスター分（同ファイルの D）
--    このブロックが「テーブルが存在しない」エラーになる場合は、
--    土台の stop_modes_schema.sql 自体が未適用ということ。
-- ------------------------------------------------------------
select
  'D. need_note具体化3件' as 確認項目,
  (select count(*) from public.equipment_stop_modes where
     (code = 'F3' and need_note = '外れたプラグコードを差し直す（火傷に注意）') or
     (code = 'M3' and need_note = '冷えるのを待つ。布と水で燃料ポンプを冷やす手も') or
     (code = 'E5' and need_note = 'エンジンルームのスターター本体のレバーを直接押す（火傷に注意）')
  )::text || ' / 3' as 実測,
  case when (select count(*) from public.equipment_stop_modes where
     (code = 'F3' and need_note = '外れたプラグコードを差し直す（火傷に注意）') or
     (code = 'M3' and need_note = '冷えるのを待つ。布と水で燃料ポンプを冷やす手も') or
     (code = 'E5' and need_note = 'エンジンルームのスターター本体のレバーを直接押す（火傷に注意）')
  ) = 3 then '✅ 適用済み' else '❌ 未適用' end as 判定
union all
select
  '止まり方マスター件数（参考）',
  (select count(*) from public.equipment_stop_modes where is_active)::text || ' 件（想定29件）',
  case when (select count(*) from public.equipment_stop_modes where is_active) = 29
       then '✅' else 'ℹ️ 要確認' end;
