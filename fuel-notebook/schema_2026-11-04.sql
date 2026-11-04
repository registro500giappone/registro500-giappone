-- 給油の記録 — 2026-11-04
-- 給油1回＝fuel_records、金額＝fuel_costs（書いた本人と管理人だけが読める）。
-- 写真は保存しない（レシートとメーターは /api/fuel-read で読むだけ）。fuel_read_log はその読み取り回数の控え（1人1日10回まで）。
-- 直す・消すは「書いた本人」と管理人だけ（maint_records と同じ理由＝車が売れても前の持ち主の記録を新しい持ち主が触れない）。

-- ── 給油 ──────────────────────────────────────────
create table if not exists public.fuel_records (
  id              uuid primary key default gen_random_uuid(),
  car_id          text not null,
  author_user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fill_date       date not null,
  odometer_km     integer not null check (odometer_km between 0 and 999999),
  liters          numeric(5,2) not null check (liters > 0 and liters <= 60),
  fuel            text check (fuel is null or fuel in ('regular','premium','diesel')),
  full_tank       boolean not null default true,
  note            text check (note is null or char_length(note) <= 500),
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 車ごと・給油日の新しい順（同じ日は距離の大きい順）。燃費は表示のたびにここから計算する
create index if not exists idx_fuel_records_car
  on public.fuel_records (car_id, fill_date desc, odometer_km desc);

-- 車・作者・作成日時は後から変えさせない（管理人の代行と SQL からの管理作業は値をそのまま通す）
create or replace function public.fuel_records_guard()
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

drop trigger if exists fuel_records_guard on public.fuel_records;
create trigger fuel_records_guard before insert or update on public.fuel_records
  for each row execute function public.fuel_records_guard();

alter table public.fuel_records enable row level security;

drop policy if exists fuel_records_read on public.fuel_records;
create policy fuel_records_read on public.fuel_records for select to public
  using (is_public or author_user_id = auth.uid() or public.is_admin());

drop policy if exists fuel_records_insert on public.fuel_records;
create policy fuel_records_insert on public.fuel_records for insert to authenticated
  with check (public.is_admin()
              or (public.owns_car(car_id) and author_user_id = auth.uid()));

drop policy if exists fuel_records_update on public.fuel_records;
create policy fuel_records_update on public.fuel_records for update to authenticated
  using (public.is_admin() or author_user_id = auth.uid())
  with check (public.is_admin() or author_user_id = auth.uid());

drop policy if exists fuel_records_delete on public.fuel_records;
create policy fuel_records_delete on public.fuel_records for delete to authenticated
  using (public.is_admin() or author_user_id = auth.uid());

revoke all on public.fuel_records from anon, authenticated;
grant select on public.fuel_records to anon;
grant select, insert, update, delete on public.fuel_records to authenticated;

-- ── 金額（他の人には見せない。読めるのは書いた本人と管理人だけ） ──────────────
create table if not exists public.fuel_costs (
  record_id   uuid primary key references public.fuel_records(id) on delete cascade,
  total_yen   integer not null check (total_yen between 0 and 1000000),
  updated_at  timestamptz not null default now()
);

alter table public.fuel_costs enable row level security;

drop policy if exists fuel_costs_own on public.fuel_costs;
create policy fuel_costs_own on public.fuel_costs for all to authenticated
  using (public.is_admin()
         or exists (select 1 from public.fuel_records r
                     where r.id = fuel_costs.record_id and r.author_user_id = auth.uid()))
  with check (public.is_admin()
              or exists (select 1 from public.fuel_records r
                          where r.id = fuel_costs.record_id and r.author_user_id = auth.uid()));

revoke all on public.fuel_costs from anon, authenticated;
grant select, insert, update, delete on public.fuel_costs to authenticated;

-- ── 読み取り回数の控え（/api/fuel-read がサーバーの鍵で書く。画面からは読めも書けもしない） ──
create table if not exists public.fuel_read_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_fuel_read_log_user on public.fuel_read_log (user_id, created_at desc);

alter table public.fuel_read_log enable row level security;
revoke all on public.fuel_read_log from anon, authenticated;

-- ── 車両ページ用：公開の行と、その区間の燃費（2026-11-04 追記） ──────────────
-- 非公開の行があると、車両ページ（公開の行しか見えない）で数えた燃費が狂う（間に入れた量が抜ける）。
-- そこで区間は全部の行で数え、返すのは公開の行とその区間の距離・量だけにする＝非公開の行の中身は出ない。
-- 数え方は fuel-view.js の economy() と同じ（満タン法・5桁メーターの一周を足し戻す）。
create or replace function public.fuel_public_rows(p_car text)
returns table (id uuid, fill_date date, odometer_km integer, liters numeric, fuel text, full_tank boolean,
               sec_km integer, sec_liters numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  r record;
  last_odo integer := null;
  sum_l numeric := 0;
  d integer;
begin
  for r in select * from public.fuel_records f where f.car_id = p_car order by f.fill_date, f.odometer_km loop
    sec_km := null; sec_liters := null;
    if last_odo is not null then sum_l := sum_l + r.liters; end if;
    if r.full_tank then
      if last_odo is not null then
        d := r.odometer_km - last_odo;
        if d < 0 and d + 100000 <= 1500 then d := d + 100000; end if;
        if d > 0 and sum_l > 0 then sec_km := d; sec_liters := sum_l; end if;
      end if;
      last_odo := r.odometer_km; sum_l := 0;
    end if;
    if r.is_public then
      id := r.id; fill_date := r.fill_date; odometer_km := r.odometer_km; liters := r.liters;
      fuel := r.fuel; full_tank := r.full_tank;
      return next;
    end if;
  end loop;
end $$;

revoke all on function public.fuel_public_rows(text) from public;
grant execute on function public.fuel_public_rows(text) to anon, authenticated;
