-- 2026-11-04 整備の記録：箇所に「アクセサリー」を足し、定番作業の印（tasks）を持たせる
-- tasks はオイル交換を個別に数えるための印。いずれ統計メニューのアンケート（cars.engine_oil_interval 等）と突き合わせる。
-- 増やすときはこの check に足す（areas と同じ流儀）

alter table public.maint_records drop constraint if exists maint_records_areas_check;
alter table public.maint_records add constraint maint_records_areas_check
  check (areas <@ array['engine','fuel','driveline','suspension','brake','body','electric','consumable','accessory']::text[]);

alter table public.maint_records add column if not exists tasks text[] not null default '{}';
alter table public.maint_records drop constraint if exists maint_records_tasks_check;
alter table public.maint_records add constraint maint_records_tasks_check
  check (tasks <@ array['engine_oil','gear_oil']::text[]);

create index if not exists maint_records_tasks_idx on public.maint_records using gin (tasks);
