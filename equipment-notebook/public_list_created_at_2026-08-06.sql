-- ============================================================
-- 車載手帳: equipment_public_list() の戻り値に created_at を追加
-- migration名: equipment_notebook_public_list_created_at_2026_08_06
-- 状態: ★未適用★（2026-08-06 起案・適用はローカルPCから）
--
-- 目的: 表示用に追加するだけ（一覧の並び順は updated_at desc のまま変更しない）。
-- 位置: 戻り値の列順は updated_at の直後に created_at を挿入。
--
-- ⚠️ PostgreSQLは CREATE OR REPLACE FUNCTION で戻り値の型（列構成）を
--    変更できないため、drop → create の手順を取る。
-- ⚠️ 変更点は「戻り値の列定義に created_at を追加」「linked/pub CTEで
--    r.created_at を持ち回る」「select リストに p.created_at を追加」の3箇所のみ。
--    他のロジック（上位互換 supersedes 等）は
--    public_list_supersedes_v2_2026-08-06.sql から一切変えていない。
-- ============================================================

drop function if exists public.equipment_public_list(int);

create function public.equipment_public_list(p_limit int default 24)
returns table (
  record_id      uuid,
  vehicle_id     text,
  updated_at     timestamptz,
  created_at     timestamptz,
  handle_name    text,
  model_display  text,
  car_type       text,
  photo_main     text,
  prefecture     text,
  car_year       text,
  loaded_count   int,
  has_experience boolean,
  is_maestro     boolean,
  total_public   bigint,
  total_linked   bigint
)
language sql
stable
security definer
set search_path = public
as $$
with master as (
  select unnest(array[
    4, 55, 56, 1, 5, 6, 61, 2, 60, 3, 58, 9, 57, 10, 7, 11, 13, 62, 63, 64,
    14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 27, 28, 65, 68, 71,
    29, 31, 32, 33, 70,
    40, 46,
    39, 38, 44, 45,
    8, 59, 74
  ]::bigint[]) as id
),
safety as (
  select unnest(array[39, 38, 44, 45]::bigint[]) as id
),
-- 上位互換の対応表。JS側 equipment-maestro.js の SUPERSEDES と一致させること。
supersedes(owner_id, covered_id) as (
  values
    (66::bigint, 71::bigint),   -- キャブレター本体 → 補修部品
    (67::bigint, 19::bigint),   -- デスビ本体 → デスビキャップ
    (67::bigint, 20::bigint),   -- デスビ本体 → ローター
    (67::bigint, 15::bigint),   -- デスビ本体 → ポイント
    (67::bigint, 16::bigint)    -- デスビ本体 → コンデンサー
),
master_existing as (
  select m.id from master m join equipment_items i on i.id = m.id
),
required as (
  select ceil(count(*) * 0.9)::int as n from master_existing
),
linked as (
  select r.id, r.vehicle_id, r.updated_at, r.created_at
    from equipment_records r
    join cars c on c.document_id = r.vehicle_id
   where r.is_public = true
),
totals as (
  select
    (select count(*) from equipment_records where is_public = true) as total_public,
    (select count(*) from linked) as total_linked
),
pub as (
  -- 1〜100にクランプ（匿名から呼べる関数のため、巨大なlimit指定での乱用を防ぐ）
  select * from linked order by updated_at desc
   limit least(greatest(coalesce(p_limit, 24), 1), 100)
),
raw_loaded as (
  -- frequency が null の行は「行はあるが積んでいない」＝未搭載として除く
  select e.record_id, e.item_id
    from equipment_entries e
    join pub p on p.id = e.record_id
   where e.frequency is not null
),
loaded as (
  -- 実際に登録された項目に、上位互換で充足とみなす項目を足した実効セット。
  -- 例: 66を積んでいれば71も持っている扱いにする。distinct で重複を潰す。
  select distinct record_id, item_id from (
    select record_id, item_id from raw_loaded
    union all
    select rl.record_id, s.covered_id as item_id
      from raw_loaded rl join supersedes s on s.owner_id = rl.item_id
  ) x
)
select
  p.id,
  p.vehicle_id::text,
  p.updated_at,
  p.created_at,
  c.handle_name::text,
  coalesce(
    nullif(c.model_display_c::text, ''),
    nullif(btrim(concat_ws(' ', nullif(c.model_display_a::text, ''), nullif(c.model_display_b::text, ''))), '')
  ),
  c.car_type::text,
  c.photo_main::text,
  c.prefecture::text,
  c.year::text,
  -- 「装備数」は実際に登録された数を出す（上位互換で水増ししない。画面に出る事実は実データのまま）
  (
    (select count(*) from raw_loaded l where l.record_id = p.id)
    + (select count(*) from equipment_custom_items ci where ci.record_id = p.id and ci.frequency is not null)
  )::int,
  -- 本文が空の行は「経験談あり」に数えない（車両ページの表示条件と揃える）
  exists (select 1 from equipment_experiences x
           where x.record_id = p.id and nullif(btrim(x.body), '') is not null),
  (
    (select count(*) from loaded l join master_existing me on me.id = l.item_id where l.record_id = p.id) >= (select n from required)
    and (select count(*) from loaded l join safety s on s.id = l.item_id where l.record_id = p.id) = (select count(*) from safety)
  ),
  t.total_public,
  t.total_linked
from pub p
join cars c on c.document_id = p.vehicle_id
cross join totals t
order by p.updated_at desc;
$$;

comment on function public.equipment_public_list(int) is
  '公開中の車載手帳を1行1レコードで返す。装備点数・車載マエストロ判定をDB側で集計し、'
  'ブラウザが全員ぶんの明細を引かずに済むようにする（PostgRESTの1000行上限対策）。'
  '判定基準の正本は equipment-maestro.js（SUPERSEDES＝上位互換を含む）。変更時は両方を直すこと。';

revoke all on function public.equipment_public_list(int) from public;
grant execute on function public.equipment_public_list(int) to anon, authenticated;

-- ============================================================
-- 適用後の確認（結果をそのまま表示するだけ。判定は人が行う）
-- ============================================================
-- 期待: created_at 列が増え、他の値（loaded_count・is_maestro等）は変わっていない
-- select record_id, handle_name, updated_at, created_at, loaded_count, is_maestro
--   from public.equipment_public_list(24);
--
-- ------------------------------------------------------------
-- クラウドセッションからの独立検算（公開キー・読み取りのみ）
-- ------------------------------------------------------------
--   U="https://ttlttclfovuzafvghvaq.supabase.co/rest/v1"
--   K="sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt"
--   curl -s -X POST "$U/rpc/equipment_public_list" -H "apikey: $K" -H "Content-Type: application/json" -d '{"p_limit":24}'
