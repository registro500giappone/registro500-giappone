# 空冷 FIAT 500 / 126 エンジンチューニング「王道パッケージ」調査（2026-09-18）

> 目的：エンジン妄想シミュレーターのプリセット候補として、Web で**実際によく組まれている部品の組合せ**を頻度が分かる形で集める。
> 方法：WebSearch＋WebFetch。店の「kit」ページ（構成が明記される）と、フォーラムの実組み事例（構成がばらつく）を分けて数えた。
> ⚠️ **500forum.it の技術スレはログイン壁で本文が読めない**（検索エンジンの抜粋だけ見えた。抜粋由来は「抜粋」と明記）。500clubitalia の新フォーラムは 404。日本語はショップブログ・販売車両ページに「650cc・ハイカム・28mmキャブ」程度しか書かれず、**度数・バルブ径まで書いた日本語記事は見つからなかった**。
> 表記：q.c.＝quota di compressione＝ピストンの圧縮高さ（mm）。**圧縮比ではない**（後述 §3）。

---

## 1. パッケージ候補の表

根拠の本数＝その組合せ（またはその中核部品の同じ使い方）が出た**独立した店・スレの数**。出典番号は §2。

### 段階A「まず650」（純正499cc → 650cc・街乗り）

| 名前（仮） | 狙い | 排気量/ボア | CR | カム | ヘッド | キャブ | マフラー | ファイナル・タイヤ | 根拠 | 出典 |
|---|---|---|---|---|---|---|---|---|---|---|
| **A1 650 クラシコ**（店キットの標準形） | 純正の性格のまま登坂・巡航に余裕。店が「入門」と呼ぶ構成 | 650cc／φ77（500ブロックに鋳鉄シリンダ＋スペーサ板 83×10mm。Gerstl は 10mm 高いシリンダでスペーサ不要） | キットでは固定されない（q.c.39 のピストン・ヘッドガスケット無しで組む指示＝§3） | **35/75**（鋼製） | 純正ヘッドのまま（バルブ 32/28） | **Weber 28 IMB**（新品または「modificato」） | スポーツ型（Abarth 型 Y 字・出口 φ50 等） | ミッションは 500 の 8/41 のまま、または 126 シンクロ（8/39）。D'Angelo は「5速・3/4 速ショート」を推奨。タイヤ 125 R12 → 135 R12 が無加工で入る | **5**（D'Angelo・500ricambi・fiat500sport のカム表・fiatforum 2 スレ）＋抜粋 1（500clubitalia「classico 35/75」） | [1][2][7][13][27][28]、抜粋 [S1] |
| **A2 650 素の126** | 126 の 652cc をそのまま載せる（英・日で最多の実例） | 652cc／φ77（126 純正） | 126 純正 | 126 純正（20/50 相当） | 126 純正（モノ通路） | 126 純正 28 IMB | 純正/スポーツ | 126 シンクロ箱（8/39）ごと載せるのが英国流。日本の販売車両も「126 シンクロミッション」表記が多い | 3 | [30][33][37]、日本語 [J2] |

> 英国フォーラムの一致点：「素の 650 は約 23bhp＝ポート加工した 500（23〜25bhp）と大差ない。**ヘッド・キャブ・排気・カムの4本柱を一緒に触って初めて差が出る**」[27][30]。

### 段階B「650スポーツ」

| 名前（仮） | 狙い | 排気量/ボア | CR | カム | ヘッド | キャブ | マフラー | ファイナル・タイヤ | 根拠 | 出典 |
|---|---|---|---|---|---|---|---|---|---|---|
| **B1 650 FZD**（NANNI 系キット） | 街乗り 45HP 表示の店パッケージ | 650cc | 記載なし | 記載なし（「albero a cammes」同梱） | バルブ・スプリング同梱（径は非公開） | **Dell'Orto FZD 32/28** | ステンレス高効率マフラー | 記載なし | 2 店＋英 3 人 | [10][11][26] |
| **B2 650 ビッグバルブ 40/80** | フォーラムで「一段上」と言われる実組み | 650cc | 9.5〜10:1（フォーラム値・抜粋） | **40/80** | **バルブ拡大 35〜36/30〜31（ステム8）＋ポート研磨**。英国は「Panda 30 ヘッド＋35mm 吸気」 | 二連（**30 DGF / 30 DIC**）または FZD。単連なら 28 IMB を「modificato」 | Giannini 型モノチューブ／スポーツ | 9/39 に上げる例あり（§4） | **4**（fiatforum 2・500forum 1・fiat500sport カム表「40/80 stradale/sportivo」）＋抜粋 1 | [13][23][28][29]、抜粋 [S2] |

> ⚠️ B2 の注意：500forum の実例で「650＋40/80＋**モノ通路の 500 ヘッド**＋30 DGF」は始動・アイドルが決まらず失敗、「650＋30/70＋**Panda ヘッド**＋30 DIC 23/23」は成功（130 km/h 超）と報告[23]。**二連キャブはヘッドの通路と組で決まる**＝キャブだけ替える構成をプリセットにしない。

### 段階C「Abarth 595 / 595SS / 695SS 相当」

| 名前（仮） | 狙い | 排気量/ボア | CR | カム | ヘッド | キャブ | マフラー | ファイナル・タイヤ | 根拠 | 出典 |
|---|---|---|---|---|---|---|---|---|---|---|
| **C1 595（純正 Abarth）** | 27 CV@5000 | 593.7cc／φ73.5×70 | 9.5:1（autotecnica）／10〜10.5（500forum 表・抜粋） | 記載なし | 記載なし | **Solex C28 PBJ** | Record Monza 二本出し φ28 | 8/41・125×12 | 2 | [22][24] |
| **C2 595 SS** | 32 CV@6000・130 km/h | 同上 | 同上 | 記載なし | 記載なし | **Solex 34 PBIC**（専用インマニ） | Abarth | **8/39 がオプション**・125/135 前・135/145 後（4.5J） | 3 | [22][24][39] |
| **C3 695 SS** | 38 CV@5200・140 km/h | 689.5cc／**φ76×76**（ストロークも変更＝ボアアップだけでは再現できない） | **10.5:1** | **40-85 / 80-45**（Gerstl 記事・抜粋） | 記載なし | Solex 34 PBIC | Abarth | 記載なし | 2 | [22][25] |
| **C4 「695 レプリカ」キット**（D'Angelo） | ストロークは純正のまま φ79.5 で 695cc | 695cc／φ79.5（q.c.40） | 固定されない | **63/110 – 40/80-80/40** と表記 | 記載なし | 記載なし | スポーツ・ステンレス | 記載なし | 1 店 | [6] |

> ⚠️ カム度数の食い違い：fiat500sport は「Abarth 695 用 **45/75**」を売り[13]、Gerstl 記事は純正 695 SS を **40-85/80-45** と書き[25]、D'Angelo のレプリカは **40/80**[6]。**「695 相当のカム」は一つに決まらない**（下 §3）。

### 段階D「700 本気」

| 名前（仮） | 狙い | 排気量/ボア | CR | カム | ヘッド | キャブ | マフラー | ファイナル・タイヤ | 根拠 | 出典 |
|---|---|---|---|---|---|---|---|---|---|---|
| **D1 700 ストラダーレ**（NANNI） | 街乗り 48HP 表示 | 700cc | 記載なし | 記載なし | バルブ同梱＋**鋼製コンロッド** | FZD 32/28 | ステンレス | 記載なし | 1 店（500・R/126 の 2 品番） | [10][12] |
| **D2 700 DCOE**（D'Angelo step 3） | 二連サイドドラフトの「本気」 | 700cc／**φ79.5（q.c.25）** | 固定されない | **40/80** | **バルブ 36/30 ステム8** | **Weber 40 DCOE** | Lavazza ステンレス「corsa」 | 記載なし | 1 店（＋500ricambi の φ80 q.c.39 ピストン＝2 店目の素材） | [3][9] |

### 段階E「750〜800」

| 名前（仮） | 狙い | 排気量/ボア | CR | カム | ヘッド | キャブ | マフラー | ファイナル・タイヤ | 根拠 | 出典 |
|---|---|---|---|---|---|---|---|---|---|---|
| **E1 740 Nural**（NANNI） | 53HP 表示 | 740cc（Nural シリンダ・ピストン） | 記載なし | 記載なし | 純正ヘッドに 40 用インマニ | **Weber 40 DCOE** | ステンレス | 記載なし | 1 店 | [10] |
| **E2 740 step 3**（D'Angelo） | 「competizione」・最大 58 CV 表示 | 740cc／**φ82（q.c.25）** | 固定されない | 40/80 | 36/30 ステム8・H 断面コンロッド 130mm・4.5kg フライホイール | **Weber 45 DCOE** | Lavazza corsa | 「他の部分もこのキットの性能に合わせて」とだけ | 1 店 | [4] |
| **E3 800 step 3**（D'Angelo） | 上限 | 800cc／**φ85（q.c.28）**・ブロック加工 φ92（抜粋） | 固定されない | 40/80 | **Lavazza 完成ヘッド**（径非公開） | Weber 45 DCOE | Lavazza corsa | 記載なし | 1 店 | [5]、抜粋 [S3] |

> 750〜800 は **D'Angelo と NANNI（fiat500sport）の 2 店にしか完成キットが無く、フォーラムの実組み報告は拾えなかった**。500ricambi のカタログにも 750 の Standard/Sport/Abarth 段階があるが構成非公開[8]。

---

## 2. 出典一覧

### 専門店（イタリア）
| # | URL | 媒体 | 1行要約 |
|---|---|---|---|
| [1] | https://www.dangelomotori.it/prodotto/kit-elaborazione-motore-650-cc-step-1-base-motore-110f-500/ | D'Angelo Motori | 650 step 1：鋳鉄シリンダ φ77・q.c.39・鋼 35/75・アルミ下板 83×10・「fino a 40 CV」・€735 税抜・ヘッドガスケット無し・5速（3/4 速ショート）推奨 |
| [2] | https://www.dangelomotori.it/prodotto/kit-elaborazione-motore-650-cc-step-3-base-motore-110f-500/ | D'Angelo Motori | 650 step 3：[1]＋Weber 28 IMB＋インマニ＋マフラー＋オイルパン＋ファン・€1,991.81 税抜（step 2＝700cc €1,642.63 の存在も表示） |
| [3] | https://www.dangelomotori.it/prodotto/kit-elaborazione-motore-700cc-step-3-base-motore-110f-500/ | D'Angelo Motori | 700 step 3：φ79.5 q.c.25・40/80・バルブ 36/30 ステム8・Weber 40 DCOE・Lavazza ステンレス・€3,352.46 税抜 |
| [4] | https://www.dangelomotori.it/prodotto/kit-di-trasformazione-motore-740-cc-step3-by-dangelo-motori/ | D'Angelo Motori | 740 step 3：φ82 q.c.25・40/80・36/30・45 DCOE・H コンロッド・最大 58 CV・€3,209.02 税抜 |
| [5] | https://www.dangelomotori.it/prodotto/kit-elaborazione-motore-800-cc-step-3-per-fiat-500-f-l-r-e-fiat-126-depoca/ | D'Angelo Motori | 800 step 3：φ85 q.c.28・40/80・Lavazza 完成ヘッド・45 DCOE・€5,257.38 税抜 |
| [6] | https://www.dangelomotori.it/prodotto/kit-di-trasformazione-motore-695cc-abarth-base-motore-110f-500/ | D'Angelo Motori | 695 "abarth"：φ79.5 q.c.40・カム「63/110 – 40/80 – 80/40」・スポーツ・ステンレス排気・€1,204.92 税抜 |
| [7] | https://www.500ricambi.it/Product/1836/KIT-ELABORAZIONE-650 | 500ricambi.it | 650 完成キット：φ77 平頂ピストン・「albero a camme sportivo」（度数非公開）・Weber 28 IMB 新品・Abarth 型 Y マフラー φ50・銅ヘッドガスケット・Abarth オイルパン 3.5kg・「40HP」・€1,530 |
| [8] | https://www.500ricambi.it/Catalog/101/ELABORAZIONE-MOTORE/ | 500ricambi.it | 650/700/750 × Standard（€788）/Sport（€940）/Abarth（€1,210）/Abarth 完成（€1,530〜1,590）の段階＝構成は非公開 |
| [9] | https://www.500ricambi.it/fiat-500-f-l-r-126-kit-elaborazione-motore-abarth-700cc-cilindri-e-pistoni-80/ | 500ricambi.it | 700cc シリンダ・ピストン φ80 q.c.39・€549.65（商品名は「695cc 79,5」だが本文は φ80／700） |
| [10] | https://www.fiat500sport.com/categoria-prodotto/parti-motore-e-kit-di-elaborazione/ | Fiat 500 Sport（NANNI） | キット一覧：595cc 40HP（Weber 改）／650 45HP FZD 32/28／700 48HP FZD 32/28＋鋼コンロッド／740 53HP Nural＋40 DCOE。いずれもステンレス高効率マフラー同梱 |
| [11] | https://www.fiat500sport.com/prodotto/kit-nanni-per-fiat-500-r-per-elaborazione-motore-ad-uso-stradale-650-cc-40-hp/ | Fiat 500 Sport | 650 R 用：FZD 32/28・45HP・€1,499・ピストンはドイツ製。ボア・CR・度数は非公開 |
| [12] | https://www.fiat500sport.com/prodotto/kit-fiat-500-f-l-nanni-per-elaborazione-motore-ad-uso-stradale700-cc-40-hp/ | Fiat 500 Sport | 700 F/L 用：48HP・FZD 32/28・鋼コンロッド・€1,799・シリンダ自社製／ピストン Federal Mogul |
| [13] | https://www.fiat500sport.com/categoria-prodotto/assi-a-camme/ | Fiat 500 Sport | カム品揃え：30/70（Giannini）・**35/75「uso stradale」**・**40/80「stradale／sportivo」**・45/75「Abarth 695」・42/82・48/88（Giannini Montecarlo）・50/90「stradale molto veloce」・52/82・55/85（corsa） |
| [14] | https://www.fiat500sport.com/categoria-prodotto/impianto-di-alimentazione/ | Fiat 500 Sport | インマニ品揃え＝Weber 30/32 IBA・二連 32 縦・Dell'Orto FZD・**Solex 32/34 PBIC**・二連 30。エアクリは 28 IMB・30 DIC・Panda 30・32/35・40/45 用 |
| [15] | https://dmdautomotors.com/products/testata-fiat-500-elaborata-con-valvole-diametro-31-scarico-36-aspirazione-stelo-7-in-acciaio | DMD Automotors | 加工ヘッド：URL は 36/31 だが本文は「吸気 40／排気 34・ステム7」€859.99（ビッグバルブ寸法が店で揺れる例） |
| [16] | https://webshop.fiat500126.com/en/engine-parts-und-gaskets/pistons-und-cylinder/cylinder-kit-650-ccm-_500-block_-with-pistons_rings-premium | Axel Gerstl | 500 ブロック用 650 シリンダキット：10mm 高いシリンダでスペーサ不要・ブロックのボーリング要 |
| [17] | https://webshop.fiat500126.com/de/getriebe-und-schaltung/differential/teller-_kegelrad-8_39 ／ …/teller-_kegelrad--8_41 | Axel Gerstl | コッピア・コニカ 8/39（126）と 8/41（500/126）を販売（ページは 403・検索結果で存在確認のみ） |
| [18] | https://www.500ricambi.it/Product/2199/COPPIA-CONICA-TRASMISSIONE | 500ricambi.it | 8/41（F/L）€210、関連商品に 8/39（R/126）€210 |
| [19] | https://www.passione500.it/coppia-conica-rapporto-8-41-fiat-500-f-l-giardiniera | Passione 500 | 8/41 の販売（構成説明なし） |
| [20] | https://www.500frtuning.it/trasmissione/3531-coppia-conica-rapporto-839-fiat-500-r-126.html | 500 FR Tuning | 8/39（500 R/126）の販売（移転後 404・タイトルのみ） |

### フォーラム・解説（イタリア語）
| # | URL | 媒体 | 1行要約 |
|---|---|---|---|
| [21] | https://www.500forum.it/forum/viewtopic.php?t=24 | 500forum.it「Dati Tecnici」 | 純正バルブ N/D/F/L＝32/28・出力 N16.5/D17.5/F-L18/Sport21/126 23-24 cv・**ファイナル 500＝8/41・500R＆126＝8/39・126 Bis＝9/39** |
| [22] | https://www.500forum.it/forum/viewtopic.php?t=129 | 500forum.it「Dati Abarth 595」 | 595：73.5×70・27CV@5000・Solex C28 PBJ・125×12・8/41／595 SS：32CV@6000・Solex 34 PBIC・130km/h・**8/39 オプション**／695：76×76・30CV@4900／695 SS：38CV@5200・140km/h |
| [23] | https://www.500forum.it/forum/viewtopic.php?t=24706 | 500forum.it「Carburatore 30 DGF」 | 650＋40/80＋モノ通路 500 ヘッド＋30 DGF（120/120・180/175・50）は不調／650＋30/70＋Panda ヘッド＋30 DIC 23/23（850 Sport 用）は好調 130km/h 超／街乗りは「Weber 28 modificato」が上との総意 |
| [24] | https://www.autotecnica.org/fiat-abarth-595-ss-piccola-e-cattiva/ | Auto Tecnica | 595：φ67.4→73.5・ストローク 70・**CR 7:1→9.5:1**・27CV@5000・Solex 28 PBJ・Record Monza φ28 二本出し／595 SS：32CV・Solex 34 PBIC |
| [25] | https://webshop.fiat500126.com/it/sites/386 | Axel Gerstl 解説記事 | 695/695 SS：689.5cc・76×76・**CR 10.5:1・弁時期 40-85/80-45**・Solex 34 PBIC 専用インマニ・38CV・140km/h（ページは 403・検索抜粋） |
| [37] | https://www.mx5italia.com/forum/thread-28914-page-2.html | mx5italia フォーラム | 126 ベース 650：ヘッドはモノ通路のままか Panda 30（サーモ座の加工要）・キャブは 126 純正か 40 二連・カム再研磨 €50-100・35〜40hp 主張・組立完成品 €2,800 |
| [39] | https://www.fiat500nelmondo.it/gli-pneumatici-della-fiat-500/ | Fiat 500 nel mondo | 純正 125/12（3.5×12）・595 は 4.5J に前 125/135・後 135/145・現行推奨 Pirelli Cinturato CN54 125/80R12 |
| [40] | https://www.pneuserviceitalia.com/prodotti/pneumatici-145-70-12-69t-gomme-larghe-per-fiat-500-epoca/ | Pneuservice Italia | 145/70 R12 69T を「gomme larghe per Fiat 500 epoca」として販売（検索結果） |
| [43] | https://www.elaborare.com/51690-fiat-500-elaborazione-tuning-auto/ | Elaborare | 126 ブロック 700cc・スポーツカム・ヘッド加工・軽量フライホイール・126 Personal シンクロ箱・CSC 排気・推定 35〜40CV（ベンチ未測定） |

### フォーラム（英語）
| # | URL | 媒体 | 1行要約 |
|---|---|---|---|
| [26] | https://www.fiatforum.com/threads/650-carburetor-upgrade.304606/ | The FIAT Forum | 650 のキャブ：Dell'Orto FZD が 3 人（「THE single choke carb」だが高価）・30 DIC・30/32 IBA・SU HS2 |
| [27] | https://www.fiatforum.com/threads/about-camshafts.453906/ | The FIAT Forum | 20/50＝純正 500・30/70＝540 向け中間・**35/75＝チューンド 650**・「カム単体では効かない（キャブ・ヘッド・排気と同時に）」 |
| [28] | https://www.fiatforum.com/threads/simple-tuning-upgrades.499776/ | The FIAT Forum | **35/75「good sport/fast road」・40/80「that little step further」**・28 IMB のメインジェット 115→120・CR 9.5:1・吸気ポート 26→30mm |
| [29] | https://www.fiatforum.com/threads/650-engine-questions.498930/ | The FIAT Forum | 実組み：650 シリンダ＋**Panda 30 ヘッド（35mm 吸気）＋Alquati A2 40/80＋Weber DGF**。500 ケースは 652cc が上限 |
| [30] | https://www.fiatforum.com/threads/650cc-engine-upgrade.424067/ | The FIAT Forum | 素の 650≒23bhp・ポート加工 500＝23-25bhp・「650 に加工ヘッドを移さないと意味がない」で全員一致・MBG／ilmotore.de |
| [31] | https://www.fiatforum.com/threads/high-final-drive.507293/ | The FIAT Forum | 650 向けファイナル：**9/39 推し 4 人・8/39 のままが 2 人**（1 人は 9/39 から戻した）・10/39 は過大・9/39 セット Gerstl €409／Tecnotrasmissioni €199・60mph@約4000rpm |
| [32] | https://www.fiatforum.com/threads/top-speed-increase-with-126-bis-pinion.463651/ | The FIAT Forum | 9/39（4.333）vs 8/39（4.875）・126 BIS は 135×13・652cc で 50mph≒3500rpm・実測 65.5mph・登坂で苦しい／1 速がうるさい |
| [33] | https://www.fiatforum.com/threads/gearbox-to-suit-650-engine.524336/ | The FIAT Forum | 126 箱＝8/39・500 箱＝8/41・126 箱には 500 の 25mm ドライブシャフト・**135×12 は純正ホイールに入る** |
| [34] | https://www.fiatforum.com/threads/gearbox-final-drive-ratios.433578/ | The FIAT Forum | 9/39 は BIS だけ・594/652 の 126 はどちらも 8/39・チューンドは「126 シンクロ＋5速」推し |
| [35] | https://www.fiatforum.com/threads/650cc-upgrade-looking-for-opinions-and-experiences.502843/ | The FIAT Forum | FD Ricambi のチューンド 650 検討・9/39 で 60mph@4000・5速キットは「5速軸が片持ち」で巡航専用なら可 |
| [36] | https://www.fiatforum.com/threads/gearbox-best-option.511151/ | The FIAT Forum（検索抜粋） | 8/41＝5.125→47.2mph@4000／8/39＝4.875→49.6mph／9/39＝4.333→55.8mph（理論）・165/55R13 のチューンド 652 で 60mph@4250・70mph@5000 |

### 日本語
| # | URL | 媒体 | 1行要約 |
|---|---|---|---|
| [J1] | https://basic-bene.com/blog/500or650/ | Basic Bene（ショップブログ） | 「フィアットのお客様の 3 分の 2 以上が 650cc 化済み」・狙いは最高速でなく**登坂（60km/h 限界の坂を 80km/h 維持）**・激しい改造は勧めない。部品構成の記載なし |
| [J2] | https://www.flexnet.co.jp/custom-gallery/detail/424217886.html | 販売車両ページ | 500L「650cc ボアアップ・ハイカム入り・キャブ／タンクリフレッシュ」＝度数・キャブ型番の記載なし |
| [J3] | https://museo500.com/mcrt650.html | チンクエチェント博物館（接続不可・検索抜粋） | mCrt 650＝ボアアップキット＋ハイカム＋**デロルト製キャブ**で 650 化・ミッション／足回り／ブレーキも OH |
| [J4] | http://datacomm500.ciao.jp/sub8.html | 販売車両（404・検索抜粋） | 「650cc ボアアップ・ビッグバルブ・28mm キャブ」 |

### 検索抜粋のみ（本文未読・裏取り不可）
| # | 出所 | 内容 |
|---|---|---|
| [S1] | 500clubitalia.it「albero a camme e carburatore motore 650cc」（404） | 「650 には classico 35/75。より過激なカムはフライホイール・キャブ・バルブも一緒に」 |
| [S2] | 500forum.it t=27818「consiglio preparazione testa」（ログイン壁） | 「バルブ 35-30 または 36-31 ステム8・ポート研磨・CR 10:1」「40/80＋通路拡大ヘッド＋36/31＋Giannini 型モノチューブ」 |
| [S3] | D'Angelo「motore 700 super sport」・800 動画 | 700：φ80・**45/75**・36/30 ステム8／800：φ85 にはブロック φ92 加工・Abarth 695 カムは「45-85/85-45」 |

---

## 3. 食い違い・注意

1. **「q.c. 39/40/25/28」は圧縮比ではない**。D'Angelo・500ricambi のピストン表記 q.c.（quota di compressione）はピン中心〜頂面の圧縮高さ mm。実 CR はヘッドガスケットの有無（D'Angelo は「無しで組む」[1][2]）・下板厚（83×10）・ヘッド面研で決まり、**どのキットも CR を数値で約束していない**。フォーラム値は 9.5:1[28]・10:1[S2]（650 ビッグバルブ）、純正 Abarth は 595＝9.5:1[24]（別表では 10〜10.5[22]）・695 SS＝10.5:1[25]。→ シミュレーターでは **CR をキットに紐づけず独立入力**にするのが実態に合う。
2. **店が売る構成 vs フォーラムで組む構成**：店キット（650）は「35/75＋28 IMB＋純正ヘッド」で揃うが[1][2][7]、フォーラムの「差が出た」報告は必ず**ヘッド加工（バルブ拡大・Panda 30 ヘッド流用）**を含む[23][29][30][S2]。キャブは英国＝FZD 32/28 が定番[10][26]・イタリア＝28 IMB 改か二連 30（DGF/DIC）[23]・フォーラムは「二連はヘッドと組で決めろ」。
3. **695 系カムの度数が 3 通り**：純正 695 SS は 40-85/80-45[25]（別抜粋では 45-85/85-45[S3]）、店の「Abarth 695 用」は 45/75[13]、レプリカキットは 40/80[6]。商品名の「Abarth」は再現保証ではない。
4. **ボア表記のブレ**：695cc は φ79.5（D'Angelo）[6]、500ricambi は商品名 79.5／本文 φ80＝700cc[9]。同じ「700」でも φ79.5（q.c.25）[3]と φ80（q.c.39）[9]が混在。**排気量よりボア径と q.c. で識別**すべき。
5. **500 ケースの限界**：500 クランクケースは 652cc が実質上限[29]。700 以上は 126 ケース前提が多く（[43]は 126 ブロック）、800 はケース φ92 加工[S3]。
6. **ヘッド寸法の店ごとの揺れ**：同じ URL で 36/31 と 40/34 が混在[15]。35/30・36/31 が「650〜700 の定番」[S2][3][4]、39/33 以上は今回**出典を確認できず**。
7. **地域差**：イタリア＝店キット文化（step 1/2/3・Standard/Sport/Abarth の段階売り）[1]-[12]。英国＝126 シンクロ箱＋ファイナル変更の議論が厚く、エンジンより駆動系の話が多い[31]-[36]。日本＝「650 化＋ハイカム＋126 シンクロ」が販売車両の定型句だが**度数・型番を公開する記事が無い**[J1]-[J4]。日本のショップの狙いは「登坂」で最高速ではない[J1]。
8. **出力表示は店の宣伝値**（650＝40〜45HP・700＝48・740＝53〜58）[1][7][10][4]。フォーラムのベンチ実測は拾えなかった（[43]も未測定）。素の 652＝23〜24bhp[21][30]が唯一の裏付けある基準。
9. **5速キット**：D'Angelo は 650 step 1 に「5速・3/4 速ショート」を勧める[1]が、英国フォーラムは「5速軸が片持ちで弱い・巡航専用なら」と慎重[35]。

---

## 4. ファイナル（コッピア・コニカ）とタイヤ

### 4-1. 純正値（出典 [21][22][32][34][36][39]）
| 車 | ファイナル | 比 | 4000rpm 時（125 R12・4速 1:1 前提の英国計算[36]） | 純正タイヤ |
|---|---|---|---|---|
| 500 N/D/F/L（ノンシンクロ箱） | **8/41** | 5.125 | 約 47 mph（76 km/h） | 125-12（3.5J×12） |
| 500 R・126（594/652・シンクロ箱） | **8/39** | 4.875 | 約 50 mph（80 km/h） | 125-12（500R）／135-12（126） |
| 126 BIS（704cc 水冷） | **9/39** | 4.333 | 約 56 mph（90 km/h・理論） | 135-13 |
| Abarth 595 | 8/41 | 5.125 | — | 125-12（4.5J に前 125/135・後 135/145 が許容） |
| Abarth 595 SS | 8/41・**8/39 オプション** | — | — | 同上 |

### 4-2. 社外・流用の選択肢と「定番」
- **売られているもの**：8/41（500ricambi €210・Passione 500・Gerstl）[17][18][19]、8/39（500ricambi €210・500 FR・Gerstl）[17][18][20]、**9/39**（Gerstl €409・Tecnotrasmissioni €199）[31]。9/41・7/39 は今回**販売ページを確認できず**（存在は不明＝推測で書かない）。
- **650 化の定番（英国フォーラム）**：①まず **126 シンクロ箱ごと載せる＝8/39** が基本形[33][34]。②巡航重視なら **9/39 を 126 箱に組む**（4 人推し・60mph≒4000rpm）[31][32][35]。ただし 9/39 は「登坂で 4 速が苦しい」「1 速がうるさい」「素の 650 では恩恵が薄く戻した人あり」[31][32]＝**ヘッド加工済みの 650 向け**。③10/39 は過大[31]。
- **イタリアの店の定番**：D'Angelo は 650 に「5速＋3/4 速ショート」[1]＝ファイナルより変速比で詰める流儀。
- **タイヤ**：純正 125 R12（現行では Cinturato CN54 125/80R12 が「見た目同じ」推奨）[39]。**135 R12 は純正 3.5J ホイールに無加工で入る**[33]。**145/70 R12** は「gomme larghe per Fiat 500 epoca」として売られ、直径がほぼ変わらず幅だけ広がる[40]（日本の一般論でも 135/80→145/70 で直径は 135/80 の方が大きい）。英国のチューンド 652 では 165/55R13（13 インチ化）で 60mph@4250rpm の例[36]。
- ⚠️ 直径の目安（計算値・推測ではなくタイヤ規格からの算出）：125/80R12≈505mm・135/80R12≈521mm・145/70R12≈508mm・135R13≈519mm[32]。**145/70R12 は 125 とほぼ同径＝ファイナル換算に影響しない／135/80R12 は約 3% 大径＝ファイナルを約 3% ロングにしたのと同じ**。

---

## 5. 結び

### 最も自信のある定番 3 つ
1. **650 クラシコ＝φ77（650cc）＋カム 35/75＋Weber 28 IMB＋スポーツマフラー、ヘッド純正**。店 3 店（D'Angelo・500ricambi・fiat500sport）と英フォーラム 2 スレで同じ組合せ。CR は固定されない。
2. **650 スポーツ＝40/80＋ビッグバルブ（35〜36/30〜31 または Panda 30 ヘッド）＋二連 30（DGF/DIC）または FZD 32/28**。英・伊のフォーラム計 4 本で「一段上」の共通形。二連キャブはヘッドの通路と組で決めることまで一致。
3. **駆動系＝126 シンクロ箱（8/39）が 650 の標準、巡航重視なら 9/39（126 BIS）、タイヤは 135 R12 が無加工で入る**。英フォーラム 5 スレで数値（8/41=5.125・8/39=4.875・9/39=4.333・60mph≒4000rpm）が一致。

### 裏が取れなかった事
- 500forum.it の主要技術スレ（t=15742・13691・27818・4706・368・2359）＝**ログイン壁**。抜粋 [S1][S2] は本文未確認。
- **各キットの実 CR**（店はどこも q.c. しか書かない）と**ベンチ実測出力**（宣伝値のみ）。
- **695 SS 純正の弁時期**（40-85/80-45 と 45-85/85-45 の 2 説・どちらも抜粋）と**バルブ径**。
- **9/41・7/39 のコッピア・コニカ**の販売実態（今回の検索では出てこなかった）。
- **750〜800 の実組み事例**（店キット 2 店のみ・フォーラム報告なし）。
- **39/33 以上のヘッド**の出典。
- **日本語での度数・型番つきの構成**（ショップは「650 化・ハイカム・ビッグバルブ・28mm キャブ・デロルト」までしか書かない）。Julcar・FD Ricambi・Passione 500 の「kit」ページは検索に出ず、Axel Gerstl のチューニング頁と 500forum.de は 403。
