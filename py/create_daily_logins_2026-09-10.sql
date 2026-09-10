-- 2026-09-10 適用済み（Supabase 本番）
-- 日次ユニークログイン人数（延べではない）を記録するテーブルと収集関数。
-- ⛔非公開: RLSを有効化しポリシーは作らない＝service_role以外は読み書き不可。
-- 定義・運用の背景は project-history-and-join-cta-2026-09 系メモリと py/gen_report.py を見る。

create table if not exists public.daily_logins (
  login_date date not null,
  user_id uuid not null,
  car_id text,
  handle_name text,
  owner_email text,
  n_cars integer not null default 1,
  first_login_at timestamptz not null,
  sessions_that_day integer not null default 1,
  primary key (login_date, user_id)
);

comment on table public.daily_logins is
  '日次のユニークログイン人数の記録（延べ=セッション数ではなく実人数）。⛔非公開テーブル（RLS・ポリシーなし）。auth.sessions は保持期間が不確定なため、毎日 sync_daily_logins() で固定保存する。';

alter table public.daily_logins enable row level security;

create or replace function public.sync_daily_logins(target_date date default null)
returns integer
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  d date := coalesce(target_date, ((now() at time zone 'Asia/Tokyo')::date - 1));
  n integer;
begin
  with day_sessions as (
    select s.user_id, min(s.created_at) as first_login_at, count(*) as sessions_that_day
    from auth.sessions s
    where (s.created_at at time zone 'Asia/Tokyo')::date = d
    group by s.user_id
  ),
  owner as (
    select c.owner_user_id as user_id,
           (array_agg(c.id order by c.created_at))[1] as car_id,
           (array_agg(c.handle_name order by c.created_at))[1] as handle_name,
           (array_agg(c.owner_email order by c.created_at))[1] as owner_email,
           count(*) as n_cars
    from public.cars c
    where c.owner_user_id is not null
    group by c.owner_user_id
  )
  insert into public.daily_logins (login_date, user_id, car_id, handle_name, owner_email, n_cars, first_login_at, sessions_that_day)
  select d, ds.user_id, o.car_id, o.handle_name, o.owner_email, coalesce(o.n_cars, 0),
         ds.first_login_at, ds.sessions_that_day
  from day_sessions ds
  left join owner o on o.user_id = ds.user_id
  on conflict (login_date, user_id) do update set
    car_id = excluded.car_id, handle_name = excluded.handle_name, owner_email = excluded.owner_email,
    n_cars = excluded.n_cars, first_login_at = excluded.first_login_at, sessions_that_day = excluded.sessions_that_day;

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.sync_daily_logins is
  '引数の日付（省略時はJSTの昨日）のユニークログイン人数を daily_logins へ upsert する。戻り値=書き込んだ人数。毎日 GitHub Actions から呼ぶ。';

create or replace function public.report_daily_logins(days integer default 30)
returns json
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(json_agg(json_build_object('d', to_char(login_date,'YYYY-MM-DD'), 'n', n) order by login_date), '[]'::json)
  from (
    select login_date, count(*) as n
    from public.daily_logins
    where login_date >= (now() at time zone 'Asia/Tokyo')::date - days
    group by login_date
  ) x;
$$;

comment on function public.report_daily_logins is
  '直近days日ぶんの日次ユニークログイン人数を{date,n}の配列で返す。個人情報は含まない。report.html から呼ぶ。';
