-- 2026-09-10 適用済み（Supabase 本番）
-- 90日参加台数（participation_90d）の席を weekly_metrics に作る。
-- active_90d は「90日以内にログインした人数」＝ログイン指標であって参加ではない。
-- participation_90d は「直近90日に何かした車」を重複なしで数える（新規登録・車両更新・
-- 車載手帳・イベント参加表明・ストーリーの5経路の和集合）＝成長戦略の北極星。
-- 定義と注意点は repo の report-design.md 「participation_90d と active_90d は別物」を見る。
alter table public.weekly_metrics
  add column if not exists participation_90d integer;

comment on column public.weekly_metrics.participation_90d is
  '直近90日に参加した車の台数（car_history registered/updated ∪ equipment_records ∪ event_participants ∪ car_episodes の重複なし）。ベースライン=43（2026-08-29）。active_90d（90日ログイン人数）とは別物。';

comment on column public.weekly_metrics.active_90d is
  '90日以内にログインしたオーナー数（auth.users 由来）。⛔「参加」ではない＝参加は participation_90d を見る。';
