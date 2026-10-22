-- 「わたしも使ってる」を投稿した本人にだけ知らせる — 2026-10-22（正本＝owner-tools/HANDOFF.md §6b）
-- 知らせ済みの（工具, 押した車）の組を残す台帳。押す→取り消す→押し直すを繰り返しても、
-- 同じ組では二度と知らせない（owner_tool_users は取り消しで行が消えるため、そちらには印を持てない）。
-- 読み書きは py/send_digest.py（サーバー側の権限）だけ＝ポリシーを作らず、anon・authenticated の権限も外す。
create table if not exists public.owner_tool_metoo_notices (
  tool_id     uuid not null,
  car_id      text not null,
  notified_at timestamptz not null default now(),
  primary key (tool_id, car_id)
);

alter table public.owner_tool_metoo_notices enable row level security;
revoke all on public.owner_tool_metoo_notices from anon, authenticated;
grant select, insert on public.owner_tool_metoo_notices to service_role;
