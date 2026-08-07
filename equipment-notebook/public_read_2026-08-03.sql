-- ============================================================
-- 装備手帳 フェーズB: 公開読み取り（オプトイン公開）migration 起案
-- 状態: ✅適用済み（2026-08-03 起案 ／ 2026-08-06 本番データで適用を実地確認）
-- 根拠: 匿名キーで is_public=true の手帳6件が読める
-- 方針（2026-08-03 ユーザー確認済み）:
--   Q1. 公開はオプトイン。既存パイロット6件は非公開のまま、
--       閲覧ページ完成後に個別に公開可否を確認する（is_public は既存列・default false のまま）
--   Q2. 公開単位は手帳丸ごと（装備＋メモ＋自由追加＋経験談）。
--       公開トグルON時にUI側で「すべて公開されます」を明示する
--   Q3. 入口は equipment.html の「公開中の手帳一覧」＋集計結果データ公開、
--       および各オーナーのガレージページへの埋め込み
-- 対象外: equipment_entry_history（変更履歴は公開しない）
-- 参考: equipment-notebook/schema.sql（既存RLS。ポリシーはORで合成されるため追加のみで安全）
-- ============================================================

-- ------------------------------------------------------------
-- A. 公開手帳の読み取りポリシー（親）
--    is_public=true の手帳は誰でも（未ログイン含む）SELECT可。
--    書き込み系ポリシーは変更しない（本人のみのまま）。
-- ------------------------------------------------------------
create policy equipment_records_select_public on public.equipment_records
  for select using (is_public = true);

-- ------------------------------------------------------------
-- B. 公開手帳の子テーブル読み取りポリシー
--    親 record が is_public のときのみ誰でも SELECT 可。
--    既存の FOR ALL 本人ポリシーとはORで併存する。
-- ------------------------------------------------------------
create policy equipment_entries_select_public on public.equipment_entries
  for select using (exists (
    select 1 from public.equipment_records r
    where r.id = record_id and r.is_public = true));

create policy equipment_catstatus_select_public on public.equipment_category_status
  for select using (exists (
    select 1 from public.equipment_records r
    where r.id = record_id and r.is_public = true));

create policy equipment_custom_select_public on public.equipment_custom_items
  for select using (exists (
    select 1 from public.equipment_records r
    where r.id = record_id and r.is_public = true));

create policy equipment_exp_select_public on public.equipment_experiences
  for select using (exists (
    select 1 from public.equipment_records r
    where r.id = record_id and r.is_public = true));

-- ------------------------------------------------------------
-- C. 集計結果データの公開ビュー（equipment.html 用）
--    非公開の手帳も含めた全体集計を「件数のみ」公開する。
--    個人が特定できる列は一切含めない（item_id別の搭載数と全体母数のみ）。
--    security_invoker=false（定義者権限）でRLSを迂回して集計する意図的な設計。
-- ------------------------------------------------------------
create or replace view public.equipment_item_stats
  with (security_invoker = false) as
  select e.item_id,
         count(*) filter (where e.frequency = 'always')     as always_count,
         count(*) filter (where e.frequency = 'occasional') as occasional_count,
         count(*)                                           as total_count
  from public.equipment_entries e
  group by e.item_id;

create or replace view public.equipment_records_total
  with (security_invoker = false) as
  select count(*) as record_count
  from public.equipment_records;

grant select on public.equipment_item_stats  to anon, authenticated;
grant select on public.equipment_records_total to anon, authenticated;

-- ============================================================
-- 検算コメント
--   A. equipment_records に SELECT 公開ポリシー1本（書き込み系は不変）
--   B. 子4テーブル（entries／category_status／custom_items／experiences）に
--      SELECT 公開ポリシー各1本。entry_history には付与しない＝非公開のまま
--   C. 集計ビュー2本（item別集計・全体母数）＋ anon/authenticated へ SELECT 付与
-- ロールバック:
--   drop policy equipment_records_select_public on public.equipment_records;
--   drop policy equipment_entries_select_public on public.equipment_entries;
--   drop policy equipment_catstatus_select_public on public.equipment_category_status;
--   drop policy equipment_custom_select_public on public.equipment_custom_items;
--   drop policy equipment_exp_select_public on public.equipment_experiences;
--   drop view public.equipment_item_stats;
--   drop view public.equipment_records_total;
-- ============================================================
