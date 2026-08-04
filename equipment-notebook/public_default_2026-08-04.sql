-- ============================================================
-- 装備手帳: 公開の既定値を「公開」に変更する migration 起案
-- migration名: equipment_notebook_public_default_2026_08_04
-- 状態: ★未適用★（2026-08-04 起案・適用はローカルPCから）
--
-- 方針変更（2026-08-04 ユーザー判断）:
--   フェーズB当初は「公開はオプトイン（既定 false）」で実装したが、
--   「公開前提」に変更する。ただし本番リリース前に、
--   既存パイロット6件については個別に公開の了解を取る。
--
-- ⚠️ 重要: 既存行は変更しない。
--   alter column ... set default はこれから作られる行にのみ効き、
--   既に false で保存されている6件は非公開のまま保たれる。
--   パイロット参加者は「パイロット期間中は非公開」という前提で記入しているため、
--   本人の同意なく公開に切り替えてはいけない（HANDOFF.md L136 の方針）。
--
-- 補足: フロント（equipment-edit.html）は insert 時に is_public を必ず明示送信するため、
--   このカラム既定値は実質的に使われない。意図を DB 側にも残すための整合目的の変更。
--   実際の既定を決めているのはフロントのトグル初期状態（record ? record.is_public : true）。
-- ============================================================

alter table public.equipment_records
  alter column is_public set default true;

-- ============================================================
-- 適用後の確認（既存6件が false のままであることを必ず見る）
--   select is_public, count(*) from public.equipment_records group by is_public;
--     → 方針変更の直後は false が6件・true が0件（または本人が公開した分のみ）
--   select column_default from information_schema.columns
--    where table_schema='public' and table_name='equipment_records' and column_name='is_public';
--     → true
--
-- ロールバック:
--   alter table public.equipment_records alter column is_public set default false;
-- ============================================================
