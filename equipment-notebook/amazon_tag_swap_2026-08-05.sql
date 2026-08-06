-- ============================================================
-- 車載手帳: Amazonトラッキングタグの差し替え（実行用・発行済みタグ反映）
-- migration名: equipment_notebook_amazon_tag_swap_2026_08_05
-- 状態: ✅適用済み（2026-08-05 タグ発行済み ／ 2026-08-06 本番データで適用を実地確認）
-- 根拠: equipment_items.purchase_links に registro500eq-22 が40件、旧タグ registro500-22 は0件
--
-- amazon_tag_swap_TEMPLATE.sql の NEW_TAG_HERE を実タグ registro500eq-22 に
-- 埋めた実行用ファイル。テンプレート自体は次回以降のタグ変更に備えて残す。
--
-- 目的（HANDOFF「次にやること」4番）:
--   車載手帳のAmazonリンクは現在サイト共通タグ registro500-22 を使っており、
--   goods.html など他ページの売上と混ざってページ別の成果が切り分けられない。
--   専用トラッキングID registro500eq-22 を発行済み（2026-08-05）。
--   車載手帳のリンクだけをこのIDに差し替える。
--
-- 影響範囲＝equipment_items.purchase_links の amazon リンクのみ:
--   ・goods.html などHTMLに直書きされたリンクは対象外（意図どおり。共通タグのまま）
--   ・type='shop'（スタンダードスピード）はアフィリエイトではないので無関係
--
-- 開示文について（2026-08-05 対応済み・作業不要）:
--   equipment-edit.html の開示文に出るアソシエイトIDは、描画したリンクの
--   tag= パラメータから動的に取り出すようにした（#affiliate-tag）。
--   このmigrationを適用すれば開示文の表記も自動で registro500eq-22 に変わる
--   ＝HTML側の作業は不要。
-- ============================================================

-- ------------------------------------------------------------
-- 差し替え前の確認（結果をそのまま表示するだけ。判定は人が行う）
-- ------------------------------------------------------------
-- 期待: 旧タグを含む項目が40件（第1弾39件＋タイミングライト1件）
-- select count(*) as 旧タグ件数
--   from public.equipment_items
--  where purchase_links::text like '%tag=registro500-22%';

-- ------------------------------------------------------------
-- 本体: jsonb をテキスト化して置換し、jsonb に戻す
--   URLのクエリ内の文字列置換なので、jsonb の構造は変わらない。
--   'tag=' まで含めて置換することで、他の値を巻き込まない。
-- ------------------------------------------------------------
update public.equipment_items
   set purchase_links = replace(purchase_links::text,
                                'tag=registro500-22',
                                'tag=registro500eq-22')::jsonb
 where purchase_links::text like '%tag=registro500-22%';

-- ------------------------------------------------------------
-- 差し替え後の確認（結果をそのまま表示するだけ。判定は人が行う）
-- ------------------------------------------------------------
-- 期待: 旧タグ0件・新タグ40件
-- select
--   count(*) filter (where purchase_links::text like '%tag=registro500-22%')   as 旧タグ残,
--   count(*) filter (where purchase_links::text like '%tag=registro500eq-22%') as 新タグ
--   from public.equipment_items;
--
-- 期待: リンクが1本サンプルで開ける形になっている
-- select id, name, purchase_links from public.equipment_items where id = 1;

-- ------------------------------------------------------------
-- クラウドセッションからの独立検算（公開キー・読み取りのみ）
-- ------------------------------------------------------------
--   U="https://ttlttclfovuzafvghvaq.supabase.co/rest/v1"
--   K="sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt"
--   curl -s "$U/equipment_items?select=id,name,purchase_links&id=eq.1" -H "apikey: $K"
