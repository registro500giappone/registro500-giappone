-- ============================================================
-- migration名: equipment_notebook_feedback_2026_08_03
-- 2026-08-03起案・未適用（ローカルのSupabase MCPセッションで適用する）
-- ユーザー実機レビュー10件の反映。
--   A. 項目マスターの表記修正2件（id4名称・id9note_prompt）
--   B. 工具カテゴリ23項目のsort_order種類別再割当
--   C. equipment_stop_modesにcause列追加＋29件に想定原因を投入
--   D. need_noteの説明文具体化3件
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
-- C. equipment_stop_modes に cause 列（想定原因の短文）を追加
--    目安15〜30字・体言止め・専門用語は原文（stop_modes_schema.sql note/sym）準拠。
--    noteが薄いコードはsymの括弧内などから素直に起案。推測の付け足しはしない。
-- ============================================================
alter table public.equipment_stop_modes add column if not exists cause text;

update public.equipment_stop_modes set cause = 'コンデンサー不良など点火系の突然死' where code = 'F1';
update public.equipment_stop_modes set cause = 'デスビ調整不良・二次エア・接触不良' where code = 'F2';
update public.equipment_stop_modes set cause = 'プラグコードのすっぽ抜け・接触不良' where code = 'F3';
update public.equipment_stop_modes set cause = 'イグニッションコイルの熱による不良' where code = 'F4';
update public.equipment_stop_modes set cause = 'デスビ固定ナットの脱落・キャップ破損' where code = 'F5';

update public.equipment_stop_modes set cause = '燃料計の狂いで残量に気づけないガス欠' where code = 'M1';
update public.equipment_stop_modes set cause = 'キャブレター燃料吸入口の脱落・破損' where code = 'M2';
update public.equipment_stop_modes set cause = 'パーコレーションによる燃料の気化' where code = 'M3';
update public.equipment_stop_modes set cause = 'ジェット詰まり・二次エア・点火時期狂い' where code = 'M4';
update public.equipment_stop_modes set cause = 'アクセルワイヤー切れ／キャブリンケージの外れ' where code = 'M5';
update public.equipment_stop_modes set cause = '燃料ポンプの機械的な故障・寿命' where code = 'M6';

update public.equipment_stop_modes set cause = 'バルブクラッシュなどエンジン内部破損' where code = 'C1';
update public.equipment_stop_modes set cause = 'オイル漏れ・増し締めで戻る系から油圧系故障まで' where code = 'C2';

update public.equipment_stop_modes set cause = 'ベルト滑り・配線不良・レギュレーター不良' where code = 'E1';
update public.equipment_stop_modes set cause = '端子緩み・アース不良・バッテリー劣化' where code = 'E2';
update public.equipment_stop_modes set cause = 'バルブのソケット脱落・端子外れ・断線' where code = 'E3';
update public.equipment_stop_modes set cause = 'バッテリー充電不良・発電機系の故障' where code = 'E4';
update public.equipment_stop_modes set cause = 'スターターワイヤーのフック外れ・断線' where code = 'E5';

update public.equipment_stop_modes set cause = '固定ピン破断・ワイヤー切れ・ボルト折損' where code = 'D1';
update public.equipment_stop_modes set cause = 'シフトリンケージのゴムカップリング劣化' where code = 'D2';
update public.equipment_stop_modes set cause = 'ドライブシャフトジョイントの摩耗・破損' where code = 'D3';
update public.equipment_stop_modes set cause = 'ミッションサポートラバーの劣化' where code = 'D4';

update public.equipment_stop_modes set cause = 'タイヤの経年劣化・異物混入によるパンク' where code = 'X1';
update public.equipment_stop_modes set cause = 'ホイールボルトの緩み・折損、キングピン摩耗' where code = 'X2';
update public.equipment_stop_modes set cause = 'センターボルトのネジ山舐め・脱落' where code = 'X3';

update public.equipment_stop_modes set cause = 'ホイールシリンダー／マスターシリンダーの破損（ホース起因も）' where code = 'B1';

update public.equipment_stop_modes set cause = 'クーリングファンの破損' where code = 'K1';
update public.equipment_stop_modes set cause = 'ファンカバーダクトの脱落・外れ' where code = 'K2';
update public.equipment_stop_modes set cause = 'サーモスタットの故障によるフラップ固着' where code = 'K3';

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
update public.equipment_stop_modes
  set need_note = 'エンジンルームのスターター本体のレバーを直接押す（火傷に注意）'
  where code = 'E5';

-- ============================================================
-- 検算コメント
--   A. equipment_items 表記修正: 2件（id4 name／id9 note_prompt）
--   B. equipment_items sort_order再割当: 23件
--      （①回す・締める7＝id4,55,56,1,5,6,61／②点火の調整2＝id2,60／
--       ③電気まわり2＝id3,58／④持ち上げる・支える4＝id9,57,10,12／
--       ⑤応急材料3＝id7,8,59／⑥作業補助5＝id11,13,62,63,64／合計7+2+2+4+3+5=23）
--   C. equipment_stop_modes cause列: 29件
--      （F1〜F5=5, M1〜M6=6, C1〜C2=2, E1〜E5=5, D1〜D4=4, X1〜X3=3, B1=1, K1〜K3=3 ／合計29）
--   D. equipment_stop_modes need_note 具体化: 3件（F3, M3, E5）
-- ============================================================
