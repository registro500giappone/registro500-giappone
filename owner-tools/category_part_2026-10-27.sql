-- おすすめ工具にパーツ・消耗品の分類を足す — 2026-10-27
-- 投稿にパーツ（プラグ・緩み止め）が来て「回す」へ紛れ込んだため。道具の種類1本の軸は崩さない（物の種類なので場所の軸ではない）
alter table public.owner_tools drop constraint owner_tools_category_check;
alter table public.owner_tools add constraint owner_tools_category_check
  check (category in ('turn','grip','measure','lift','special','light','repair','part'));

-- 既存の2件（NGK B7HCS・ペタルファスナー）を付け替え
update public.owner_tools set category = 'part'
where id in ('46312cab-e0f6-43c3-9eda-7c35213abf4d', '45f5ba26-aecb-474e-91d3-85c5ce950983');
