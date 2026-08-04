-- ============================================================
-- 装備手帳: 車載マエストロ確定に伴う項目マスターの調整
-- migration名: equipment_notebook_master_items_2026_08_04
-- 状態: ★未適用★（2026-08-04 起案・適用はローカルPCから）
--
-- 背景（HANDOFF「主従の再確認」2026-08-04確定分）:
--   車載マエストロの認定を「マスター装備リスト50項目のうち45項目以上（90%）、
--   ただし安全装備4点は必須」と確定した。これに伴い項目マスターを2点調整する。
--
-- A. タイミングライトを新規追加（→ 実項目数が49から50ちょうどになる）
-- B. 「配線図・整備マニュアル」を「整備マニュアル」に改名
--
-- ⚠️ 適用すると入力UIの項目数が 66 → 67 になる（タイミングライト追加分）。
--    パイロット6人は未回答なので当面 0/6 だが、90%ルールの余白（5項目分）が吸収する。
-- ============================================================


-- ------------------------------------------------------------
-- A. タイミングライトを追加（工具・点火の調整グループの末尾）
--
--    ユーザー指摘: 「デスビの調整をした場合、引き続きで必須の道具。
--                   これがあれば、ではなく、これがないと」
--    → 理由文は「あれば便利」でなく「無いと成立しない」向きで書く。
--
--    id は最大値73の次。sort_order は
--    シックネスゲージ(80) → ポイントヤスリ(90) → ここ(95) → 検電テスター(100)。
--    既存の10刻みを崩さずに割り込ませるため 95 とする。
-- ------------------------------------------------------------

insert into public.equipment_items (id, code, category, name, reason, sort_order, is_active)
values (
  74,
  'tool_timing_light',
  '工具',
  'タイミングライト',
  'デスビを動かしたら点火時期は必ず狂う。これが無いと合わせ直せない',
  95,
  true
)
on conflict (id) do nothing;

-- 止まり方への紐づけ（role='help'＝付記情報。判定には影響せず、結果画面の説明にのみ使う）
-- デスビ内部を触る止まり方に添える。need にはしない（主＝装備・従＝止まり方の原則）。
insert into public.equipment_stop_mode_items (stop_mode_code, item_id, role)
values
  ('F2', 74, 'help'),   -- 加速でもたつく・失速する（ポイント交換後の時期合わせ）
  ('F5', 74, 'help')    -- クランキングするが火花が飛ばない（デスビキャップ交換後）
on conflict (stop_mode_code, item_id, role) do nothing;


-- ------------------------------------------------------------
-- B. 「配線図・整備マニュアル」→「整備マニュアル」に改名
--
--    ユーザー判断: 配線図は registro500.com の配線図ビューアー（/wiring・本番稼働中）
--    で見られるため車載不要。必要なのは整備マニュアルのみ。
--    「配線図はサイトで見られるので車載は整備マニュアルだけで十分」という情報自体が
--    オーナーへの気付きになるため、理由文にビューアーへの案内を入れる。
-- ------------------------------------------------------------

update public.equipment_items
  set name   = '整備マニュアル',
      reason = '現場での判断材料になる。配線図はサイトの配線図ビューアーで見られるので、車載はマニュアルだけで足りる'
  where id = 46;


-- ============================================================
-- 検算（適用前の実測値: 全66項目・最大id73・stop_mode_items 151行）
--   A. equipment_items に1行追加 → 66 → 67項目
--      equipment_stop_mode_items に help 2行追加 → 151 → 153行
--   B. id46 の name / reason を更新（1行）
--
-- 適用後の確認:
--   select count(*) from public.equipment_items where is_active;          -- 期待: 67
--   select id, name, reason, sort_order from public.equipment_items where id = 74;
--   select id, name from public.equipment_items where id = 46;            -- 期待: 整備マニュアル
--   select stop_mode_code, role from public.equipment_stop_mode_items where item_id = 74;
--     -- 期待: F2/help, F5/help
--   -- 工具カテゴリの並び順が崩れていないか
--   select id, name, sort_order from public.equipment_items
--    where category = '工具' and sort_order between 80 and 110 order by sort_order;
--
-- ロールバック:
--   delete from public.equipment_stop_mode_items where item_id = 74;
--   delete from public.equipment_items where id = 74;
--   update public.equipment_items
--     set name = '配線図・整備マニュアル', reason = '現場での判断材料になる'
--    where id = 46;
-- ============================================================
