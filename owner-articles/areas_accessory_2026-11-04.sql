-- 2026-11-04 オーナーの記事：箇所に「アクセサリー」を足す（maint_records の areas と同じ9つにそろえる）
-- みんなの整備手帳で「箇所：アクセサリー」を選んだとき、記事の行も出せるようにするため

alter table public.owner_articles drop constraint if exists owner_articles_areas_check;
alter table public.owner_articles add constraint owner_articles_areas_check
  check (areas <@ array['engine','fuel','driveline','suspension','brake','body','electric','consumable','accessory']::text[]);
