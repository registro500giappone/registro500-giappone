-- 動画検索を題名だけでなく解説・手順カードの本文まで広げるための列（2026-11-07）
-- 例：「ドアロック」「ドアラッチ」は題名に無く手順カードにだけある語だった。
-- generated column なので書き込み側（取得・要約バッチ）は変更不要。
alter table public.videos
  add column if not exists search_text text
  generated always as (
    coalesce(title_ja,'') || ' ' || coalesce(title_original,'') || ' ' ||
    coalesce(description_ja,'') || ' ' || coalesce(steps_ja::text,'')
  ) stored;
