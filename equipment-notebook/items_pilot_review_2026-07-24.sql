-- ============================================================
-- 装備手帳 項目マスター見直し（パイロット5名の回答分析にもとづく）
-- 本番適用済み migration: equipment_notebook_items_pilot_review_2026_07_24
-- 適用日: 2026-07-24
--
-- 分析の出典＝パイロット回答6件（うち1件は部分入力）。自由追加30件のうち
-- 19件が「工具」に集中しており、工具マスターの粒度不足が最大の欠落だった。
-- 複数人が独立に自由追加した物＝マスターの穴として最優先で採用している。
--
-- ※ id 1〜54 は不変（回答が壊れるため）。不要項目も削除せず is_active=false。
-- ============================================================

-- 1) 非活性化：ガレージ作業用で車載向きでない（回答0件）
update public.equipment_items set is_active = false where id in (34, 35);  -- 液体ガスケット / マフラーパテ

-- ※ パンク修理剤(37) はチューブレスのオーナーも多いため残す（回答0件だが維持）
-- ※ デスビキャップ(19)・ローター(20) は単品needsも残し、「デスビ一式」(67) と併存させる

-- 2) 「洗車・その他」廃止（主題=出先トラブル備えから外れる。残2項目を非活性化）
--    項目0件のカテゴリは equipment-edit.html / equipment.html とも描画をスキップするため
--    HTML の CATEGORIES 配列は変更不要。復活させたい場合はこの2行を戻すだけでよい。
update public.equipment_items set is_active = false where id in (50, 51);  -- マイクロファイバークロス / ガラスクリーナー

-- 3) 新規項目（id 55〜70）
insert into public.equipment_items (id, code, category, name, reason, sort_order, is_active) values
  (55,'tool_socket_set','工具','ラチェット＋ソケットセット（8/10/13/17/19mm）','スパナだけでは回しにくい奥まったボルトに。エクステンションバーがあると手が届く',140,true),
  (56,'tool_torque_wrench','工具','トルクレンチ','出先で組み直したときの締め付けトルク管理に。締めすぎ・緩みを防ぐ',150,true),
  (57,'tool_jack_stand','工具','ジャッキスタンド（リジッドラック）','ジャッキだけで車体の下に入るのは危険。安全確保のために',160,true),
  (58,'tool_wire_crimp','工具','電工ペンチ＋圧着端子・配線','断線は出先で起きる。端子と1.25sq程度の電線があれば応急処置ができる',170,true),
  (59,'tool_duct_tape','工具','強力ガムテープ・ダクトテープ','ホースやボディの応急固定に。粘着力の強いものを',180,true),
  (60,'tool_point_file','工具','ポイントヤスリ','ポイントの荒れを整えて、出先での点火不良を改善する',190,true),
  (61,'tool_water_pump_pliers','工具','ウォーターポンププライヤー・プライヤーレンチ','大きめの部材やダブルナットを掴む。1本あると応用が利く',200,true),
  (62,'tool_pickup_tool','工具','ピックアップツール（マグネット）','エンジンルームの隙間に落としたボルト・ナットを拾う',210,true),
  (63,'tool_hammer','工具','ハンマー','固着した部品を叩いて外す。小ぶりなもので十分',220,true),
  (64,'tool_cutter','工具','カッター','ホース・テープ・結束バンドを切る',230,true),
  (65,'part_driveshaft_joint','パーツ','ドライブシャフトジョイント／ブーツ','ゴム部分がへたると走行不能になる。積んでおけば自走で帰れる',160,true),
  (66,'part_carburetor','パーツ','キャブレター（本体または補修部品）','不調時に丸ごと、または蓋・ニップルなどの補修部品で復帰させる',170,true),
  (67,'part_distributor','パーツ','デスビ一式','キャップ・ローター単品でなく丸ごと積んで、最短で復帰させたいとき',180,true),
  (68,'part_ignition_coil','パーツ','イグニッションコイル','点火系の要。故障すると始動も走行もできなくなる',190,true),
  (69,'part_tire_tube','パーツ','タイヤチューブ','チューブタイヤの場合は修理剤が効きにくいため、チューブ交換が確実',200,true),
  (70,'chem_grease','ケミカル','グリス各種（リチウム／モリブデン／カッパー／シリコン）','ワイヤー交換時やカジリ・異音対策に。小分けして少量ずつ',100,true);

-- 4) note_prompt 拡大
--    パイロットでは note_prompt 付き2項目に5件のメモが集まり（回答機会7回中5回）、
--    車載ジャッキでは「マサダ油圧パンタジャッキ」が2名から独立に挙がった＝名品の炙り出しが機能した。
--    銘柄が集まると価値が出る項目に限って追加する（全項目に付けると照合に疲れて離脱する）。
update public.equipment_items set note_prompt = 'どんなライト？（ヘッドランプ／マグネット付き／充電式 など）' where id = 11;
update public.equipment_items set note_prompt = '銘柄・サイズは？'                                     where id = 14;
update public.equipment_items set note_prompt = '銘柄・種類は？（検電ペン／サーキットテスター など）'   where id = 3;
update public.equipment_items set note_prompt = '銘柄・サイズは？（チューブ／チューブレスも）'          where id = 28;
update public.equipment_items set note_prompt = '銘柄・サイズ構成は？'                                 where id = 55;
update public.equipment_items set note_prompt = 'どんなスタンド？（折り畳み／耐荷重 など）'             where id = 57;

-- 5) recommend_priority 再割当（1〜33）
--    v3で確定した既存23件の相対順はそのまま維持し、新規・未設定の項目だけを間に挿入している。
--    無料で積める（ロードサービス連絡先・保険証券）と安全（輪止め・ジャッキスタンド）を上位へ。
update public.equipment_items set recommend_priority = null;
update public.equipment_items set recommend_priority = 1  where id = 39; -- 三角表示板
update public.equipment_items set recommend_priority = 2  where id = 38; -- 発煙筒・非常信号灯
update public.equipment_items set recommend_priority = 3  where id = 44; -- ロードサービス連絡先（無料で積める）
update public.equipment_items set recommend_priority = 4  where id = 45; -- 保険証券（無料で積める）
update public.equipment_items set recommend_priority = 5  where id = 10; -- 輪止め
update public.equipment_items set recommend_priority = 6  where id = 57; -- ジャッキスタンド（安全）
update public.equipment_items set recommend_priority = 7  where id = 4;  -- スパナ・メガネ
update public.equipment_items set recommend_priority = 8  where id = 1;  -- プラグレンチ
update public.equipment_items set recommend_priority = 9  where id = 55; -- ラチェット＋ソケット
update public.equipment_items set recommend_priority = 10 where id = 11; -- 作業用ライト
update public.equipment_items set recommend_priority = 11 where id = 13; -- 軍手・ウエス
update public.equipment_items set recommend_priority = 12 where id = 5;  -- マイナスドライバー
update public.equipment_items set recommend_priority = 13 where id = 3;  -- 検電テスター
update public.equipment_items set recommend_priority = 14 where id = 6;  -- ラジオペンチ・ニッパー
update public.equipment_items set recommend_priority = 15 where id = 7;  -- 針金・タイラップ
update public.equipment_items set recommend_priority = 16 where id = 59; -- 強力ガムテープ
update public.equipment_items set recommend_priority = 17 where id = 8;  -- 自己融着テープ
update public.equipment_items set recommend_priority = 18 where id = 58; -- 電工ペンチ＋端子・配線
update public.equipment_items set recommend_priority = 19 where id = 2;  -- シックネスゲージ
update public.equipment_items set recommend_priority = 20 where id = 14; -- Vベルト
update public.equipment_items set recommend_priority = 21 where id = 21; -- ヒューズ
update public.equipment_items set recommend_priority = 22 where id = 28; -- スペアタイヤ
update public.equipment_items set recommend_priority = 23 where id = 29; -- エンジンオイル
update public.equipment_items set recommend_priority = 24 where id = 33; -- 接点復活剤
update public.equipment_items set recommend_priority = 25 where id = 17; -- スパークプラグ
update public.equipment_items set recommend_priority = 26 where id = 22; -- 電球一式
update public.equipment_items set recommend_priority = 27 where id = 16; -- コンデンサー
update public.equipment_items set recommend_priority = 28 where id = 15; -- ポイント
update public.equipment_items set recommend_priority = 29 where id = 23; -- 燃料ホース＋ホースバンド
update public.equipment_items set recommend_priority = 30 where id = 24; -- アクセルワイヤー
update public.equipment_items set recommend_priority = 31 where id = 25; -- クラッチワイヤー
update public.equipment_items set recommend_priority = 32 where id = 68; -- イグニッションコイル
update public.equipment_items set recommend_priority = 33 where id = 65; -- ドライブシャフトジョイント

-- 適用後の状態：有効63項目（工具23 / パーツ20 / ケミカル8 / 非常時対応12 / 洗車・その他0）
--                note_prompt 付き8項目、recommend_priority 付き33項目
