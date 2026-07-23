-- ============================================================
-- 装備手帳機能（equipment notebook）スキーマ【本番適用済みの控え】
-- migration: equipment_notebook_schema（2026-07-22 適用）
-- 空冷クラシックFiat 500 車載品の記録・管理ツール
-- 最重要制約: equipment_items.id は seed で明示採番し以後不変
-- ============================================================

-- 1. 項目マスター --------------------------------------------
create table if not exists public.equipment_items (
  id               bigint primary key,             -- seedで明示採番・不変
  code             text unique not null,           -- 人間可読の安定キー
  category         text not null,                  -- 工具/パーツ/ケミカル/非常時対応/洗車・その他
  name             text not null,
  reason           text not null,                  -- 一行理由（気付きの主動線）
  sort_order       int  not null default 0,
  is_active        boolean not null default true,  -- 廃止は false（行削除しない）
  item_class       text not null default 'standard' check (item_class in ('standard','meihin')),
  recommend_priority int,                           -- 編集部推奨の並び（低いほど優先・null=非推奨）
  note_prompt      text,                            -- [migration: equipment_notebook_item_notes] メモ欄のプロンプト。null=メモ欄を出さない
  affiliate_url    text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_equipment_items_cat on public.equipment_items (category, sort_order);

-- 2. 手帳（回答セッション・親） ------------------------------
create table if not exists public.equipment_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,  -- 匿名可のため nullable
  vehicle_id    text,                                               -- cars.document_id
  is_anonymous  boolean not null default false,
  is_public     boolean not null default false,   -- ガレージ公開（フェーズ2）
  model_year    text,
  usage_freq    text,
  longtrip_freq text,
  owner_type    text,                              -- 現地修理型など分類結果（保存する場合）
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_equipment_records_user on public.equipment_records (user_id);
create index if not exists idx_equipment_records_vehicle on public.equipment_records (vehicle_id);

-- 3. 個別回答（最新状態） ------------------------------------
create table if not exists public.equipment_entries (
  id         uuid primary key default gen_random_uuid(),
  record_id  uuid not null references public.equipment_records(id) on delete cascade,
  item_id    bigint not null references public.equipment_items(id),
  frequency  text not null check (frequency in ('always','occasional')),
  note       text,                                  -- [migration: equipment_notebook_item_notes] 項目単位の自由記入（note_prompt を持つ項目のみ）
  unique (record_id, item_id)
);
create index if not exists idx_equipment_entries_record on public.equipment_entries (record_id);
create index if not exists idx_equipment_entries_item on public.equipment_entries (item_id);

-- 4. 変更履歴（器のみ・書込はフェーズ2） ---------------------
create table if not exists public.equipment_entry_history (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references public.equipment_records(id) on delete cascade,
  item_id     bigint not null,
  frequency   text,
  change_type text not null check (change_type in ('add','update','remove')),
  changed_at  timestamptz not null default now()
);
create index if not exists idx_equipment_history_record on public.equipment_entry_history (record_id);

-- 5. カテゴリ完了フラグ（未回答と未搭載の区別） ---------------
create table if not exists public.equipment_category_status (
  record_id uuid not null references public.equipment_records(id) on delete cascade,
  category  text not null,
  completed boolean not null default false,
  primary key (record_id, category)
);

-- 6. 自由追加項目（名品昇格の種） ----------------------------
create table if not exists public.equipment_custom_items (
  id                  uuid primary key default gen_random_uuid(),
  record_id           uuid not null references public.equipment_records(id) on delete cascade,
  name                text not null,
  category            text,                         -- [migration: equipment_custom_items_category] 入力されたカテゴリ（昇格時の配置先判断）
  frequency           text check (frequency in ('always','occasional')),
  reason              text,
  promoted_to_item_id bigint references public.equipment_items(id),
  created_at          timestamptz not null default now()
);
create index if not exists idx_equipment_custom_record on public.equipment_custom_items (record_id);

-- 7. 経験談（記事素材） --------------------------------------
create table if not exists public.equipment_experiences (
  id         uuid primary key default gen_random_uuid(),
  record_id  uuid not null references public.equipment_records(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_equipment_exp_record on public.equipment_experiences (record_id);

-- ============================================================
-- RLS（MVP=ログイン必須。匿名anon INSERTはフェーズ2で別途付与）
-- ============================================================

-- 項目マスター: 全員 SELECT 可・書込は service_role のみ（ポリシー未付与）
alter table public.equipment_items enable row level security;
create policy equipment_items_select_all on public.equipment_items
  for select using (true);

-- 手帳（親）: 本人のみ
alter table public.equipment_records enable row level security;
create policy equipment_records_select_own on public.equipment_records
  for select using (auth.uid() = user_id);
create policy equipment_records_insert_own on public.equipment_records
  for insert with check (auth.uid() = user_id);
create policy equipment_records_update_own on public.equipment_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy equipment_records_delete_own on public.equipment_records
  for delete using (auth.uid() = user_id);

-- 子テーブル: 親 record の所有者のみ（FOR ALL・EXISTS で親を照合）
alter table public.equipment_entries enable row level security;
create policy equipment_entries_all_own on public.equipment_entries
  for all
  using (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()));

alter table public.equipment_entry_history enable row level security;
create policy equipment_history_all_own on public.equipment_entry_history
  for all
  using (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()));

alter table public.equipment_category_status enable row level security;
create policy equipment_catstatus_all_own on public.equipment_category_status
  for all
  using (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()));

alter table public.equipment_custom_items enable row level security;
create policy equipment_custom_all_own on public.equipment_custom_items
  for all
  using (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()));

alter table public.equipment_experiences enable row level security;
create policy equipment_exp_all_own on public.equipment_experiences
  for all
  using (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.equipment_records r where r.id = record_id and r.user_id = auth.uid()));

-- ============================================================
-- 集計関数（積載率・全体比較。個人特定なし）
-- SECURITY DEFINER で全体母数を算出し anon/authenticated に公開
-- ※ advisor が SECURITY DEFINER 警告を出すが「集計公開」の意図通り（受容）
-- ============================================================
create or replace function public.equipment_item_rates()
returns table (
  item_id          bigint,
  code             text,
  category         text,
  name             text,
  always_count     bigint,
  occasional_count bigint,
  loaded_count     bigint,
  total_records    bigint,
  load_rate        numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with totals as (
    select count(*)::bigint as n from public.equipment_records
  )
  select
    i.id,
    i.code,
    i.category,
    i.name,
    count(e.id) filter (where e.frequency = 'always')::bigint,
    count(e.id) filter (where e.frequency = 'occasional')::bigint,
    count(e.id)::bigint as loaded_count,
    (select n from totals) as total_records,
    case when (select n from totals) > 0
      then round(count(e.id)::numeric / (select n from totals), 4)
      else 0 end as load_rate
  from public.equipment_items i
  left join public.equipment_entries e on e.item_id = i.id
  where i.is_active
  group by i.id, i.code, i.category, i.name, i.sort_order
  order by i.sort_order;
$$;
grant execute on function public.equipment_item_rates() to anon, authenticated;
