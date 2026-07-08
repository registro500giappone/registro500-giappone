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
