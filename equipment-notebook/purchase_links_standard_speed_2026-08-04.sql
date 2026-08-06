-- ============================================================
-- 装備手帳: スタンダードスピードのパーツページリンク追加（第2弾）
-- migration名: equipment_notebook_purchase_links_standard_speed_2026_08_04
-- 状態: ✅適用済み（2026-08-04 起案 ／ 2026-08-06 本番データで適用を実地確認）
-- 根拠: 対象13項目(id15-19,21,68,14,23,24,25,22,65)すべてに nuova500.com のリンクがある
--
-- 背景（ユーザー判断 2026-08-04）:
--   パーツカテゴリはAmazon検索の精度が出ないため第1弾で対象外にしていた（L160の残論点）。
--   代わりに **スタンダードスピード**（ガレージ登録オーナーの専門店）のパーツページへ送る。
--   リンク掲載はユーザーが先方に確認済み。
--
-- ⚠️ これはアフィリエイトではない。
--   type='shop' で登録するため、描画側（purchaseLinkBtnHtml）は
--   rel="nofollow"（sponsoredなし）・PRバッジなしで出力する＝Amazonと明確に区別される。
--   表示は label + 'で見る' ＝「スタンダードスピードで見る」。
--
-- リンク先の粒度＝カテゴリページを採用した理由:
--   1. 個別商品ページが存在しない（サイト構造は parts_<カテゴリ>.html のみ・実地調査で確認）
--   2. カテゴリページの粒度が実用的。例「点火・電装系」にはポイント・コンデンサー・
--      コイル・ディストリビュータが同居し、旧車整備の「ついでに替える」需要に合う
--   3. 在庫や品番で腐らない（Amazonを検索リンクにしたのと同じ判断）
--
-- ⚠️ 既存のAmazonリンクを壊さないこと:
--   purchase_links は配列。上書きでなく jsonb 連結（||）で追記する。
--   パーツカテゴリは第1弾でAmazonリンクを付けていない（全てnull）ため、
--   null || x = null を避けるため coalesce で空配列を補う。
--
-- 全6ページの生存を実地確認済（いずれもHTTP 200）。
-- ============================================================

-- ------------------------------------------------------------
-- 点火・電装系（parts_electric.html）
--   ポイント・コンデンサー・スパークプラグ・プラグコード・デスビキャップ・
--   ヒューズ・イグニッションコイル
-- ------------------------------------------------------------
update public.equipment_items
  set purchase_links = coalesce(purchase_links, '[]'::jsonb) ||
    '[{"type":"shop","label":"スタンダードスピード","url":"https://www.nuova500.com/standard-speed/parts_electric.html"}]'::jsonb
  where id in (15, 16, 17, 18, 19, 21, 68);

-- ------------------------------------------------------------
-- エンジン（parts_engine.html）
--   Vベルト・燃料ホース
-- ------------------------------------------------------------
update public.equipment_items
  set purchase_links = coalesce(purchase_links, '[]'::jsonb) ||
    '[{"type":"shop","label":"スタンダードスピード","url":"https://www.nuova500.com/standard-speed/parts_engine.html"}]'::jsonb
  where id in (14, 23);

-- ------------------------------------------------------------
-- ケーブル（parts_cable.html）
--   アクセルワイヤー・クラッチワイヤー
-- ------------------------------------------------------------
update public.equipment_items
  set purchase_links = coalesce(purchase_links, '[]'::jsonb) ||
    '[{"type":"shop","label":"スタンダードスピード","url":"https://www.nuova500.com/standard-speed/parts_cable.html"}]'::jsonb
  where id in (24, 25);

-- ------------------------------------------------------------
-- ライト／インジケーター（parts_light.html）
--   予備の電球
-- ------------------------------------------------------------
update public.equipment_items
  set purchase_links = coalesce(purchase_links, '[]'::jsonb) ||
    '[{"type":"shop","label":"スタンダードスピード","url":"https://www.nuova500.com/standard-speed/parts_light.html"}]'::jsonb
  where id = 22;

-- ------------------------------------------------------------
-- リアサスペンション・ドライブシャフト（parts_rear-sus.html）
--   ドライブシャフトジョイント／ブーツ
-- ------------------------------------------------------------
update public.equipment_items
  set purchase_links = coalesce(purchase_links, '[]'::jsonb) ||
    '[{"type":"shop","label":"スタンダードスピード","url":"https://www.nuova500.com/standard-speed/parts_rear-sus.html"}]'::jsonb
  where id = 65;

-- ------------------------------------------------------------
-- キャブレターO/Hキット・ジェット類（parts_3OHkit.html）
--   キャブレターの補修部品
-- ------------------------------------------------------------
update public.equipment_items
  set purchase_links = coalesce(purchase_links, '[]'::jsonb) ||
    '[{"type":"shop","label":"スタンダードスピード","url":"https://www.nuova500.com/standard-speed/parts_3OHkit.html"}]'::jsonb
  where id = 71;


-- ============================================================
-- 検算
--   対象14項目（点火電装7 ＋ エンジン2 ＋ ケーブル2 ＋ ライト1 ＋ リアサス1 ＋ キャブOH1）
--   マスターリストのパーツ16項目のうち、リンク先が無いのは2項目:
--     id27 ボルト・ナット・ワッシャー ／ id28 スペアタイヤ（該当カテゴリなし）
--   purchase_links 付与項目数: 40 → 54（パーツ14項目が新たに付与される）
--
-- 適用後の確認:
--   -- shopリンクを持つ項目数
--   select count(*) from public.equipment_items
--    where purchase_links @> '[{"type":"shop"}]'::jsonb;                  -- 期待: 14
--   -- Amazonリンクが壊れていないか（第1弾の40件が維持されているか）
--   select count(*) from public.equipment_items
--    where purchase_links @> '[{"type":"amazon"}]'::jsonb;                -- 期待: 40
--   -- パーツカテゴリの付与状況
--   select category,
--          count(*) filter (where purchase_links is not null) as with_link
--     from public.equipment_items where is_active group by category order by category;
--     -- 期待: パーツ with_link=14
--   -- 中身の確認
--   select id, name, purchase_links from public.equipment_items where id in (15, 14, 24, 22, 65, 71) order by id;
--
-- ロールバック（shopリンクだけを取り除きAmazonリンクは残す）:
--   update public.equipment_items
--     set purchase_links = (
--       select coalesce(jsonb_agg(x), '[]'::jsonb)
--       from jsonb_array_elements(purchase_links) x
--       where x->>'type' <> 'shop')
--    where purchase_links @> '[{"type":"shop"}]'::jsonb;
--   -- 空配列になった行はnullに戻す
--   update public.equipment_items set purchase_links = null
--    where purchase_links = '[]'::jsonb;
-- ============================================================
