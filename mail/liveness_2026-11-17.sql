-- 年に一度の「今も乗っていますか？」の確認 — 2026-11-17
--   1年動きのなかった車のオーナーにだけ、1台につき年1回、ボタン1つで答えられるメールを送る（催促はしない）。
--   答えがなくても何も消さない・公開の表示も変えない。2回続けて答えがなければ内部の「消息不明」（missed >= 2）。
--   ⛔最後に確認した日・消息不明を公開ページに出さない。

create table if not exists public.car_liveness (
  car_id        text primary key,                 -- cars.document_id
  last_seen_at  timestamptz,                      -- 持ち主の最後の動き（liveness_sync が毎朝進める）
  asked_at      timestamptz,                      -- 最後に確認のメールを送った日
  token         uuid unique,                      -- 返事のページの札（聞くたびに作り直す）
  answer        text check (answer in ('keep', 'sold')),
  answered_at   timestamptz,
  missed        integer not null default 0,       -- 続けて答えのなかった回数（聞いたら +1・動きか返事で 0）
  updated_at    timestamptz not null default now()
);
alter table public.car_liveness enable row level security;   -- ポリシーなし＝非公開（送信スクリプトと下の関数だけ）
comment on table public.car_liveness is '年1回の生存確認。⛔非公開（RLS・ポリシーなし）。公開ページに出さない。';

-- 毎朝：持ち主の最後の動きを集める（スイッチ OFF の間も回す＝セッションは消えるので残しておく）
create or replace function public.liveness_sync()
returns integer
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare n integer;
begin
  with owner_of as (
    select c.document_id as car_id,
           coalesce(c.owner_user_id,
                    (select u.id from auth.users u where lower(u.email) = lower(c.owner_email) limit 1)) as user_id,
           c.last_update_date
      from public.cars c
     where not c.is_sold
  ),
  seen as (
    select o.car_id,
           greatest(
             o.last_update_date,                               -- ⛔cars.updated_at は使わない（管理人の一括修正でも動く）
             (select u.last_sign_in_at from auth.users u where u.id = o.user_id),
             (select max(greatest(s.created_at, s.updated_at, s.refreshed_at::timestamptz))
                from auth.sessions s where s.user_id = o.user_id),
             (select (max(d.login_date) + 1)::timestamptz from public.daily_logins d where d.user_id = o.user_id)
           ) as t
      from owner_of o
  )
  insert into public.car_liveness as l (car_id, last_seen_at)
  select car_id, t from seen where t is not null
  on conflict (car_id) do update
     set last_seen_at = greatest(l.last_seen_at, excluded.last_seen_at),
         missed = case when l.asked_at is not null and excluded.last_seen_at > l.asked_at then 0 else l.missed end,
         updated_at = now()
   where l.last_seen_at is distinct from greatest(l.last_seen_at, excluded.last_seen_at);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.liveness_sync() from public, anon, authenticated;

-- 聞く車（古い登録順に n 台）
create or replace function public.liveness_targets(p_limit integer default 10)
returns table (car_id text, owner_email text, handle_name text, model text, registered_at timestamptz, missed integer)
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  select c.document_id, lower(c.owner_email), c.handle_name, coalesce(c.model_display_c, 'お車'), c.created_at,
         coalesce(l.missed, 0)
    from public.cars c
    left join public.car_liveness l on l.car_id = c.document_id
   where not c.is_sold
     and c.owner_email like '%@%'
     and c.created_at < now() - interval '365 days'
     and coalesce(l.last_seen_at, c.created_at) < now() - interval '365 days'
     and (l.asked_at is null or l.asked_at < now() - interval '365 days')
   order by c.created_at asc
   limit greatest(p_limit, 0)
$$;
revoke all on function public.liveness_targets(integer) from public, anon, authenticated;

-- 返事（/alive から公開キーで呼ぶ）。札は聞いてから400日だけ有効。答えは1回だけ（2回目は今の答えを返すだけ）。
create or replace function public.liveness_answer(p_token uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r public.car_liveness%rowtype;
  c public.cars%rowtype;
  others integer;
begin
  if p_answer not in ('keep', 'sold') then return null; end if;
  select * into r from public.car_liveness
   where token = p_token and asked_at > now() - interval '400 days' for update;
  if not found then return null; end if;
  select * into c from public.cars where document_id = r.car_id;
  if not found then return null; end if;

  if r.answer is not null then
    return jsonb_build_object('model', c.model_display_c, 'answer', r.answer, 'already', true);
  end if;

  update public.car_liveness
     set answer = p_answer, answered_at = now(), missed = 0,
         last_seen_at = case when p_answer = 'keep' then now() else last_seen_at end,
         updated_at = now()
   where car_id = r.car_id;

  if p_answer = 'sold' and not c.is_sold then
    update public.cars set is_sold = true, sold_at = now() where document_id = r.car_id;
  end if;

  select count(*) into others from public.cars
   where lower(owner_email) = lower(c.owner_email) and not is_sold;

  -- 車がもう残っていない人には、このページで週刊便りを案内する＝翌朝の「手放した人への問いかけ」を重ねて送らない
  if p_answer = 'sold' and others = 0 and c.owner_email like '%@%' then
    insert into public.mail_former_asks (email, car_id) values (lower(c.owner_email), r.car_id)
    on conflict (email) do nothing;
  end if;

  return jsonb_build_object('model', c.model_display_c, 'answer', p_answer, 'already', false,
                            'other_cars', others);
end $$;
revoke all on function public.liveness_answer(uuid, text) from public;
grant execute on function public.liveness_answer(uuid, text) to anon, authenticated;
