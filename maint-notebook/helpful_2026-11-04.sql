-- 整備の記録の「👍 参考になった」— 2026-11-04（おすすめ工具の owner_tool_helpful と同じ扱い）
-- 読んで役に立った登録オーナーが、書いた人をたたえるボタン。
-- ⛔数は画面に出さない＝記録の車の持ち主にだけ翌朝のメールで知らせる（send_digest.py の send_maint_helpful_notices）。
-- そのため他人の押した行は誰にも読ませない（読めるのは押した本人と管理人だけ）。
create table if not exists public.maint_helpful (
  id         uuid primary key default gen_random_uuid(),
  record_id  uuid not null references public.maint_records(id) on delete cascade,
  car_id     text not null,
  created_at timestamptz not null default now(),
  unique (record_id, car_id)
);
create index if not exists idx_maint_helpful_car on public.maint_helpful (car_id);

alter table public.maint_helpful enable row level security;

drop policy if exists maint_helpful_read on public.maint_helpful;
create policy maint_helpful_read on public.maint_helpful for select to authenticated
  using (public.is_admin() or public.owns_car(car_id));

-- 押せるのは公開の記録だけ。自分の車の記録には押せない（同じ持ち主の車の記録も含む）
drop policy if exists maint_helpful_insert on public.maint_helpful;
create policy maint_helpful_insert on public.maint_helpful for insert to authenticated
  with check (public.owns_car(car_id)
    and exists (select 1 from public.maint_records m where m.id = record_id and m.is_public and m.work_date is not null)
    and not exists (select 1 from public.maint_records m where m.id = record_id and public.owns_car(m.car_id)));

drop policy if exists maint_helpful_delete on public.maint_helpful;
create policy maint_helpful_delete on public.maint_helpful for delete to authenticated
  using (public.is_admin() or public.owns_car(car_id));

revoke all on public.maint_helpful from anon;
grant select, insert, delete on public.maint_helpful to authenticated;

-- 知らせ済みの台帳（サーバー側＝秘密鍵だけが読み書き）。取り消して押し直しても同じ組では二度と知らせない
create table if not exists public.maint_helpful_notices (
  record_id   uuid not null,
  car_id      text not null,
  notified_at timestamptz not null default now(),
  primary key (record_id, car_id)
);
alter table public.maint_helpful_notices enable row level security;
revoke all on public.maint_helpful_notices from anon, authenticated;
