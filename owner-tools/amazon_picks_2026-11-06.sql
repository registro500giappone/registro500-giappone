-- おすすめ工具：購入リンク候補の置き場（2026-11-06）
-- ローカルPCの探索（py/tool_pick.py）が候補を書き、管理人がメールの「これで掲載」から選ぶ。
-- token は選ぶURLの合言葉＝anon/authenticated からは読めないよう RLS ポリシーを置かない（service_role だけ）。
create table if not exists public.owner_tool_amazon_picks (
  tool_id      uuid primary key references public.owner_tools(id) on delete cascade,
  token        text not null,
  candidates   jsonb not null default '[]'::jsonb,  -- [{asin,title,url,note}]
  searched_at  timestamptz not null default now(),
  picked_index int,
  picked_at    timestamptz
);
alter table public.owner_tool_amazon_picks enable row level security;
revoke all on public.owner_tool_amazon_picks from anon, authenticated;
