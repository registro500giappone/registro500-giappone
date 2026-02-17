-- ============================================
-- Fiat 126 サイト対応: データベース拡張
-- 実行日: 2026-02-17
-- ============================================

-- ============================================
-- 1. cars テーブルに car_type 列を追加
-- ============================================

-- car_type 列の追加（デフォルト値 '500' で既存データを保護）
ALTER TABLE public.cars
ADD COLUMN IF NOT EXISTS car_type VARCHAR(10) DEFAULT '500' NOT NULL;

-- car_type の制約追加（'500' または '126' のみ許可）
ALTER TABLE public.cars
ADD CONSTRAINT check_car_type CHECK (car_type IN ('500', '126'));

-- car_type のインデックス追加（検索高速化）
CREATE INDEX IF NOT EXISTS idx_cars_car_type ON public.cars(car_type);

-- コメント追加
COMMENT ON COLUMN public.cars.car_type IS '車両タイプ: 500 または 126';

-- ============================================
-- 2. events テーブルに target_car_type 列を追加（オプション）
-- ============================================

-- target_car_type 列の追加（デフォルト値 'both' で500/126共通イベント）
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS target_car_type VARCHAR(20) DEFAULT 'both' NOT NULL;

-- target_car_type の制約追加
ALTER TABLE public.events
ADD CONSTRAINT check_target_car_type CHECK (target_car_type IN ('both', '500', '126'));

-- target_car_type のインデックス追加
CREATE INDEX IF NOT EXISTS idx_events_target_car_type ON public.events(target_car_type);

-- コメント追加
COMMENT ON COLUMN public.events.target_car_type IS 'イベント対象車種: both（共通）, 500, 126';

-- ============================================
-- 3. news テーブルに target_car_type 列を追加（オプション）
-- ============================================

ALTER TABLE public.news
ADD COLUMN IF NOT EXISTS target_car_type VARCHAR(20) DEFAULT 'both' NOT NULL;

ALTER TABLE public.news
ADD CONSTRAINT check_news_car_type CHECK (target_car_type IN ('both', '500', '126'));

CREATE INDEX IF NOT EXISTS idx_news_target_car_type ON public.news(target_car_type);

COMMENT ON COLUMN public.news.target_car_type IS 'ニュース対象車種: both（共通）, 500, 126';

-- ============================================
-- 4. 既存データの確認クエリ（実行結果を確認用）
-- ============================================

-- 既存の cars データ数を確認
SELECT car_type, COUNT(*) as count
FROM public.cars
GROUP BY car_type;

-- 既存の events データ数を確認
SELECT target_car_type, COUNT(*) as count
FROM public.events
GROUP BY target_car_type;

-- ============================================
-- 実行手順
-- ============================================
-- 1. Supabase SQL Editor でこのファイルの内容を実行
-- 2. 実行結果を確認（エラーがないことを確認）
-- 3. 既存データがすべて car_type='500' になっていることを確認
-- 4. edit.html の改修に進む
-- ============================================
