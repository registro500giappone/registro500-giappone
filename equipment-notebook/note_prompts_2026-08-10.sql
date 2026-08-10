-- 装備手帳: メモ欄を出す項目を 10 → 28 に増やす（2026-08-10）
--
-- 【背景】
-- 2026-08-10 に equipment.html を「率の縦一列」から「人数の帯＋押すと中身」へ改修し、
-- 項目を押すと、積んでいる人の手帳とメモが読めるようになった。
-- ところがメモは 426エントリ中25件・14項目ぶんしかない。
--
-- 原因は「オーナーが書かないから」ではない。equipment-edit.html は
-- **note_prompt を持つ項目にしかメモ欄を出さない**（無い項目は入力しても保存されない）。
-- そして note_prompt は 67項目中10項目にしか入っていなかった。
-- つまり「書ける場所が10個しか無かった」だけで、置いた場所には実際に書かれている
-- （「ブリヂストン スニーカー 145/70R12は空気を少し抜かないと本来の場所に入らない」等）。
-- 問い掛けの文が具体的な回答を引き出しているので、同じやり方を広げる。
--
-- 【選定の基準】
-- 「同じ名前でも中身が違い、それを知ると他の人が真似できる」項目だけに付ける。
-- 軍手・ウエス・保険証券のように選び方で差が出ないものには付けない。
-- 全項目に付けないのは、メモ欄が多すぎると照合に疲れて離脱するという既存の設計判断
-- （equipment-edit.html のコメント参照）を尊重するため。今回は第1弾として18項目を追加する。
--
-- 【安全性】既存データには触れない。表示されるプレースホルダが増えるだけ。
-- 元に戻すときは対象コードの note_prompt を NULL に戻せばよい。

update equipment_items set note_prompt = case code
  -- パーツ：銘柄・型・サイズで中身が変わるもの
  when 'part_spark_plug'   then '銘柄・熱価は？'
  when 'part_points'       then '銘柄・入手先は？'
  when 'part_condenser'    then '銘柄・入手先は？'
  when 'part_fuel_hose'    then '内径・長さは？'
  when 'part_tire_tube'    then 'サイズは？'
  when 'part_distributor'  then 'どの型？（純正／電子化 など）'
  when 'part_carburetor'   then '型式は？'
  -- ケミカル：銘柄と用途が知りたいもの
  when 'chem_engine_oil'   then '銘柄・粘度は？'
  when 'chem_grease'       then 'どのグリスを、何に使いますか？'
  -- 工具：同じ名前でも仕様が大きく違うもの
  when 'tool_spanner_set'  then '銘柄・サイズ構成は？'
  when 'tool_torque_wrench' then '銘柄・測定範囲は？'
  when 'tool_feeler_gauge' then 'どんなもの？（単体／ポイント調整用の薄いもの など）'
  when 'tool_timing_light' then '銘柄・タイプは？（電池式／バッテリー接続 など）'
  when 'tool_wire_crimp'   then '端子・配線はどんなものを？（サイズ・種類）'
  when 'tool_point_file'   then 'どんなもの？（専用ヤスリ／代用品 など）'
  -- 非常時対応：どれを選んだかが実用情報になるもの
  when 'emg_wiring_manual' then 'どの本・どのデータですか？'
  when 'emg_air_pump'      then '電動／手動・銘柄は？'
  when 'emg_booster_cable' then '長さ・容量は？'
  else note_prompt
end
where code in (
  'part_spark_plug','part_points','part_condenser','part_fuel_hose','part_tire_tube',
  'part_distributor','part_carburetor','chem_engine_oil','chem_grease',
  'tool_spanner_set','tool_torque_wrench','tool_feeler_gauge','tool_timing_light',
  'tool_wire_crimp','tool_point_file','emg_wiring_manual','emg_air_pump','emg_booster_cable'
);

-- 追補（2026-08-10 ユーザー指示）：プライヤー2項目。
-- 同じ「プライヤー」でも指すものが人によって違い、銘柄でも使い勝手が大きく変わるため。
update equipment_items set note_prompt = case code
  when 'tool_pliers'            then '銘柄・種類は？（ラジオペンチ／ニッパー／両方 など）'
  when 'tool_water_pump_pliers' then '銘柄・サイズは？（プライヤーレンチ／ウォーターポンププライヤー など）'
  else note_prompt
end
where code in ('tool_pliers','tool_water_pump_pliers');
