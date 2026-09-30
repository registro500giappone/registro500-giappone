-- 書込ポリシーを「ログイン済みなら誰でも」から「持ち主か管理者だけ」へ絞る（2026-09-30 適用）
--
-- 2026-09-30 のセキュリティ点検で、cars / car_episodes / events / event_participants /
-- event_photos / event_report_photos の UPDATE・DELETE と news の INSERT が
-- `auth.uid() IS NOT NULL` だけで、行の持ち主を見ていないことが分かった。
-- Google ログインは誰でも作れるので、アカウントを作れば REST から他人の車両を
-- 書き換え・削除でき、news に入れた行は翌朝のダイジェストで全オーナーへ配信される。
--
-- 方針：
--   * 持ち主＝cars.owner_user_id = auth.uid()。子テーブルは car_id / owner_id で cars を辿る。
--   * owner_user_id が NULL の車（まだ一度もログインしていない旧登録 50 台）は、
--     ログイン時に link_owner_car() がメール一致で紐づける。その紐づけ前に本人が編集する
--     場面（edit.html は保存時に owner_user_id を入れる）を壊さないよう、
--     「NULL かつ owner_email が JWT のメールと一致」も本人とみなす。
--   * 管理者（is_admin()）は従来どおり全部できる。
--   * INSERT の条件は変えない（登録・投稿の入口を狭めない）。ただし events は
--     owner_id を自分の車か 'ADMIN'（管理者のみ）に限る。
--   * news は管理者以外 INSERT 不可（フロントに書込経路は無く、Actions は service_role）。
--   * event_photos / event_report_photos はフロントに書込経路が無いので DELETE は管理者のみ。
--   * user_selections（`id IS NOT NULL` で匿名から ALL）はフロントに参照が無い＝ログイン必須に。

create or replace function public.owns_car(p_doc text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.cars c
     where c.document_id = p_doc
       and (
         c.owner_user_id = auth.uid()
         or (c.owner_user_id is null
             and lower(c.owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
       )
  );
$$;

-- cars ----------------------------------------------------------------
drop policy if exists cars_update_policy on public.cars;
create policy cars_update_policy on public.cars
  for update
  using (
    is_admin()
    or owner_user_id = auth.uid()
    or (owner_user_id is null
        and lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
  with check (
    is_admin()
    or owner_user_id = auth.uid()
    or (owner_user_id is null
        and lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );

drop policy if exists cars_delete_policy on public.cars;
create policy cars_delete_policy on public.cars
  for delete
  using (is_admin() or owner_user_id = auth.uid());

-- car_episodes --------------------------------------------------------
drop policy if exists car_episodes_update_auth on public.car_episodes;
create policy car_episodes_update_auth on public.car_episodes
  for update
  using (is_admin() or owns_car(car_id))
  with check (is_admin() or owns_car(car_id));

drop policy if exists car_episodes_delete_auth on public.car_episodes;
create policy car_episodes_delete_auth on public.car_episodes
  for delete
  using (is_admin() or owns_car(car_id));

drop policy if exists car_episodes_insert_auth on public.car_episodes;
create policy car_episodes_insert_auth on public.car_episodes
  for insert
  with check (is_admin() or owns_car(car_id));

-- events --------------------------------------------------------------
drop policy if exists events_insert_policy on public.events;
create policy events_insert_policy on public.events
  for insert
  with check (is_admin() or owns_car(owner_id));

drop policy if exists events_update_policy on public.events;
create policy events_update_policy on public.events
  for update
  using (is_admin() or owns_car(owner_id))
  with check (is_admin() or owns_car(owner_id));

drop policy if exists events_delete_policy on public.events;
create policy events_delete_policy on public.events
  for delete
  using (is_admin() or owns_car(owner_id));

-- event_participants ---------------------------------------------------
drop policy if exists event_participants_insert_policy on public.event_participants;
create policy event_participants_insert_policy on public.event_participants
  for insert
  with check (is_admin() or owns_car(car_id));

drop policy if exists event_participants_delete_policy on public.event_participants;
create policy event_participants_delete_policy on public.event_participants
  for delete
  using (is_admin() or owns_car(car_id));

-- event_photos / event_report_photos（フロントに書込経路なし）------------
drop policy if exists event_photos_delete_policy on public.event_photos;
create policy event_photos_delete_policy on public.event_photos
  for delete using (is_admin());

drop policy if exists event_report_photos_delete_policy on public.event_report_photos;
create policy event_report_photos_delete_policy on public.event_report_photos
  for delete using (is_admin());

drop policy if exists event_report_photos_insert_policy on public.event_report_photos;
create policy event_report_photos_insert_policy on public.event_report_photos
  for insert with check (is_admin());

-- news（投入は管理者と Actions だけ）-------------------------------------
drop policy if exists news_insert_policy on public.news;
create policy news_insert_policy on public.news
  for insert with check (is_admin());

-- user_selections（匿名 ALL → ログイン必須）-----------------------------
drop policy if exists "Allow insert/update with id" on public.user_selections;
create policy user_selections_auth_only on public.user_selections
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
