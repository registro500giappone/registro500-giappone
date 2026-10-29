-- オーナーの記事（ブログなど、よそで書いた記事へのリンク） — 2026-10-29
-- 記事1本＝owner_articles。題名・日付はリンク先から読んだものを本人が直せる。本文・写真は持たない。
-- 「整備の記事」にした行（is_maintenance）は、車両ページの「整備だけ」とみんなの整備手帳にも出る。
-- 直す・消すは「書いた本人」と管理人だけ（整備手帳と同じ理由＝車の持ち主が替わっても前の持ち主の行を触らせない）。

create table if not exists public.owner_articles (
  id              uuid primary key default gen_random_uuid(),
  car_id          text not null,
  author_user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url             text not null check (url like 'https://%' and char_length(url) <= 1000),
  title           text not null check (char_length(btrim(title)) between 1 and 120),
  site_name       text check (site_name is null or char_length(site_name) <= 60),
  published_on    date not null,
  is_maintenance  boolean not null default false,
  areas           text[] not null default '{}'
                  check (areas <@ array['engine','fuel','driveline','suspension','brake','body','electric','consumable']::text[]),
  is_hidden       boolean not null default false,   -- 管理人だけが立てる（不適切なリンクを伏せる）
  digest_sent_at  timestamptz,                      -- 朝のダイジェストに載せた時刻（send_digest.py だけが書く）
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint owner_articles_car_url_key unique (car_id, url)
);

create index if not exists owner_articles_car_idx on public.owner_articles (car_id, published_on desc);
create index if not exists owner_articles_new_idx on public.owner_articles (created_at desc) where not is_hidden;

-- 車・作者・作成日時・伏せ・ダイジェスト済みは本人が変えられない（管理人は可）
create or replace function public.owner_articles_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.author_user_id := auth.uid();
      new.is_hidden := false;
      new.digest_sent_at := null;
    end if;
    new.created_at := now();
  elsif not public.is_admin() then
    new.car_id := old.car_id;
    new.author_user_id := old.author_user_id;
    new.created_at := old.created_at;
    new.is_hidden := old.is_hidden;
    new.digest_sent_at := old.digest_sent_at;
  end if;
  return new;
end $$;

drop trigger if exists owner_articles_guard on public.owner_articles;
create trigger owner_articles_guard before insert or update on public.owner_articles
  for each row execute function public.owner_articles_guard();

alter table public.owner_articles enable row level security;

drop policy if exists owner_articles_read on public.owner_articles;
create policy owner_articles_read on public.owner_articles for select to public
  using (not is_hidden or author_user_id = auth.uid() or public.is_admin());

drop policy if exists owner_articles_insert on public.owner_articles;
create policy owner_articles_insert on public.owner_articles for insert to authenticated
  with check (public.is_admin()
              or (public.owns_car(car_id) and author_user_id = auth.uid()));

drop policy if exists owner_articles_update on public.owner_articles;
create policy owner_articles_update on public.owner_articles for update to authenticated
  using (public.is_admin() or author_user_id = auth.uid())
  with check (public.is_admin() or author_user_id = auth.uid());

drop policy if exists owner_articles_delete on public.owner_articles;
create policy owner_articles_delete on public.owner_articles for delete to authenticated
  using (public.is_admin() or author_user_id = auth.uid());

revoke all on public.owner_articles from anon, authenticated;
grant select on public.owner_articles to anon;
grant select, insert, update, delete on public.owner_articles to authenticated;
