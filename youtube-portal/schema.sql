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
  channel_id         text,                               -- YouTubeチャンネルID（信頼chまるごと取得・重複判定用）
  source_tier        smallint not null default 3,        -- 信頼ソースティア: 0=手動追加(管理者/オーナー推薦・最上位・自動削除保護), 1=本命ch, 2=条件付きch, 3=キーワード/その他
  recommended_by_name text,                              -- オーナー推薦の記名（null=無記名/自動取得動画・管理者自発追加）
  is_categorized     boolean generated always as (category_id is not null) stored,  -- 整備動画と確定したか(並びの帯分け用・generated)
  is_howto           boolean not null default false,      -- 実践How-to(手を動かす系=整備/レストア/チューニング)か。category_idの親階層で判定しトリガ維持(下記 set_video_is_howto)
  steps_ja           jsonb,                               -- AI要約(方法A: Gemini動画視聴→日本語要約)。形式 {"kind":"howto"|"points","steps":[{"t":"見出し","d":"本文(専門用語=日本語+原語併記)"}...最大12],"caution":"注意点1行"}。kind=howto:整備手順カード(番号)/points:見る系の要点まとめ(箇条書き)。kind省略=howto扱い。null=未生成or中身なし。全動画対象(py/youtube_steps.py・夜間cron)。逐語訳でなく自分の言葉の要約=権利安全側
  has_steps          boolean generated always as (steps_ja is not null) stored,  -- 手順カードありか(一覧を軽く保つ・バッジ用・generated)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_videos_category   on videos(category_id);
create index idx_videos_viewcount  on videos(view_count desc);
create index idx_videos_published  on videos(published_at desc);
create index idx_videos_tier_view  on videos(source_tier, view_count desc);

-- is_howto をカテゴリ親階層から自動維持。フロントの並びは is_howto→is_categorized→source_tier→view_count。
create or replace function set_video_is_howto()
returns trigger
language plpgsql
set search_path = public
as $$
declare root_slug text;
begin
  if NEW.category_id is null then
    NEW.is_howto := false;
  else
    select coalesce(p.slug, c.slug) into root_slug
    from categories c left join categories p on p.id = c.parent_id
    where c.id = NEW.category_id;
    NEW.is_howto := coalesce(root_slug in ('manutenzione','restauro','elaborazione'), false);
  end if;
  return NEW;
end;
$$;
create trigger trg_video_is_howto
before insert or update of category_id on videos
for each row execute function set_video_is_howto();

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

-- 9. excluded_videos — 除外ID台帳（永続デノリスト）
--   人手で「クラシックFIAT 500/126でない無関係」と判断した動画IDを二度と取り込まないための台帳。
--   丸ごとフェッチ（信頼chまるごと取得）・月次再取得（search）での復活を防ぐ主装置。
--   本番migration: youtube_portal_excluded_videos（2026-07-01）。
--   運用: py/youtube_exclude.py が videos削除＋台帳登録をセットで実行。
--         youtube_fetch.py が起動時に台帳をロードし取得前に間引く（主防御）。
--         youtube_add.py は手動追加成功時に当該IDを台帳から解除（復活の意図と整合）。
create table excluded_videos (
  youtube_id   text primary key,
  reason       text,
  channel_name text,
  excluded_at  timestamptz not null default now()
);

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
alter table excluded_videos  enable row level security;

create policy "public read categories"      on categories      for select using (true);
create policy "public read part_tags"       on part_tags       for select using (true);
create policy "public read vehicles"        on vehicles        for select using (true);
create policy "public read videos"          on videos          for select using (true);
create policy "public read video_part_tags" on video_part_tags for select using (true);
create policy "public read video_vehicles"  on video_vehicles  for select using (true);
create policy "public read recommendations" on recommendations for select using (true);
create policy "public read view_history"    on view_history    for select using (true);
create policy "public read excluded_videos" on excluded_videos for select using (true);

create policy "insert own recommendation" on recommendations
  for insert with check (auth.uid() = user_id);
create policy "update own recommendation" on recommendations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own recommendation" on recommendations
  for delete using (auth.uid() = user_id);

-- 注: videos / categories などへの書き込み (取り込みパイプライン) は
--     service_role キー経由で行う想定。service_role は RLS をバイパスする。
