# 空冷 FIAT 500 / 126 「変速比を変えるギアセット」調査（2026-09-20）

> 目的：エンジン妄想シミュレーター第2弾「ミッション・タイヤ編」のプリセット候補として、**既存ミッションの一部ギアを比の違うものに換えるキット**（3/4速ショート・クロス・5速化・シンクロ箱換装）を、歯数と比が分かる形で集める。
> 方法：WebSearch（英・伊・独・日の4言語）＋WebFetch。店の製品ページ（歯数が明記される）とフォーラム（体感・費用感）を分けて読んだ。
> 対象店：優先5店＝Axel Gerstl／FD Ricambi（fdricambi.com＝英語店、fdricambiauto.it＝伊語店・現在は fuxricambi.it へ301転送）／Julcar（shop.euroitalia500.it）／D'Angelo Motori／PBP Klaudia Lorens。他＝NANNI（fiat500sport.com）・Bacci Romano（製造元）・500automotor・Monteferri・AutoBella・Ricambio・Passione500・Tecnotrasmissioni・500line。
> ⚠️ **本文を読めた（WebFetch 成功）ものは [n]、検索エンジンの抜粋しか読めなかったものは [S n]** で区別する。**Axel Gerstl は全ページ 403**、**500forum.de は全スレッド接続切れ**、**500forum.it は半分がログイン壁**、**eBay は 402/403**＝これらは抜粋のみ。
> ⚠️ **日本語の情報は見つからなかった**（ヒットしたのは「ノンシンクロはダブルクラッチ」の一般論と、国産エンジン＋5速ミッションへの載せ替え記事だけ＝歯数・比を書いた日本語ページは無い）。

---

## 0. 歯数表記の読み方（本レポートの前提）

店・製造元は歯数を「**プライマリ軸の歯数／セカンダリ軸の歯数**」の順で書く（例：500 純正1速 `10/37`）。**変速比＝後の数÷前の数**（37÷10＝3.700）。この向きは次の3点で検算できた：

- 500 F の純正＝`I: 37/10, II: 31/15, III: 26/20, IV: 21/24, RM: 25/10×37/18, ponte 8/41`（諸元表は逆順で書く）[16]。3.700／2.067／1.300／0.875 と一致。
- NANNI は「5速 42/31 は純正4速より **800回転**長い」「40/33 は **300回転**長い」と書く [1][2]。31÷42＝0.738、33÷40＝0.825 で、0.875 からの回転低下がそれぞれ約16%・約6%＝5000rpm で約780・約290回転＝記述と整合。
- Bacci の5速標準 `35/26` を、独 5A 社は「0.743・約700回転下がる」と書く [22]。26÷35＝0.743。

以下、**比の欄で「算出」と書いたものは、この前提で歯数から割り算したもの**。⛔歯数が出典に無いものは算出しない。

### 純正（比較の基準）

| 箱 | 1速 | 2速 | 3速 | 4速 | 後退 | ファイナル | 出典 |
|---|---|---|---|---|---|---|---|
| 500 N/D/F/L（ノンシンクロ・110F） | 10/37＝3.700 | 15/31＝2.067 | 20/26＝1.300 | 24/21＝0.875 | 25/10×37/18＝算出 5.139 | 8/41＝5.125 | [16]、Monteferri の「3ª/4ª corti」表の1・2速も同じ [11] |
| 500 R／126（シンクロ・126A） | 12/39＝3.250 | 15/31＝2.067 | 1.300（歯数は未確認・下注） | 39/34＝算出 0.8718（公称 0.872） | 見つからず | 8/39＝4.875 | 1速 12/39＝[11][6][8]／4速 39/34＝[17]／2速 15/31＝[11] |
| 126 BIS | 3.250 | 2.066 | 1.300 | 0.871 | — | **9/39**＝4.333 | [S 6]（Gerstl 諸元・centoventisei は接続不可） |

> 注：126 純正3速の歯数は直接の出典が無い。NANNI の「126 用プライマリ軸（3ª 19/26）はセカンダリ軸のギアを交換不要」[3] から**セカンダリ側 3速＝26枚**は動かず、公称 1.300 から逆算すればプライマリ 20 枚＝500 と同じ 20/26 になるが、これは推定。
> ⚠️ 食い違い：500forum.it のあるスレでは「126 の1速は **11枚・11-36**」と書く人がいる [17]。11/36＝3.273 は Abarth 595 の公認値と同じで、126 の公称 3.250＝12/39 とは合わない。店側（Monteferri・D'Angelo・Bacci・FD）は全部 12/39 [6][8][11][12]。

---

## 1. 市販ギアセットの一覧

### 1-A. NANNI（Nanni Ricambi・fiat500sport.com）＝「3ª/4ª corta」の元祖系

NANNI は**プライマリ軸を丸ごと換える方式**（モジュールを変えた歯で、セカンダリ軸のギアは純正のまま）[3][S 4]。ノンシンクロ箱用と シンクロ箱用で4速の歯数が違う。

| Art. | 製品 | 適合箱 | 3速 | 4速 | 5速 | 価格 | 出典 |
|---|---|---|---|---|---|---|---|
| 0119 | Albero primario 500 NANNI con 3ª e 4ª molto corta（軸のみ） | 500 ノンシンクロ | 19/26 | プライマリ **22枚**（純正24） | — | €250 | [4] |
| 0117 | Albero primario 126 NANNI con 3ª e 4ª molto corta（軸のみ） | 500R/126 シンクロ | 19/26 | **36/34** | — | €250 | [3] |
| 0109 | Quinta marcia 500/Giardiniera con 3ª, 4ª e 5ª corta | 500 ノンシンクロ | 19/26 | 22枚 | **40/33**（「純正4速より300回転長い」・「di potenza」） | €697（定価 €1,150） | [2] |
| 0110 | Quinta marcia 500/Giardiniera con 3ª, 4ª corta e 5ª lunga | 500 ノンシンクロ | 19/26 | 22枚 | **42/31**（「800回転長い」・高速・長距離向き） | €697（定価 €1,150） | [1] |
| 0110A | Quinta marcia 500（3/4は純正のまま） | 500 ノンシンクロ | — | — | 42/31 | €597 | [5] |
| 0112 | Quinta marcia 126 con 3ª, 4ª corta e 5ª lunga | 500R/126 シンクロ | 19/26 | 36/34 | 42/31 | €697 | [5] |
| 0113 | Quinta marcia 126 con 3ª, 4ª e 5ª corta | 500R/126 シンクロ | 19/26 | 36/34 | 40/33 | €697 | [5] |
| 0112A | Quinta marcia 126/500R（3/4は純正のまま） | 500R/126 シンクロ | — | — | 42/31 | €597 | [5] |
| 0116A／0116B | 5速ギア対のみ | 5速化済みの箱 | — | — | 42/31／40/33 | 各 €190 | [5] |

- 同梱＝ガスケット・詳細な取付説明書。**ケース加工の記述は無し**。5速化には別売セレクター Art.0071（€69）を推奨 [1][2]。
- ⚠️ 5速化キットは「ボルトオンではない」＝2速スリーブの切削・スピードメーター駆動ギアの加工（焼入れ鋼）・セレクターフォーク調整・後退ロックの切欠き・摩耗した1速の交換、の加工が要ったと英国ユーザー [23]。「Nanni は EU 外に発送しない・届くまで18か月」の報告もある [23]。

### 1-B. Bacci Romano（製造元・bacciromano.com）＝「19/27 – 22/24」系

Bacci は歯数を製品名に入れて売る。**価格はサイト非表示**（PBP 等の再販店の値）。

| コード | 製品 | 歯数 | 適合・備考 | 出典 |
|---|---|---|---|---|
| RCE01 | 3° and 4° close ratio gearkit Fiat 500 19/27 – 22/24 | 3速 19/27・4速 22/24 | 3点＝プライマリ軸＋3速スライドギア＋4速スライドギア。適合欄は「Fiat 500, 126」とだけ（シンクロ／ノンシンクロの明記なし） | [7] |
| RCE02 | Synchromesh gearkit 1°,3°,4° close ratio + reverse for Fiat 126 | 1速 12/39・3速 19/27・4速 22/24・後退 | 5点。**シンクロ箱用**。FD Ricambi VB1119 と同内容 | [6][8] |
| RCE04 | Kit trasformazione cambio 5 marce stradale（5速化キット） | 5速の歯数は選択（下） | 16点＝アルミ後カバー・2速固定ギア・5速スライド/固定ギア・5速/後退ロッド・レバー・スリーブ・ローラーケージ・小物。PDF 取説あり＝**箱を降ろすが全バラは不要**、ただし「2速フォークをその場で面取り」「ケース上の穴を φ7 で拡大」「セレクターの3速側ストッパを削って KE009 ゲートを付ける」の加工が要る | [9][10] |
| — | 5速の選択肢（PBP の商品ページ） | **35-26 STD／27-19／25-20／25-21／25-22／24-22／24-21／23-19** | PBP 価格 **€620〜690**（Bacci 1年保証） | [8] |
| RCE59 | 4 Speed close ratio gearkit | 11/36 – 15/31 – 19/29 – 21/25 | レース。1速が Abarth 595 と同じ 11/36 | [6] |
| RCE03 | 5 Speed close ratio gearkit | 11/36 – 15/31 – 19/29 – 21/25 – **22/22** | レース。5速 1:1 | [6] |
| RCE80 | 4 speed dog engagement gearkit（Gr.2 公認） | 12/36 – 16/31 – 18/26 – 20/23 | ドグ。ファイナルは 8/41・9/41・9/38・10/39・10/37 から選択 | [6] |
| RCE40／RCE67 | 6 speed dog（H パターン／シーケンシャル） | 11/37 – 15/32 – 17/29 – 19/27 – 22/27 – 22/24 | ドグ・アルミ鋳造ケース付き | [6] |

### 1-C. FD Ricambi（fdricambi.com 英語店／fuxricambi.it 伊語店）

| 品番 | 製品 | 歯数 | 価格 | 備考 | 出典 |
|---|---|---|---|---|---|
| VB1119 | Synchromesh 1°,3°,4° Close Ratio & Reverse Gear Kit (5 pcs) | 1速 12/39・3速 19/27・4速 22/24・後退 | €544.50（£468.27） | 適合＝500 R・126 全型（BIS 含む）。加工の記述なし | [12][13] |
| VB1101 | Gearbox Stradale 5 Speed Conversion Kit（500 F/L/R/Giardiniera） | 5速の歯数**未記載** | £624.36 | 製品ページは 404 | [13] |
| VB1169 | Pinion & Crown Wheel 8×41 | 8/41 | £231.79 | | [13] |
| 3209 | KIT 5 MARCE RAVVICINATO SFILABILE SINCRONIZZATO FIAT 500 126 | 1速 12/39・3速 19/27・4速 22/24・**5速 25/22** | €1,220 | 「全ギア」＋5速取付説明。「500 OP／126 シンクロ両対応」「街乗り／競技」 | [14] |
| 3920 | CAMBIO REVISIONATO FIAT 500 R/126 RAVVICINATO（完成箱） | 1速 12/39・3速 19/27・4速 22/24・5速 25/22・**ファイナル 8/39** | €2,100（旧箱返却で −€160） | 「500 用・**126 には不可**」＝500 の吊り方・ベルハウジング前提。ドライブシャフト新品・ベアリング・シール込み | [15] |
| US1120／US1219 | FIAT Gearbox 5 Speed／4 Speed 126A5 Synchronized（500 R 用リビルト） | — | £1,873.08／£1,300.75 | 純正比 | [13] |

### 1-D. 500automotor（500automotor.com）

| コード | 製品 | 歯数 | 価格 | 出典 |
|---|---|---|---|---|
| M183 | CAMBIO RAVVICINATO 500/126 – 5 PEZZI SINCRONIZZATO | 1速 12-39・3速 19-27・4速 22/24・後退（「5速を足せるよう加工済」） | €560（定価 €650） | [18] |
| M184 | 同 ＋ 5 MARCIA | 上記＋5速＝**25-20／25-21／25-22／24-21／24-22 から電話で選ぶ** | €1,190 | [19] |

### 1-E. D'Angelo Motori（dangelomotori.it）

| 製品 | 歯数 | 価格（税別） | 内容・適合 | 出典 |
|---|---|---|---|---|
| Kit trasformazione cambio 5 marce con 3° e 4° corta per 500/126 | **歯数の記載なし** | €1,650 | 5速キット＋ドライブシャフト一式＋ミッションベアリング＋**3/4速ショート（シンクロ）**＋2速ギアのベアリング対＋シフトロッド支持＋ガスケット＋5速セレクター。「純正から【下のトルクが太い】箱へ・5速で高速道路も」 | [20] |
| Cambio completo 5 marce sincronizzato con semiassi in acciaio e 3/4 corte（完成箱） | 1速 **Z12／Z39**・3速 **19/27**・4速 **22/24**・5速 **35/26**・後退 | €2,418.03 | 鋼製ドライブシャフト＋鋼製カップ・新品ベアリング。**「IMPORTANTE: Attacco campana 126 – Motorino avviamento laterale」**＝126 型ベルハウジング・横置きセルの前提。「3/4 ショートで ripresa と guidabilità が上がる・特に丘陵と山」「離した5速で快適・低燃費」 | [21] |
| Ingranaggio 4° marcia per rapporti originali 500/126 | 歯数記載なし | €70 | 名前から「5速化しても4速を純正比に戻すためのギア」と読めるが本文に説明なし | [S 7] |

### 1-F. Monteferri（ingranaggimonteferri.it・ローマのギア工房）

価格は非公開（見積り制）。**「RAPPORTI AL CAMBIO 3a/4a CORTI」の表が純正1・2速の歯数の裏取りにもなった**。

| 品目 | 500 | 126 | 出典 |
|---|---|---|---|
| Kit 5ª marcia | Z36 primario／Z26 secondario | 同 | [11] |
| Rapporti 3ª/4ª corti | 1ª 10/37・2ª 15/31・**3ª 19/27・4ª 22/24** | 1ª 12/39・2ª 15/31・3ª 19/27・4ª 22/24 | [11] |
| Cambio innesti frontali 4 marce（ドグ） | 12/35・15/32・14/23・16/22 | 同 | [11] |
| Cambio innesti frontali 5 marce | 12/37・15/32・14/24・15/22・20/26 | 同 | [11] |
| Cambio innesti frontali 6 marce | 11/46・14/39・15/31・14/24・15/22・20/26 | — | [11] |
| Coppie coniche | 4/5速用＝9/35・9/39・9/41・10/37・11/35・13/37／6速用＝9/35・10/37・11/37 | | [11] |

### 1-G. その他（歯数の無い製品・相場の参考）

- **Julcar**（shop.euroitalia500.it）：「Kit modifica cambio quinta marcia con rapporto 35/26 Fiat 500/126」[S 8] と「Scatola ingranaggi cambio usata da revisionare 500 R/126」[S 9] が検索に出るが、**製品ページはどちらも HTTP 500** で価格・内容は読めず。サイト内検索でも歯数入りの製品は出なかった [24]。
- **Axel Gerstl**（webshop.fiat500126.com）：「5-Gang-Umbausatz "Stradale" Fiat 500」[S 10]・「Synchronisationsplatte 3./4. Gang」「Rückwärtsgang-Zahnrad 500 R/126（小21枚／大26枚）」「Ingranaggio 1ª marcia (39 denti) 500 R/126」[S 11] が検索に出るが**全ページ 403**。3/4速ショートの製品は検索にも出ない。fiatforum ではファイナル新品が「Gerstl €348–409」「Tecnotrasmissioni €199」[25]。
- **PBP Klaudia Lorens**：自社サイトの Bacci 5速キット（上 1-B）のほか KIT TRIPLA 純正 €180–200・ベアリング €65 [8]。eBay 出品（「5 GEAR CHANGE ... UNSYNCHRONIZED」「CAMBIO SINCRONIZZATO 126 MODIFICA PER FIAT 500」）は 403 [S 12]。
- **Ricambio（英）**：Complete Gearbox Gear Kit 500R/126 £495.95＝純正比の総入替（メイン軸＋1〜4速＋後退＋シンクロリング3）・歯数なし [26]。
- **500line**：Kit ingranaggi tripla 500 F/L €189.90＝純正比の補修用 [27]。
- **5A（独・5-a.nrw）**：500F ノンシンクロ箱のフルリビルト＋5速 35/26（0.743・約700回転減）・1〜4速とファイナル 8/41 は純正のまま・**€2,399** [22]。
- **AutoBella（英）**：126 シンクロ4速リビルト・500 用ドライブシャフト装着済・**$1,672.36**（5速版もあり・在庫切れ） [28]。Car & Classic に「reconditioned synchromesh gearbox 126/500 F,L **£1,100**」[S 13]。

---

## 2. 典型的な組合せと狙い

| 組合せ | 何を換えるか | 狙い（店・フォーラムの言い方） | 出典 |
|---|---|---|---|
| **① 3/4 ショート（4速のまま）** | プライマリ軸＋3・4速（NANNI 19/26＋22枚 or 36/34／Bacci 19/27＋22/24） | 「回転落ちが均等になり、丘・山で ripresa が繋がる」「3→4 の谷が消える」。ただし最高速は落ちる | [3][4][21][S 1] |
| **② 3/4 ショート＋5速ロング**（「compromesso」の定番） | ①＋5速 42/31（NANNI）or 35/26・27/19（Bacci） | 「500forum.it で最も勧められる型」＝3/4 で登りを、5速で高速を。「約 1000 ユーロ」 | [S 1][21][1] |
| **③ 3/4/5 ショート（di potenza）** | ①＋5速 40/33（NANNI）or 25/22・24/22（Bacci） | 5速は純正4速と同じか少し長い程度＝**全段クロス**。「4速が延長されただけ」の感覚で、加速優先 | [2][14][19] |
| **④ 5速だけ足す（3/4 純正）** | 5速 42/31／35/26 のみ | 「650cc 以上なら最良の改造」「110km/h で一日中巡航・130km/h＋」。ただし「5速は巡航専用＝加速に使うな」（5速軸が片持ち） | [23][29][30] |
| **⑤ ファイナルだけ変える** | 8/41→8/39（126）→9/39（126 BIS） | 安い（BIS デフ「約 €50」の中古）が「全段が長くなり 3→4 の谷が広がる」＝5速化と両立しない解 | [31][25] |
| **⑥ 1速ロング（12/39・11/36）** | 1速を 500 の 10/37 から 126 の 12/39 か Abarth の 11/36 へ | Bacci/FD の「close ratio 1速」は**126 純正と同じ 12/39**＝500 ノンシンクロ箱（3.700）に入れると1速が長くなり 1→2 の谷が縮む。Abarth 595 公認値は 11/36 | [6][12][42][16] |
| **⑦ レース箱** | Bacci RCE59/03/80/40・Monteferri innesti frontali | 4〜6速・1:1 か 1.3 のトップ・ファイナルは 9/35〜13/37 の超ロング | [6][11] |

- 独フォーラムの抜粋：「山では段間の谷が大きい。500 箱を短いまま保って5速を足すと、800回転の落差の代わりに約1200になる」「5速は 35×26 だと純正4速に近すぎるので 27×19 の方が好まれる」「NANNI の 3/4 ショート軸に Bacci のロング5速を合わせた人がいる」[S 4][S 5]。
- 500forum.it（公開スレ）：660cc 化に伴い「4速は 90km/h 超で爆発しそう」＝5速化の動機。3/4 ショート同期キットの代替も提示。中古 126 箱 €200・全リビルト €300・リビルト済み約 €500、5速キット €300＋工賃 €120 [33]。

---

## 3. シンクロ箱換装（500 ノンシンクロ → 500R/126 シンクロ）

- **変換キットは存在しない**（英フォーラムでキットを探した人は「架空だった」と結論）。**中古の 126 箱（2・3・4速シンクロ・1速はノンシンクロのまま）を買って、500 のベルハウジングを付け替えるか新品ベルハウジングを買う**のが定石 [34]。
- 必要な部品・注意 [34][35][36]：
  - **ドライブシャフト＝500 用に交換**（「126 のシャフトは長すぎる」）。500 R は最初から 500 の短いシャフト [36]。初期 500（〜F 前）は φ15/16mm・3/4 ボルト継手で、F 以降と 126 は φ25mm＝**初期車は後ろのウィッシュボーンも継手径に合わせて要交換**[35]。
  - **ベルハウジング**：126 はセルが横に移った。500 のベルを移植する場合は上置きセルのまま。126 ベルを使う場合は **126 のセル・ダストシールド・「3本目のボルト」**が要る [35]。D'Angelo の完成箱は「126 ベル・横セル」前提 [21]、FD の完成箱は「500 用・126 不可」[15]。
  - **インプット軸スプライン**：初期 500 は太いスプライン、後期は細い＝クラッチ・フライホイールは世代間で互換なし [35]。
  - **ケース内部**：F 以降の内部は 65 年以前のケースに入らない。ノンシンクロと シンクロのトリプル（tripla）は互換なし [35][17]。
- **比の変化**：126 箱はファイナル 8/39（500 は 8/41）＝「各ギアで 1速+4・2速+6・3速+8・4速+10 km/h 長くなる」[37]、「約 6%（100→106 km/h）」[33]。499cc 純正エンジンだと「登りで 2→3、特に 3→4 の谷を強く感じる」→ 対策＝**126 箱に 500 の 8/41 ピニオンを入れる**（デフごと載せ替えるだけだとファイナルが変わる＝ピニオン単体を入れ替えるには箱を開ける）[37][32]。逆に 126 箱から 500 箱へ戻すと「4速で約 7 km/h 遅くなる」[31]。
- **費用感**：中古 126 箱 €200／リビルト約 €500 [33]、英国リビルト £1,100 [S 13]、AutoBella 500 シャフト装着済 $1,672 [28]、FD 完成箱（クロス・5速）€2,100 [15]、D'Angelo 完成箱 €2,418 [21]。

---

## 4. Abarth 595/695 とレース用の変速比

| 車・箱 | 1速 | 2速 | 3速 | 4速 | 後退 | ファイナル | 出典 |
|---|---|---|---|---|---|---|---|
| **Abarth 595（公認書・500forum.it 転載）** | **36/11＝3.272** | 31/15＝2.066 | 26/20＝1.300 | 21/24＝0.875 | 25/10×37/18 | **8/41** | [42] |
| 595 の選択ファイナル（1964〜） | — | — | — | — | — | 8/39・9/41・9/39 | [38] |
| 595 SS「sport gearbox」（automobile-catalog） | 402 で読めず | | | | | | [S 14] |

- **Abarth の箱は 1速だけ 11/36 で、2〜4速は 500 純正と同じ**＝「クロス」ではなく1速ロング＋ファイナル選択。695 SS の公認比は今回見つからず（500forum.it の同スレは 595 の1枚のみ）。
- レース用の市販比（歯数付き）は §1-B（Bacci）と §1-F（Monteferri）に集約。Bacci の Gr.2 公認ドグ箱＝12/36・16/31・18/26・20/23 [6]。

---

## 5. 効果の実測談（フォーラム）

**良い方**
- 5速化（650cc 以上）：「真の 110km/h を一日中・130km/h＋まで伸びる。前は 110km/h でエンジンが忙しく、バルブバウンスで下りでも 115km/h 止まり」[23]。「2台で10年毎日使って問題なし」[25][30]。
- 3/4 ショート＋5速ロング：「登りで遊べる・回転落ちが均一・常にパワーバンド」「約1000ユーロ」[S 1]。
- 9/39（BIS）＋チューン 650：「60mph が約 4000rpm で steady cruise」[25]。4速 8/41 系の実測＝「62mph@4000rpm・70mph@4500rpm」「60mph@4250・70mph@5000」[39]。

**悪い方・注意**
- 「5速は巡航専用。加速に使うな」（5速軸の後端に支持がない）＝Middle Barton Garage の助言として複数スレで繰り返される [29][30][40]。
- 「純正 500 エンジンには、さらに高いギアを引く grunt が無い」＝5速化の効果は排気量次第 [30]。「中間トルクの出るカムを選び、フライホイールを軽くしすぎるな」（軽いフライホイール＋ハイカムで5速が引けなかった例）[23]。
- 「ファイナルを上げすぎると必要回転に届かず最高速が【下がる】し加速も悪化」「10/39 は 40hp の 650 でも要らない」[25]。
- 126 箱（8/39）を 499cc に：「丘で 3→4 が extremely きつい」[37]。BIS デフ：「全段長くなるが加速が落ち 3→4 の谷が広がる」[31]。500 箱→126 箱で「加速を失って後悔・最高速は同じ」[32]。
- NANNI 5速の取付は「ボルトオンではない」（§1-A）。5速に入らない／3・4速が出ない不調＝ロリポップ（シフト継手）の劣化・短縮加工不足（FD VB1216 €19.35 の短縮品）[40][41]。
- 主軸の限界：「500/126 のクランクを常用 6000rpm は壊れる」「車は 75mph 出るがメインベアリングは 65mph まで」[39]＝ショート化で回転が上がる側の警告。

---

## 6. ⭐ シミュレーターに入れる用の表

比は「算出」＝歯数から §0 の向きで割ったもの（小数3桁）。**「—」は純正のまま**（対象箱の純正値を使う）。適合箱＝NS：500 N/D/F/L ノンシンクロ／S：500R・126 シンクロ。

| id 案 | 名前 | 1速 | 2速 | 3速 | 4速 | 5速 | 後退 | ファイナル | 適合箱 | 出典 |
|---|---|---|---|---|---|---|---|---|---|---|
| `stock_500` | 500 純正（110F） | 10/37＝3.700 | 15/31＝2.067 | 20/26＝1.300 | 24/21＝0.875 | — | 算出 5.139 | 8/41＝5.125 | NS | [16] |
| `stock_126` | 500R/126 純正（126A） | 12/39＝3.250 | 15/31＝2.067 | 1.300（歯数未確認） | 39/34＝算出 0.872 | — | 見つからず | 8/39＝4.875 | S | [11][17] |
| `stock_126bis` | 126 BIS 純正 | 3.250 | 2.066 | 1.300 | 0.871 | — | 見つからず | 9/39＝4.333 | S（BIS ケース） | [S 6] |
| `nanni_34_ns` | NANNI 3/4 molto corta（軸のみ） | — | — | 19/26＝算出 1.368 | 22/21＝算出 0.955（セカンダリ21枚は純正流用） | — | — | — | NS | [4] |
| `nanni_34_s` | NANNI 3/4 molto corta（126 軸） | — | — | 19/26＝算出 1.368 | 36/34＝算出 0.944 | — | — | — | S | [3] |
| `nanni_345_corta_ns` | NANNI Art.0109（3/4/5 corta） | — | — | 1.368 | 0.955 | 40/33＝算出 0.825 | — | — | NS | [2] |
| `nanni_34c_5l_ns` | NANNI Art.0110（3/4 corta＋5 lunga） | — | — | 1.368 | 0.955 | 42/31＝算出 0.738 | — | — | NS | [1] |
| `nanni_5_ns` | NANNI Art.0110A（5速のみ） | — | — | — | — | 42/31＝0.738 | — | — | NS | [5] |
| `nanni_34c_5l_s` | NANNI Art.0112（126・3/4 corta＋5 lunga） | — | — | 1.368 | 0.944 | 42/31＝0.738 | — | — | S | [5] |
| `nanni_345_corta_s` | NANNI Art.0113（126・3/4/5 corta） | — | — | 1.368 | 0.944 | 40/33＝0.825 | — | — | S | [5] |
| `bacci_34` | Bacci RCE01 3/4 close ratio | — | — | 19/27＝算出 1.421 | 22/24＝算出 1.091 | — | — | — | 明記なし（Monteferri は NS・S 両方に同歯数）[11] | [7] |
| `bacci_134_s` | Bacci RCE02／FD VB1119／500automotor M183 | 12/39＝3.250 | — | 19/27＝1.421 | 22/24＝1.091 | — | 含む（歯数なし） | — | S | [6][12][18] |
| `bacci_5_std` | Bacci 5速 35/26 STD（D'Angelo 完成箱・5A も同じ） | — | — | — | — | 35/26＝算出 0.743 | — | — | NS/S | [8][21][22] |
| `bacci_5_2719` | Bacci 5速 27/19 | — | — | — | — | 27/19＝算出 0.704 | — | — | NS/S | [8] |
| `bacci_5_2520` | Bacci 5速 25/20 | — | — | — | — | 算出 0.800 | — | — | NS/S | [8][19] |
| `bacci_5_2521` | Bacci 5速 25/21 | — | — | — | — | 算出 0.840 | — | — | NS/S | [8][19] |
| `bacci_5_2522` | Bacci 5速 25/22（FD 3209・3920 の標準） | — | — | — | — | 算出 0.880 | — | — | NS/S | [8][14][15][19] |
| `bacci_5_2422` | Bacci 5速 24/22 | — | — | — | — | 算出 0.917 | — | — | NS/S | [8][19] |
| `bacci_5_2421` | Bacci 5速 24/21 | — | — | — | — | 算出 0.875 | — | — | NS/S | [8][19] |
| `bacci_5_2319` | Bacci 5速 23/19 | — | — | — | — | 算出 0.826 | — | — | NS/S | [8] |
| `monteferri_5` | Monteferri 5速 Z36/Z26 | — | — | — | — | 36/26＝算出 0.722 | — | — | NS/S | [11] |
| `fd_ravvicinato_5` | FD 3209／3920 完成形（クロス＋5速） | 3.250 | — | 1.421 | 1.091 | 25/22＝0.880 | 含む | 3920 は 8/39 | S | [14][15] |
| `dangelo_complete` | D'Angelo 完成箱（3/4 corte＋5） | 3.250 | — | 1.421 | 1.091 | 35/26＝0.743 | 含む | 記載なし | S（126 ベル） | [21] |
| `abarth_595` | Abarth 595 公認 | 11/36＝3.272 | 15/31＝2.066 | 20/26＝1.300 | 24/21＝0.875 | — | 25/10×37/18＝算出 5.139 | 8/41（選択 8/39・9/41・9/39） | NS | [42][38] |
| `bacci_race4` | Bacci RCE59 | 11/36＝3.273 | 15/31＝2.067 | 19/29＝算出 1.526 | 21/25＝算出 1.190 | — | — | 選択 | レース | [6] |
| `bacci_race5` | Bacci RCE03 | 3.273 | 2.067 | 1.526 | 1.190 | 22/22＝1.000 | — | 選択 | レース | [6] |
| `bacci_dog4_gr2` | Bacci RCE80（Gr.2） | 12/36＝3.000 | 16/31＝算出 1.938 | 18/26＝算出 1.444 | 20/23＝算出 1.150 | — | — | 8/41・9/41・9/38・10/39・10/37 | ドグ | [6] |
| `bacci_dog6` | Bacci RCE40/67 | 11/37＝算出 3.364 | 15/32＝算出 2.133 | 17/29＝算出 1.706 | 19/27＝1.421 | 22/27＝算出 1.227（6速 22/24＝1.091） | — | 同上 | ドグ | [6] |
| `monteferri_dog4` | Monteferri innesti frontali 4 | 12/35＝算出 2.917 | 15/32＝2.133 | 14/23＝算出 1.643 | 16/22＝算出 1.375 | — | — | 9/35〜13/37 | ドグ | [11] |
| `monteferri_dog5` | Monteferri innesti frontali 5 | 12/37＝算出 3.083 | 2.133 | 14/24＝算出 1.714 | 15/22＝算出 1.467 | 20/26＝1.300 | — | 同上 | ドグ | [11] |
| `final_*` | ファイナル単品 | 8/41＝5.125／8/39＝4.875／9/41＝4.556／9/39＝4.333／9/38＝4.222／10/39＝3.900／10/37＝3.700／9/35＝3.889／11/35＝3.182／11/37＝3.364／13/37＝2.846 | | | | | | | | [6][11][38] |

> 実装メモ（判断はユーザー）：**同じ「3/4 ショート」でも NANNI（1.368／0.95）と Bacci（1.421／1.091）は別物**＝Bacci の 4速 1.091 は純正4速より 25% 短く、5速 0.88（25/22）を足して初めて純正4速相当のトップになる（「5速を足せるよう加工済」と M183 が断るのはこのため [18]）。NANNI は4速が 0.95 で、単体でも街乗りの4速として成立する（「300回転長い 40/33 の5速」を足すのが Art.0109）。**シミュレーターの選択肢を「3/4 ショート」の一語で括らない**方がよい。

---

## 7. 食い違い・裏が取れなかった事

### 食い違い
1. **126 純正1速の歯数**：店側は全部 12/39（3.250）[6][8][11][12]。500forum.it の一人は「11枚・11-36」[17]（Abarth 595 の値と一致）。公称 3.250 は 12/39。
2. **「3/4 corta」の中身**：NANNI 3速 19/26・4速 22枚 or 36/34 [1]〜[5] vs Bacci/FD/500automotor/D'Angelo/Monteferri 19/27・22/24 [6][12][18][21][11]。両方が「3/4 ショート」と呼ぶ。
3. **「標準の5速」**：Bacci 35/26（0.743）[8][21][22] vs NANNI 42/31（0.738）[1] vs Monteferri 36/26（0.722）[11] vs FD の完成品 25/22（0.880）[14][15]。独フォーラムは「35×26 は純正4速に近すぎ・27×19 がよい」[S 4]（＝26/35 と 19/27 の差 5% を「近すぎ」と言うのは疑問だが原文どおり）。
4. **同じ Bacci 5点キットの値段**：FD VB1119 €544.50 [12] vs 500automotor M183 €560 [18]（ほぼ同じ）。5速付きは FD 3209 €1,220 [14] vs M184 €1,190 [19]。
5. **500 純正1速の呼び方**：フォーラムでは「F まではエンジンが非力なので1速・後退が違う（短い）」との記述 [S 15] ＝ N/D と F/L で1速が違う可能性を示唆するが、歯数の出典は無し。本レポートは 110F の 10/37 を全ノンシンクロ箱に当てている。

### 裏が取れなかった事
- **Axel Gerstl の製品（5-Gang Stradale の歯数・価格・3/4 ショートの有無）**＝全ページ 403。
- **Julcar の 5速 35/26 キットの価格・内容**＝HTTP 500。
- **D'Angelo の「kit trasformazione」の歯数**＝製品ページに無い（完成箱の歯数から同じ 19/27・22/24・35/26 と推測できるが未確認）。
- **126 純正 3速の歯数・後退の歯数**、**126 BIS の後退**。
- **695 SS の変速比**（500forum.it の公認書スレは 595 のみ・automobile-catalog は 402）。
- **NANNI 5速キットのケース加工の要否**（Bacci の PDF は φ7 穴拡大とフォーク面取りを明記 [10]。NANNI は「dettagliatissime istruzioni」とだけ）。
- **Bacci RCE01 がノンシンクロ箱に入るか**（適合欄「Fiat 500, 126」のみ。Monteferri の同歯数の表は NS/S 両方にある [11]）。
- **500forum.it のログイン壁の向こう**：「Gruppo d'acquisto 3-4 corta e 5° marcia」（共同購入スレ・20ページ超）・「Consiglio quinta marcia su motore 126」・「Cambio Sportivo & Co.」・「Rapporti cambio」・「Info cambio 595」・「cambio 126 bis」＝**歯数と体感の一次資料が最も濃いはずの場所が読めない**。
- **500forum.de 全部**（Getriebe kürzer übersetzen／Getriebeübersetzungen／Empfehlung Auswahl Getriebe／Bis Übersetzung oder 5.Gang／Langer 5er Gang／Erfahrungen 5-Gang）＝接続切れ。抜粋 [S 4][S 5] のみ。
- **日本語**：歯数・比を書いた日本語ページは無し。

---

## 出典一覧

本文を読めたもの（WebFetch 成功）

| # | URL | サイト | 要旨 |
|---|---|---|---|
| 1 | https://www.fiat500sport.com/prodotto/kit-5a-marcia-nanni-per-fiat-500-con-3a-4a-corta-e-5a-lunga-con-guarnizioni/ | fiat500sport（NANNI） | Art.0110：3ª 19/26・4ª 22枚・5ª 42/31（純正4速より800回転長い）・€697 |
| 2 | https://www.fiat500sport.com/prodotto/kit-5a-marcia-nanni-per-fiat-500-con-3a-4a-e-5a-corta-con-guarnizioni/ | 同 | Art.0109：3ª 19/26・4ª 22枚・5ª 40/33（300回転長い・di potenza）・€697 |
| 3 | https://www.fiat500sport.com/prodotto/albero-primario-cambio-fiat-126-nanni-con-3a-e-4a-molto-corta/ | 同 | Art.0117：126 用軸 3ª 19/26・4ª 36/34・セカンダリ交換不要・€250 |
| 4 | https://www.fiat500sport.com/categoria-prodotto/cambio-e-trasmissione/page/2/ | 同 | Art.0119：500 用軸 3ª 19/26・4ª 22枚（純正24）・€250 ほか |
| 5 | https://www.fiat500sport.com/categoria-prodotto/cambio-e-trasmissione/ | 同 | 0110A／0112／0112A／0113／0116A／0116B の歯数と価格・8/41 純正 €295 |
| 6 | https://www.bacciromano.com/en/cars/fiat/500-126/ ・ https://www.bacciromano.com/en/cars/fiat/126/ | Bacci Romano | RCE01/02/03/04/59/80/40/67 の歯数・選択ファイナル |
| 7 | https://www.bacciromano.com/en/3%C2%B0-and-4%C2%B0-close-ratio-gearkit-fiat-500-19-27-%E2%80%93-22-24/ | 同 | RCE01＝軸＋3速＋4速の3点・適合「500, 126」 |
| 8 | https://pbpklaudialorens.com/it/shop/cambio-e-trasmissione/kit-ingranaggi/kit-modifica-5-marce-bacci-fiat-500-126-copia/ | PBP Klaudia Lorens | Bacci 5速キット €620–690・5速歯数8種・内容9点 |
| 9 | https://www.bacciromano.com/it/auto-storiche/fiat/500-126/kit-trasformazione-cambio-5-marce-stradale-fiat-500-e-126/ | Bacci Romano | RCE04 の16点構成・PDF |
| 10 | https://www.bacciromano.com/_files/uploads/fiat_500_kit_montaggio_5_rce04.pdf | 同（PDF・ローカル抽出） | 全バラ不要の取付手順・φ7 穴拡大・2速フォーク面取り・セレクター KE009 |
| 11 | https://www.ingranaggimonteferri.it/fiat-storiche | Monteferri | 3ª/4ª corti（500：10/37・15/31・19/27・22/24／126：12/39・…）・5速 36/26・ドグ箱・ファイナル |
| 12 | https://www.fdricambi.com/en/vb1119-synchromesh-10-30-and-40-close-ratio-reverse-gear-kit-5pcs-set/ | FD Ricambi（英） | VB1119：12/39・19/27・22/24・後退・€544.50・適合 500R/126/BIS |
| 13 | https://www.fdricambi.com/en/fiat-500/transmission/?currency=GBP | 同 | リビルト箱・VB1101 Stradale £624.36・VB1169 8×41 |
| 14 | https://www.fuxricambi.it/cambio-e-trasmissione/3209-kit-5-marce-ravvicinato-sfilabile-sincronizzato-fiat-500-126 | FD Ricambi 伊（fuxricambi） | 12/39・19/27・22/24・25/22・€1,220 |
| 15 | https://www.fuxricambi.it/cambio-e-trasmissione/3920-cambio-revisionato-fiat-500-r-126-ravvicinato | 同 | 完成箱 €2,100・8/39・500 用・126 不可 |
| 16 | https://www.cincent.tn.it/scheda-tecnica-fiat-500-f/ | cincent（500 F 諸元） | I 37/10・II 31/15・III 26/20・IV 21/24・RM 25/10×37/18・ponte 8/41・125-12 |
| 17 | https://www.500forum.it/forum/viewtopic.php?t=14826 | 500forum.it（公開） | 126 の 4速 39-34・500 の 4速 24-21・1速 10-37／「126 の1速は11枚」（食い違い） |
| 18 | https://500automotor.com/prodotto/cambio-ravvicinato-per-fiat-500-e-fiat-126-5-pezzi-sincronizzato/ | 500automotor | M183：12-39・19-27・22/24・€560・「5速を足せるよう加工済」 |
| 19 | https://500automotor.com/prodotto/cambio-ravvicinato-per-fiat-500-e-fiat-126-5-pezzi-sincronizzato-5-marcia/ | 同 | M184：＋5速（25-20/25-21/25-22/24-21/24-22）・€1,190 |
| 20 | https://www.dangelomotori.it/prodotto/kit-trasformazione-cambio-5-marce-con-3-e-4-corta-per-fiat-500-126/ | D'Angelo Motori | 変換キット €1,650・内容・歯数なし |
| 21 | https://www.dangelomotori.it/prodotto/cambio-sincronizzato-completo-a-5-marce-per-fiat-500-f-l-r-e-fiat-126-motore-126/ | 同 | 完成箱 €2,418.03・Z12/Z39・19/27・22/24・35/26・126 ベル横セル |
| 22 | https://www.5-a.nrw/5-gang-getriebe-fiat-500f | 5A（独） | 500F ノンシンクロ・5速 35/26＝0.743・約700回転減・€2,399 |
| 23 | https://www.fiatforum.com/threads/5-speed.420736/ | fiatforum | 5速化の体感（110km/h 巡航・130+）・加工内容・Nanni 18か月 |
| 24 | https://shop.euroitalia500.it/ricerca?controller=search&s=quinta+marcia | Julcar | 検索結果に歯数入り製品なし |
| 25 | https://www.fiatforum.com/threads/high-final-drive.507293/ | fiatforum | 8/39・9/39・10/39・60mph@4000・ファイナル価格（Gerstl €348–409・Tecnotrasmissioni €199） |
| 26 | https://www.ricambio.co.uk/products/complete-gearbox-gear-kit-classic-fiat-500r-126-synchro-gearbox | Ricambio | 純正比総入替 £495.95 |
| 27 | https://www.500line.it/products/kit-ingranaggi-cambio-fiat-500-f-l-epoca | 500line | tripla 500 F/L €189.90 |
| 28 | https://autobellaparts.com/en-us/products/classic-fiat-500-126-complete-5-speed-gearbox-fully-refurbished-reconditioned-copy | AutoBella | 126 シンクロリビルト・500 シャフト付 $1,672.36 |
| 29 | https://www.fiatforum.com/threads/nanni-5-speed-gear-selection-problem.501329/ | fiatforum | 5速に入らない不調・ロリポップ・「5速は巡航専用」 |
| 30 | https://www.fiatforum.com/threads/5-speed-transmission-upgrade.521503/ | fiatforum | 8/41→8/39 の安価案・「5速は巡航専用」（Castle-Miller）・10年使用 |
| 31 | https://www.500forum.it/forum/viewtopic.php?t=22823 | 500forum.it（公開） | 500 箱に戻すと4速 −7km/h・BIS デフ約 €50・「全段長くなり 3→4 の谷」 |
| 32 | https://www.500forum.it/forum/viewtopic.php?t=6344 | 500forum.it（公開） | 8/41 vs 8/39・デフ載せ替え可だがピニオン入替は箱を開ける・126 箱で加速を失い後悔 |
| 33 | https://www.500forum.it/forum/viewtopic.php?t=25766 | 500forum.it（公開） | 「4速 90km/h 超で爆発しそう」・5速候補 24-22/24-21/25-22/25-21/23-19・中古 126 箱 €200・リビルト €500・キット €300＋工賃 €120 |
| 34 | https://www.fiatforum.com/threads/gearbox-conversion-kits-crash-to-synchro.471951/ | fiatforum | 変換キットは存在しない・126 箱＋500 ベル・シャフトは 500 用 |
| 35 | https://www.fiatforum.com/threads/gearboxes-and-drive-shaft-and-clutches-and-compatibility.500750/ | fiatforum | シャフト径 15/16→25mm・126 セル横・3本目ボルト・スプライン世代差・ウィッシュボーン |
| 36 | https://www.fiatforum.com/threads/what-gearbox.479061/ | fiatforum | 500R は 500 の短いシャフト・補修キット約 €250 |
| 37 | https://www.500forum.it/forum/viewtopic.php?t=24972 | 500forum.it（公開） | 8/39 で各ギア +4/+6/+8/+10 km/h・499cc は登りで 3→4 がきつい・8/41 ピニオンを 126 箱へ |
| 38 | https://www.autotecnica.org/fiat-abarth-595-ss-piccola-e-cattiva/ | Auto Tecnica | 595：1964 から 8/41 の代わりに 8/39・9/41・9/39 |
| 39 | https://www.fiatforum.com/threads/cruising-speed.487480/ | fiatforum | 62mph@4000・70mph@4500・6000rpm 常用は壊れる |
| 40 | https://www.fiatforum.com/threads/instruction-nanni-5-speed.474436/ | fiatforum | ロリポップ短縮（FD VB1216 €19.35／1.5cm 内側に穴）・セレクター切削・純正エンジンでは効果薄 |
| 41 | https://www.fiatforum.com/threads/gearbox-final-drive-ratios.433578/ | fiatforum | 9/39＝126 650・595/695・BIS／8/39 標準／4速 9/39 で 60mph≒4000rpm |
| 42 | http://www.500forum.it/forum/viewtopic.php?t=129 | 500forum.it（公開） | Abarth 595 公認書：I 36/11 3,272・II 31/15 2,066・III 26/20 1,300・IV 21/24 0,875・RM 25/10×37/18・ponte 8/41 |

検索結果の抜粋のみ（本文は読めていない）

| # | URL | サイト | 要旨 |
|---|---|---|---|
| S 1 | https://www.500forum.it/forum/viewtopic.php?t=20135 ほか | 500forum.it（ログイン壁） | 「3/4 corta＋5 lunga が compromesso の定番・登りで遊べる・約1000ユーロ」 |
| S 4 | https://www.500forum.de/index.php/Thread/35268-Getriebe-k%C3%BCrzer-%C3%BCbersetzen/ | 500forum.de（接続切れ） | NANNI はモジュール変更で軸だけ交換・27×19 が 35×26 より好まれる・Bacci は比を選べる |
| S 5 | https://www.500forum.de/index.php/Thread/8394-Erfahrungen-5-Gang-Getriebe/?pageNo=3 ほか | 500forum.de（接続切れ） | 「500 箱を短いまま5速を足すと落差 800→1200 回転」・NANNI 軸＋Bacci 5速の混在例 |
| S 6 | https://webshop.fiat500126.com/it/sites/428 ・ http://www.centoventisei.it/datitecnicibis.html | Gerstl 諸元（403）・centoventisei（接続不可） | 126 BIS：3.250／2.066／1.300／0.871・ponte 9/39 |
| S 7 | https://www.dangelomotori.it/prodotto/ingranaggio-4-marcia-per-rapporti-originali-fiat-500-126/ | D'Angelo | 「純正比用4速ギア」€70（本文に歯数なし＝実質抜粋扱い） |
| S 8 | https://euroitalia500-commerce.it/index.php?id_product=1610&controller=product | Julcar（HTTP 500） | Kit modifica quinta marcia rapporto 35/26 |
| S 9 | https://euroitalia500-commerce.it/index.php?controller=product&id_product=1304 | Julcar（HTTP 500） | 中古 500R/126 ギアボックス（要リビルト） |
| S 10 | https://webshop.fiat500126.com/de/tuning/getriebe/5-gang-umbausatz-stradale | Gerstl（403） | 5-Gang-Umbausatz "Stradale" Fiat 500 |
| S 11 | https://webshop.fiat500126.com/it/cambi-e-comandi-cambio/cambio/ingranaggio-1a-marcia-_39-denti ほか | Gerstl（403） | 1ª marcia 39 denti 500R/126・後退 21/26 枚 |
| S 12 | https://www.ebay.co.uk/itm/353149303757 ・ https://www.ebay.com/itm/353853886365 | eBay PBP（403） | 5速ノンシンクロ箱／126 シンクロ箱の 500 向け改造品 |
| S 13 | https://www.carandclassic.com/car/C964423 | Car & Classic（403） | 126/500 F,L リビルト・シンクロ箱 £1,100 |
| S 14 | https://automobile-catalog.com/car/1968/211205/fiat_abarth_595_ss_sport_gearbox.html | automobile-catalog（402） | 595 SS sport gearbox の比（読めず） |
| S 15 | http://www.500forum.it/forum/viewtopic.php?f=42&t=1839 | 500forum.it（ログイン壁） | 「F までは非力なので1速・後退が違う」 |
