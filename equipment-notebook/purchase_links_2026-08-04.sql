-- ============================================================
-- 装備手帳: 購入先リンク（Amazon・第1弾）投入 migration 起案
-- migration名: equipment_notebook_purchase_links_2026_08_04
-- 状態: ✅適用済み（2026-08-04 起案 ／ 2026-08-06 本番データで適用を実地確認）
-- 根拠: purchase_links を持つ項目が60/74件ある
--
-- ⚠️ 重要: 描画コード（equipment-edit.html の結果画面リコメンド）は既に本番稼働中。
--   このmigrationを適用した瞬間、本番の結果画面に「🛒 Amazonで見る（PR）」と
--   アフィリエイト開示文が表示され始める（デプロイ不要）。データ投入が最後の
--   スイッチになるため、適用前に検索クエリの妥当性を必ずレビューすること。
--
-- 背景:
--   equipment_items.purchase_links（jsonb）は全66項目でnullの状態。
--   今回は Amazon のみ（第1弾）。パーツカテゴリ（車種専用のため
--   Amazon検索の精度が出ない）は対象外とし、専門店リンクとあわせて
--   第2弾で改めて検討する。
--
-- 対象の線引き:
--   ・工具カテゴリ      → 全件対象
--   ・ケミカルカテゴリ  → 全件対象
--   ・非常時対応カテゴリ → 物品のみ対象。
--       「ロードサービス連絡先」「保険証券」「配線図・整備マニュアル」「飲料水」は除外
--   ・洗車・その他カテゴリ → 全件対象（※2026-08-04時点、本番にこのカテゴリの
--       項目は存在しない。存在しないため対象0件・除外0件で影響なし）
--   ・パーツカテゴリ    → 全件除外（第2弾送り）
--
-- リンク形式:
--   [{"type":"amazon","url":"https://www.amazon.co.jp/s?k=<URLエンコード済みクエリ>&tag=registro500-22"}]
--
-- クエリ設計の原則:
--   1. 商品名の転記ではなく「Amazon検索窓に入れたら欲しい物が上位に出る語」を設計
--   2. サイズ・規格が肝の項目はクエリに含める
--   3. 一般名詞すぎる語は整備文脈の修飾語を足して雑貨混入を避ける
--   4. エンジンオイルは空冷クラシックFiatの定番粘度「20W-50 鉱物油」に固定
--   5. 各行末コメントに採用理由を1行で付与
-- ============================================================


-- ------------------------------------------------------------
-- ケミカル（8件・全件対象）
-- ------------------------------------------------------------
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%82%A8%E3%83%B3%E3%82%B8%E3%83%B3%E3%82%AA%E3%82%A4%E3%83%AB+20W-50+%E9%89%B1%E7%89%A9%E6%B2%B9&tag=registro500-22"}]'::jsonb where id = 29; -- エンジンオイル ／ 空冷クラシックFiatの定番粘度（鉱物油20W-50）を指定
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%96%E3%83%AC%E3%83%BC%E3%82%AD%E3%83%95%E3%83%AB%E3%83%BC%E3%83%89+DOT4&tag=registro500-22"}]'::jsonb where id = 30; -- ブレーキフルード ／ クラシック車でも入手性が良いDOT4を指定（DOT3上位互換）
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%91%E3%83%BC%E3%83%84%E3%82%AF%E3%83%AA%E3%83%BC%E3%83%8A%E3%83%BC+%E9%AB%98%E6%B5%B8%E9%80%8F+%E3%82%B9%E3%83%97%E3%83%AC%E3%83%BC&tag=registro500-22"}]'::jsonb where id = 31; -- パーツクリーナー ／ 整備用の浸透式パーツクリーナーに絞る修飾語を付与
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E6%BD%A4%E6%BB%91%E3%82%B9%E3%83%97%E3%83%AC%E3%83%BC+%E9%98%B2%E9%8C%86+%E5%A4%9A%E7%94%A8%E9%80%94&tag=registro500-22"}]'::jsonb where id = 32; -- 潤滑スプレー ／ 特定ブランド名を避け防錆・多用途の整備用スプレーに絞る
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E6%8E%A5%E7%82%B9%E5%BE%A9%E6%B4%BB%E5%89%A4&tag=registro500-22"}]'::jsonb where id = 33; -- 接点復活剤 ／ 項目名がそのまま検索語として機能する定番ワード
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%82%AC%E3%82%BD%E3%83%AA%E3%83%B3%E6%90%BA%E8%A1%8C%E7%BC%B6+%E9%87%91%E5%B1%9E%E8%A3%BD+%E6%B6%88%E9%98%B2%E6%B3%95%E9%81%A9%E5%90%88&tag=registro500-22"}]'::jsonb where id = 36; -- ガソリン携行缶 ／ 安全規格（消防法適合）を明示し金属製の携行缶に絞る
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%91%E3%83%B3%E3%82%AF%E4%BF%AE%E7%90%86%E5%89%A4+%E3%82%B9%E3%83%97%E3%83%AC%E3%83%BC+%E3%82%BF%E3%82%A4%E3%83%A4&tag=registro500-22"}]'::jsonb where id = 37; -- パンク修理剤 ／ 応急用のスプレー式パンク修理剤に絞る
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%82%B0%E3%83%AA%E3%82%B9+4%E7%A8%AE%E3%82%BB%E3%83%83%E3%83%88+%E3%83%AA%E3%83%81%E3%82%A6%E3%83%A0+%E3%83%A2%E3%83%AA%E3%83%96%E3%83%87%E3%83%B3+%E3%82%AB%E3%83%83%E3%83%91%E3%83%BC+%E3%82%B7%E3%83%AA%E3%82%B3%E3%83%B3&tag=registro500-22"}]'::jsonb where id = 70; -- グリス各種 ／ 項目名にある4種類（リチウム/モリブデン/カッパー/シリコン）を明記しセット品を狙う


-- ------------------------------------------------------------
-- 工具（23件・全件対象）
-- ------------------------------------------------------------
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%A1%E3%82%AC%E3%83%8D%E3%83%AC%E3%83%B3%E3%83%81+%E3%82%BB%E3%83%83%E3%83%88+8+10+11+13+17&tag=registro500-22"}]'::jsonb where id = 4; -- スパナ・メガネ ／ 項目名記載のサイズ(8/10/11/13/17mm)を列挙
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%82%BD%E3%82%B1%E3%83%83%E3%83%88%E3%83%AC%E3%83%B3%E3%83%81%E3%82%BB%E3%83%83%E3%83%88+%E3%83%A9%E3%83%81%E3%82%A7%E3%83%83%E3%83%88+8+10+13+17+19mm&tag=registro500-22"}]'::jsonb where id = 55; -- ラチェット＋ソケットセット ／ 項目名記載のサイズ(8/10/13/17/19mm)を列挙
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%88%E3%83%AB%E3%82%AF%E3%83%AC%E3%83%B3%E3%83%81+%E5%B7%AE%E8%BE%BC%E8%A7%929.5mm+3%2F8&tag=registro500-22"}]'::jsonb where id = 56; -- トルクレンチ ／ スパナ一覧がM8〜M17域のため3/8(9.5mm)ドライブを想定（要確認・迷った項目。note_prompt無しで規格不明のため推測）
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%97%E3%83%A9%E3%82%B0%E3%83%AC%E3%83%B3%E3%83%81+21mm+%E8%96%84%E5%8F%A3&tag=registro500-22"}]'::jsonb where id = 1; -- プラグレンチ ／ note_promptの薄肉仕様を反映。20.8mmは流通表記でないため21mm表記を採用
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%9E%E3%82%A4%E3%83%8A%E3%82%B9%E3%83%89%E3%83%A9%E3%82%A4%E3%83%90%E3%83%BC+%E3%82%BB%E3%83%83%E3%83%88+%E5%A4%A7%E5%B0%8F&tag=registro500-22"}]'::jsonb where id = 5; -- マイナスドライバー（大小） ／ 項目名の大小構成をそのまま反映
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%A9%E3%82%B8%E3%82%AA%E3%83%9A%E3%83%B3%E3%83%81+%E3%83%8B%E3%83%83%E3%83%91%E3%83%BC+%E3%82%BB%E3%83%83%E3%83%88&tag=registro500-22"}]'::jsonb where id = 6; -- ラジオペンチ・ニッパー ／ 項目名の2工具セットをそのまま反映
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%82%A6%E3%82%A9%E3%83%BC%E3%82%BF%E3%83%BC%E3%83%9D%E3%83%B3%E3%83%97%E3%83%97%E3%83%A9%E3%82%A4%E3%83%A4%E3%83%BC&tag=registro500-22"}]'::jsonb where id = 61; -- ウォーターポンププライヤー・プライヤーレンチ ／ 整備工具として一意に通じる定番名称
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%82%B7%E3%83%83%E3%82%AF%E3%83%8D%E3%82%B9%E3%82%B2%E3%83%BC%E3%82%B8+%E9%9A%99%E9%96%93%E3%82%B2%E3%83%BC%E3%82%B8&tag=registro500-22"}]'::jsonb where id = 2; -- シックネスゲージ ／ 別名（隙間ゲージ）を併記しヒット率を上げる
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%9D%E3%82%A4%E3%83%B3%E3%83%88%E3%83%A4%E3%82%B9%E3%83%AA+%E6%8E%A5%E7%82%B9%E3%83%A4%E3%82%B9%E3%83%AA&tag=registro500-22"}]'::jsonb where id = 60; -- ポイントヤスリ ／ 別名（接点ヤスリ）を併記しヒット率を上げる
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E6%A4%9C%E9%9B%BB%E3%83%86%E3%82%B9%E3%82%BF%E3%83%BC+%E3%82%B5%E3%83%BC%E3%82%AD%E3%83%83%E3%83%88%E3%83%86%E3%82%B9%E3%82%BF%E3%83%BC+12V&tag=registro500-22"}]'::jsonb where id = 3; -- 検電テスター ／ note_promptの候補（検電ペン/サーキットテスター）のうち12V車用途を明示
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E9%9B%BB%E5%B7%A5%E3%83%9A%E3%83%B3%E3%83%81+%E5%9C%A7%E7%9D%80%E7%AB%AF%E5%AD%90+%E3%82%BB%E3%83%83%E3%83%88&tag=registro500-22"}]'::jsonb where id = 58; -- 電工ペンチ＋圧着端子・配線 ／ 項目名の2点セットをそのまま反映
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E6%B2%B9%E5%9C%A7%E3%83%91%E3%83%B3%E3%82%BF%E3%82%B8%E3%83%A3%E3%83%83%E3%82%AD&tag=registro500-22"}]'::jsonb where id = 9; -- 車載ジャッキ ／ note_promptの「油圧パンタ」指定をそのまま採用
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%AA%E3%82%B8%E3%83%83%E3%83%89%E3%83%A9%E3%83%83%E3%82%AF+%E3%82%B8%E3%83%A3%E3%83%83%E3%82%AD%E3%82%B9%E3%82%BF%E3%83%B3%E3%83%89&tag=registro500-22"}]'::jsonb where id = 57; -- ジャッキスタンド（リジッドラック） ／ 項目名の別名（リジッドラック）を先頭に置きヒット率を上げる
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E8%BC%AA%E6%AD%A2%E3%82%81+%E3%82%BF%E3%82%A4%E3%83%A4%E3%82%B9%E3%83%88%E3%83%83%E3%83%91%E3%83%BC&tag=registro500-22"}]'::jsonb where id = 10; -- 輪止め ／ 別名（タイヤストッパー）を併記しヒット率を上げる
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E6%95%B4%E5%82%99%E3%83%9E%E3%83%83%E3%83%88+%E4%BD%9C%E6%A5%AD%E7%94%A8%E3%83%9E%E3%83%83%E3%83%88&tag=registro500-22"}]'::jsonb where id = 12; -- 整備マット ／ 雑貨と混ざらないよう「整備・作業用」を明示
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E7%B5%90%E6%9D%9F%E3%83%90%E3%83%B3%E3%83%89+%E9%87%9D%E9%87%91+%E3%82%BB%E3%83%83%E3%83%88&tag=registro500-22"}]'::jsonb where id = 7; -- 針金・タイラップ ／ タイラップの一般名（結束バンド）を先頭に配置
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E8%87%AA%E5%B7%B1%E8%9E%8D%E7%9D%80%E3%83%86%E3%83%BC%E3%83%97+%E7%B5%B6%E7%B8%81&tag=registro500-22"}]'::jsonb where id = 8; -- 自己融着テープ ／ 用途語（絶縁）を添えテープ一般と区別
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%80%E3%82%AF%E3%83%88%E3%83%86%E3%83%BC%E3%83%97+%E5%BC%B7%E5%8A%9B+%E5%B8%83%E3%83%86%E3%83%BC%E3%83%97&tag=registro500-22"}]'::jsonb where id = 59; -- 強力ガムテープ・ダクトテープ ／ 項目名の「強力」を反映し布テープ系に絞る
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=LED+%E4%BD%9C%E6%A5%AD%E7%81%AF+%E3%83%98%E3%83%83%E3%83%89%E3%83%A9%E3%83%B3%E3%83%97+%E5%85%85%E9%9B%BB%E5%BC%8F&tag=registro500-22"}]'::jsonb where id = 11; -- 作業用ライト（懐中電灯・ヘッドランプなど） ／ note_promptの候補のうちヘッドランプ・充電式を採用し雑貨と区別
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E8%BB%8D%E6%89%8B+%E3%82%A6%E3%82%A8%E3%82%B9+%E3%82%BB%E3%83%83%E3%83%88+%E6%95%B4%E5%82%99%E7%94%A8&tag=registro500-22"}]'::jsonb where id = 13; -- 軍手・ウエス／ペーパータオル ／ 整備文脈を明示し雑貨と区別
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%9E%E3%82%B0%E3%83%8D%E3%83%83%E3%83%88%E3%83%94%E3%83%83%E3%82%AF%E3%82%A2%E3%83%83%E3%83%97%E3%83%84%E3%83%BC%E3%83%AB+%E4%BC%B8%E7%B8%AE&tag=registro500-22"}]'::jsonb where id = 62; -- ピックアップツール（マグネット） ／ 伸縮式である一般的な形状語を追加
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%8F%E3%83%B3%E3%83%9E%E3%83%BC+%E6%95%B4%E5%82%99+%E3%82%B3%E3%83%B3%E3%83%91%E3%82%AF%E3%83%88&tag=registro500-22"}]'::jsonb where id = 63; -- ハンマー ／ 一般名詞すぎるため整備用途・コンパクトの修飾を追加（原則3）
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%82%AB%E3%83%83%E3%82%BF%E3%83%BC%E3%83%8A%E3%82%A4%E3%83%95&tag=registro500-22"}]'::jsonb where id = 64; -- カッター ／ 雑貨の刃物と混ざりにくい一般的な呼称に統一


-- ------------------------------------------------------------
-- 非常時対応（12件中8件対象・4件除外＝ロードサービス連絡先/保険証券/配線図・整備マニュアル/飲料水）
-- ------------------------------------------------------------
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E7%99%BA%E7%85%99%E7%AD%92+LED+%E9%9D%9E%E5%B8%B8%E4%BF%A1%E5%8F%B7%E7%81%AF&tag=registro500-22"}]'::jsonb where id = 38; -- 発煙筒・非常信号灯（LED可） ／ 項目名の「LED可」を反映し従来型・LED型どちらも拾えるようにする
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E4%B8%89%E8%A7%92%E8%A1%A8%E7%A4%BA%E6%9D%BF+%E8%BB%8A%E8%BC%89&tag=registro500-22"}]'::jsonb where id = 39; -- 三角表示板 ／ 車載用途を明示し類似品と区別
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%96%E3%83%BC%E3%82%B9%E3%82%BF%E3%83%BC%E3%82%B1%E3%83%BC%E3%83%96%E3%83%AB+12V&tag=registro500-22"}]'::jsonb where id = 40; -- ブースターケーブル ／ 12V車用であることを明示
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E7%89%BD%E5%BC%95%E3%83%AD%E3%83%BC%E3%83%97+%E3%83%99%E3%83%AB%E3%83%88&tag=registro500-22"}]'::jsonb where id = 41; -- 牽引ロープ ／ ロープ/ベルト両表記でヒット率を上げる
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E6%90%BA%E5%B8%AF+%E7%A9%BA%E6%B0%97%E5%85%A5%E3%82%8C+%E9%9B%BB%E5%8B%95+12V&tag=registro500-22"}]'::jsonb where id = 42; -- 携帯空気入れ ／ 12V電源対応の携帯用であることを明示
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%A2%E3%83%90%E3%82%A4%E3%83%AB%E3%83%90%E3%83%83%E3%83%86%E3%83%AA%E3%83%BC+%E5%A4%A7%E5%AE%B9%E9%87%8F&tag=registro500-22"}]'::jsonb where id = 43; -- モバイルバッテリー ／ 車載常備を想定し大容量タイプに絞る
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E5%8F%8D%E5%B0%84%E3%83%99%E3%82%B9%E3%83%88+%E5%AE%89%E5%85%A8%E3%83%99%E3%82%B9%E3%83%88&tag=registro500-22"}]'::jsonb where id = 47; -- 反射ベスト ／ 別名（安全ベスト）を併記しヒット率を上げる
update public.equipment_items set purchase_links = '[{"type":"amazon","url":"https://www.amazon.co.jp/s?k=%E3%83%AC%E3%82%A4%E3%83%B3%E3%82%A6%E3%82%A7%E3%82%A2+%E4%BD%9C%E6%A5%AD%E7%94%A8+%E3%82%AB%E3%83%83%E3%83%91&tag=registro500-22"}]'::jsonb where id = 48; -- 雨具 ／ 整備作業時の使用を想定し作業用レインウェアに絞る


-- ============================================================
-- 検算（2026-08-04時点の本番equipment_itemsより。is_active=true, 計66件）
--   ケミカル      8件 → 対象 8 ／ 除外 0
--   工具         23件 → 対象23 ／ 除外 0
--   非常時対応   12件 → 対象 8 ／ 除外 4（ロードサービス連絡先/保険証券/配線図・整備マニュアル/飲料水）
--   パーツ       23件 → 対象 0 ／ 除外23（第2弾送り。専門店リンクとあわせて検討）
--   洗車・その他  0件 → 対象 0 ／ 除外 0（本カテゴリの項目は現状存在しない）
--   -----------------------------------------------------------
--   合計 66件 → 対象合計 39 ／ 除外合計 27 （39 + 27 = 66 で整合）
--
-- 適用後の確認:
--   select category, count(*) filter (where purchase_links is not null) as with_link,
--          count(*) filter (where purchase_links is null) as without_link
--   from public.equipment_items
--   where is_active = true
--   group by category
--   order by category;
--     → ケミカル: with_link=8, without_link=0
--     → 工具: with_link=23, without_link=0
--     → 非常時対応: with_link=8, without_link=4
--     → パーツ: with_link=0, without_link=23
--
-- ロールバック（本migrationで設定した39件のみをnullに戻す）:
--   update public.equipment_items
--   set purchase_links = null
--   where id in (
--     29,30,31,32,33,36,37,70,
--     4,55,56,1,5,6,61,2,60,3,58,9,57,10,12,7,8,59,11,13,62,63,64,
--     38,39,40,41,42,43,47,48
--   );
-- ============================================================
