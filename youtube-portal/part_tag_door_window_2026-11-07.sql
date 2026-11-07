-- 箇所タグ「ドア・窓」新設と既存34本への付与（2026-11-07 適用済）
-- 背景：ドアロックの質問に答えられる動画が登録済みなのに、検索・タグのどこからも辿れなかった。
-- 新着動画には youtube_classify.py が part_tags を DB から読むので自動で付く。
with t as (
  insert into part_tags (slug, name_ja, name_it) values ('door-window','ドア・窓','porte e finestrini')
  on conflict (slug) do update set name_ja=excluded.name_ja returning id
)
insert into video_part_tags (video_id, part_tag_id)
select v.id, t.id from videos v, t
where v.youtube_id in ('S4IDbuWMPGM','K3r5btxkPnc','QqKLonMFK14','7Lw8eOhlW38','a6yZk1UIoFk','9hfLiQmdoY8','2J9aRkVNpRI','04ph7GeunO0','zBcvLo5AGYI','HQmMJO7PQz8','jKX4H9_khtM','GAFSVc4slD0','XoYSggEeaU8','mvIyJtVg6xk','Hlvrl33OcPY','Yep-ShyprXY','U0UvXlSbbdI','o6wAonn_PKU','6Ou7eQyZQT4','8Tn2BFRsTnY','0KvsqBLofdo','nHLMJeoOgpc','o1HvBWJIvGw','XrQsW5hSFrc','EQwS4nty7NI','ADOzMxzWTQg','MgZYXfdxNhQ','M6XmV_Ym7r8','Qb2otLEtsJg','1IrL2_P0z_0','p_8d1VlLNfU','0IKoDpKe2j0','uLNNUnnrGHU','KrcHDevdhzM')
on conflict do nothing;
