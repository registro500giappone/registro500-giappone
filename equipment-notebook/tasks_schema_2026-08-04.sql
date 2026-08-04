-- ============================================================
-- migration名: equipment_tasks_schema_2026_08_04
-- 2026-08-04起案・⚠️未適用（適用はローカルPCのSupabase MCPセッションから）
--
-- 目的: 結果画面のリコメンドを「いまの装備に これ を足すと、これもできるように
--       なりますよ」の形で書けるようにする。止まり方（症状）には言及しない。
--       確定内容の正本＝ equipment-notebook/tasks_draft_2026-08-04.md
--
-- 規約は既存の equipment_stop_modes 系に合わせる:
--   - RLS = SELECT 全員可 / 書込は service_role のみ
--   - updated_at カラムは持つが set_updated_at トリガは付けない（既存規約）
--   - code は人間可読の安定キー、item_id は equipment_items.id（bigint・不変）
-- ============================================================

-- ============================================================
-- A. 作業マスター
--    task_group 'A' = パーツ交換（パーツ＋工具）／'B' = 工具だけで成立する作業。
--    リコメンドは A を優先して並べるためグループを列に持つ（2026-08-04 ユーザー確定「イ」）。
-- ============================================================
create table if not exists public.equipment_tasks (
  code       text primary key,               -- 'A01'〜'A18' / 'B01'〜'B07'
  name       text not null,                  -- 「スパークプラグの交換」＝画面にそのまま出す作業名
  task_group text not null check (task_group in ('A','B')),
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_equipment_tasks_sort on public.equipment_tasks (sort_order);

-- ============================================================
-- B. 作業 × 必要装備
--    or_group が null の行 = 必須（AND）。
--    同一 task_code 内で or_group が同じ値の行 = そのうち1つでも搭載していれば満たす。
--    （2026-08-04 ユーザー確定: スペアタイヤ交換のレンチは「径の合うレンチでいい」）
-- ============================================================
create table if not exists public.equipment_task_items (
  task_code text   not null references public.equipment_tasks(code) on delete cascade,
  item_id   bigint not null references public.equipment_items(id),
  or_group  text,                            -- null=必須 / 同値=いずれか1つで充足
  primary key (task_code, item_id)
);
create index if not exists idx_equipment_task_items_item on public.equipment_task_items (item_id);

-- ============================================================
-- C. 万能装備フラグ（D群＝作業に紐づけず別枠でリコメンドする常備品）
--    作業のneedに入れると「これが無いとVベルト交換ができない」という誤った断定に
--    なるため、作業マスターには入れず equipment_items 側のフラグで扱う。
--    2026-08-04 ユーザー確定＝5件のみ。
-- ============================================================
alter table public.equipment_items
  add column if not exists is_universal boolean not null default false;

comment on column public.equipment_items.is_universal is
  '万能装備（どの作業にも効く常備品）。結果画面で作業リコメンドとは別枠に出す。migration: equipment_tasks_schema_2026_08_04';

update public.equipment_items set is_universal = true
 where id in (7, 8, 59, 11, 13);
-- 7 針金・タイラップ / 8 自己融着テープ / 59 強力ガムテープ・ダクトテープ
-- 11 作業用ライト / 13 軍手・ウエス／ペーパータオル

-- ============================================================
-- C-2. id64 の項目名を広げる（2026-08-04 ユーザー判断）
--     A12 燃料ホースの交換に「カッターかハサミが必須」との判断。ハサミは項目マスターに
--     存在しないため、新規idを起こさず id64 の名前の幅を広げて吸収する。
--     「項目名は幅を持たせ、細かい内訳は note_prompt で集める」（2026-07-24 項目名の見直し 第2弾）
--     と同じ扱い。id は不変なので既存の回答は壊れない。
--     ロールバック: update public.equipment_items set name='カッター', reason='ホース・テープ・結束バンドを切る' where id=64;
-- ============================================================
update public.equipment_items
   set name   = 'カッター・ハサミ',
       reason = 'ホース・テープ・結束バンドを切る。カッターでもハサミでもよい'
 where id = 64;

-- ============================================================
-- D. 作業マスターの投入（A群18件・B群7件）
-- ============================================================
insert into public.equipment_tasks (code, name, task_group, sort_order) values
  ('A01', 'スパークプラグの交換',            'A',  10),
  ('A02', 'プラグコードの交換',              'A',  20),
  ('A03', 'ポイントの交換',                  'A',  30),
  ('A04', 'コンデンサーの交換',              'A',  40),
  ('A05', 'デスビキャップの交換',            'A',  50),
  ('A06', 'ローターの交換',                  'A',  60),
  ('A07', 'デスビ本体の交換',                'A',  70),
  ('A08', 'イグニッションコイルの交換',      'A',  80),
  ('A09', 'Vベルトの交換',                   'A',  90),
  ('A10', 'ヒューズの交換',                  'A', 100),
  ('A11', '電球の交換',                      'A', 110),
  ('A12', '燃料ホースの交換',                'A', 120),
  ('A13', 'アクセルワイヤーの交換',          'A', 130),
  ('A14', 'クラッチワイヤーの交換',          'A', 140),
  ('A15', 'スペアタイヤへの交換',            'A', 150),
  ('A16', 'キャブレター本体の交換',          'A', 160),
  ('A17', 'キャブレターの現地修理',          'A', 170),
  ('A18', 'ドライブシャフトジョイントの交換','A', 180),
  ('B01', 'ポイントギャップの調整',          'B', 210),
  ('B02', '点火時期の調整',                  'B', 220),
  ('B03', 'ポイント接点の清掃',              'B', 230),
  ('B04', '電気系の導通チェック',            'B', 240),
  ('B05', '配線の修理（圧着）',              'B', 250),
  ('B06', '各部の増し締め（規定トルク）',    'B', 260),
  ('B07', '接点の復活（電気系の接触不良）',  'B', 270)
on conflict (code) do nothing;

-- ============================================================
-- E. 必要装備の投入
--    or_group を使うのは A15（レンチはスパナ・メガネ または ラチェット）のみ。
-- ============================================================
insert into public.equipment_task_items (task_code, item_id, or_group) values
  -- A01 スパークプラグの交換: 17 スパークプラグ / 1 プラグレンチ
  ('A01', 17, null), ('A01',  1, null),
  -- A02 プラグコードの交換: 18 プラグコード（工具不要＝手で抜き差し）
  ('A02', 18, null),
  -- A03 ポイントの交換: 15 ポイント / 5 マイナスドライバー / 2 シックネスゲージ
  --     （2026-08-04 ユーザー確定＝ギャップを出さないと交換の意味がないため必須）
  ('A03', 15, null), ('A03',  5, null), ('A03',  2, null),
  -- A04 コンデンサーの交換: 16 コンデンサー / 5 マイナスドライバー
  ('A04', 16, null), ('A04',  5, null),
  -- A05 デスビキャップの交換: 19 デスビキャップ / 5 マイナスドライバー
  ('A05', 19, null), ('A05',  5, null),
  -- A06 ローターの交換: 20 ローター（工具不要＝差し替えのみ）
  ('A06', 20, null),
  -- A07 デスビ本体の交換: 67 デスビ本体 / 4 スパナ・メガネ / 74 タイミングライト
  --     （載せ替えたら点火時期は必ず狂うのでタイミングライトを必須側に置く）
  ('A07', 67, null), ('A07',  4, null), ('A07', 74, null),
  -- A08 イグニッションコイルの交換: 68 コイル / 4 スパナ・メガネ
  ('A08', 68, null), ('A08',  4, null),
  -- A09 Vベルトの交換: 14 Vベルト / 4 スパナ・メガネ（ダイナモのステー調整）
  ('A09', 14, null), ('A09',  4, null),
  -- A10 ヒューズの交換: 21 ヒューズ（工具不要）
  ('A10', 21, null),
  -- A11 電球の交換: 22 予備の電球 / 5 マイナスドライバー
  ('A11', 22, null), ('A11',  5, null),
  -- A12 燃料ホースの交換: 23 燃料ホース＋バンド / 5 マイナスドライバー / 64 カッター・ハサミ
  --     （2026-08-04 ユーザー判断「カッターかハサミが必須」→ id64 の項目名を広げて吸収済み）
  ('A12', 23, null), ('A12',  5, null), ('A12', 64, null),
  -- A13 アクセルワイヤーの交換: 24 アクセルワイヤー / 4 スパナ・メガネ / 6 ラジオペンチ
  ('A13', 24, null), ('A13',  4, null), ('A13',  6, null),
  -- A14 クラッチワイヤーの交換: 25 クラッチワイヤー / 4 スパナ・メガネ / 6 ラジオペンチ
  ('A14', 25, null), ('A14',  4, null), ('A14',  6, null),
  -- A15 スペアタイヤへの交換: 28 スペアタイヤ / 9 車載ジャッキ / [4 または 55]
  --     （2026-08-04 ユーザー確定「ホイール専用レンチを積む人は少ない。径の合うレンチでいい」）
  ('A15', 28, null), ('A15',  9, null), ('A15',  4, 'wrench'), ('A15', 55, 'wrench'),
  -- A16 キャブレター本体の交換: 66 キャブ本体 / 4 スパナ・メガネ / 5 マイナスドライバー / 26 ガスケット類
  ('A16', 66, null), ('A16',  4, null), ('A16',  5, null), ('A16', 26, null),
  -- A17 キャブレターの現地修理: 71 キャブ補修部品 / 5 マイナスドライバー / 31 パーツクリーナー
  ('A17', 71, null), ('A17',  5, null), ('A17', 31, null),
  -- A18 ドライブシャフトジョイントの交換: 65 ジョイント / 9 ジャッキ / 57 ジャッキスタンド / 55 ラチェット / 70 グリス
  --     （床下に潜るためジャッキスタンドは安全上必須＝2026-08-04ユーザー明言）
  ('A18', 65, null), ('A18',  9, null), ('A18', 57, null), ('A18', 55, null), ('A18', 70, null),

  -- B01 ポイントギャップの調整: 2 シックネスゲージ / 5 マイナスドライバー
  ('B01',  2, null), ('B01',  5, null),
  -- B02 点火時期の調整: 74 タイミングライト / 4 スパナ・メガネ
  ('B02', 74, null), ('B02',  4, null),
  -- B03 ポイント接点の清掃: 60 ポイントヤスリ / 31 パーツクリーナー
  ('B03', 60, null), ('B03', 31, null),
  -- B04 電気系の導通チェック: 3 検電テスター（単独で成立）
  ('B04',  3, null),
  -- B05 配線の修理（圧着）: 58 電工ペンチ＋圧着端子・配線（単独で成立）
  ('B05', 58, null),
  -- B06 各部の増し締め: 56 トルクレンチ / 55 ラチェット＋ソケット
  ('B06', 56, null), ('B06', 55, null),
  -- B07 接点の復活: 33 接点復活剤（単独で成立）
  ('B07', 33, null)
on conflict (task_code, item_id) do nothing;

-- ============================================================
-- F. RLS（既存 equipment_stop_modes 系と同型：読み取り全員可・書込 service_role のみ）
-- ============================================================
alter table public.equipment_tasks      enable row level security;
alter table public.equipment_task_items enable row level security;

drop policy if exists equipment_tasks_select_all on public.equipment_tasks;
create policy equipment_tasks_select_all
  on public.equipment_tasks for select to anon, authenticated using (true);

drop policy if exists equipment_task_items_select_all on public.equipment_task_items;
create policy equipment_task_items_select_all
  on public.equipment_task_items for select to anon, authenticated using (true);

-- ============================================================
-- ロールバック（必要になったとき手で流す）
-- ------------------------------------------------------------
-- drop table if exists public.equipment_task_items;
-- drop table if exists public.equipment_tasks;
-- alter table public.equipment_items drop column if exists is_universal;
-- ============================================================
