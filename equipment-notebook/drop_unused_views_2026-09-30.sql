-- 未参照の SECURITY DEFINER ビュー2本を落とす（2026-09-30 適用）
--
-- equipment_item_stats / equipment_records_total は集計の初期実装で、
-- その後 RPC equipment_item_rates()（public_list_rpc_2026-08-05.sql 以降）に置き換わった。
-- 2026-09-30 の棚卸しで、repo のコード・DB の他ビュー・関数本文のいずれからも参照ゼロを確認。
-- Supabase advisor の security_definer_view（ERROR）もこの2本だけが対象だった。

drop view if exists public.equipment_item_stats;
drop view if exists public.equipment_records_total;
