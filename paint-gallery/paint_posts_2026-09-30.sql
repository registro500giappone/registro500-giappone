-- FIAT500/126みんなのお絵描き帳：投稿（設計図＋縮小画像）
-- 設計図＝お絵描き帳の URL の # 以降。動画は預からない（見る人の端末で設計図から作り直す）
-- 書き込みは関数 paint_post_create だけ（テーブルへ直接 INSERT させない）。ログインなしでも投稿できる

create table if not exists public.paint_posts (
  id bigint generated always as identity primary key,
  car_type text not null check (car_type in ('500','126')),
  design text not null check (char_length(design) <= 3000),  -- 空＝何も塗っていない素の1台
  thumb_path text not null unique,
  comment text check (comment is null or char_length(comment) <= 40),
  visitor_name text check (visitor_name is null or char_length(visitor_name) <= 20),
  car_doc text,                 -- オーナーの投稿だけ（cars.document_id）
  user_id uuid,                 -- 投稿したオーナー（auth.uid()）
  delete_key_hash text,         -- ビジターの削除用の鍵（sha256）。鍵そのものは投稿した端末にだけ残る
  created_at timestamptz not null default now()
);
create index if not exists paint_posts_created_idx on public.paint_posts (created_at desc);
create index if not exists paint_posts_car_idx on public.paint_posts (car_doc, created_at desc);

alter table public.paint_posts enable row level security;
-- 直接の読み書きは誰にも許さない（読むのは paint_posts_list、書くのは create / delete の関数経由）
revoke all on public.paint_posts from anon, authenticated;

-- 投稿
create or replace function public.paint_post_create(
  p_car_type text, p_design text, p_thumb_path text,
  p_comment text default null, p_name text default null,
  p_car_doc text default null, p_delete_key text default null
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_comment text := nullif(btrim(coalesce(p_comment,'')), '');
  v_name text := nullif(btrim(coalesce(p_name,'')), '');
begin
  if p_car_type not in ('500','126') then raise exception 'bad car_type'; end if;
  if char_length(coalesce(p_design,'')) > 3000 then raise exception 'bad design'; end if;
  if v_comment is not null and char_length(v_comment) > 40 then raise exception 'comment too long'; end if;
  if v_name is not null and char_length(v_name) > 20 then raise exception 'name too long'; end if;
  if p_thumb_path !~ ('^' || p_car_type || '/[0-9a-f-]{36}\.jpg$') then raise exception 'bad thumb'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'paint-thumbs' and name = p_thumb_path) then
    raise exception 'thumb missing';
  end if;
  -- 洪水よけ：全体で1時間60件まで
  if (select count(*) from paint_posts where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate limited';
  end if;

  if p_car_doc is not null then
    -- オーナーの投稿＝本人の車であることを確かめる
    if v_uid is null or not exists (select 1 from cars where document_id = p_car_doc and owner_user_id = v_uid) then
      raise exception 'not your car';
    end if;
    insert into paint_posts (car_type, design, thumb_path, comment, car_doc, user_id)
    values (p_car_type, coalesce(p_design,''), p_thumb_path, v_comment, p_car_doc, v_uid)
    returning id into v_id;
  else
    if p_delete_key is null or char_length(p_delete_key) < 32 then raise exception 'bad key'; end if;
    insert into paint_posts (car_type, design, thumb_path, comment, visitor_name, user_id, delete_key_hash)
    values (p_car_type, coalesce(p_design,''), p_thumb_path, v_comment, v_name, v_uid,
            encode(sha256(convert_to(p_delete_key, 'UTF8')), 'hex'))
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- 削除（管理者／その車のいまのオーナー／投稿したオーナー本人／削除用の鍵を持つビジター）。縮小画像のパスを返す＝画面が続けて画像も消す
create or replace function public.paint_post_delete(p_id bigint, p_delete_key text default null)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  r paint_posts%rowtype;
  v_uid uuid := auth.uid();
begin
  select * into r from paint_posts where id = p_id;
  if not found then return null; end if;
  if not (
       is_admin()
    or (v_uid is not null and r.user_id = v_uid and r.car_doc is not null)
    or (v_uid is not null and r.car_doc is not null and exists (select 1 from cars where document_id = r.car_doc and owner_user_id = v_uid))
    or (p_delete_key is not null and r.delete_key_hash = encode(sha256(convert_to(p_delete_key, 'UTF8')), 'hex'))
  ) then
    raise exception 'not allowed';
  end if;
  delete from paint_posts where id = p_id;
  return r.thumb_path;
end $$;

-- 一覧（新しい順）。表示名＝オーナーはいまのハンドルネーム／ビジターは入力名、空なら「ゲスト」
create or replace function public.paint_posts_list(
  p_car_type text default null, p_car_doc text default null,
  p_limit int default 60, p_before bigint default null
) returns table (
  id bigint, car_type text, design text, thumb_path text, comment text,
  name text, car_doc text, is_owner_post boolean, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.car_type, p.design, p.thumb_path, p.comment,
         case when p.car_doc is not null then coalesce(nullif(c.handle_name,''), 'オーナー')
              else coalesce(p.visitor_name, 'ゲスト') end,
         p.car_doc, p.car_doc is not null, p.created_at
  from paint_posts p
  left join cars c on c.document_id = p.car_doc
  where (p_car_type is null or p.car_type = p_car_type)
    and (p_car_doc is null or p.car_doc = p_car_doc)
    and (p_before is null or p.id < p_before)
  order by p.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

revoke all on function public.paint_post_create(text,text,text,text,text,text,text) from public;
revoke all on function public.paint_post_delete(bigint,text) from public;
revoke all on function public.paint_posts_list(text,text,int,bigint) from public;
grant execute on function public.paint_post_create(text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.paint_post_delete(bigint,text) to anon, authenticated;
grant execute on function public.paint_posts_list(text,text,int,bigint) to anon, authenticated;

-- 縮小画像の置き場（公開読み取り・1枚300KBまで・JPEG だけ）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paint-thumbs', 'paint-thumbs', true, 300000, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 300000, allowed_mime_types = array['image/jpeg'];

-- 置く＝誰でも（名前は 500/ か 126/ ＋UUID.jpg だけ・上書き不可＝UPDATE の方針を作らない）
drop policy if exists paint_thumbs_insert on storage.objects;
create policy paint_thumbs_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'paint-thumbs' and name ~ '^(500|126)/[0-9a-f-]{36}\.jpg$');
drop policy if exists paint_thumbs_select on storage.objects;
create policy paint_thumbs_select on storage.objects for select to anon, authenticated
  using (bucket_id = 'paint-thumbs');
-- 消す＝どの投稿からも参照されていない画像だけ（投稿を消した直後の後片付け・投稿しそこねた画像）
-- 参照の有無は paint_posts を読めない匿名にも判定できるよう security definer の関数で見る
create or replace function public.paint_thumb_in_use(p_name text) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from paint_posts where thumb_path = p_name) $$;
revoke all on function public.paint_thumb_in_use(text) from public;
grant execute on function public.paint_thumb_in_use(text) to anon, authenticated;
drop policy if exists paint_thumbs_delete on storage.objects;
create policy paint_thumbs_delete on storage.objects for delete to anon, authenticated
  using (bucket_id = 'paint-thumbs' and not public.paint_thumb_in_use(name));
