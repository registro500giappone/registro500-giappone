-- 「🔧 わたしも使ってる」— 2026-10-07（正本＝owner-tools/HANDOFF.md §6）
-- 押せるのはログイン済みの登録オーナーだけ・車1台につき投稿1件に1回。
create table if not exists public.owner_tool_users (
  id         uuid primary key default gen_random_uuid(),
  tool_id    uuid not null references public.owner_tools(id) on delete cascade,
  car_id     text not null,
  created_at timestamptz not null default now(),
  unique (tool_id, car_id)
);
create index if not exists idx_owner_tool_users_tool on public.owner_tool_users (tool_id);
create index if not exists idx_owner_tool_users_car on public.owner_tool_users (car_id);

alter table public.owner_tool_users enable row level security;

drop policy if exists owner_tool_users_read on public.owner_tool_users;
create policy owner_tool_users_read on public.owner_tool_users for select to public using (true);

drop policy if exists owner_tool_users_insert on public.owner_tool_users;
create policy owner_tool_users_insert on public.owner_tool_users for insert to authenticated
  with check (public.is_admin() or public.owns_car(car_id));

drop policy if exists owner_tool_users_delete on public.owner_tool_users;
create policy owner_tool_users_delete on public.owner_tool_users for delete to authenticated
  using (public.is_admin() or public.owns_car(car_id));

grant select on public.owner_tool_users to anon;
grant select, insert, delete on public.owner_tool_users to authenticated;
