-- 2026-11-17 整備の記録：定期のメンテナンスの印（tasks）にグリスアップ2種を足す
-- キングピン（kingpin_grease）・ドライブシャフト（driveshaft_grease）。オイルと同じく前回からの間隔を数える。
-- 増やすときはこの check に足す（並びは my-maintenance.html / maintenance.html の TASKS と同じ）

alter table public.maint_records drop constraint if exists maint_records_tasks_check;
alter table public.maint_records add constraint maint_records_tasks_check
  check (tasks <@ array['engine_oil','gear_oil','kingpin_grease','driveshaft_grease']::text[]);
