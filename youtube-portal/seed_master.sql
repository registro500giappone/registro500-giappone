-- ============================================================================
-- registro500 YouTube ポータル — 初期マスタデータ（タスク2）
-- 2026-06-29 本番投入済（service_role 接続で execute）。
-- HANDOFF.md §3 が正本。ID直書きを避け slug 参照で挿入する。
-- 冪等ではない（再投入時は事前にtruncate、またはバックフィルはNOT EXISTS化すること）。
-- ============================================================================

-- ===== vehicles（粗い粒度・通称表示・edit.html区分をエイリアスに反映） =====
insert into vehicles (slug, name_official, name_display, search_aliases, sort_order) values
('fiat-500','Nuova500','FIAT 500',
  array['Fiat 500','fiat500','Cinquecento','500 d''epoca','Nuova 500','500 F','500 L','500 R','500 D','N Normale','Prima Serie'],1),
('fiat-126','Fiat 126','FIAT 126',
  array['Fiat 126','126p','Polski Fiat 126p','126p FL','Maluch','Zastava 126','Steyr-Puch 126','FSM','FSM Niki','126 BIS','126 EL','126 ELX','Fiat 126 Personal','Fiat 126 Bambino'],2);

insert into vehicles (slug, name_official, name_display, search_aliases, base_vehicle_id, sort_order) values
('giardiniera','500 Giardiniera','Giardiniera',
  array['Giardiniera','500 Giardiniera','Familiare','Belvedere'], (select id from vehicles where slug='fiat-500'),3),
('abarth','Abarth (595/695)','アバルト',
  array['Abarth 595','Abarth 695','595 SS','695 SS','595SS','695SS'], (select id from vehicles where slug='fiat-500'),4),
('giannini','Giannini','ジャンニーニ',
  array['Giannini','Giannini 590','Giannini 126 GP'], (select id from vehicles where slug='fiat-500'),5);

-- ===== part_tags（整備/チューニング共通語彙・フェーズ1+2を最初に全投入） =====
insert into part_tags (slug, name_ja, name_it) values
('ignition-timing','点火時期調整','messa in fase'),
('contact-points','ポイント点検','puntine platinate'),
('valve-clearance','タペット調整','registrazione punterie'),
('carb-tuning','キャブ調整','regolazione carburatore'),
('carb-rebuild','キャブOH','revisione carburatore'),
('spark-plugs','プラグ','candele'),
('wiring-dynamo-belt','配線・ダイナモ・ファンベルト','impianto elettrico / dinamo'),
('oil-seals','オイル・シール',null),
('head-topend','ヘッド・腰上',null),
('clutch','クラッチ','frizione'),
('transmission','ミッション','cambio'),
('brakes','ブレーキ','freni'),
('suspension','サスペンション','sospensioni');

-- ===== categories 親6 =====
insert into categories (slug, name_ja, name_it, sort_order) values
('manutenzione','整備・修理','Manutenzione',1),
('restauro','レストア・板金','Restauro',2),
('elaborazione','チューニング・改造','Elaborazione',3),
('on-the-road','走行・ツーリング','On the Road',4),
('storia','歴史・カルチャー','Storia',5),
('eventi-acquisto','イベント・購入','Eventi / Acquisto',6);

-- ===== categories 中区分（親をslugで参照・フェーズ2分も全投入） =====
insert into categories (parent_id, slug, name_ja, sort_order)
select p.id, x.slug, x.name_ja, x.sort_order
from (values
  ('engine','エンジン',1),
  ('fuel-intake','燃料・吸気',2),
  ('ignition-electrical','点火・電装',3),
  ('drivetrain','駆動・クラッチ・ミッション',4),
  ('suspension-brakes','足回り・ブレーキ',5),
  ('body-interior-misc','ボディ・内装・電気小物',6),
  ('general-maintenance','一般メンテ・油脂',7)
) as x(slug,name_ja,sort_order)
cross join categories p where p.slug='manutenzione';

insert into categories (parent_id, slug, name_ja, sort_order)
select p.id, x.slug, x.name_ja, x.sort_order
from (values
  ('full-restoration','フルレストア記録',1),
  ('rust-treatment','錆処理・防錆',2),
  ('panel-bodywork','板金・パネル交換',3),
  ('painting','塗装',4),
  ('interior-softtop-seats','内装・幌・シート',5)
) as x(slug,name_ja,sort_order)
cross join categories p where p.slug='restauro';

insert into categories (parent_id, slug, name_ja, sort_order)
select p.id, x.slug, x.name_ja, x.sort_order
from (values
  ('engine-tuning','エンジン強化・腰上',1),
  ('head-bigcarb','ヘッド・ビッグキャブ',2),
  ('engine-swap-126','126エンジン換装',3),
  ('exhaust','排気・マフラー',4),
  ('electronic-ignition','電子化（点火・電装）',5)
) as x(slug,name_ja,sort_order)
cross join categories p where p.slug='elaborazione';

insert into categories (parent_id, slug, name_ja, sort_order)
select p.id, x.slug, x.name_ja, x.sort_order
from (values
  ('roadtrip','ロードトリップ・紀行',1),
  ('rally-events','ラリー・走行イベント',2),
  ('city-test-drive','街乗り・試乗インプレ',3),
  ('sound-onboard','サウンド・車載',4)
) as x(slug,name_ja,sort_order)
cross join categories p where p.slug='on-the-road';

insert into categories (parent_id, slug, name_ja, sort_order)
select p.id, x.slug, x.name_ja, x.sort_order
from (values
  ('model-history','モデル史・系譜',1),
  ('design-documentary','デザイン・ドキュメンタリー',2),
  ('famous-cars','名車・著名個体',3),
  ('advertising-culture','広告・カルチャー',4),
  ('tuner-history','チューナー・派生史（アバルト/ジャンニーニ）',5)
) as x(slug,name_ja,sort_order)
cross join categories p where p.slug='storia';

insert into categories (parent_id, slug, name_ja, sort_order)
select p.id, x.slug, x.name_ja, x.sort_order
from (values
  ('meetings','ミーティング・旧車祭',1),
  ('auctions-market','オークション・相場',2),
  ('buying-guide','購入前チェック・査定',3)
) as x(slug,name_ja,sort_order)
cross join categories p where p.slug='eventi-acquisto';
