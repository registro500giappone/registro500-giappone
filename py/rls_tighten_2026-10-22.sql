-- 2026-10-22 のセキュリティ点検で見つかった3点を絞る（2026-10-22 適用）
--
-- 1. car_episodes：SELECT に `auth.uid() IS NOT NULL` のポリシーがあり、
--    ログインできる人なら誰でも他人の非公開（is_published=false）ストーリーを読めた。
--    非公開を読めるのは持ち主と管理者だけにする（公開分は public_read のまま）。
--    フロントで非公開を読むのは episode-edit.html（持ち主の編集）だけ。
-- 2. storage paint-thumbs：匿名アップロードに上限が無く、投稿に使わない画像を
--    際限なく置けた。投稿（paint_post_create）と同じ「直近1時間で60枚」を上限にする。
--    匿名にも paint-thumbs の SELECT を許しているので、サブクエリの件数は全件が数えられる。
-- 3. user_selections：ALL ポリシーが `auth.uid() IS NOT NULL` だけで、ログインすれば
--    他人の行を書き換え・削除できた。フロントに参照が無いので書込ポリシーを外す
--    （読取の "Allow select for all" は py/gen_report.py の件数集計のため残す）。

-- 1 -------------------------------------------------------------------
drop policy if exists car_episodes_select_auth on public.car_episodes;
create policy car_episodes_select_owner on public.car_episodes
  for select to public
  using (is_admin() or owns_car(car_id));

-- 2 -------------------------------------------------------------------
drop policy if exists paint_thumbs_insert on storage.objects;
create policy paint_thumbs_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'paint-thumbs'
    and name ~ '^(500|126)/[0-9a-f-]{36}\.jpg$'
    and (select count(*) from storage.objects o
          where o.bucket_id = 'paint-thumbs'
            and o.created_at > now() - interval '1 hour') < 60
  );

-- 3 -------------------------------------------------------------------
drop policy if exists user_selections_auth_only on public.user_selections;
