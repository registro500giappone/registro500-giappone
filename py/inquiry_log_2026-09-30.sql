-- /api/inquiry（オーナーへの問い合わせ転送）の送信記録（2026-09-30 適用）
-- 回数制限のためだけに持つ。読み書きは Cloudflare Function（functions/api/inquiry.js・secret key）だけ。
-- RLS 有効・ポリシー無し＝REST からは見えない。
create table if not exists public.inquiry_log (
  id bigint generated always as identity primary key,
  sender_uid uuid not null,
  sender_email text not null,
  target_doc text not null,
  created_at timestamptz not null default now()
);
create index if not exists inquiry_log_sender_idx on public.inquiry_log (sender_uid, created_at desc);
alter table public.inquiry_log enable row level security;
revoke all on public.inquiry_log from anon, authenticated;
