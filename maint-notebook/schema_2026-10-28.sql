-- マイ整備手帳／みんなの整備手帳 — 2026-10-28
-- 記録1件＝maint_records、写真1枚＝maint_photos、費用＝maint_costs（書いた本人と管理人だけが読める）。
-- 直す・消すは「書いた本人」と管理人だけ（車が売れて持ち主が替わっても、前の持ち主の記録を新しい持ち主が触れないように）。

-- ── 記録 ──────────────────────────────────────────
create table if not exists public.maint_records (
  id              uuid primary key default gen_random_uuid(),
  car_id          text not null,
  author_user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 80),
  comment         text check (comment is null or char_length(comment) <= 2000),
  work_date       date,
  odometer_km     integer check (odometer_km is null or odometer_km between 0 and 999999),
  areas           text[] not null default '{}'
                  check (areas <@ array['engine','fuel','driveline','suspension','brake','body','electric','consumable']::text[]),
  worker          text check (worker is null or worker in ('diy','shop')),
  is_public       boolean not null default true,
  source          text not null default 'post' check (source in ('post','minkara')),
  minkara_url     text check (minkara_url is null
                              or (minkara_url like 'https://minkara.carview.co.jp/%' and char_length(minkara_url) <= 500)),
  video_urls      text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 作業日が空でよいのは、みんカラから貼った「日付待ち」の行だけ
  constraint maint_records_work_date_check check (work_date is not null or source = 'minkara'),
  constraint maint_records_minkara_check check (source <> 'minkara' or minkara_url is not null)
);

-- 動画は YouTube・Instagram・X のURLだけ
create or replace function public.maint_video_urls_ok(u text[])
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select coalesce(bool_and(
    char_length(x) <= 500
    and x ~ '^https://((www|m)\.)?(youtube\.com|youtu\.be|instagram\.com|x\.com|twitter\.com)/'
  ), true)
  from unnest(u) as x
$$;
alter table public.maint_records drop constraint if exists maint_records_video_urls_check;
alter table public.maint_records add constraint maint_records_video_urls_check
  check (public.maint_video_urls_ok(video_urls));

-- 歩み（車ごと・作業日の新しい順、同じ日は入力した順）
create index if not exists idx_maint_records_car
  on public.maint_records (car_id, work_date desc, created_at);
-- みんなの整備手帳（公開の記録だけを新しい順に）
create index if not exists idx_maint_records_public
  on public.maint_records (work_date desc, created_at desc)
  where is_public and work_date is not null;

-- 車・作者・作成日時は後から変えさせない（管理人の代行だけは例外）
create or replace function public.maint_records_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.author_user_id := auth.uid();
    end if;
    new.created_at := now();
  elsif not public.is_admin() then
    new.car_id := old.car_id;
    new.author_user_id := old.author_user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists maint_records_guard on public.maint_records;
create trigger maint_records_guard before insert or update on public.maint_records
  for each row execute function public.maint_records_guard();

alter table public.maint_records enable row level security;

drop policy if exists maint_records_read on public.maint_records;
create policy maint_records_read on public.maint_records for select to public
  using ((is_public and work_date is not null)
         or author_user_id = auth.uid()
         or public.is_admin());

drop policy if exists maint_records_insert on public.maint_records;
create policy maint_records_insert on public.maint_records for insert to authenticated
  with check (public.is_admin()
              or (public.owns_car(car_id) and author_user_id = auth.uid()));

drop policy if exists maint_records_update on public.maint_records;
create policy maint_records_update on public.maint_records for update to authenticated
  using (public.is_admin() or author_user_id = auth.uid())
  with check (public.is_admin() or author_user_id = auth.uid());

drop policy if exists maint_records_delete on public.maint_records;
create policy maint_records_delete on public.maint_records for delete to authenticated
  using (public.is_admin() or author_user_id = auth.uid());

revoke all on public.maint_records from anon, authenticated;
grant select on public.maint_records to anon;
grant select, insert, update, delete on public.maint_records to authenticated;

-- ── 写真 ──────────────────────────────────────────
create table if not exists public.maint_photos (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references public.maint_records(id) on delete cascade,
  url         text not null check (url like 'https://firebasestorage.googleapis.com/%' and char_length(url) <= 1000),
  thumb_url   text check (thumb_url is null
                          or (thumb_url like 'https://firebasestorage.googleapis.com/%' and char_length(thumb_url) <= 1000)),
  caption     text check (caption is null or char_length(caption) <= 500),
  sort_order  integer not null default 0,
  taken_at    timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_maint_photos_record on public.maint_photos (record_id, sort_order);

-- 写真を別の記録へ付け替えさせない（管理人の代行だけは例外）
create or replace function public.maint_photos_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and not public.is_admin() then
    new.record_id := old.record_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists maint_photos_guard on public.maint_photos;
create trigger maint_photos_guard before update on public.maint_photos
  for each row execute function public.maint_photos_guard();

alter table public.maint_photos enable row level security;

drop policy if exists maint_photos_read on public.maint_photos;
create policy maint_photos_read on public.maint_photos for select to public
  using (exists (select 1 from public.maint_records r
                  where r.id = maint_photos.record_id
                    and ((r.is_public and r.work_date is not null)
                         or r.author_user_id = auth.uid()
                         or public.is_admin())));

drop policy if exists maint_photos_write on public.maint_photos;
create policy maint_photos_write on public.maint_photos for all to authenticated
  using (exists (select 1 from public.maint_records r
                  where r.id = maint_photos.record_id
                    and (r.author_user_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.maint_records r
                       where r.id = maint_photos.record_id
                         and (r.author_user_id = auth.uid() or public.is_admin())));

revoke all on public.maint_photos from anon, authenticated;
grant select on public.maint_photos to anon;
grant select, insert, update, delete on public.maint_photos to authenticated;

-- ── 費用（他の人には見せない。読めるのは書いた本人と管理人の代行だけ） ──────────────
create table if not exists public.maint_costs (
  record_id   uuid primary key references public.maint_records(id) on delete cascade,
  cost_yen    integer not null check (cost_yen between 0 and 100000000),
  updated_at  timestamptz not null default now()
);

alter table public.maint_costs enable row level security;

drop policy if exists maint_costs_own on public.maint_costs;
create policy maint_costs_own on public.maint_costs for all to authenticated
  using (public.is_admin()
         or exists (select 1 from public.maint_records r
                     where r.id = maint_costs.record_id and r.author_user_id = auth.uid()))
  with check (public.is_admin()
              or exists (select 1 from public.maint_records r
                          where r.id = maint_costs.record_id and r.author_user_id = auth.uid()));

revoke all on public.maint_costs from anon, authenticated;
grant select, insert, update, delete on public.maint_costs to authenticated;

-- 【2026-10-28 追記】ガードは「画面からの一般利用者の操作」だけに掛ける。
-- auth.uid() が無い操作（SQL からの管理作業・バックアップからの復元）は値をそのまま通す
-- （前の形だと作者が空になって入れられず、復元では作成日時が今の時刻に置き換わっていた）。
create or replace function public.maint_records_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.is_admin() then
    if tg_op = 'UPDATE' then new.updated_at := now(); end if;
    return new;
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.author_user_id := auth.uid();
    new.created_at := now();
  else
    new.car_id := old.car_id;
    new.author_user_id := old.author_user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create or replace function public.maint_photos_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_admin() then
    new.record_id := old.record_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
