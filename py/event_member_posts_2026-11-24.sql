-- イベント参加者限定の共有に、参加者の投稿（写真・動画URL）を足す（2026-11-24）
-- 前提：py/event_member_videos_2026-11-24.sql（名簿 event_video_access と can_view_event_video）
-- 写真は「名簿の人だけの閉じた共有」に限る（events-portal/HANDOFF.md §2-6 の 2026-11-24 追記）。
-- 置き場所は非公開のバケット。表示は署名つきURL（期限つき）で、名簿の人と管理人だけが取り出せる。

-- 動画：投稿した車を持つ（管理人が入れた分は null）
alter table public.event_member_videos add column if not exists car_id text;
alter table public.event_member_videos add column if not exists handle_name text;

create table if not exists public.event_member_photos (
  id          bigint generated always as identity primary key,
  event_id    text not null,
  car_id      text,                 -- 投稿した車（管理人が入れた分は null）
  handle_name text,
  path        text not null unique, -- <event_id>/<car_id or admin>/<uuid>.jpg（一覧用は同名の _t.jpg）
  created_at  timestamptz not null default now()
);
create index if not exists event_member_photos_event_idx on public.event_member_photos (event_id, created_at);

-- 1台あたりの上限（写真50枚・動画10本／イベント）
create or replace function public.event_member_post_limit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if new.car_id is null then return new; end if;
  if tg_table_name = 'event_member_photos' then
    select count(*) into n from public.event_member_photos where event_id = new.event_id and car_id = new.car_id;
    if n >= 50 then raise exception '写真は1台50枚までです' using errcode = 'P0001'; end if;
  else
    select count(*) into n from public.event_member_videos where event_id = new.event_id and car_id = new.car_id;
    if n >= 10 then raise exception '動画は1台10本までです' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
drop trigger if exists event_member_photos_limit on public.event_member_photos;
create trigger event_member_photos_limit before insert on public.event_member_photos
  for each row execute function public.event_member_post_limit();
drop trigger if exists event_member_videos_limit on public.event_member_videos;
create trigger event_member_videos_limit before insert on public.event_member_videos
  for each row execute function public.event_member_post_limit();

-- 名簿の車か（自分の車であることは owns_car で別に見る）
create or replace function public.in_event_roster(p_event text, p_car text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.event_video_access where event_id = p_event and car_id = p_car);
$$;
revoke all on function public.in_event_roster(text, text) from public;
grant execute on function public.in_event_roster(text, text) to authenticated;

-- 動画：参加者は自分の名簿の車で足せる・自分の分だけ消せる
drop policy if exists event_member_videos_member_insert on public.event_member_videos;
create policy event_member_videos_member_insert on public.event_member_videos
  for insert to authenticated
  with check (car_id is not null and public.owns_car(car_id) and public.in_event_roster(event_id, car_id));
drop policy if exists event_member_videos_member_delete on public.event_member_videos;
create policy event_member_videos_member_delete on public.event_member_videos
  for delete to authenticated using (car_id is not null and public.owns_car(car_id));

-- 写真の表
alter table public.event_member_photos enable row level security;
drop policy if exists event_member_photos_select on public.event_member_photos;
create policy event_member_photos_select on public.event_member_photos
  for select using (public.can_view_event_video(event_id));
drop policy if exists event_member_photos_member_insert on public.event_member_photos;
create policy event_member_photos_member_insert on public.event_member_photos
  for insert to authenticated
  with check (car_id is not null and public.owns_car(car_id) and public.in_event_roster(event_id, car_id)
              and path like event_id || '/' || car_id || '/%');
drop policy if exists event_member_photos_delete on public.event_member_photos;
create policy event_member_photos_delete on public.event_member_photos
  for delete to authenticated using (public.is_admin() or (car_id is not null and public.owns_car(car_id)));
drop policy if exists event_member_photos_admin_write on public.event_member_photos;
create policy event_member_photos_admin_write on public.event_member_photos
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.event_member_photos to anon, authenticated;
grant insert, delete on public.event_member_photos, public.event_member_videos to authenticated;

-- 未ログインの案内用：動画と写真を合わせた件数
create or replace function public.event_member_video_count(p_event text)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select (select count(*) from public.event_member_videos where event_id = p_event)::int
       + (select count(*) from public.event_member_photos where event_id = p_event)::int;
$$;

-- 非公開のバケット（JPEG だけ・1枚 800KB まで＝ブラウザで縮めてから送る）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-member-photos', 'event-member-photos', false, 800000, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 800000, allowed_mime_types = array['image/jpeg'];

-- パスの1段目＝イベント、2段目＝車
drop policy if exists event_member_photos_obj_select on storage.objects;
create policy event_member_photos_obj_select on storage.objects
  for select using (bucket_id = 'event-member-photos'
                    and public.can_view_event_video(split_part(name, '/', 1)));
drop policy if exists event_member_photos_obj_insert on storage.objects;
create policy event_member_photos_obj_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-member-photos'
              and public.owns_car(split_part(name, '/', 2))
              and public.in_event_roster(split_part(name, '/', 1), split_part(name, '/', 2)));
drop policy if exists event_member_photos_obj_delete on storage.objects;
create policy event_member_photos_obj_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-member-photos'
         and (public.is_admin() or public.owns_car(split_part(name, '/', 2))));

-- 投稿に使う「名簿にある自分の車」（管理人でも他人の車は返さない）
create or replace function public.my_event_roster_cars(p_event text)
returns table(car_id text, handle_name text) language sql stable security definer
set search_path = public, pg_temp as $$
  select a.car_id, c.handle_name from public.event_video_access a
    join public.cars c on c.document_id = a.car_id
   where a.event_id = p_event and public.owns_car(a.car_id)
   order by a.car_id;
$$;
revoke all on function public.my_event_roster_cars(text) from public;
grant execute on function public.my_event_roster_cars(text) to authenticated;

-- ショート（縦長）か。投稿時に URL に /shorts/ があれば true
alter table public.event_member_videos add column if not exists vertical boolean not null default false;
