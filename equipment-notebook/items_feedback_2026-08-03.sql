-- ============================================================
-- migration名: equipment_notebook_feedback_2026_08_03
-- 状態: ✅適用済み（2026-08-03 起案 ／ 2026-08-06 本番データで適用を実地確認）
-- 根拠: 工具カテゴリの sort_order が10刻みに再割当されている（id4=10 / id55=20 / id56=30 …）
-- ユーザー実機レビュー10件の反映。
--   A. 項目マスターの表記修正2件（id4名称・id9note_prompt）
--   B. 工具カテゴリ23項目のsort_order種類別再割当
--   D. need_noteの説明文具体化3件
-- ※ 旧C（equipment_stop_modesへの想定原因列追加）は不採用。症状ベース判定の廃止に伴い、
--   「想定原因」表示のC部分は方針変更で削除した（2026-08-03）。
-- 参考: equipment-notebook/stop_modes_schema.sql（テーブル定義・29件note原文）
--       equipment-notebook/seed_items.sql（書式）
-- ============================================================

-- ============================================================
-- A. 項目マスターの表記修正2件
-- ============================================================

-- id4: スパナ・メガネ … 8mmを追加（500の主要ボルトに8mmが必要というオーナー指摘）
update public.equipment_items
  set name = 'スパナ・メガネ（主要サイズ 8/10/11/13/17mm）'
  where id = 4; -- tool_spanner_set

-- id9: 車載ジャッキ … note_promptの「油圧フロア」は実態に合わないため「油圧パンタ」に修正
--       （マサダは油圧パンタ、という指摘。純正パンタ／パンタ社外との横並びも維持）
update public.equipment_items
  set note_prompt = 'どんなジャッキ？（純正パンタ／油圧パンタ／パンタ社外 など）'
  where id = 9; -- tool_jack

-- ============================================================
-- B. 工具カテゴリ23項目のsort_order再割当（ユーザー承認済みの並び・10刻み）
--    対象はすべてcategory='工具'の項目。既存の並び順を種類別グループに組み替える。
-- ============================================================

-- ①回す・締める
update public.equipment_items set sort_order = 10 where id = 4;  -- スパナ・メガネ
update public.equipment_items set sort_order = 20 where id = 55; -- ラチェット＋ソケットセット
update public.equipment_items set sort_order = 30 where id = 56; -- トルクレンチ
update public.equipment_items set sort_order = 40 where id = 1;  -- プラグレンチ
update public.equipment_items set sort_order = 50 where id = 5;  -- マイナスドライバー
update public.equipment_items set sort_order = 60 where id = 6;  -- ラジオペンチ・ニッパー
update public.equipment_items set sort_order = 70 where id = 61; -- ウォーターポンププライヤー・プライヤーレンチ

-- ②点火の調整
update public.equipment_items set sort_order = 80 where id = 2;  -- シックネスゲージ
update public.equipment_items set sort_order = 90 where id = 60; -- ポイントヤスリ

-- ③電気まわり
update public.equipment_items set sort_order = 100 where id = 3;  -- 検電テスター
update public.equipment_items set sort_order = 110 where id = 58; -- 電工ペンチ＋圧着端子・配線

-- ④持ち上げる・支える
update public.equipment_items set sort_order = 120 where id = 9;  -- 車載ジャッキ
update public.equipment_items set sort_order = 130 where id = 57; -- ジャッキスタンド（リジッドラック）
update public.equipment_items set sort_order = 140 where id = 10; -- 輪止め
update public.equipment_items set sort_order = 150 where id = 12; -- 整備マット

-- ⑤応急材料
update public.equipment_items set sort_order = 160 where id = 7;  -- 針金・タイラップ
update public.equipment_items set sort_order = 170 where id = 8;  -- 自己融着テープ
update public.equipment_items set sort_order = 180 where id = 59; -- 強力ガムテープ・ダクトテープ

-- ⑥作業補助
update public.equipment_items set sort_order = 190 where id = 11; -- 作業用ライト（懐中電灯・ヘッドランプなど）
update public.equipment_items set sort_order = 200 where id = 13; -- 軍手・ウエス
update public.equipment_items set sort_order = 210 where id = 62; -- ピックアップツール（マグネット）
update public.equipment_items set sort_order = 220 where id = 63; -- ハンマー
update public.equipment_items set sort_order = 230 where id = 64; -- カッター

-- ============================================================
-- D. need_note の説明文を具体化3件（「手で対処できる、とは？」への対応）
--    画面にそのまま出る文のため、原文の意図を保ちつつ具体的な動作を明記する。
-- ============================================================

-- F3: プラグコードのすっぽ抜け（旧: '（手だけで直せる）'）
update public.equipment_stop_modes
  set need_note = '外れたプラグコードを差し直す（火傷に注意）'
  where code = 'F3';

-- M3: パーコレーション（旧: '（手だけで対処）'）
update public.equipment_stop_modes
  set need_note = '冷えるのを待つ。布と水で燃料ポンプを冷やす手も'
  where code = 'M3';

-- E5: スターターワイヤー断線・外れ（旧: '（手で対処＝エンジンルームのスターター本体のレバーを直接押す）'）
--     【2026-08-03 ユーザーレビュー反映】素手で押させないため「絶縁の棒等で」を明記。
--     レバーは通電部かつ高温部のため、道具の指定まで書かないと危険な操作になる。
update public.equipment_stop_modes
  set need_note = 'エンジンルームのスターター本体のレバーを絶縁の棒等で直接押す（火傷に注意）'
  where code = 'E5';

-- ============================================================
-- 検算コメント
--   A. equipment_items 表記修正: 2件（id4 name／id9 note_prompt）
--   B. equipment_items sort_order再割当: 23件
--      （①回す・締める7＝id4,55,56,1,5,6,61／②点火の調整2＝id2,60／
--       ③電気まわり2＝id3,58／④持ち上げる・支える4＝id9,57,10,12／
--       ⑤応急材料3＝id7,8,59／⑥作業補助5＝id11,13,62,63,64／合計7+2+2+4+3+5=23）
--   D. equipment_stop_modes need_note 具体化: 3件（F3, M3, E5）
-- ============================================================
