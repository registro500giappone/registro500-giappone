-- マイ整備手帳 — 動画ごとの説明（2026-10-31）
-- video_captions[i] が video_urls[i] の説明（空文字＝説明なし）。写真の caption と同じく1本〜500字。
-- 2つの配列は入力画面が必ずそろえて書く。説明だけが余ることは許さない。

alter table public.maint_records add column if not exists video_captions text[] not null default '{}';

create or replace function public.maint_video_captions_ok(c text[])
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select coalesce(bool_and(x is not null and char_length(x) <= 500), true)
  from unnest(c) as x
$$;
alter table public.maint_records drop constraint if exists maint_records_video_captions_check;
alter table public.maint_records add constraint maint_records_video_captions_check
  check (public.maint_video_captions_ok(video_captions)
         and cardinality(video_captions) <= cardinality(video_urls));
