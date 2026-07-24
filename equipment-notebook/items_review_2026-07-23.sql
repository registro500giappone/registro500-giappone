-- migration: equipment_notebook_items_review_2026_07_23（適用済みの控え）
-- 画面レビュー（2026-07-23・ユーザー実機確認）の反映。
-- 原則: id は不変・行削除もしない。既存回答（equipment_entries.item_id）を壊さないため、
--       取り下げは is_active=false で行う（集計関数・入力UIともに is_active でフィルタ済み）。

-- 1) ライトの種類を固定しない
--    「頭部装着型」と書くと形状を1つに決めてしまう。積んでいる物のバリエーション自体に
--    価値があるため、機能（暗所で手元を照らす）で括り直す。
update public.equipment_items
set name = '作業用ライト（懐中電灯・ヘッドランプなど）',
    reason = '夜間や暗所では手元が見えないと何も始まらない。両手が空くタイプならなお良い'
where id = 11;

-- 2) 「積んでいて当然」の3項目を非表示化
--    recommend_priority と同じ判断軸＝指摘の新規性が無いものは載せない
--    （既に車検証・自賠責を推奨から外した判断の延長）。
--    id 52 車検証・自賠責 / 53 ETC・小銭 / 54 スマホホルダー・充電ケーブル
update public.equipment_items
set is_active = false
where id in (52, 53, 54);

-- 結果: 有効項目 54 → 51 件（工具13 / パーツ15 / ケミカル9 / 非常時対応12 / 洗車・その他2）

-- 3) プラグレンチのサイズ表記修正（migration: equipment_notebook_plug_wrench_size_fix）
--    パイロットテスターの指摘: 「14mm」はスパークプラグのネジ径であり、レンチの対辺（六角二面幅）と誤解を招く。
--    正しい対辺サイズ（20.8mm、または21mm表記の製品もある）に訂正。
update public.equipment_items
set name = 'プラグレンチ（20.8mm・六角二面幅／21mm表記のもの）'
where id = 1;
