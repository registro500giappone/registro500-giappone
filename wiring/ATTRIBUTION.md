# 3Dモデル帰属表記

このビューア（`wiring/index.html`）で使用している車体3DモデルはSketchfabで公開されているCC BY 4.0（表示のみ）ライセンスの作品を改変して使用しています。

## Fiat Nuova 500F（`assets/body_f_v2.glb`）
- 作者: [freeReef](https://sketchfab.com/freeReef)
- 原本: https://sketchfab.com/3d-models/fiat-nuova-500f-0d1548037b7641f2b8fb32da8556018e
- ライセンス: [CC Attribution 4.0](http://creativecommons.org/licenses/by/4.0/)
- 改変内容: テクスチャ除去・実車寸法へのスケール/座標整列・パーツ分類（ボディ/ガラス/タイヤ/クローム）・gltf-transformによる軽量化
- 再生成手順（2026-07-08確定・引数値を必ずここに残すこと）:
  ```
  cd wiring/tools
  python prep_model.py <ソース置き場>/500f_gltf/scene.gltf ../assets/body_f_v2.glb \
      --real-length-mm 2970 --front-overhang-mm 509 --wheelbase-mm 1840
  npx @gltf-transform/cli weld ../assets/body_f_v2.glb tmp.glb
  npx @gltf-transform/cli quantize tmp.glb ../assets/body_f_v2.glb
  python check_model.py ../assets/body_f_v2.glb --wheelbase-mm 1840
  ```
  ソース(scene.gltf/bin)はリポジトリ外 `Documents/registro500-notes/assets3d/500f_gltf/` に保管。
  生成される `body_f_v2_wheels.json` の値を `index.html` の `MODEL_INFO.f.wheels` に手動で反映する。

## Fiat500_alt（`assets/body_l_v2.glb`）
- 作者: [PapaX007](https://sketchfab.com/PapaX007)
- 原本: https://sketchfab.com/3d-models/fiat500-alt-1d34eceb6aea44049ec1d6a1dd1c3c83
- ライセンス: [CC Attribution 4.0](http://creativecommons.org/licenses/by/4.0/)
- 改変内容: テクスチャ除去・実車寸法へのスケール/座標整列・マテリアル名によるパーツ分類・約45万面→約12万面へ簡略化・gltf-transformによる軽量化

## 110F型エンジンユニット（`assets/engine_110f.glb`）
- 出典: 他社作品の改変ではなく自作プロシージャル生成（`tools/build_engine.py`）。
  形状の主参照は FIAT 500 D 型 uso e manutenzione マニュアル p47「Motore con
  ventilatore, sezionati parzialmente」（カットモデル図版・著作権はFIAT/出版元に帰属・
  ローカル参照のみで同梱はしていない）。
- 構成: クランクケース＋オイルパン／フィン付きシリンダー×2＋ヘッドカバー／遠心ファン
  ハウジング(ダイナモ一体)＋シュラウド／クランクプーリー・ファンプーリー・Vベルト／
  キャブレター＋エアクリーナー／マフラー＋エキゾーストパイプ×2／ディストリビューター・
  点火コイル・オイルフィラーキャップ／ベルハウジング最小スタブ(ギアボックス本体は別GLB
  drivetrain_110f.glb が担当する前提で重複させていない)。
- 座標系: body_f_v2.glb/body_l_v2.glb と同じ実車mm座標系(x=前軸0・後方+/y=左+/z=地面0・
  上+)で直接生成。f.json の group:"engine" ノード(cylinder_head/dynamo/air_cleaner/
  distributor/ignition_coil 等)の pos3d を配置アンカーとして使用(詳細は
  build_engine.py 冒頭docstring)。
- 再生成手順:
  ```
  cd wiring/tools
  python build_engine.py
  ```
  出力先は `../assets/engine_110f.glb`（面数・バウンディングボックスを標準出力に表示）。
  index.html 側は `EXTRA_GLBS` 配列（機械系ユニット追加GLB群）から読み込む。今後
  駆動系等を追加する場合はこの配列にファイルを1行追加すればよい。

## drivetrain_110f.glb / front_parts_110f.glb / dashboard_110f.glb（自作プロシージャル）
- 作者: 本プロジェクト自作（プリミティブ合成・第三者素材不使用）。参照資料はFIAT純正マニュアル図版
  （110型 uso e manutenzione p45=エンジン+ギアボックス実写、110F/L版 p22/p24=上面透視図）。
- 内容:
  - `drivetrain_110f.glb`: クラッチベルハウジング・ギアボックス＋デフ一体ケース・
    左右ドライブシャフト（ジョイントブーツ付き）・マウント類。エンジンGLBのベルハウジング
    スタブ終端(1815,0,488)へ接続。
  - `front_parts_110f.glb`: フロントトランク内燃料タンク（給油キャップ・コック・配管）＋
    左右ヘッドライトユニット（リフレクター椀・リム・レンズ・バルブ）。ヘッドライト中心
    (-409,±418,578)は body_f_v2.glb の灯体凹みをレイキャスト実測して取得
    （f.json の lamp_fl/fr [-420,±455,430] はウインカーであり別物）。
  - `dashboard_110f.glb`: ダッシュパネル・Veglia風スピードメーター・警告灯3点・
    イグニッションスイッチ・トグルスイッチ類。
- 座標系: 実車mm座標系（engine_110f.glb と同様）。
- 再生成手順:
  ```
  cd wiring/tools
  python build_drivetrain.py
  python build_front_parts.py
  python build_dashboard.py
  ```
  いずれも index.html の `EXTRA_GLBS` 配列から読み込む。
