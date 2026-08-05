-- ============================================================
-- 装備手帳: Amazonトラッキングタグの差し替え（テンプレート）
-- migration名: equipment_notebook_amazon_tag_swap_<YYYY_MM_DD>
-- 状態: ★ひな型★（新しいタグを発行してから使う。適用はローカルPCから）
--
-- 目的（HANDOFF「次にやること」4番）:
--   装備手帳のAmazonリンクは現在サイト共通タグ registro500-22 を使っており、
--   goods.html など他ページの売上と混ざってページ別の成果が切り分けられない。
--   Amazonアソシエイトの管理画面で装備手帳専用のトラッキングIDを追加発行し、
--   装備手帳のリンクだけをそのIDに差し替える。
--
-- ⚠️ このファイルは編集して使う。下の :new_tag を実タグに置換すること。
--    置換箇所は1か所だけ（NEW_TAG_HERE）。
--
-- 影響範囲＝equipment_items.purchase_links の amazon リンクのみ:
--   ・goods.html などHTMLに直書きされたリンクは対象外（意図どおり。共通タグのまま）
--   ・type='shop'（スタンダードスピード）はアフィリエイトではないので無関係
--
-- 開示文について（2026-08-05 対応済み・作業不要）:
--   equipment-edit.html の開示文に出るアソシエイトIDは、描画したリンクの
--   tag= パラメータから動的に取り出すようにした（#affiliate-tag）。
--   このmigrationを適用すれば開示文の表記も自動で新タグに変わる＝HTML側の作業は不要。
--   （フォールバック定数 AMAZON_ASSOCIATE_TAG_FALLBACK はリンクからtagを取れなかった
--     場合の保険。実害はないが、落ち着いたら新タグに直しておくとより正確。）
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
                                'tag=NEW_TAG_HERE')::jsonb
 where purchase_links::text like '%tag=registro500-22%';

-- ------------------------------------------------------------
-- 差し替え後の確認（結果をそのまま表示するだけ。判定は人が行う）
-- ------------------------------------------------------------
-- 期待: 旧タグ0件・新タグ40件
-- select
--   count(*) filter (where purchase_links::text like '%tag=registro500-22%') as 旧タグ残,
--   count(*) filter (where purchase_links::text like '%tag=NEW_TAG_HERE%')   as 新タグ
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
