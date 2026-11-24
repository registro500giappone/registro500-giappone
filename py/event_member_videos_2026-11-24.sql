-- イベント参加者限定の動画（2026-11-24）
-- 見られるのは「名簿 event_video_access に自分の車があるオーナー」と管理人だけ。
-- 名簿は参加表明（event_participants）とは別に持つ＝表明せずに来た人も入れられ、
-- 終わったあとに参加表明を押しても見られるようにはならない。名簿の中身は管理人が入れる。
-- 動画そのものは YouTube の限定公開。ここに置くのは ID だけ。

create table if not exists public.event_video_access (
  event_id   text not null,
  car_id     text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, car_id)
);

create table if not exists public.event_member_videos (
  id         bigint generated always as identity primary key,
  event_id   text not null,
  title      text,
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_member_videos_event_idx on public.event_member_videos (event_id);

-- 自分の車が名簿にあるか（管理人は常に true）
create or replace function public.can_view_event_video(p_event text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.is_admin() or exists (
    select 1 from public.event_video_access a
     where a.event_id = p_event and public.owns_car(a.car_id));
$$;

-- 未ログインの人に「参加者向けの動画があります（ログインして見る）」を出すための本数だけ。
-- 中身（題名・ID）は返さない。
create or replace function public.event_member_video_count(p_event text)
returns int language sql stable security definer
set search_path = public, pg_temp as $$
  select count(*)::int from public.event_member_videos where event_id = p_event;
$$;

alter table public.event_video_access  enable row level security;
alter table public.event_member_videos enable row level security;

drop policy if exists event_video_access_select on public.event_video_access;
create policy event_video_access_select on public.event_video_access
  for select using (public.is_admin() or public.owns_car(car_id));
drop policy if exists event_video_access_admin_write on public.event_video_access;
create policy event_video_access_admin_write on public.event_video_access
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists event_member_videos_select on public.event_member_videos;
create policy event_member_videos_select on public.event_member_videos
  for select using (public.can_view_event_video(event_id));
drop policy if exists event_member_videos_admin_write on public.event_member_videos;
create policy event_member_videos_admin_write on public.event_member_videos
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.event_video_access, public.event_member_videos to anon, authenticated;
revoke all on function public.can_view_event_video(text) from public;
grant execute on function public.can_view_event_video(text) to anon, authenticated;
revoke all on function public.event_member_video_count(text) from public;
grant execute on function public.event_member_video_count(text) to anon, authenticated;
