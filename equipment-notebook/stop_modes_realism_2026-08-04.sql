-- ============================================================
-- 装備手帳: 止まり方マスターの現実性調整（車載マスターを到達可能にする）
-- migration名: equipment_notebook_stop_modes_realism_2026_08_04
-- 状態: ★未適用★（2026-08-04 起案・適用はローカルPCから）
--
-- 背景:
--   結果画面を3層構造に再設計し、頂点に唯一の称号「車載マスター」
--   （全止まり方カバー かつ 安全装備4/4）を置いた。しかし本番データで検算したところ、
--   パイロット6人の理論上限が19/22で、誰一人マスターに到達できない状態だった
--   ＝称号が机上の空論になる。原因は「現実には車載しない部品」をneedに含めていたこと。
--
-- ユーザー判断（2026-08-04）:
--   ・ローター（id20）を除外 … 同時点火化した車両には存在しない。
--       元々F5のneedに入っていたのは「デスビキャップとセットで」という理由のみ（項目のreason）。
--   ・シフトリンケージのカップリング（id72）を除外 … 現実には車載しない
--   ・ミッションサポートラバー（id73）を除外 … 現実には車載しない
--   ・イグニッションコイル（id68）は維持 … 予備を積む妥当性あり（F4のneed。本migrationでは触らない）
--   ・ジャッキスタンド（id57）は維持 … ドラシャジョイント交換は床下に潜る必要があり、
--       安全上むしろ推奨したい（D3のneed。本migrationでは触らない）
--   ・デスビキャップ（id19）は維持 … 割れ・トラッキングという固有の故障モードがあり、
--       デスビのナットが外れた実例報告もある（F5のnote）。ローターと違い「セットで」以外の根拠を持つ
--
-- 効果（本番データで検算済み）:
--   分母 22 → 20 ／ 理論到達件数 19 → 20（＝マスター成立可能になる）
--   救援案件 7件 → 9件（D2・D4が加わる）
--   マスター必要装備 28項目（66項目中。洗車用品・パンク修理剤等は不要）
--   最難関: イグニッションコイル(1/6)・デスビキャップ(1/6)・ドラシャジョイント(1/6)・ジャッキスタンド(1/6)
-- ============================================================


-- ------------------------------------------------------------
-- A. 現実には車載しない部品を need から外す（3行）
--    ※項目マスター側は削除しない。積んでいる人は入力でき、集計にも残る。
--      あくまで「マスターの必須条件から外す」だけ。
-- ------------------------------------------------------------

-- F5（クランキングするが火花が飛ばない）から ローター を外す。
-- デスビキャップ(id19)・マイナスドライバー(id5)・スパナ(id4) は残るため、F5は引き続き到達可能。
delete from public.equipment_stop_mode_items
  where stop_mode_code = 'F5' and item_id = 20 and role = 'need';

-- D2（ギアが入らない・シフトがグニャグニャ）の唯一のneed
delete from public.equipment_stop_mode_items
  where stop_mode_code = 'D2' and item_id = 72 and role = 'need';

-- D4（ギアチェンジのたびにダダダという振動）の唯一のneed
delete from public.equipment_stop_mode_items
  where stop_mode_code = 'D4' and item_id = 73 and role = 'need';


-- ------------------------------------------------------------
-- B. D2・D4 を救援案件（levels=['R']）に変更する
--
--    ⚠️ Aだけを適用してBを飛ばすと、D2・D4のneedが0件になり、
--       フロントの computeStopModeCoverage() が「需要なし＝工具なしで対処できる」
--       （hands扱い）と解釈して全員カバー扱いになる。実態と食い違うため必ずセットで適用する。
--       部品を車載しない以上、路上では直せない＝救援案件が正直な分類。
--       救援案件は分母から除外され別枠表示されるため、分母は22→20になる。
-- ------------------------------------------------------------

update public.equipment_stop_modes
  set levels = array['R']::text[]
  where code in ('D2', 'D4');


-- ============================================================
-- 検算
--   A. need行の削除: 3行（F5×id20 / D2×id72 / D4×id73）→ 52行 → 49行
--   B. levels変更: 2件（D2, D4）→ 救援案件 7件 → 9件・分母 22 → 20
--
-- 適用後の確認:
--   -- need行が3行減っているか
--   select count(*) from public.equipment_stop_mode_items where role = 'need';   -- 期待: 49
--   -- 救援案件が9件になっているか
--   select count(*) from public.equipment_stop_modes
--    where is_active and levels = array['R']::text[];                            -- 期待: 9
--   -- D2/D4のneedが消えているか
--   select stop_mode_code, count(*) from public.equipment_stop_mode_items
--    where stop_mode_code in ('D2','D4','F5') and role='need' group by 1;        -- 期待: F5のみ3行
--
-- ロールバック:
--   insert into public.equipment_stop_mode_items (stop_mode_code, item_id, role)
--     values ('F5',20,'need'), ('D2',72,'need'), ('D4',73,'need');
--   update public.equipment_stop_modes set levels = array['L2','L3']::text[] where code = 'D2';
--   update public.equipment_stop_modes set levels = array['L3','R']::text[]  where code = 'D4';
--   ※ロールバック前に元のlevels値を必ず控えること:
--     select code, levels from public.equipment_stop_modes where code in ('D2','D4');
-- ============================================================
