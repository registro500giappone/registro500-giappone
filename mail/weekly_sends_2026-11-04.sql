-- 週1回のお知らせ（py/send_weekly.py）の送信の控え — 2026-11-04
-- 1日1行＝同じ日に二度送らない（ワークフローの再実行・手動実行が重なっても）。宛先の人数も残す＝購読者数の推移になる。
-- 読み書きは送信スクリプト（service role）と管理人だけ。
create table if not exists public.mail_weekly_sends (
  sent_on     date primary key,              -- JST の日付
  recipients  integer not null,
  items       integer not null,
  created_at  timestamptz not null default now()
);
alter table public.mail_weekly_sends enable row level security;
drop policy if exists mail_weekly_sends_admin on public.mail_weekly_sends;
create policy mail_weekly_sends_admin on public.mail_weekly_sends for select to authenticated
  using (public.is_admin());
