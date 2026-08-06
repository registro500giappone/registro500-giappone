-- ============================================================
-- 車載手帳: 「非常時対応」から「安全装備」を独立カテゴリとして切り出す
-- migration名: equipment_notebook_category_safety_split_2026_08_05
-- 状態: ✅適用済み（2026-08-05 起案 ／ 2026-08-06 本番データで適用を実地確認）
-- 根拠: '安全・救援' カテゴリが独立して存在（4件）
--
-- 背景（2026-08-05 ユーザー確定）:
--   結果画面では安全装備4点を「唯一ダメ出しが許される特別枠」として別扱いしているのに、
--   DB上は「非常時対応」12項目の一部でしかなく、公開閲覧画面（detail.html）では
--   ブースターケーブルや雨具と同列に並んでいた。
--   つまり「DBのカテゴリ（モノの種類）」と「結果画面のロジック上のグループ（安全装備4点）」
--   という軸が2本あり、閲覧画面はカテゴリしか見ていないため区別が消えていた。
--   表示層だけで束ねると入力画面と閲覧画面で見え方が食い違い続けるため、
--   **カテゴリ自体を割って軸を1本にする**。
--
-- ⚠️ 項目IDは変えない。回答（equipment_entries.item_id）は一切壊れない。
--    変えるのは category と、カテゴリ内の並び順 sort_order だけ。
--
-- カテゴリの並び（フロント側の CATEGORIES 配列と一致させること）:
--   工具 → パーツ → ケミカル → 安全装備 → 非常時対応 → 洗車・その他
--   ※ 安全装備を先頭に出す案もあるが、入力画面は先頭カテゴリが既定で開くため
--     既存ユーザーの操作感を変えないよう「非常時対応の直前」に置いた。
--
-- ⚠️ equipment_category_status への影響:
--   「非常時対応を確認済み」にしていた既存レコードは、そのフラグを保持したまま
--   「安全装備」が未確認の状態になる。**これは意図どおり**＝新カテゴリを本人が
--   見ていないのは事実なので、勝手に完了扱いにはしない。データ移行は行わない。
-- ============================================================

-- ------------------------------------------------------------
-- 適用前の確認（結果をそのまま表示するだけ。判定は人が行う）
-- ------------------------------------------------------------
-- 期待: 非常時対応が12件、安全装備が0件
-- select category, count(*) from public.equipment_items
--  where category in ('非常時対応', '安全装備') group by category;

-- ------------------------------------------------------------
-- A. 安全装備4点を新カテゴリへ移す
--    並び順は結果画面の安全装備ブロックと同じ（recommend_priority 1→4 の順）＝
--    三角表示板 → 発煙筒 → ロードサービス連絡先 → 保険証券。
--    画面ごとに順番が違うと同じ4点だと気づきにくいため揃える。
-- ------------------------------------------------------------
update public.equipment_items set category = '安全装備', sort_order =  10 where id = 39; -- 三角表示板（法律上の義務）
update public.equipment_items set category = '安全装備', sort_order =  20 where id = 38; -- 発煙筒・非常信号灯
update public.equipment_items set category = '安全装備', sort_order =  30 where id = 44; -- ロードサービス連絡先
update public.equipment_items set category = '安全装備', sort_order =  40 where id = 45; -- 保険証券

-- ------------------------------------------------------------
-- B. 「非常時対応」に残る8項目の sort_order を詰め直す
--    （4点が抜けた穴を埋めるだけ。表示順の相対関係は変えない）
-- ------------------------------------------------------------
update public.equipment_items set sort_order =  10 where id = 40; -- ブースターケーブル
update public.equipment_items set sort_order =  20 where id = 41; -- 牽引ロープ
update public.equipment_items set sort_order =  30 where id = 42; -- 携帯空気入れ
update public.equipment_items set sort_order =  40 where id = 43; -- モバイルバッテリー
update public.equipment_items set sort_order =  50 where id = 46; -- 整備マニュアル
update public.equipment_items set sort_order =  60 where id = 47; -- 反射ベスト
update public.equipment_items set sort_order =  70 where id = 48; -- 雨具
update public.equipment_items set sort_order =  80 where id = 49; -- 飲料水

-- ============================================================
-- 適用後の確認（結果をそのまま表示するだけ。判定は人が行う）
-- ============================================================
-- 期待: 安全装備4件・非常時対応8件
-- select category, count(*) from public.equipment_items
--  where category in ('非常時対応', '安全装備') group by category;
--
-- 期待: 安全装備が 39→38→44→45 の順、非常時対応が 40,41,42,43,46,47,48,49 の順
-- select category, sort_order, id, name from public.equipment_items
--  where category in ('安全装備', '非常時対応') order by category desc, sort_order;
--
-- 期待: どのカテゴリにも属さない項目が出ていない（フロントの CATEGORIES 配列と突合）
-- select distinct category from public.equipment_items where is_active = true order by 1;

-- ------------------------------------------------------------
-- クラウドセッションからの独立検算（公開キー・読み取りのみ）
-- ------------------------------------------------------------
--   U="https://ttlttclfovuzafvghvaq.supabase.co/rest/v1"
--   K="sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt"
--   curl -s "$U/equipment_items?select=id,category,sort_order,name&id=in.(38,39,44,45)&order=sort_order" -H "apikey: $K"
--
-- ⚠️ フロント側（CATEGORIES 配列）を先にデプロイしてからこのmigrationを適用する。
--    逆順だと、配列に無いカテゴリ '安全装備' の4項目が
--    detail.html では「洗車・その他」に落ち、equipment-edit.html では表示されなくなる。
