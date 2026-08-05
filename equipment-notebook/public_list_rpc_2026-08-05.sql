-- ============================================================
-- 車載手帳: 公開一覧を1行1レコードで返す関数 equipment_public_list()
-- migration名: equipment_notebook_public_list_rpc_2026_08_05
-- 状態: ★未適用★（2026-08-05 起案・適用はローカルPCから）
--
-- 【なぜ必要か＝壊れる前に直す】
--   一覧（equipment.html）は「装備N点」と車載マエストロ判定のために、表示する
--   全員ぶんの equipment_entries をブラウザ側へ1クエリで引いていた。
--   **PostgRESTの返却上限は1000行**（2026-08-05に本番で実測。parts 33,028件が
--   1000件で打ち切られることを確認）。1人あたりの搭載は30〜56件なので、
--   **公開が25〜30人を超えたあたりで1000行に達して黙って切れる**。
--   エラーは出ず、点数が実際より小さく出て、マエストロの称号が消える。
--   ＝ 表示上の不具合ではなく「静かに嘘をつく」不具合なので、公開者が増える前に潰す。
--
--   この関数は集計をDB側で済ませ、1レコード=1行で返す。150人でも150行。
--
-- 【SECURITY DEFINER にする理由と安全性】
--   既存の equipment_item_rates() と同型。RLSを迂回するが、
--   ・返すのは is_public = true の手帳だけ（関数内でハードコード）
--   ・cars から返す列は、いずれも既に匿名で読める列のみ
--     （handle_name / model_display_* / car_type / photo_main / prefecture / year）
--   なので、匿名訪問者が今すでに見られる情報の範囲を1ミリも超えない。
--
-- 【⚠️ 判定ロジックの二重化について】
--   車載マエストロの判定基準の正本は `equipment-maestro.js`（結果画面・車両ページが使う）。
--   この関数は同じ基準をSQLで書き直したもの＝**二重管理になる**。
--   基準を変えるときは必ず両方を直すこと。値は以下の3つ:
--     ・マスター装備リスト50項目（下の master CTE）
--     ・安全装備4点（39三角表示板 / 38発煙筒 / 44ロードサービス連絡先 / 45保険証券）
--     ・必要割合 0.9（50項目なら45項目）
--   JS側から基準を注入する形にはできない（匿名から実行する関数のため）。
--   フロントは RPC が無ければ従来のクライアント集計にフォールバックするので、
--   この関数を適用しなくても一覧は表示される（件数が少ないうちは実害なし）。
--
-- 【型について】
--   cars の列型を実地で確定できなかったため、返す値はすべて ::text で明示キャストする。
--   （year が int の環境でも text の環境でも戻り値の型が変わらないようにするため）
-- ============================================================

create or replace function public.equipment_public_list(p_limit int default 24)
returns table (
  record_id      uuid,
  vehicle_id     text,
  updated_at     timestamptz,
  handle_name    text,
  model_display  text,
  car_type       text,
  photo_main     text,
  prefecture     text,
  car_year       text,
  loaded_count   int,
  has_experience boolean,
  is_maestro     boolean,
  total_public   bigint,   -- 公開手帳の総数（上限・紐付けを問わない）
  total_linked   bigint    -- うち車両ページに紐付いていて一覧に出せるもの
)
language sql
stable
security definer
set search_path = public
as $$
with master as (
  -- マスター装備リスト50項目（equipment-maestro.js の MASTER_ITEM_IDS と同一）
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
  -- 安全装備4点（equipment-maestro.js の SAFETY_ITEM_IDS と同一）
  select unnest(array[39, 38, 44, 45]::bigint[]) as id
),
master_existing as (
  -- 項目マスターに実在するものだけを母数にする（JS側 masterExistingItemIds と同じ考え方）。
  -- 存在しないidを母数に含めると「どれだけ積んでも届かない基準」になるため。
  select m.id from master m join equipment_items i on i.id = m.id
),
required as (
  select ceil(count(*) * 0.9)::int as n from master_existing
),
linked as (
  -- 一覧に出せる公開手帳＝公開かつ車両ページが実在するもの
  select r.id, r.vehicle_id, r.updated_at
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
  select * from linked order by updated_at desc limit greatest(coalesce(p_limit, 24), 1)
),
loaded as (
  -- frequency が null の行は「行はあるが積んでいない」＝未搭載として除く
  select e.record_id, e.item_id
    from equipment_entries e
    join pub p on p.id = e.record_id
   where e.frequency is not null
)
select
  p.id,
  p.vehicle_id::text,
  p.updated_at,
  c.handle_name::text,
  coalesce(
    nullif(c.model_display_c::text, ''),
    nullif(btrim(concat_ws(' ', nullif(c.model_display_a::text, ''), nullif(c.model_display_b::text, ''))), '')
  ),
  c.car_type::text,
  c.photo_main::text,
  c.prefecture::text,
  c.year::text,
  (
    (select count(*) from loaded l where l.record_id = p.id)
    + (select count(*) from equipment_custom_items ci where ci.record_id = p.id and ci.frequency is not null)
  )::int,
  exists (select 1 from equipment_experiences x where x.record_id = p.id),
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
  '判定基準の正本は equipment-maestro.js。変更時は両方を直すこと。';

revoke all on function public.equipment_public_list(int) from public;
grant execute on function public.equipment_public_list(int) to anon, authenticated;

-- ============================================================
-- 適用後の確認（結果をそのまま表示するだけ。判定は人が行う）
-- ============================================================
-- 期待: 公開中の手帳が1行1レコードで返る。現在の公開はぱそたさん1件。
-- select record_id, handle_name, model_display, loaded_count, is_maestro, total_public, total_linked
--   from public.equipment_public_list(24);
--
-- 期待: total_public と total_linked が上のクエリの行数と整合する
-- select count(*) as 公開総数 from public.equipment_records where is_public = true;
--
-- 期待: 匿名ロールで実行できる（フロントは匿名で叩く）
-- set role anon; select count(*) from public.equipment_public_list(24); reset role;

-- ------------------------------------------------------------
-- クラウドセッションからの独立検算（公開キー・読み取りのみ）
-- ------------------------------------------------------------
--   U="https://ttlttclfovuzafvghvaq.supabase.co/rest/v1"
--   K="sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt"
--   curl -s -X POST "$U/rpc/equipment_public_list" -H "apikey: $K" \
--        -H "Content-Type: application/json" -d '{"p_limit":24}'
--
-- ⚠️ advisor(security) が SECURITY DEFINER の警告を出すが、equipment_item_rates() と
--    同じ意図（公開情報だけを返す集計関数）なので受容する。
