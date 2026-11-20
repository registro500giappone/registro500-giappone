-- イベント個別ページの「参加者の連絡欄」（2026-11-20 ユーザー決裁）
--
-- ・読めるのは、そのイベントに参加表明した人（車両を登録済みのオーナー）と管理人だけ。
-- ・書き込みは /api/event-message（Pages Function・秘密キー）だけが行う。
--   ＝クライアントから直接 insert する口は作らない（回数の歯止めとメール送信を1か所で握るため）。
-- ・消せるのは書いた本人と管理人。
-- ・メールは「連絡メール」という別の種類（mail_subscriptions.list = 'event_board'）にして、
--   朝の便とは別に止められるようにする。
--
-- 適用: 2026-11-20 本番（ローカルPCから）

create table if not exists public.event_messages (
  id bigint generated always as identity primary key,
  event_id text not null references public.events(id) on delete cascade,
  car_id text not null,                 -- 書いた人の車（管理人が車なしで書くときは 'ADMIN'）
  handle_name text not null,
  body text not null check (char_length(body) between 1 and 1000),
  notify boolean not null default false,        -- 「参加者にメールで知らせる」を選んだか
  mailed_count integer not null default 0,      -- 実際に送った通数（1日の上限の勘定に使う）
  created_at timestamptz not null default now()
);
create index if not exists event_messages_event_idx on public.event_messages (event_id, created_at);
create index if not exists event_messages_created_idx on public.event_messages (created_at);

alter table public.event_messages enable row level security;

-- そのイベントに、自分の車で参加表明しているか。
-- 'ADMIN' の行（車両を持たない参加者）は人を見分けられないので数えない。
create or replace function public.is_event_participant(p_event text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.event_participants p
     where p.event_id = p_event
       and p.car_id <> 'ADMIN'
       and public.owns_car(p.car_id)
  );
$$;
revoke all on function public.is_event_participant(text) from public;
grant execute on function public.is_event_participant(text) to authenticated;

drop policy if exists event_messages_select_policy on public.event_messages;
create policy event_messages_select_policy on public.event_messages
  for select to authenticated
  using (public.is_admin() or public.is_event_participant(event_id));

drop policy if exists event_messages_delete_policy on public.event_messages;
create policy event_messages_delete_policy on public.event_messages
  for delete to authenticated
  using (public.is_admin() or public.owns_car(car_id));

-- insert / update のポリシーは作らない（＝クライアントからは書けない）。
revoke all on public.event_messages from anon;
revoke insert, update on public.event_messages from authenticated;

-- 連絡メールを「種類」として足す（止める口は既存の /unsubscribe をそのまま使う）
alter table public.mail_subscriptions drop constraint if exists mail_subscriptions_list_check;
alter table public.mail_subscriptions add constraint mail_subscriptions_list_check
  check (list = any (array['weekly'::text, 'owner_digest'::text, 'owner_notice'::text, 'event_board'::text]));
