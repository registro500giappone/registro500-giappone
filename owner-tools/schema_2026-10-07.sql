-- みんなのおすすめ工具（オーナー投稿）— 2026-10-07
-- 正本＝owner-tools/HANDOFF.md §3

create table if not exists public.owner_tools (
  id          uuid primary key default gen_random_uuid(),
  car_id      text not null,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  category    text not null check (category in ('ignition','electric','chassis','wrench','measure','misc')),
  usage       text not null check (usage in ('carry','garage','both')),
  comment     text not null check (char_length(btrim(comment)) between 1 and 400),
  photo_url   text check (photo_url is null or photo_url like 'https://firebasestorage.googleapis.com/%'),
  consent_at  timestamptz not null default now(),
  source      text not null default 'post' check (source in ('post','notebook')),
  tool_key    text,
  amazon_url  text check (amazon_url is null or amazon_url like 'https://www.amazon.co.jp/%' or amazon_url like 'https://amzn.to/%'),
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_owner_tools_car on public.owner_tools (car_id);
create index if not exists idx_owner_tools_created on public.owner_tools (created_at desc);

-- 管理人専用列（tool_key・amazon_url・is_hidden・source）を非管理人が変えられないようにする
create or replace function public.owner_tools_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.tool_key := null; new.amazon_url := null; new.is_hidden := false; new.source := 'post';
    new.consent_at := now();
  else
    new.tool_key := old.tool_key; new.amazon_url := old.amazon_url;
    new.is_hidden := old.is_hidden; new.source := old.source;
    new.consent_at := old.consent_at; new.car_id := old.car_id; new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists owner_tools_guard on public.owner_tools;
create trigger owner_tools_guard before insert or update on public.owner_tools
  for each row execute function public.owner_tools_guard();

alter table public.owner_tools enable row level security;

drop policy if exists owner_tools_public_read on public.owner_tools;
create policy owner_tools_public_read on public.owner_tools for select to public
  using (is_hidden = false or public.is_admin() or public.owns_car(car_id));

drop policy if exists owner_tools_insert on public.owner_tools;
create policy owner_tools_insert on public.owner_tools for insert to authenticated
  with check (public.is_admin() or public.owns_car(car_id));

drop policy if exists owner_tools_update on public.owner_tools;
create policy owner_tools_update on public.owner_tools for update to authenticated
  using (public.is_admin() or public.owns_car(car_id))
  with check (public.is_admin() or public.owns_car(car_id));

drop policy if exists owner_tools_delete on public.owner_tools;
create policy owner_tools_delete on public.owner_tools for delete to authenticated
  using (public.is_admin() or public.owns_car(car_id));

grant select on public.owner_tools to anon;
grant select, insert, update, delete on public.owner_tools to authenticated;

-- 【2026-10-07 追記】写真は他サイトの画像URLでも可（ユーザー指示）・購入リンクは同意チェックではなく告知で
alter table public.owner_tools drop constraint if exists owner_tools_photo_url_check;
alter table public.owner_tools add constraint owner_tools_photo_url_check
  check (photo_url is null or (photo_url like 'https://%' and char_length(photo_url) <= 1000));
comment on column public.owner_tools.consent_at is '投稿した時刻（掲載と購入リンクの告知を表示した上での投稿）';
