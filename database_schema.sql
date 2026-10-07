-- database_schema.sql ―― 本番 Supabase（public スキーマ）の写し
-- 生成: 2026-10-07 20:13 JST  by py/dump_schema.py（DB 関数 schema_snapshot() の出力）
-- ⚠️ 手で編集しない。スキーマを変えたら migration を当ててから再生成する。
-- ⚠️ そのまま流して復元する用途ではない（依存順・GRANT・storage/auth スキーマは含まない）。読むための資料。

-- ===== extensions =====
-- pg_stat_statements 1.11
-- pgcrypto 1.3
-- plpgsql 1.0
-- supabase_vault 0.3.1
-- uuid-ossp 1.1

-- ===== enum types =====
-- (none)

-- ===== tables / constraints / RLS =====
create table public.car_episodes (
  id uuid not null default gen_random_uuid(),
  car_id text not null,
  type text not null,
  title text not null,
  blocks jsonb not null default '[]'::jsonb,
  episode_date date,
  is_published boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  content text,
  cover_url text,
  photo_urls jsonb not null default '[]'::jsonb,
  date_precision text default 'day'::text,
  is_approximate boolean default false,
  source_url text,
  source_label text,
  notification_sent boolean default false
);
alter table public.car_episodes add constraint car_episodes_pkey PRIMARY KEY (id);
alter table public.car_episodes add constraint car_episodes_date_precision_check CHECK ((date_precision = ANY (ARRAY['year'::text, 'month'::text, 'day'::text])));
alter table public.car_episodes add constraint car_episodes_type_check CHECK ((type = ANY (ARRAY['acquisition'::text, 'trouble'::text, 'tuning'::text, 'drive'::text, 'event'::text, 'other'::text])));
alter table public.car_episodes enable row level security;

create table public.car_history (
  id bigint generated always as identity not null,
  car_id text not null,
  kind text not null,
  fields text,
  occurred_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);
alter table public.car_history add constraint car_history_pkey PRIMARY KEY (id);
alter table public.car_history enable row level security;

create table public.cars (
  id uuid not null default gen_random_uuid(),
  document_id text,
  owner_email text not null,
  handle_name text not null,
  prefecture text not null,
  model_select_a text not null,
  model_text_a text,
  model_select_b text not null,
  model_text_b text,
  year text not null,
  body_color text,
  length_cm text,
  capacity text,
  steering text,
  engine_cc text,
  engine_type_select text,
  engine_type_text text,
  ignition_type text,
  ignition_sub_type text,
  distribution_type text,
  coil_name text,
  plug_name text,
  fuel_injection text,
  carburetor_name text,
  fuel_pump text,
  electric_pump_name text,
  generator text,
  oil_cooler text,
  transmission text,
  synchro text,
  joint text,
  wheel text,
  rim_diameter_in text,
  rim_width_in text,
  tire_type text,
  tire_size text,
  tire_brand_name text,
  engine_oil text,
  engine_oil_interval text,
  transmission_oil text,
  transmission_oil_interval text,
  battery text,
  highlights text,
  x_twitter text,
  instagram text,
  youtube text,
  minkara text,
  facebook text,
  threads text,
  blog_or_website text,
  photo_main text,
  photo_front text,
  photo_side text,
  photo_rear text,
  photo_engine text,
  photo_interior text,
  photo_steering_cluster text,
  accept_inquiry boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  model_display_a text,
  model_display_b text,
  model_display_c text,
  engine_display text,
  notification_sent boolean default false,
  last_update_fields text,
  last_update_date timestamp with time zone,
  car_type character varying(10) not null default '500'::character varying,
  cooling_type text,
  owner_user_id uuid,
  is_sold boolean not null default false,
  sold_at timestamp with time zone,
  sns_share_optout boolean not null default false
);
alter table public.cars add constraint cars_pkey PRIMARY KEY (id);
alter table public.cars add constraint cars_document_id_key UNIQUE (document_id);
alter table public.cars add constraint check_car_type CHECK (((car_type)::text = ANY ((ARRAY['500'::character varying, '126'::character varying])::text[])));
alter table public.cars add constraint handle_name_check CHECK ((char_length(TRIM(BOTH FROM handle_name)) > 0));
alter table public.cars add constraint model_select_a_check CHECK ((char_length(TRIM(BOTH FROM model_select_a)) > 0));
alter table public.cars add constraint model_select_b_check CHECK ((char_length(TRIM(BOTH FROM model_select_b)) > 0));
alter table public.cars add constraint prefecture_check CHECK ((char_length(TRIM(BOTH FROM prefecture)) > 0));
alter table public.cars add constraint year_check CHECK ((char_length(TRIM(BOTH FROM year)) > 0));
alter table public.cars enable row level security;

create table public.categories (
  id uuid not null default gen_random_uuid(),
  parent_id uuid,
  slug text not null,
  name_ja text not null,
  name_it text,
  icon text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now()
);
alter table public.categories add constraint categories_pkey PRIMARY KEY (id);
alter table public.categories add constraint categories_slug_key UNIQUE (slug);
alter table public.categories add constraint categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT;
alter table public.categories enable row level security;

create table public.csp_reports (
  id bigint generated always as identity not null,
  page text not null,
  directive text not null,
  blocked text not null,
  source_file text,
  line_no integer,
  sample_ua text,
  hits integer not null default 1,
  first_seen timestamp with time zone not null default now(),
  last_seen timestamp with time zone not null default now()
);
alter table public.csp_reports add constraint csp_reports_pkey PRIMARY KEY (id);
alter table public.csp_reports add constraint csp_reports_page_directive_blocked_key UNIQUE (page, directive, blocked);
alter table public.csp_reports enable row level security;
comment on table public.csp_reports is 'CSP Report-Only の違反を（page, directive, blocked）で束ねて数える。書き込みは /api/csp-report（service_role）だけ。';

create table public.daily_logins (
  login_date date not null,
  user_id uuid not null,
  car_id text,
  handle_name text,
  owner_email text,
  n_cars integer not null default 1,
  first_login_at timestamp with time zone not null,
  sessions_that_day integer not null default 1
);
alter table public.daily_logins add constraint daily_logins_pkey PRIMARY KEY (login_date, user_id);
alter table public.daily_logins enable row level security;
comment on table public.daily_logins is '日次のユニークログイン人数の記録（延べ=セッション数ではなく実人数）。⛔非公開テーブル（RLS・ポリシーなし）。auth.sessions は保持期間が不確定なため、毎日 sync_daily_logins() で固定保存する。';

create table public.equipment_category_status (
  record_id uuid not null,
  category text not null,
  completed boolean not null default false
);
alter table public.equipment_category_status add constraint equipment_category_status_pkey PRIMARY KEY (record_id, category);
alter table public.equipment_category_status add constraint equipment_category_status_record_id_fkey FOREIGN KEY (record_id) REFERENCES equipment_records(id) ON DELETE CASCADE;
alter table public.equipment_category_status enable row level security;

create table public.equipment_custom_items (
  id uuid not null default gen_random_uuid(),
  record_id uuid not null,
  name text not null,
  frequency text,
  reason text,
  promoted_to_item_id bigint,
  created_at timestamp with time zone not null default now(),
  category text
);
alter table public.equipment_custom_items add constraint equipment_custom_items_pkey PRIMARY KEY (id);
alter table public.equipment_custom_items add constraint equipment_custom_items_frequency_check CHECK ((frequency = ANY (ARRAY['always'::text, 'occasional'::text])));
alter table public.equipment_custom_items add constraint equipment_custom_items_promoted_to_item_id_fkey FOREIGN KEY (promoted_to_item_id) REFERENCES equipment_items(id);
alter table public.equipment_custom_items add constraint equipment_custom_items_record_id_fkey FOREIGN KEY (record_id) REFERENCES equipment_records(id) ON DELETE CASCADE;
alter table public.equipment_custom_items enable row level security;

create table public.equipment_entries (
  id uuid not null default gen_random_uuid(),
  record_id uuid not null,
  item_id bigint not null,
  frequency text not null,
  note text
);
alter table public.equipment_entries add constraint equipment_entries_pkey PRIMARY KEY (id);
alter table public.equipment_entries add constraint equipment_entries_record_id_item_id_key UNIQUE (record_id, item_id);
alter table public.equipment_entries add constraint equipment_entries_frequency_check CHECK ((frequency = ANY (ARRAY['always'::text, 'occasional'::text])));
alter table public.equipment_entries add constraint equipment_entries_item_id_fkey FOREIGN KEY (item_id) REFERENCES equipment_items(id);
alter table public.equipment_entries add constraint equipment_entries_record_id_fkey FOREIGN KEY (record_id) REFERENCES equipment_records(id) ON DELETE CASCADE;
alter table public.equipment_entries enable row level security;
comment on table public.equipment_entries is '装備手帳: 個別回答の最新状態。行が無い=未搭載。';

create table public.equipment_entry_history (
  id uuid not null default gen_random_uuid(),
  record_id uuid not null,
  item_id bigint not null,
  frequency text,
  change_type text not null,
  changed_at timestamp with time zone not null default now()
);
alter table public.equipment_entry_history add constraint equipment_entry_history_pkey PRIMARY KEY (id);
alter table public.equipment_entry_history add constraint equipment_entry_history_change_type_check CHECK ((change_type = ANY (ARRAY['add'::text, 'update'::text, 'remove'::text])));
alter table public.equipment_entry_history add constraint equipment_entry_history_record_id_fkey FOREIGN KEY (record_id) REFERENCES equipment_records(id) ON DELETE CASCADE;
alter table public.equipment_entry_history enable row level security;

create table public.equipment_experiences (
  id uuid not null default gen_random_uuid(),
  record_id uuid not null,
  body text not null,
  created_at timestamp with time zone not null default now()
);
alter table public.equipment_experiences add constraint equipment_experiences_pkey PRIMARY KEY (id);
alter table public.equipment_experiences add constraint equipment_experiences_record_id_fkey FOREIGN KEY (record_id) REFERENCES equipment_records(id) ON DELETE CASCADE;
alter table public.equipment_experiences enable row level security;

create table public.equipment_items (
  id bigint not null,
  code text not null,
  category text not null,
  name text not null,
  reason text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  item_class text not null default 'standard'::text,
  recommend_priority integer,
  created_at timestamp with time zone not null default now(),
  note_prompt text,
  purchase_links jsonb,
  is_universal boolean not null default false
);
alter table public.equipment_items add constraint equipment_items_pkey PRIMARY KEY (id);
alter table public.equipment_items add constraint equipment_items_code_key UNIQUE (code);
alter table public.equipment_items add constraint equipment_items_item_class_check CHECK ((item_class = ANY (ARRAY['standard'::text, 'meihin'::text])));
alter table public.equipment_items enable row level security;
comment on table public.equipment_items is '装備手帳: 項目マスター。id は不変（回答が参照）。廃止は is_active=false。名品は item_class=meihin。';

create table public.equipment_records (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  vehicle_id text,
  is_anonymous boolean not null default false,
  is_public boolean not null default true,
  model_year text,
  usage_freq text,
  longtrip_freq text,
  owner_type text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  notification_sent boolean not null default false
);
alter table public.equipment_records add constraint equipment_records_pkey PRIMARY KEY (id);
alter table public.equipment_records add constraint equipment_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.equipment_records enable row level security;
comment on table public.equipment_records is '装備手帳: 1オーナー/車両の手帳（親）。user_id nullable=匿名回答の器（MVPはログイン必須運用）。';

create table public.equipment_stop_mode_items (
  stop_mode_code text not null,
  item_id bigint not null,
  role text not null
);
alter table public.equipment_stop_mode_items add constraint equipment_stop_mode_items_pkey PRIMARY KEY (stop_mode_code, item_id, role);
alter table public.equipment_stop_mode_items add constraint equipment_stop_mode_items_role_check CHECK ((role = ANY (ARRAY['need'::text, 'help'::text])));
alter table public.equipment_stop_mode_items add constraint equipment_stop_mode_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES equipment_items(id);
alter table public.equipment_stop_mode_items add constraint equipment_stop_mode_items_stop_mode_code_fkey FOREIGN KEY (stop_mode_code) REFERENCES equipment_stop_modes(code);
alter table public.equipment_stop_mode_items enable row level security;

create table public.equipment_stop_modes (
  code text not null,
  sym text not null,
  systems text[] not null,
  levels text[] not null,
  note text,
  need_note text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table public.equipment_stop_modes add constraint equipment_stop_modes_pkey PRIMARY KEY (code);
alter table public.equipment_stop_modes enable row level security;

create table public.equipment_task_items (
  task_code text not null,
  item_id bigint not null,
  or_group text
);
alter table public.equipment_task_items add constraint equipment_task_items_pkey PRIMARY KEY (task_code, item_id);
alter table public.equipment_task_items add constraint equipment_task_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES equipment_items(id);
alter table public.equipment_task_items add constraint equipment_task_items_task_code_fkey FOREIGN KEY (task_code) REFERENCES equipment_tasks(code) ON DELETE CASCADE;
alter table public.equipment_task_items enable row level security;

create table public.equipment_tasks (
  code text not null,
  name text not null,
  task_group text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table public.equipment_tasks add constraint equipment_tasks_pkey PRIMARY KEY (code);
alter table public.equipment_tasks add constraint equipment_tasks_task_group_check CHECK ((task_group = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.equipment_tasks enable row level security;

create table public.event_community_photos (
  id integer not null default nextval('event_community_photos_id_seq'::regclass),
  event_id text not null,
  car_id text not null,
  handle_name text not null,
  photo_url text not null,
  uploaded_at timestamp with time zone default now()
);
alter table public.event_community_photos add constraint event_community_photos_pkey PRIMARY KEY (id);
alter table public.event_community_photos enable row level security;

create table public.event_discovery_log (
  id bigint not null default nextval('event_discovery_log_id_seq'::regclass),
  url_key text not null,
  url text not null,
  event_name text,
  event_date date,
  prefecture text,
  found_via text,
  sent_at timestamp with time zone not null default now()
);
alter table public.event_discovery_log add constraint event_discovery_log_pkey PRIMARY KEY (id);
alter table public.event_discovery_log add constraint event_discovery_log_url_key_key UNIQUE (url_key);
alter table public.event_discovery_log enable row level security;
comment on table public.event_discovery_log is 'イベント探索の送信済みURL台帳。週次メールで一度出した候補の再掲を防ぐためだけに使う。公開しない（service_roleのみ）。';

create table public.event_participants (
  id bigint generated by default as identity not null,
  event_id text,
  car_id text,
  handle_name text,
  created_at timestamp with time zone default now()
);
alter table public.event_participants add constraint event_participants_pkey PRIMARY KEY (id);
alter table public.event_participants add constraint event_participants_event_id_car_id_key UNIQUE (event_id, car_id);
alter table public.event_participants add constraint event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_participants enable row level security;

create table public.event_photos (
  id integer not null default nextval('event_photos_id_seq'::regclass),
  event_id text not null,
  image_url text not null,
  uploaded_by text not null,
  user_id text,
  uploaded_at timestamp without time zone default now()
);
alter table public.event_photos add constraint event_photos_pkey PRIMARY KEY (id);
alter table public.event_photos add constraint event_photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public.event_photos enable row level security;

create table public.event_report_header (
  event_id text not null,
  group_photo_urls text[],
  organizer_message text,
  updated_at timestamp with time zone default now()
);
alter table public.event_report_header add constraint event_report_header_pkey PRIMARY KEY (event_id);
alter table public.event_report_header enable row level security;

create table public.event_report_overrides (
  id integer not null default nextval('event_report_overrides_id_seq'::regclass),
  event_id text not null,
  type text not null,
  car_id text not null,
  handle_name text,
  created_at timestamp with time zone default now()
);
alter table public.event_report_overrides add constraint event_report_overrides_pkey PRIMARY KEY (id);
alter table public.event_report_overrides add constraint event_report_overrides_event_id_type_car_id_key UNIQUE (event_id, type, car_id);
alter table public.event_report_overrides add constraint event_report_overrides_type_check CHECK ((type = ANY (ARRAY['exclude'::text, 'add'::text])));
alter table public.event_report_overrides enable row level security;

create table public.event_report_photos (
  id integer not null default nextval('event_report_photos_id_seq'::regclass),
  event_id text not null,
  car_id text not null,
  photo_index integer not null,
  photo_url text not null,
  uploaded_at timestamp with time zone default now()
);
alter table public.event_report_photos add constraint event_report_photos_pkey PRIMARY KEY (id);
alter table public.event_report_photos add constraint event_report_photos_event_id_car_id_photo_index_key UNIQUE (event_id, car_id, photo_index);
alter table public.event_report_photos add constraint event_report_photos_photo_index_check CHECK ((photo_index = ANY (ARRAY[1, 2])));
alter table public.event_report_photos enable row level security;

create table public.events (
  id text not null,
  owner_id text,
  owner_name text,
  event_name text not null,
  event_date timestamp with time zone,
  location text,
  fee text,
  url text,
  description text,
  notification_sent boolean default false,
  created_at timestamp with time zone default now(),
  event_date_end timestamp with time zone,
  target_car_type character varying(20) not null default 'both'::character varying,
  prefecture text
);
alter table public.events add constraint events_pkey PRIMARY KEY (id);
alter table public.events add constraint check_target_car_type CHECK (((target_car_type)::text = ANY ((ARRAY['both'::character varying, '500'::character varying, '126'::character varying])::text[])));
alter table public.events add constraint events_prefecture_check CHECK (((prefecture IS NULL) OR (prefecture = ANY (ARRAY['北海道'::text, '青森'::text, '岩手'::text, '宮城'::text, '秋田'::text, '山形'::text, '福島'::text, '茨城'::text, '栃木'::text, '群馬'::text, '埼玉'::text, '千葉'::text, '東京'::text, '神奈川'::text, '新潟'::text, '富山'::text, '石川'::text, '福井'::text, '山梨'::text, '長野'::text, '岐阜'::text, '静岡'::text, '愛知'::text, '三重'::text, '滋賀'::text, '京都'::text, '大阪'::text, '兵庫'::text, '奈良'::text, '和歌山'::text, '鳥取'::text, '島根'::text, '岡山'::text, '広島'::text, '山口'::text, '徳島'::text, '香川'::text, '愛媛'::text, '高知'::text, '福岡'::text, '佐賀'::text, '長崎'::text, '熊本'::text, '大分'::text, '宮崎'::text, '鹿児島'::text, '沖縄'::text, '未定'::text, 'オンライン'::text]))));
alter table public.events enable row level security;

create table public.excluded_videos (
  youtube_id text not null,
  reason text,
  channel_name text,
  excluded_at timestamp with time zone not null default now()
);
alter table public.excluded_videos add constraint excluded_videos_pkey PRIMARY KEY (youtube_id);
alter table public.excluded_videos enable row level security;

create table public.favorite_spots (
  id uuid not null default gen_random_uuid(),
  favorite_id text not null,
  owner_document_id text not null,
  spot_id text not null,
  comment text,
  photos jsonb default '[]'::jsonb,
  time_slots jsonb default '[]'::jsonb,
  time_comment character varying(100),
  weekdays jsonb default '[]'::jsonb,
  frequency character varying(20),
  duration_minutes integer,
  visibility character varying(20) default 'public'::character varying,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  owner_user_id uuid
);
alter table public.favorite_spots add constraint favorite_spots_pkey PRIMARY KEY (id);
alter table public.favorite_spots add constraint favorite_spots_favorite_id_key UNIQUE (favorite_id);
alter table public.favorite_spots add constraint unique_owner_spot UNIQUE (owner_document_id, spot_id);
alter table public.favorite_spots add constraint favorite_spots_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES spots(spot_id) ON DELETE CASCADE;
alter table public.favorite_spots enable row level security;

create table public.garage_notes (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  display_name text not null,
  post_type text not null,
  body text not null,
  shop_name text,
  rating text,
  tags text[] default '{}'::text[],
  created_at timestamp with time zone default now(),
  theme text not null default 'parts_purchase'::text
);
alter table public.garage_notes add constraint garage_notes_pkey PRIMARY KEY (id);
alter table public.garage_notes add constraint garage_notes_body_check CHECK ((char_length(TRIM(BOTH FROM body)) > 5));
alter table public.garage_notes add constraint garage_notes_post_type_check CHECK ((post_type = ANY (ARRAY['shop'::text, 'parts'::text, 'shipping'::text, 'tips'::text])));
alter table public.garage_notes add constraint garage_notes_rating_check CHECK ((rating = ANY (ARRAY['good'::text, 'normal'::text, 'caution'::text])));
alter table public.garage_notes add constraint garage_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.garage_notes enable row level security;

create table public.inquiry_log (
  id bigint generated always as identity not null,
  sender_uid uuid not null,
  sender_email text not null,
  target_doc text not null,
  created_at timestamp with time zone not null default now()
);
alter table public.inquiry_log add constraint inquiry_log_pkey PRIMARY KEY (id);
alter table public.inquiry_log enable row level security;

create table public.news (
  id bigint generated by default as identity not null,
  date date default CURRENT_DATE,
  title text not null,
  content text,
  x_posted boolean default false,
  email_sent boolean default false,
  created_at timestamp with time zone default now(),
  target_car_type character varying(20) not null default 'both'::character varying,
  sent_at timestamp with time zone
);
alter table public.news add constraint news_pkey PRIMARY KEY (id);
alter table public.news add constraint news_title_unique UNIQUE (title);
alter table public.news add constraint check_news_car_type CHECK (((target_car_type)::text = ANY ((ARRAY['both'::character varying, '500'::character varying, '126'::character varying])::text[])));
alter table public.news enable row level security;

create table public.owner_tool_users (
  id uuid not null default gen_random_uuid(),
  tool_id uuid not null,
  car_id text not null,
  created_at timestamp with time zone not null default now()
);
alter table public.owner_tool_users add constraint owner_tool_users_pkey PRIMARY KEY (id);
alter table public.owner_tool_users add constraint owner_tool_users_tool_id_car_id_key UNIQUE (tool_id, car_id);
alter table public.owner_tool_users add constraint owner_tool_users_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES owner_tools(id) ON DELETE CASCADE;
alter table public.owner_tool_users enable row level security;

create table public.owner_tools (
  id uuid not null default gen_random_uuid(),
  car_id text not null,
  name text not null,
  category text not null,
  usage text not null,
  comment text not null,
  photo_url text,
  consent_at timestamp with time zone not null default now(),
  source text not null default 'post'::text,
  tool_key text,
  amazon_url text,
  is_hidden boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  admin_notified_at timestamp with time zone,
  notification_sent boolean not null default false
);
alter table public.owner_tools add constraint owner_tools_pkey PRIMARY KEY (id);
alter table public.owner_tools add constraint owner_tools_amazon_url_check CHECK (((amazon_url IS NULL) OR (amazon_url ~~ 'https://www.amazon.co.jp/%'::text) OR (amazon_url ~~ 'https://amzn.to/%'::text)));
alter table public.owner_tools add constraint owner_tools_category_check CHECK ((category = ANY (ARRAY['turn'::text, 'grip'::text, 'measure'::text, 'lift'::text, 'special'::text, 'light'::text, 'repair'::text])));
alter table public.owner_tools add constraint owner_tools_comment_check CHECK (((char_length(btrim(comment)) >= 1) AND (char_length(btrim(comment)) <= 400)));
alter table public.owner_tools add constraint owner_tools_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80)));
alter table public.owner_tools add constraint owner_tools_photo_url_check CHECK (((photo_url IS NULL) OR ((photo_url ~~ 'https://%'::text) AND (char_length(photo_url) <= 1000))));
alter table public.owner_tools add constraint owner_tools_source_check CHECK ((source = ANY (ARRAY['post'::text, 'notebook'::text])));
alter table public.owner_tools add constraint owner_tools_usage_check CHECK ((usage = ANY (ARRAY['carry'::text, 'garage'::text, 'both'::text])));
alter table public.owner_tools enable row level security;

create table public.paint_posts (
  id bigint generated always as identity not null,
  car_type text not null,
  design text not null,
  thumb_path text not null,
  comment text,
  visitor_name text,
  car_doc text,
  user_id uuid,
  delete_key_hash text,
  created_at timestamp with time zone not null default now()
);
alter table public.paint_posts add constraint paint_posts_pkey PRIMARY KEY (id);
alter table public.paint_posts add constraint paint_posts_thumb_path_key UNIQUE (thumb_path);
alter table public.paint_posts add constraint paint_posts_car_type_check CHECK ((car_type = ANY (ARRAY['500'::text, '126'::text])));
alter table public.paint_posts add constraint paint_posts_comment_check CHECK (((comment IS NULL) OR (char_length(comment) <= 40)));
alter table public.paint_posts add constraint paint_posts_design_check CHECK ((char_length(design) <= 3000));
alter table public.paint_posts add constraint paint_posts_visitor_name_check CHECK (((visitor_name IS NULL) OR (char_length(visitor_name) <= 20)));
alter table public.paint_posts enable row level security;

create table public.part_tags (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name_ja text not null,
  name_it text,
  created_at timestamp with time zone not null default now()
);
alter table public.part_tags add constraint part_tags_pkey PRIMARY KEY (id);
alter table public.part_tags add constraint part_tags_slug_key UNIQUE (slug);
alter table public.part_tags enable row level security;

create table public.parts (
  id bigint generated by default as identity not null,
  created_at timestamp with time zone not null default now(),
  shop_name text default '"Axel Gerstl" か "FD Ricambi" かを入れる'::text,
  product_no text default '各ショップ独自の品番'::text,
  oem_no text default '純正品番（名寄せの重要キー）'::text,
  name_en text default 'ショップにある元の英語名'::text,
  price_euro double precision,
  category text,
  stock_status text,
  image_url text,
  page_url text,
  target_cars text,
  specs text,
  updated_at timestamp with time zone default now(),
  name_jp text,
  search_keywords_jp text
);
alter table public.parts add constraint parts_pkey PRIMARY KEY (id);
alter table public.parts add constraint parts_product_no_key UNIQUE (product_no);
alter table public.parts enable row level security;

create table public.parts_snapshots (
  id bigint generated always as identity not null,
  snapshot_date date not null default CURRENT_DATE,
  part_id bigint not null,
  shop_name text,
  price_euro double precision,
  stock_status text,
  captured_at timestamp with time zone not null default now()
);
alter table public.parts_snapshots add constraint parts_snapshots_pkey PRIMARY KEY (id);
alter table public.parts_snapshots add constraint parts_snapshots_snapshot_date_part_id_key UNIQUE (snapshot_date, part_id);
alter table public.parts_snapshots enable row level security;
comment on table public.parts_snapshots is '内部分析用: parts の価格・在庫の変化点だけを記録する時系列（2026-09-30 から）。初出・在庫変化・価格が前回記録から2%以上動いた日にだけ行がある。行が無い日＝直前の行と同じ（±2%未満の為替の揺れを含む）。2026-09-29 以前は完全一致の日だけ間引いた。RLS有効・公開ポリシーなし（service_roleのみ）。';

create table public.recommendations (
  video_id uuid not null,
  user_id uuid not null,
  comment text,
  created_at timestamp with time zone not null default now(),
  author_name text,
  author_vehicle text
);
alter table public.recommendations add constraint recommendations_pkey PRIMARY KEY (video_id, user_id);
alter table public.recommendations add constraint recommendations_comment_len CHECK ((char_length(comment) <= 140));
alter table public.recommendations add constraint recommendations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.recommendations add constraint recommendations_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
alter table public.recommendations enable row level security;

create table public.spot_schedules (
  id uuid not null default gen_random_uuid(),
  schedule_id text not null,
  owner_document_id text not null,
  spot_id text not null,
  visit_date date not null,
  visit_time_slot character varying(20),
  visit_time_comment character varying(50),
  expected_duration_minutes integer,
  comment text,
  visibility character varying(20) default 'public'::character varying,
  status character varying(20) default 'planned'::character varying,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  owner_user_id uuid
);
alter table public.spot_schedules add constraint spot_schedules_pkey PRIMARY KEY (id);
alter table public.spot_schedules add constraint spot_schedules_schedule_id_key UNIQUE (schedule_id);
alter table public.spot_schedules add constraint unique_owner_spot_date UNIQUE (owner_document_id, spot_id, visit_date);
alter table public.spot_schedules add constraint spot_schedules_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES spots(spot_id) ON DELETE CASCADE;
alter table public.spot_schedules enable row level security;

create table public.spots (
  id uuid not null default gen_random_uuid(),
  spot_id text not null,
  name character varying(200) not null,
  category character varying(50) not null,
  latitude numeric(10,8) not null,
  longitude numeric(11,8) not null,
  place_id character varying(255),
  address text,
  registration_count integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  car_type character varying(20) not null default 'both'::character varying,
  owner_user_id uuid
);
alter table public.spots add constraint spots_pkey PRIMARY KEY (id);
alter table public.spots add constraint spots_spot_id_key UNIQUE (spot_id);
alter table public.spots enable row level security;

create table public.user_relations (
  id bigint generated by default as identity not null,
  user_id text not null,
  target_car_id text not null,
  status text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);
alter table public.user_relations add constraint user_relations_pkey PRIMARY KEY (id);
alter table public.user_relations add constraint user_relations_user_id_target_car_id_key UNIQUE (user_id, target_car_id);
alter table public.user_relations add constraint user_relations_status_check CHECK ((status = ANY (ARRAY['want'::text, 'met'::text])));
alter table public.user_relations enable row level security;

create table public.user_selections (
  id uuid not null default gen_random_uuid(),
  part_id bigint,
  shop_name text,
  created_at timestamp with time zone default now(),
  user_id text not null
);
alter table public.user_selections add constraint user_selections_pkey PRIMARY KEY (id);
alter table public.user_selections enable row level security;

create table public.vehicles (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name_official text not null,
  name_display text not null,
  search_aliases text[] not null default '{}'::text[],
  base_vehicle_id uuid,
  sort_order integer not null default 0
);
alter table public.vehicles add constraint vehicles_pkey PRIMARY KEY (id);
alter table public.vehicles add constraint vehicles_slug_key UNIQUE (slug);
alter table public.vehicles add constraint vehicles_base_vehicle_id_fkey FOREIGN KEY (base_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
alter table public.vehicles enable row level security;

create table public.video_part_tags (
  video_id uuid not null,
  part_tag_id uuid not null
);
alter table public.video_part_tags add constraint video_part_tags_pkey PRIMARY KEY (video_id, part_tag_id);
alter table public.video_part_tags add constraint video_part_tags_part_tag_id_fkey FOREIGN KEY (part_tag_id) REFERENCES part_tags(id) ON DELETE CASCADE;
alter table public.video_part_tags add constraint video_part_tags_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
alter table public.video_part_tags enable row level security;

create table public.video_vehicles (
  video_id uuid not null,
  vehicle_id uuid not null
);
alter table public.video_vehicles add constraint video_vehicles_pkey PRIMARY KEY (video_id, vehicle_id);
alter table public.video_vehicles add constraint video_vehicles_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
alter table public.video_vehicles add constraint video_vehicles_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
alter table public.video_vehicles enable row level security;

create table public.videos (
  id uuid not null default gen_random_uuid(),
  youtube_id text not null,
  category_id uuid,
  title_original text,
  title_ja text,
  channel_name text,
  duration_seconds integer,
  thumbnail_url text,
  published_at timestamp with time zone,
  view_count integer not null default 0,
  description_ja text,
  commentary_source text not null default 'ai'::text,
  has_captions boolean not null default false,
  embeddable boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  source_tier smallint not null default 3,
  channel_id text,
  is_categorized boolean default (category_id IS NOT NULL),
  is_howto boolean not null default false,
  recommended_by_name text,
  steps_ja jsonb,
  has_steps boolean default (steps_ja IS NOT NULL)
);
alter table public.videos add constraint videos_pkey PRIMARY KEY (id);
alter table public.videos add constraint videos_youtube_id_key UNIQUE (youtube_id);
alter table public.videos add constraint videos_commentary_source_check CHECK ((commentary_source = ANY (ARRAY['ai'::text, 'human'::text, 'hybrid'::text])));
alter table public.videos add constraint videos_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public.videos enable row level security;

create table public.view_history (
  id bigint generated always as identity not null,
  video_id uuid not null,
  view_count integer not null,
  fetched_at timestamp with time zone not null default now()
);
alter table public.view_history add constraint view_history_pkey PRIMARY KEY (id);
alter table public.view_history add constraint view_history_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
alter table public.view_history enable row level security;

create table public.weekly_metrics (
  week_start date not null,
  total_cars integer,
  n_500 integer,
  n_126 integer,
  new_regs_7d integer,
  linked integer,
  active_30d integer,
  active_90d integer,
  edited integer,
  unlinked integer,
  rel_count integer,
  rel_users integer,
  event_cars integer,
  fav_users integer,
  episodes_pub integer,
  garage_notes integer,
  user_selections integer,
  pv_7d integer,
  visits_7d integer,
  generated_at timestamp with time zone default now(),
  pv integer,
  visits integer,
  signup_page_views integer,
  signups integer,
  signup_cvr numeric,
  affil_clicks integer,
  affil_click_by_page jsonb,
  participation_90d integer
);
alter table public.weekly_metrics add constraint weekly_metrics_pkey PRIMARY KEY (week_start);
alter table public.weekly_metrics enable row level security;

-- ===== indexes (constraint-backed indexes excluded) =====
CREATE INDEX idx_car_episodes_car_id ON public.car_episodes USING btree (car_id);
CREATE INDEX idx_car_episodes_published ON public.car_episodes USING btree (is_published, created_at DESC);
CREATE INDEX car_history_car_idx ON public.car_history USING btree (car_id, occurred_at DESC);
CREATE INDEX idx_cars_car_type ON public.cars USING btree (car_type);
CREATE INDEX idx_cars_is_sold ON public.cars USING btree (is_sold) WHERE (is_sold = true);
CREATE INDEX idx_cars_model ON public.cars USING btree (model_select_a, model_select_b);
CREATE INDEX idx_cars_owner ON public.cars USING btree (owner_email);
CREATE INDEX idx_categories_parent ON public.categories USING btree (parent_id);
CREATE INDEX idx_equipment_custom_record ON public.equipment_custom_items USING btree (record_id);
CREATE INDEX idx_equipment_entries_item ON public.equipment_entries USING btree (item_id);
CREATE INDEX idx_equipment_entries_record ON public.equipment_entries USING btree (record_id);
CREATE INDEX idx_equipment_history_record ON public.equipment_entry_history USING btree (record_id);
CREATE INDEX idx_equipment_exp_record ON public.equipment_experiences USING btree (record_id);
CREATE INDEX idx_equipment_items_cat ON public.equipment_items USING btree (category, sort_order);
CREATE INDEX idx_equipment_records_user ON public.equipment_records USING btree (user_id);
CREATE INDEX idx_equipment_records_vehicle ON public.equipment_records USING btree (vehicle_id);
CREATE INDEX idx_equipment_stop_mode_items_item ON public.equipment_stop_mode_items USING btree (item_id);
CREATE INDEX idx_equipment_stop_modes_sort ON public.equipment_stop_modes USING btree (sort_order);
CREATE INDEX idx_equipment_task_items_item ON public.equipment_task_items USING btree (item_id);
CREATE INDEX idx_equipment_tasks_sort ON public.equipment_tasks USING btree (sort_order);
CREATE INDEX idx_event_discovery_log_sent_at ON public.event_discovery_log USING btree (sent_at DESC);
CREATE INDEX idx_event_photos_event_id ON public.event_photos USING btree (event_id);
CREATE INDEX idx_events_target_car_type ON public.events USING btree (target_car_type);
CREATE INDEX idx_favorite_spots_favorite_id ON public.favorite_spots USING btree (favorite_id);
CREATE INDEX idx_favorite_spots_owner ON public.favorite_spots USING btree (owner_document_id);
CREATE INDEX idx_favorite_spots_spot ON public.favorite_spots USING btree (spot_id);
CREATE INDEX inquiry_log_sender_idx ON public.inquiry_log USING btree (sender_uid, created_at DESC);
CREATE INDEX idx_news_target_car_type ON public.news USING btree (target_car_type);
CREATE INDEX idx_owner_tool_users_car ON public.owner_tool_users USING btree (car_id);
CREATE INDEX idx_owner_tool_users_tool ON public.owner_tool_users USING btree (tool_id);
CREATE INDEX idx_owner_tools_car ON public.owner_tools USING btree (car_id);
CREATE INDEX idx_owner_tools_created ON public.owner_tools USING btree (created_at DESC);
CREATE INDEX paint_posts_car_idx ON public.paint_posts USING btree (car_doc, created_at DESC);
CREATE INDEX paint_posts_created_idx ON public.paint_posts USING btree (created_at DESC);
CREATE INDEX idx_reco_video ON public.recommendations USING btree (video_id);
CREATE INDEX idx_schedules_date ON public.spot_schedules USING btree (visit_date);
CREATE INDEX idx_schedules_date_spot ON public.spot_schedules USING btree (visit_date, spot_id);
CREATE INDEX idx_schedules_owner ON public.spot_schedules USING btree (owner_document_id);
CREATE INDEX idx_schedules_schedule_id ON public.spot_schedules USING btree (schedule_id);
CREATE INDEX idx_schedules_spot ON public.spot_schedules USING btree (spot_id);
CREATE INDEX idx_spots_location ON public.spots USING btree (latitude, longitude);
CREATE INDEX idx_spots_spot_id ON public.spots USING btree (spot_id);
CREATE INDEX idx_vehicles_base ON public.vehicles USING btree (base_vehicle_id);
CREATE INDEX idx_vpt_tag ON public.video_part_tags USING btree (part_tag_id);
CREATE INDEX idx_vv_vehicle ON public.video_vehicles USING btree (vehicle_id);
CREATE INDEX idx_videos_category ON public.videos USING btree (category_id);
CREATE INDEX idx_videos_published ON public.videos USING btree (published_at DESC);
CREATE INDEX idx_videos_rank ON public.videos USING btree (is_categorized DESC, source_tier, view_count DESC);
CREATE INDEX idx_videos_tier_view ON public.videos USING btree (source_tier, view_count DESC);
CREATE INDEX idx_videos_viewcount ON public.videos USING btree (view_count DESC);
CREATE INDEX idx_viewhistory_video ON public.view_history USING btree (video_id, fetched_at DESC);

-- ===== views =====
create or replace view public.video_reco_counts with (security_invoker=true) as
 SELECT v.id AS video_id,
    count(r.user_id) AS reco_count,
    count(r.comment) AS comment_count
   FROM videos v
     LEFT JOIN recommendations r ON r.video_id = v.id
  GROUP BY v.id;

-- ===== functions (acl: who may EXECUTE; "=X" means PUBLIC) =====
CREATE OR REPLACE FUNCTION public.car_history_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.car_history (car_id, kind, occurred_at)
  values (new.document_id, 'registered', new.created_at);
  return new;
end;
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.car_history_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.is_sold is distinct from old.is_sold then
    insert into public.car_history (car_id, kind, occurred_at)
    values (
      new.document_id,
      case when new.is_sold then 'sold' else 'unsold' end,
      coalesce(new.sold_at, now())
    );
  end if;

  if new.last_update_date is distinct from old.last_update_date
     and new.last_update_date is not null then
    insert into public.car_history (car_id, kind, fields, occurred_at)
    values (new.document_id, 'updated', new.last_update_fields, new.last_update_date);
  end if;

  return new;
end;
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.csp_report_log(p_page text, p_directive text, p_blocked text, p_source text, p_line integer, p_ua text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  insert into public.csp_reports (page, directive, blocked, source_file, line_no, sample_ua)
  values (left(p_page, 300), left(p_directive, 60), left(coalesce(p_blocked, ''), 300), left(p_source, 300), p_line, left(p_ua, 200))
  on conflict (page, directive, blocked) do update
    set hits        = csp_reports.hits + 1,
        last_seen   = now(),
        source_file = coalesce(excluded.source_file, csp_reports.source_file),
        line_no     = coalesce(excluded.line_no, csp_reports.line_no),
        sample_ua   = coalesce(excluded.sample_ua, csp_reports.sample_ua);
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.equipment_item_rates()
 RETURNS TABLE(item_id bigint, code text, category text, name text, always_count bigint, occasional_count bigint, loaded_count bigint, total_records bigint, load_rate numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with totals as (
    select count(*)::bigint as n from public.equipment_records
  )
  select
    i.id,
    i.code,
    i.category,
    i.name,
    count(e.id) filter (where e.frequency = 'always')::bigint,
    count(e.id) filter (where e.frequency = 'occasional')::bigint,
    count(e.id)::bigint as loaded_count,
    (select n from totals) as total_records,
    case when (select n from totals) > 0
      then round(count(e.id)::numeric / (select n from totals), 4)
      else 0 end as load_rate
  from public.equipment_items i
  left join public.equipment_entries e on e.item_id = i.id
  where i.is_active
  group by i.id, i.code, i.category, i.name, i.sort_order
  order by i.sort_order;
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.equipment_public_list(p_limit integer DEFAULT 24)
 RETURNS TABLE(record_id uuid, vehicle_id text, updated_at timestamp with time zone, created_at timestamp with time zone, handle_name text, model_display text, car_type text, photo_main text, prefecture text, car_year text, loaded_count integer, has_experience boolean, is_maestro boolean, total_public bigint, total_linked bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with master as (
  select unnest(array[
    4, 55, 56, 1, 5, 6, 61, 2, 60, 3, 58, 9, 57, 10, 7, 11, 13, 62, 63, 64,
    14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 27, 28, 65, 68, 71,
    29, 31, 32, 33, 70,
    40, 46,
    39, 38, 44, 45,
    8, 59, 74
  ]::bigint[]) as id
),
safety as (
  select unnest(array[39, 38, 44, 45]::bigint[]) as id
),
supersedes(owner_id, covered_id) as (
  values
    (66::bigint, 71::bigint),
    (67::bigint, 19::bigint),
    (67::bigint, 20::bigint),
    (67::bigint, 15::bigint),
    (67::bigint, 16::bigint)
),
master_existing as (
  select m.id from master m join equipment_items i on i.id = m.id
),
required as (
  select ceil(count(*) * 0.9)::int as n from master_existing
),
linked as (
  select r.id, r.vehicle_id, r.updated_at, r.created_at
    from equipment_records r
    join cars c on c.document_id = r.vehicle_id
   where r.is_public = true
),
totals as (
  select
    (select count(*) from equipment_records where is_public = true) as total_public,
    (select count(*) from linked) as total_linked
),
pub as (
  select * from linked order by updated_at desc
   limit least(greatest(coalesce(p_limit, 24), 1), 100)
),
raw_loaded as (
  select e.record_id, e.item_id
    from equipment_entries e
    join pub p on p.id = e.record_id
   where e.frequency is not null
),
loaded as (
  select distinct record_id, item_id from (
    select record_id, item_id from raw_loaded
    union all
    select rl.record_id, s.covered_id as item_id
      from raw_loaded rl join supersedes s on s.owner_id = rl.item_id
  ) x
)
select
  p.id,
  p.vehicle_id::text,
  p.updated_at,
  p.created_at,
  c.handle_name::text,
  coalesce(
    nullif(c.model_display_c::text, ''),
    nullif(btrim(concat_ws(' ', nullif(c.model_display_a::text, ''), nullif(c.model_display_b::text, ''))), '')
  ),
  c.car_type::text,
  c.photo_main::text,
  c.prefecture::text,
  c.year::text,
  (
    (select count(*) from raw_loaded l where l.record_id = p.id)
    + (select count(*) from equipment_custom_items ci where ci.record_id = p.id and ci.frequency is not null)
  )::int,
  exists (select 1 from equipment_experiences x
           where x.record_id = p.id and nullif(btrim(x.body), '') is not null),
  (
    (select count(*) from loaded l join master_existing me on me.id = l.item_id where l.record_id = p.id) >= (select n from required)
    and (select count(*) from loaded l join safety s on s.id = l.item_id where l.record_id = p.id) = (select count(*) from safety)
  ),
  t.total_public,
  t.total_linked
from pub p
join cars c on c.document_id = p.vehicle_id
cross join totals t
order by p.updated_at desc;
$function$
;
-- acl: postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.generate_bookmark_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.generate_favorite_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.generate_privacy_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.generate_schedule_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.generate_spot_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.get_next_doc_id()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    next_num INTEGER;
BEGIN
    -- DOC_ の後の数字だけを取り出して最大値を探す
    SELECT COALESCE(MAX(CAST(SUBSTRING(document_id FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM cars
    WHERE document_id LIKE 'DOC_%';
    
    RETURN 'DOC_' || next_num;
END;
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.handle_car_display_names()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- model_display_a の計算
  NEW.model_display_a := CASE WHEN NEW.model_select_a = 'その他' THEN NEW.model_text_a ELSE NEW.model_select_a END;

  -- model_display_b の計算
  NEW.model_display_b := CASE WHEN NEW.model_select_b = 'その他' THEN NEW.model_text_b ELSE NEW.model_select_b END;

  -- model_display_c の合体 (A + B)
  -- model_display_b が '標準' / '不明' のときは車名の一部ではないので結合しない
  NEW.model_display_c := CASE
    WHEN NEW.model_display_b IS NULL OR NEW.model_display_b = '' OR NEW.model_display_b IN ('標準', '不明')
    THEN TRIM(COALESCE(NEW.model_display_a, ''))
    ELSE TRIM(COALESCE(NEW.model_display_a, '') || ' ' || NEW.model_display_b)
  END;

  -- engine_display の計算
  NEW.engine_display := CASE WHEN NEW.engine_type_select = 'その他' THEN NEW.engine_type_text ELSE NEW.engine_type_select END;

  RETURN NEW;
END;
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.handle_lower_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.owner_email := LOWER(NEW.owner_email);
  RETURN NEW;
END;
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'registro500giappone@gmail.com';
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.link_owner_car()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(nullif(auth.jwt() ->> 'email', ''), ''));
  n integer;
begin
  if v_uid is null or v_email = '' then
    return 0;
  end if;
  update public.cars
     set owner_user_id = v_uid
   where owner_user_id is null
     and lower(owner_email) = v_email;
  get diagnostics n = row_count;
  return n;
end;
$function$
;
-- acl: postgres=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.mark_event_notification_sent(p_event_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE events SET notification_sent = true WHERE id = p_event_id;
END;
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.mark_notification_sent(car_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE cars SET notification_sent = true WHERE id = car_id;
END;
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.owner_tools_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  if public.is_admin() or current_user not in ('authenticated','anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.tool_key := null; new.amazon_url := null; new.is_hidden := false; new.source := 'post';
    new.consent_at := now(); new.admin_notified_at := null; new.notification_sent := false;
  else
    new.tool_key := old.tool_key; new.amazon_url := old.amazon_url;
    new.is_hidden := old.is_hidden; new.source := old.source;
    new.consent_at := old.consent_at; new.car_id := old.car_id; new.created_at := old.created_at;
    new.admin_notified_at := old.admin_notified_at; new.notification_sent := old.notification_sent;
  end if;
  return new;
end $function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.owns_car(p_doc text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.cars c
     where c.document_id = p_doc
       and (
         c.owner_user_id = auth.uid()
         or (c.owner_user_id is null
             and lower(c.owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
       )
  );
$function$
;
-- acl: postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.paint_post_create(p_car_type text, p_design text, p_thumb_path text, p_comment text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_car_doc text DEFAULT NULL::text, p_delete_key text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_design text := coalesce(p_design, '');
  v_comment text := nullif(btrim(coalesce(p_comment,'')), '');
  v_name text := nullif(btrim(coalesce(p_name,'')), '');
begin
  if p_car_type not in ('500','126') then raise exception 'bad car_type'; end if;
  if char_length(v_design) > 3000 then raise exception 'bad design'; end if;
  if v_comment is not null and char_length(v_comment) > 40 then raise exception 'comment too long'; end if;
  if v_name is not null and char_length(v_name) > 20 then raise exception 'name too long'; end if;
  if p_thumb_path !~ ('^' || p_car_type || '/[0-9a-f-]{36}\.jpg$') then raise exception 'bad thumb'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'paint-thumbs' and name = p_thumb_path) then
    raise exception 'thumb missing';
  end if;
  if (select count(*) from paint_posts where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate limited';
  end if;
  if p_car_doc is not null then
    if v_uid is null or not exists (select 1 from cars where document_id = p_car_doc and owner_user_id = v_uid) then
      raise exception 'not your car';
    end if;
    insert into paint_posts (car_type, design, thumb_path, comment, car_doc, user_id)
    values (p_car_type, v_design, p_thumb_path, v_comment, p_car_doc, v_uid)
    returning id into v_id;
  else
    if p_delete_key is null or char_length(p_delete_key) < 32 then raise exception 'bad key'; end if;
    if v_name is null then raise exception 'name required'; end if;
    insert into paint_posts (car_type, design, thumb_path, comment, visitor_name, user_id, delete_key_hash)
    values (p_car_type, v_design, p_thumb_path, v_comment, v_name, v_uid,
            encode(sha256(convert_to(p_delete_key, 'UTF8')), 'hex'))
    returning id into v_id;
  end if;
  return v_id;
end $function$
;
-- acl: postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.paint_post_delete(p_id bigint, p_delete_key text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r paint_posts%rowtype;
  v_uid uuid := auth.uid();
begin
  select * into r from paint_posts where id = p_id;
  if not found then return null; end if;
  if not (
       is_admin()
    or (v_uid is not null and r.user_id = v_uid and r.car_doc is not null)
    or (v_uid is not null and r.car_doc is not null and exists (select 1 from cars where document_id = r.car_doc and owner_user_id = v_uid))
    or (p_delete_key is not null and r.delete_key_hash = encode(sha256(convert_to(p_delete_key, 'UTF8')), 'hex'))
  ) then
    raise exception 'not allowed';
  end if;
  delete from paint_posts where id = p_id;
  return r.thumb_path;
end $function$
;
-- acl: postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.paint_posts_list(p_car_type text DEFAULT NULL::text, p_car_doc text DEFAULT NULL::text, p_limit integer DEFAULT 60, p_before bigint DEFAULT NULL::bigint)
 RETURNS TABLE(id bigint, car_type text, design text, thumb_path text, comment text, name text, car_doc text, is_owner_post boolean, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.car_type, p.design, p.thumb_path, p.comment,
         case when p.car_doc is not null then coalesce(nullif(c.handle_name,''), 'オーナー')
              else coalesce(p.visitor_name, 'ゲスト') end,
         p.car_doc, p.car_doc is not null, p.created_at
  from paint_posts p
  left join cars c on c.document_id = p.car_doc
  where (p_car_type is null or p.car_type = p_car_type)
    and (p_car_doc is null or p.car_doc = p_car_doc)
    and (p_before is null or p.id < p_before)
  order by p.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$function$
;
-- acl: postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.paint_thumb_in_use(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists (select 1 from paint_posts where thumb_path = p_name) $function$
;
-- acl: postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.report_daily_logins(days integer DEFAULT 30)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_agg(json_build_object('d', to_char(login_date,'YYYY-MM-DD'), 'n', n) order by login_date), '[]'::json)
  from (
    select login_date, count(*) as n
    from public.daily_logins
    where login_date >= (now() at time zone 'Asia/Tokyo')::date - days
    group by login_date
  ) x;
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.report_owner_activity()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select json_build_object(
    'summary', (
      select json_build_object(
        'linked',     count(*),
        'active_30d', count(*) filter (where u.last_sign_in_at > now() - interval '30 days'),
        'active_90d', count(*) filter (where u.last_sign_in_at > now() - interval '90 days')
      )
      from public.cars c
      join auth.users u on u.id = c.owner_user_id
    ),
    'cohort', (
      select coalesce(json_agg(r order by r.ym), '[]'::json)
      from (
        select to_char(c.created_at, 'YYYY-MM') as ym,
               count(*)                                                              as registered,
               count(c.owner_user_id)                                               as linked,
               count(*) filter (where u.last_sign_in_at > now() - interval '90 days') as active_90d
        from public.cars c
        left join auth.users u on u.id = c.owner_user_id
        group by 1
      ) r
    )
  );
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.set_video_is_howto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare root_slug text;
begin
  if NEW.category_id is null then
    NEW.is_howto := false;
  else
    select coalesce(p.slug, c.slug) into root_slug
    from public.categories c
    left join public.categories p on p.id = c.parent_id
    where c.id = NEW.category_id;
    NEW.is_howto := coalesce(root_slug in ('manutenzione','restauro','elaborazione'), false);
  end if;
  return NEW;
end;
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.sync_daily_logins(target_date date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  d date := coalesce(target_date, ((now() at time zone 'Asia/Tokyo')::date - 1));
  n integer;
begin
  with day_sessions as (
    select s.user_id, min(s.created_at) as first_login_at, count(*) as sessions_that_day
    from auth.sessions s
    where (s.created_at at time zone 'Asia/Tokyo')::date = d
    group by s.user_id
  ),
  owner as (
    select c.owner_user_id as user_id,
           (array_agg(c.id order by c.created_at))[1] as car_id,
           (array_agg(c.handle_name order by c.created_at))[1] as handle_name,
           (array_agg(c.owner_email order by c.created_at))[1] as owner_email,
           count(*) as n_cars
    from public.cars c
    where c.owner_user_id is not null
    group by c.owner_user_id
  )
  insert into public.daily_logins (login_date, user_id, car_id, handle_name, owner_email, n_cars, first_login_at, sessions_that_day)
  select d, ds.user_id, o.car_id, o.handle_name, o.owner_email, coalesce(o.n_cars, 0),
         ds.first_login_at, ds.sessions_that_day
  from day_sessions ds
  left join owner o on o.user_id = ds.user_id
  on conflict (login_date, user_id) do update set
    car_id = excluded.car_id, handle_name = excluded.handle_name, owner_email = excluded.owner_email,
    n_cars = excluded.n_cars, first_login_at = excluded.first_login_at, sessions_that_day = excluded.sessions_that_day;

  get diagnostics n = row_count;
  return n;
end;
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.take_parts_snapshot()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  inserted_count integer;
begin
  with last as (
    select distinct on (part_id) part_id, price_euro, stock_status
      from public.parts_snapshots
     order by part_id, snapshot_date desc
  )
  insert into public.parts_snapshots (snapshot_date, part_id, shop_name, price_euro, stock_status)
  select current_date, p.id, p.shop_name, p.price_euro, p.stock_status
    from public.parts p
    left join last l on l.part_id = p.id
   where l.part_id is null
      or p.stock_status is distinct from l.stock_status
      or (p.price_euro is distinct from l.price_euro
          and (p.price_euro is null or l.price_euro is null or l.price_euro = 0
               or abs(p.price_euro - l.price_euro) / abs(l.price_euro) >= 0.02))
  on conflict (snapshot_date, part_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.trigger_set_doc_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.document_id IS NULL OR NEW.document_id = '' OR NEW.document_id LIKE 'DOC_17%' THEN
        NEW.document_id := get_next_doc_id();
    END IF;
    RETURN NEW;
END;
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.update_spot_registration_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  BEGIN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.spots
      SET registration_count = COALESCE(registration_count, 0) + 1,
          updated_at = NOW()
      WHERE spot_id = NEW.spot_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.spots
      SET registration_count = GREATEST(COALESCE(registration_count, 0) - 1, 0),
          updated_at = NOW()
      WHERE spot_id = OLD.spot_id;
    END IF;
    RETURN NULL;
  END;
$function$
;
-- acl: postgres=X/postgres service_role=X/postgres

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
-- acl: =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres

-- ===== triggers =====
CREATE TRIGGER car_history_after_insert AFTER INSERT ON public.cars FOR EACH ROW EXECUTE FUNCTION car_history_on_insert();
CREATE TRIGGER car_history_after_update AFTER UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION car_history_on_update();
CREATE TRIGGER tr_calculate_display_names BEFORE INSERT OR UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION handle_car_display_names();
CREATE TRIGGER tr_lower_email BEFORE INSERT OR UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION handle_lower_email();
CREATE TRIGGER tr_set_doc_id BEFORE INSERT ON public.cars FOR EACH ROW EXECUTE FUNCTION trigger_set_doc_id();
CREATE TRIGGER after_favorite_spot_change AFTER INSERT OR DELETE ON public.favorite_spots FOR EACH ROW EXECUTE FUNCTION update_spot_registration_count();
CREATE TRIGGER before_insert_favorite_spots BEFORE INSERT ON public.favorite_spots FOR EACH ROW WHEN ((new.favorite_id IS NULL)) EXECUTE FUNCTION generate_favorite_id();
CREATE TRIGGER owner_tools_guard BEFORE INSERT OR UPDATE ON public.owner_tools FOR EACH ROW EXECUTE FUNCTION owner_tools_guard();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER before_insert_schedules BEFORE INSERT ON public.spot_schedules FOR EACH ROW WHEN ((new.schedule_id IS NULL)) EXECUTE FUNCTION generate_schedule_id();
CREATE TRIGGER before_insert_spots BEFORE INSERT ON public.spots FOR EACH ROW WHEN ((new.spot_id IS NULL)) EXECUTE FUNCTION generate_spot_id();
CREATE TRIGGER trg_video_is_howto BEFORE INSERT OR UPDATE OF category_id ON public.videos FOR EACH ROW EXECUTE FUNCTION set_video_is_howto();
CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== row level security policies =====
create policy car_episodes_delete_auth on public.car_episodes as permissive for DELETE to public
  using ((is_admin() OR owns_car(car_id)));
create policy car_episodes_insert_auth on public.car_episodes as permissive for INSERT to public
  with check ((is_admin() OR owns_car(car_id)));
create policy car_episodes_select_auth on public.car_episodes as permissive for SELECT to public
  using ((auth.uid() IS NOT NULL));
create policy car_episodes_update_auth on public.car_episodes as permissive for UPDATE to public
  using ((is_admin() OR owns_car(car_id)))
  with check ((is_admin() OR owns_car(car_id)));
create policy public_read on public.car_episodes as permissive for SELECT to public
  using ((is_published = true));
create policy car_history_public_read on public.car_history as permissive for SELECT to public
  using (true);
create policy cars_delete_policy on public.cars as permissive for DELETE to public
  using ((is_admin() OR (owner_user_id = auth.uid())));
create policy cars_insert_policy on public.cars as permissive for INSERT to public
  with check ((auth.uid() IS NOT NULL));
create policy cars_select_policy on public.cars as permissive for SELECT to public
  using (true);
create policy cars_update_policy on public.cars as permissive for UPDATE to public
  using ((is_admin() OR (owner_user_id = auth.uid()) OR ((owner_user_id IS NULL) AND (lower(owner_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))))
  with check ((is_admin() OR (owner_user_id = auth.uid()) OR ((owner_user_id IS NULL) AND (lower(owner_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))));
create policy "public read categories" on public.categories as permissive for SELECT to public
  using (true);
create policy equipment_catstatus_all_own on public.equipment_category_status as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_category_status.record_id) AND (r.user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_category_status.record_id) AND (r.user_id = auth.uid())))));
create policy equipment_catstatus_select_public on public.equipment_category_status as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_category_status.record_id) AND (r.is_public = true)))));
create policy equipment_custom_all_own on public.equipment_custom_items as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_custom_items.record_id) AND (r.user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_custom_items.record_id) AND (r.user_id = auth.uid())))));
create policy equipment_custom_select_public on public.equipment_custom_items as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_custom_items.record_id) AND (r.is_public = true)))));
create policy equipment_entries_all_own on public.equipment_entries as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_entries.record_id) AND (r.user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_entries.record_id) AND (r.user_id = auth.uid())))));
create policy equipment_entries_select_public on public.equipment_entries as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_entries.record_id) AND (r.is_public = true)))));
create policy equipment_history_all_own on public.equipment_entry_history as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_entry_history.record_id) AND (r.user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_entry_history.record_id) AND (r.user_id = auth.uid())))));
create policy equipment_exp_all_own on public.equipment_experiences as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_experiences.record_id) AND (r.user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_experiences.record_id) AND (r.user_id = auth.uid())))));
create policy equipment_exp_select_public on public.equipment_experiences as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM equipment_records r
  WHERE ((r.id = equipment_experiences.record_id) AND (r.is_public = true)))));
create policy equipment_items_select_all on public.equipment_items as permissive for SELECT to public
  using (true);
create policy equipment_records_delete_own on public.equipment_records as permissive for DELETE to public
  using ((auth.uid() = user_id));
create policy equipment_records_insert_own on public.equipment_records as permissive for INSERT to public
  with check ((auth.uid() = user_id));
create policy equipment_records_select_own on public.equipment_records as permissive for SELECT to public
  using ((auth.uid() = user_id));
create policy equipment_records_select_public on public.equipment_records as permissive for SELECT to public
  using ((is_public = true));
create policy equipment_records_update_own on public.equipment_records as permissive for UPDATE to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy equipment_stop_mode_items_select_all on public.equipment_stop_mode_items as permissive for SELECT to public
  using (true);
create policy equipment_stop_modes_select_all on public.equipment_stop_modes as permissive for SELECT to public
  using (true);
create policy equipment_task_items_select_all on public.equipment_task_items as permissive for SELECT to anon, authenticated
  using (true);
create policy equipment_tasks_select_all on public.equipment_tasks as permissive for SELECT to anon, authenticated
  using (true);
create policy event_community_photos_delete_policy on public.event_community_photos as permissive for DELETE to public
  using ((is_admin() OR (car_id IN ( SELECT cars.document_id
   FROM cars
  WHERE (cars.owner_user_id = auth.uid())))));
create policy event_community_photos_insert_policy on public.event_community_photos as permissive for INSERT to public
  with check ((auth.uid() IS NOT NULL));
create policy event_community_photos_select_policy on public.event_community_photos as permissive for SELECT to public
  using (true);
create policy event_participants_delete_policy on public.event_participants as permissive for DELETE to public
  using ((is_admin() OR owns_car(car_id)));
create policy event_participants_insert_policy on public.event_participants as permissive for INSERT to public
  with check ((is_admin() OR owns_car(car_id)));
create policy event_participants_select_policy on public.event_participants as permissive for SELECT to public
  using (true);
create policy event_photos_delete_policy on public.event_photos as permissive for DELETE to public
  using (is_admin());
create policy event_photos_insert_policy on public.event_photos as permissive for INSERT to public
  with check ((auth.uid() IS NOT NULL));
create policy event_photos_select_policy on public.event_photos as permissive for SELECT to public
  using (true);
create policy event_report_header_insert_policy on public.event_report_header as permissive for INSERT to public
  with check (is_admin());
create policy event_report_header_select_policy on public.event_report_header as permissive for SELECT to public
  using (true);
create policy event_report_header_update_policy on public.event_report_header as permissive for UPDATE to public
  using (is_admin())
  with check (is_admin());
create policy event_report_overrides_delete_policy on public.event_report_overrides as permissive for DELETE to public
  using (is_admin());
create policy event_report_overrides_insert_policy on public.event_report_overrides as permissive for INSERT to public
  with check (is_admin());
create policy event_report_overrides_select_policy on public.event_report_overrides as permissive for SELECT to public
  using (true);
create policy event_report_photos_delete_policy on public.event_report_photos as permissive for DELETE to public
  using (is_admin());
create policy event_report_photos_insert_policy on public.event_report_photos as permissive for INSERT to public
  with check (is_admin());
create policy event_report_photos_select_policy on public.event_report_photos as permissive for SELECT to public
  using (true);
create policy events_delete_policy on public.events as permissive for DELETE to public
  using ((is_admin() OR owns_car(owner_id)));
create policy events_insert_policy on public.events as permissive for INSERT to public
  with check ((is_admin() OR owns_car(owner_id)));
create policy events_select_policy on public.events as permissive for SELECT to public
  using (true);
create policy events_update_policy on public.events as permissive for UPDATE to public
  using ((is_admin() OR owns_car(owner_id)))
  with check ((is_admin() OR owns_car(owner_id)));
create policy "public read excluded_videos" on public.excluded_videos as permissive for SELECT to public
  using (true);
create policy favorite_spots_delete_policy on public.favorite_spots as permissive for DELETE to public
  using ((( SELECT auth.uid() AS uid) = owner_user_id));
create policy favorite_spots_insert_policy on public.favorite_spots as permissive for INSERT to public
  with check ((( SELECT auth.uid() AS uid) IS NOT NULL));
create policy favorite_spots_select_policy on public.favorite_spots as permissive for SELECT to public
  using (true);
create policy favorite_spots_update_policy on public.favorite_spots as permissive for UPDATE to public
  using ((( SELECT auth.uid() AS uid) = owner_user_id))
  with check ((( SELECT auth.uid() AS uid) = owner_user_id));
create policy garage_notes_delete on public.garage_notes as permissive for DELETE to public
  using (((auth.uid() = user_id) OR ((( SELECT users.email
   FROM auth.users
  WHERE (users.id = auth.uid())))::text = 'registro500giappone@gmail.com'::text)));
create policy garage_notes_insert on public.garage_notes as permissive for INSERT to public
  with check (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)));
create policy garage_notes_select on public.garage_notes as permissive for SELECT to public
  using (true);
create policy news_insert_policy on public.news as permissive for INSERT to public
  with check (is_admin());
create policy news_select_policy on public.news as permissive for SELECT to public
  using (true);
create policy owner_tool_users_delete on public.owner_tool_users as permissive for DELETE to authenticated
  using ((is_admin() OR owns_car(car_id)));
create policy owner_tool_users_insert on public.owner_tool_users as permissive for INSERT to authenticated
  with check ((is_admin() OR owns_car(car_id)));
create policy owner_tool_users_read on public.owner_tool_users as permissive for SELECT to public
  using (true);
create policy owner_tools_delete on public.owner_tools as permissive for DELETE to authenticated
  using ((is_admin() OR owns_car(car_id)));
create policy owner_tools_insert on public.owner_tools as permissive for INSERT to authenticated
  with check ((is_admin() OR owns_car(car_id)));
create policy owner_tools_public_read on public.owner_tools as permissive for SELECT to public
  using (((is_hidden = false) OR is_admin() OR owns_car(car_id)));
create policy owner_tools_update on public.owner_tools as permissive for UPDATE to authenticated
  using ((is_admin() OR owns_car(car_id)))
  with check ((is_admin() OR owns_car(car_id)));
create policy "public read part_tags" on public.part_tags as permissive for SELECT to public
  using (true);
create policy parts_select_policy on public.parts as permissive for SELECT to public
  using (true);
create policy "delete own recommendation" on public.recommendations as permissive for DELETE to public
  using ((auth.uid() = user_id));
create policy "insert own recommendation" on public.recommendations as permissive for INSERT to public
  with check ((auth.uid() = user_id));
create policy "public read recommendations" on public.recommendations as permissive for SELECT to public
  using (true);
create policy "update own recommendation" on public.recommendations as permissive for UPDATE to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy spot_schedules_delete_policy on public.spot_schedules as permissive for DELETE to public
  using ((( SELECT auth.uid() AS uid) = owner_user_id));
create policy spot_schedules_insert_policy on public.spot_schedules as permissive for INSERT to public
  with check ((( SELECT auth.uid() AS uid) IS NOT NULL));
create policy spot_schedules_select_policy on public.spot_schedules as permissive for SELECT to public
  using (true);
create policy spot_schedules_update_policy on public.spot_schedules as permissive for UPDATE to public
  using ((( SELECT auth.uid() AS uid) = owner_user_id))
  with check ((( SELECT auth.uid() AS uid) = owner_user_id));
create policy spots_delete_policy on public.spots as permissive for DELETE to public
  using (((auth.uid() = owner_user_id) OR is_admin()));
create policy spots_insert_policy on public.spots as permissive for INSERT to public
  with check ((( SELECT auth.uid() AS uid) IS NOT NULL));
create policy spots_select_policy on public.spots as permissive for SELECT to public
  using (true);
create policy spots_update_policy on public.spots as permissive for UPDATE to public
  using (((auth.uid() = owner_user_id) OR is_admin()))
  with check (((auth.uid() = owner_user_id) OR is_admin()));
create policy user_relations_delete_policy on public.user_relations as permissive for DELETE to public
  using ((user_id = (auth.jwt() ->> 'email'::text)));
create policy user_relations_insert_policy on public.user_relations as permissive for INSERT to public
  with check ((auth.uid() IS NOT NULL));
create policy user_relations_select_policy on public.user_relations as permissive for SELECT to public
  using (true);
create policy "Allow select for all" on public.user_selections as permissive for SELECT to public
  using (true);
create policy user_selections_auth_only on public.user_selections as permissive for ALL to public
  using ((auth.uid() IS NOT NULL))
  with check ((auth.uid() IS NOT NULL));
create policy "public read vehicles" on public.vehicles as permissive for SELECT to public
  using (true);
create policy "public read video_part_tags" on public.video_part_tags as permissive for SELECT to public
  using (true);
create policy "public read video_vehicles" on public.video_vehicles as permissive for SELECT to public
  using (true);
create policy "public read videos" on public.videos as permissive for SELECT to public
  using (true);
create policy "public read view_history" on public.view_history as permissive for SELECT to public
  using (true);
