-- ============================================================================
-- registro500 YouTube ポータル — Supabase (PostgreSQL) スキーマ
-- クラシック FIAT 500 / 126 動画キュレーション
--
-- 2026-06-29 本番適用済（migration: youtube_portal_schema）。
-- 原引き継ぎ schema.sql からの差分は安全側の2点のみ（HANDOFF.md §9 参照）:
--   * video_reco_counts ビューに security_invoker=true
--   * set_updated_at() に search_path='' （別migration: youtube_portal_harden_set_updated_at）
--
-- 決定事項の反映:
--   * カテゴリは親子1テーブル自己参照 (categories.parent_id)
--   * 主分類は1つ (videos.category_id) / 箇所タグは多対多 (video_part_tags)
--   * 車種 500/126 は多対多 (video_vehicles)、両対応は2行で表現
--   * 評価は「おすすめ1段階」+ 任意コメント (recommendations)
--     - 1ユーザー1動画1回 (UNIQUE)
--     - 書き込みはログインオーナーのみ / 読み取りは全員 (RLS)
--   * 日本語解説は AI 自動生成 (commentary_source='ai')
--   * 埋め込み可否 (videos.embeddable)
--   * 再生数履歴 (view_history) で「今人気」を将来算出
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. categories — 親カテゴリと中区分を1テーブルで (自己参照)
create table categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references categories(id) on delete restrict,
  slug        text not null unique,
  name_ja     text not null,
  name_it     text,
  icon        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_categories_parent on categories(parent_id);

-- 2. part_tags — 箇所タグ (整備/チューニング共通語彙)
create table part_tags (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_ja     text not null,
  name_it     text,
  created_at  timestamptz not null default now()
);

-- 3. vehicles — 車種マスタ (500, 126)
create table vehicles (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name_official   text not null,
  name_display    text not null,
  search_aliases  text[] not null default '{}',
  base_vehicle_id uuid references vehicles(id) on delete set null,
  sort_order      integer not null default 0
);
create index idx_vehicles_base on vehicles(base_vehicle_id);

-- 4. videos — 動画本体
create table videos (
  id                 uuid primary key default gen_random_uuid(),
  youtube_id         text not null unique,
  category_id        uuid references categories(id) on delete set null,
  title_original     text,
  title_ja           text,
  channel_name       text,
  duration_seconds   integer,
  thumbnail_url      text,
  published_at       timestamptz,
  view_count         integer not null default 0,
  description_ja     text,
  commentary_source  text not null default 'ai'
                       check (commentary_source in ('ai','human','hybrid')),
  has_captions       boolean not null default false,
  embeddable         boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_videos_category   on videos(category_id);
create index idx_videos_viewcount  on videos(view_count desc);
create index idx_videos_published  on videos(published_at desc);

-- 5. video_part_tags — 動画 ↔ 箇所タグ (多対多)
create table video_part_tags (
  video_id     uuid not null references videos(id)    on delete cascade,
  part_tag_id  uuid not null references part_tags(id)  on delete cascade,
  primary key (video_id, part_tag_id)
);
create index idx_vpt_tag on video_part_tags(part_tag_id);

-- 6. video_vehicles — 動画 ↔ 車種 (多対多)
create table video_vehicles (
  video_id    uuid not null references videos(id)    on delete cascade,
  vehicle_id  uuid not null references vehicles(id)  on delete cascade,
  primary key (video_id, vehicle_id)
);
create index idx_vv_vehicle on video_vehicles(vehicle_id);

-- 7. recommendations — おすすめ1段階 + 任意コメント
create table recommendations (
  video_id    uuid not null references videos(id)      on delete cascade,
  user_id     uuid not null references auth.users(id)  on delete cascade,
  comment     text,
  created_at  timestamptz not null default now(),
  primary key (video_id, user_id)
);
create index idx_reco_video on recommendations(video_id);

-- 8. view_history — 再生数の履歴
create table view_history (
  id          bigint generated always as identity primary key,
  video_id    uuid not null references videos(id) on delete cascade,
  view_count  integer not null,
  fetched_at  timestamptz not null default now()
);
create index idx_viewhistory_video on view_history(video_id, fetched_at desc);

-- updated_at 自動更新トリガ (videos)
create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_videos_updated_at
  before update on videos
  for each row execute function set_updated_at();

-- 集計ビュー: カードに出す「おすすめ数」をまとめて取得
create view video_reco_counts
with (security_invoker = true) as
select v.id as video_id,
       count(r.user_id) as reco_count,
       count(r.comment) as comment_count
from videos v
left join recommendations r on r.video_id = v.id
group by v.id;

-- ============================================================================
-- RLS (Row Level Security)
--   読み取り: 全員可  /  書き込み: ログインユーザーのみ・本人行のみ
-- ============================================================================
alter table categories       enable row level security;
alter table part_tags        enable row level security;
alter table vehicles         enable row level security;
alter table videos           enable row level security;
alter table video_part_tags  enable row level security;
alter table video_vehicles   enable row level security;
alter table recommendations  enable row level security;
alter table view_history     enable row level security;

create policy "public read categories"      on categories      for select using (true);
create policy "public read part_tags"       on part_tags       for select using (true);
create policy "public read vehicles"        on vehicles        for select using (true);
create policy "public read videos"          on videos          for select using (true);
create policy "public read video_part_tags" on video_part_tags for select using (true);
create policy "public read video_vehicles"  on video_vehicles  for select using (true);
create policy "public read recommendations" on recommendations for select using (true);
create policy "public read view_history"    on view_history    for select using (true);

create policy "insert own recommendation" on recommendations
  for insert with check (auth.uid() = user_id);
create policy "update own recommendation" on recommendations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own recommendation" on recommendations
  for delete using (auth.uid() = user_id);

-- 注: videos / categories などへの書き込み (取り込みパイプライン) は
--     service_role キー経由で行う想定。service_role は RLS をバイパスする。
