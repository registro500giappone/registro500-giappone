CREATE TABLE public.spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id TEXT UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  place_id VARCHAR(255),
  address TEXT,
  registration_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- spot_id自動発番トリガー
CREATE OR REPLACE FUNCTION public.generate_spot_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.spot_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(spot_id FROM 6) AS INT)), 0) + 1
    INTO next_num
    FROM public.spots;
    NEW.spot_id := 'SPOT_' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_spots
BEFORE INSERT ON spots
FOR EACH ROW
WHEN (NEW.spot_id IS NULL)
EXECUTE FUNCTION generate_spot_id();

-- インデックス
CREATE INDEX idx_spots_spot_id ON spots(spot_id);
CREATE INDEX idx_spots_location ON spots(latitude, longitude);

-- ============================================
-- 2. favorite_spots テーブル（お気に入り登録）
-- ============================================

CREATE TABLE public.favorite_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  favorite_id TEXT UNIQUE NOT NULL,
  owner_document_id TEXT NOT NULL,
  spot_id TEXT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,

  comment TEXT,
  photos JSONB DEFAULT '[]'::JSONB,
  time_slots JSONB DEFAULT '[]'::JSONB,
  time_comment VARCHAR(100),
  weekdays JSONB DEFAULT '[]'::JSONB,
  frequency VARCHAR(20),
  duration_minutes INT,
  visibility VARCHAR(20) DEFAULT 'public',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_owner_spot UNIQUE (owner_document_id, spot_id)
);

-- favorite_id自動発番トリガー
CREATE OR REPLACE FUNCTION public.generate_favorite_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.favorite_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(favorite_id FROM 5) AS INT)), 0) + 1
    INTO next_num
    FROM public.favorite_spots;
    NEW.favorite_id := 'FAV_' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_favorite_spots
BEFORE INSERT ON favorite_spots
FOR EACH ROW
WHEN (NEW.favorite_id IS NULL)
EXECUTE FUNCTION generate_favorite_id();

-- 登録人数の自動更新トリガー
CREATE OR REPLACE FUNCTION public.update_spot_registration_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.spots
    SET registration_count = registration_count + 1,
        updated_at = NOW()
    WHERE spot_id = NEW.spot_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.spots
    SET registration_count = registration_count - 1,
        updated_at = NOW()
    WHERE spot_id = OLD.spot_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER after_favorite_spot_change
AFTER INSERT OR DELETE ON favorite_spots
FOR EACH ROW
EXECUTE FUNCTION update_spot_registration_count();

-- インデックス
CREATE INDEX idx_favorite_spots_favorite_id ON favorite_spots(favorite_id);
CREATE INDEX idx_favorite_spots_owner ON favorite_spots(owner_document_id);
CREATE INDEX idx_favorite_spots_spot ON favorite_spots(spot_id);

-- ============================================
-- 3. spot_schedules テーブル（出没予報）
-- ============================================

CREATE TABLE public.spot_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id TEXT UNIQUE NOT NULL,
  owner_document_id TEXT NOT NULL,
  spot_id TEXT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,

  visit_date DATE NOT NULL,
  visit_time_slot VARCHAR(20),
  visit_time_comment VARCHAR(50),
  expected_duration_minutes INT,

  comment TEXT,
  visibility VARCHAR(20) DEFAULT 'public',
  status VARCHAR(20) DEFAULT 'planned',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_owner_spot_date UNIQUE (owner_document_id, spot_id, visit_date)
);

-- schedule_id自動発番トリガー
CREATE OR REPLACE FUNCTION public.generate_schedule_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.schedule_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(schedule_id FROM 7) AS INT)), 0) + 1
    INTO next_num
    FROM public.spot_schedules;
    NEW.schedule_id := 'SCHED_' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_schedules
BEFORE INSERT ON spot_schedules
FOR EACH ROW
WHEN (NEW.schedule_id IS NULL)
EXECUTE FUNCTION generate_schedule_id();

-- インデックス
CREATE INDEX idx_schedules_schedule_id ON spot_schedules(schedule_id);
CREATE INDEX idx_schedules_owner ON spot_schedules(owner_document_id);
CREATE INDEX idx_schedules_spot ON spot_schedules(spot_id);
CREATE INDEX idx_schedules_date ON spot_schedules(visit_date);
CREATE INDEX idx_schedules_date_spot ON spot_schedules(visit_date, spot_id);

-- ============================================
-- 4. privacy_zones テーブル（非表示エリア）
-- ============================================

CREATE TABLE public.privacy_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privacy_id TEXT UNIQUE NOT NULL,
  owner_document_id TEXT NOT NULL,
  zone_type VARCHAR(20) NOT NULL DEFAULT 'circle',
  center_latitude DECIMAL(10, 8),
  center_longitude DECIMAL(11, 8),
  radius_meters INT,
  polygon_coords JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- privacy_id自動発番トリガー
CREATE OR REPLACE FUNCTION public.generate_privacy_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.privacy_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(privacy_id FROM 6) AS INT)), 0) + 1
    INTO next_num
    FROM public.privacy_zones;
    NEW.privacy_id := 'PRIV_' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_privacy_zones
BEFORE INSERT ON privacy_zones
FOR EACH ROW
WHEN (NEW.privacy_id IS NULL)
EXECUTE FUNCTION generate_privacy_id();

-- インデックス
CREATE INDEX idx_privacy_zones_privacy_id ON privacy_zones(privacy_id);
CREATE INDEX idx_privacy_zones_owner ON privacy_zones(owner_document_id);

-- ============================================
-- 5. spot_bookmarks テーブル（行きたいリスト）
-- ============================================

CREATE TABLE public.spot_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id TEXT UNIQUE NOT NULL,
  owner_document_id TEXT NOT NULL,
  spot_id TEXT NOT NULL REFERENCES spots(spot_id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_owner_bookmark UNIQUE (owner_document_id, spot_id)
);

-- bookmark_id自動発番トリガー
CREATE OR REPLACE FUNCTION public.generate_bookmark_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.bookmark_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(bookmark_id FROM 6) AS INT)), 0) + 1
    INTO next_num
    FROM public.spot_bookmarks;
    NEW.bookmark_id := 'BOOK_' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_bookmarks
BEFORE INSERT ON spot_bookmarks
FOR EACH ROW
WHEN (NEW.bookmark_id IS NULL)
EXECUTE FUNCTION generate_bookmark_id();

-- インデックス
CREATE INDEX idx_bookmarks_bookmark_id ON spot_bookmarks(bookmark_id);
CREATE INDEX idx_bookmarks_owner ON spot_bookmarks(owner_document_id);
CREATE INDEX idx_bookmarks_spot ON spot_bookmarks(spot_id);
