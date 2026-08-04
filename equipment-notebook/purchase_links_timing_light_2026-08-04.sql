-- ============================================================
-- 装備手帳: タイミングライトの購入先リンク追加（Amazon第1弾の補完）
-- migration名: equipment_notebook_purchase_links_timing_light_2026_08_04
-- 状態: ★未適用★（2026-08-04 起案・適用はローカルPCから）
--
-- 背景:
--   purchase_links_2026-08-04.sql は項目数66の時点で作成したため、その後
--   master_items_2026-08-04.sql で追加した id74 タイミングライトが対象から漏れていた
--   （工具カテゴリの without_link が期待値0に対して1になっていた差分の正体。バグではない）。
--   タイミングライトはマスター装備リスト50項目に含まれ、かつ搭載0/6のため
--   リコメンドで最も提示されやすい装備のひとつ。購入導線が無いままでは不整合になる。
--
-- ⚠️ 適用した瞬間、本番の結果画面に「🛒 Amazonで見る（PR）」が表示される（デプロイ不要）。
--
-- クエリ設計: 「タイミングライト」単独だと撮影用のライトや照明器具が混ざるため、
--   12V（車載電源）と用途（点火時期）を添えて自動車整備用に絞る。
-- ============================================================

update public.equipment_items
  set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%82%BF%E3%82%A4%E3%83%9F%E3%83%B3%E3%82%B0%E3%83%A9%E3%82%A4%E3%83%88+12V+%E7%82%B9%E7%81%AB%E6%99%82%E6%9C%9F&tag=registro500-22"}]'::jsonb
  where id = 74;

-- ============================================================
-- 検算
--   purchase_links が付与された項目数: 39 → 40
--   工具カテゴリの without_link: 1 → 0
--
-- 適用後の確認:
--   select count(*) from public.equipment_items where purchase_links is not null;  -- 期待: 40
--   select id, name, purchase_links from public.equipment_items where id = 74;
--   select category,
--          count(*) filter (where purchase_links is not null) as with_link,
--          count(*) filter (where purchase_links is null)     as without_link
--     from public.equipment_items where is_active group by category order by category;
--     -- 期待: 工具 with_link=24 / without_link=0
--
-- ロールバック:
--   update public.equipment_items set purchase_links = null where id = 74;
-- ============================================================
