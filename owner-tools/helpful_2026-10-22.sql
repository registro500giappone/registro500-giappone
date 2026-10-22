-- 「👍 参考になった」— 2026-10-22（正本＝owner-tools/HANDOFF.md §6c）
-- 使っていなくても、読んで役に立った登録オーナーが投稿者をたたえるボタン。
-- ⛔数は画面に出さない＝投稿者本人にだけ翌朝のメールで知らせる（send_digest.py の send_metoo_notices）。
-- そのため他人の押した行は誰にも読ませない（読めるのは押した本人と管理人だけ）。
create table if not exists public.owner_tool_helpful (
  id         uuid primary key default gen_random_uuid(),
  tool_id    uuid not null references public.owner_tools(id) on delete cascade,
  car_id     text not null,
  created_at timestamptz not null default now(),
  unique (tool_id, car_id)
);
create index if not exists idx_owner_tool_helpful_car on public.owner_tool_helpful (car_id);

alter table public.owner_tool_helpful enable row level security;

drop policy if exists owner_tool_helpful_read on public.owner_tool_helpful;
create policy owner_tool_helpful_read on public.owner_tool_helpful for select to authenticated
  using (public.is_admin() or public.owns_car(car_id));

-- 自分の投稿には押せない（同じ持ち主の車の投稿も含む）
drop policy if exists owner_tool_helpful_insert on public.owner_tool_helpful;
create policy owner_tool_helpful_insert on public.owner_tool_helpful for insert to authenticated
  with check (public.owns_car(car_id)
    and not exists (select 1 from public.owner_tools t where t.id = tool_id and public.owns_car(t.car_id)));

drop policy if exists owner_tool_helpful_delete on public.owner_tool_helpful;
create policy owner_tool_helpful_delete on public.owner_tool_helpful for delete to authenticated
  using (public.is_admin() or public.owns_car(car_id));

revoke all on public.owner_tool_helpful from anon;
grant select, insert, delete on public.owner_tool_helpful to authenticated;

-- 知らせ済みの台帳を「わたしも使ってる」と「参考になった」で分ける（同じ車が両方押せるため）
alter table public.owner_tool_metoo_notices add column if not exists kind text not null default 'metoo';
alter table public.owner_tool_metoo_notices drop constraint if exists owner_tool_metoo_notices_pkey;
alter table public.owner_tool_metoo_notices add primary key (tool_id, car_id, kind);
