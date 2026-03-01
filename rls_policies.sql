-- ============================================
-- Row Level Security (RLS) ポリシー設定
-- Supabase SQL Editor で実行
-- ============================================

-- ============================================
-- 1. spots テーブル
--    SELECT: 全員可能（公開スポット情報）
--    INSERT: anon/authenticated 可能（GAS経由）
--    UPDATE: 禁止（GAS service_role でのみ可能）
--    DELETE: 禁止（GAS service_role でのみ可能）
-- ============================================
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spots_select_all" ON public.spots
  FOR SELECT USING (true);

CREATE POLICY "spots_insert_all" ON public.spots
  FOR INSERT WITH CHECK (true);

CREATE POLICY "spots_no_update" ON public.spots
  FOR UPDATE USING (false);

CREATE POLICY "spots_no_delete" ON public.spots
  FOR DELETE USING (false);

-- ============================================
-- 2. favorite_spots テーブル
--    SELECT: visibility='public' または 自分のデータ
--    INSERT: 自分のデータのみ
--    UPDATE: 自分のデータのみ
--    DELETE: 自分のデータのみ
-- ============================================
ALTER TABLE public.favorite_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorite_spots_select" ON public.favorite_spots
  FOR SELECT USING (
    visibility = 'public'
    OR owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

CREATE POLICY "favorite_spots_insert" ON public.favorite_spots
  FOR INSERT WITH CHECK (
    owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

CREATE POLICY "favorite_spots_update" ON public.favorite_spots
  FOR UPDATE USING (
    owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

CREATE POLICY "favorite_spots_delete" ON public.favorite_spots
  FOR DELETE USING (
    owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

-- ============================================
-- 3. spot_schedules テーブル
--    SELECT: visibility='public' または 自分のデータ
--    INSERT: 自分のデータのみ
--    UPDATE: 自分のデータのみ
--    DELETE: 自分のデータのみ
-- ============================================
ALTER TABLE public.spot_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_select" ON public.spot_schedules
  FOR SELECT USING (
    visibility = 'public'
    OR owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

CREATE POLICY "schedules_insert" ON public.spot_schedules
  FOR INSERT WITH CHECK (
    owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

CREATE POLICY "schedules_update" ON public.spot_schedules
  FOR UPDATE USING (
    owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

CREATE POLICY "schedules_delete" ON public.spot_schedules
  FOR DELETE USING (
    owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

-- ============================================
-- 4. privacy_zones テーブル
--    全操作: 自分のデータのみ
-- ============================================
ALTER TABLE public.privacy_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "privacy_zones_all" ON public.privacy_zones
  FOR ALL USING (
    owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

-- ============================================
-- 5. spot_bookmarks テーブル
--    全操作: 自分のデータのみ
-- ============================================
ALTER TABLE public.spot_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks_all" ON public.spot_bookmarks
  FOR ALL USING (
    owner_document_id = current_setting('request.headers', true)::json->>'x-owner-document-id'
  );

-- ============================================
-- 注意: GASからのリクエストは service_role key を使用するため
-- RLS をバイパスします。
-- フロントエンドから直接Supabaseにアクセスする場合のみ
-- これらのポリシーが適用されます。
--
-- GAS経由の場合は spots_api.gs 内の
-- owner_document_id チェックで権限制御しています。
-- ============================================
