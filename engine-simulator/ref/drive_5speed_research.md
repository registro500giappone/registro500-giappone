# 空冷 FIAT 500 / 126「5速化キット」の実態調査（2026-09-20）

> 目的：既存の4速ミッションに5速を足すキット（例：FD Ricambi VB1101「Gearbox Stradale 5 Speed Conversion Kit」35/26＝0.743）について、**推奨できるかどうかをオーナーが自分で判断できる材料**を集める。効果・故障・信頼性・使い方の注意・代替案。
> 調査日：2026-09-20。方法：WebSearch＋WebFetch（英・伊・独・日の4言語）。店ページは本文を読み、フォーラムは読めたものは全投稿を要約、読めなかったものは検索エンジンの抜粋だけを使った。
> 対象店（優先5店）：Axel Gerstl（webshop.fiat500126.com）／FD Ricambi／Julcar（euroitalia500）／D'Angelo Motori／PBP Klaudia Lorens（eBay）。他店：500automotor・fiat500sport（NANNI）・Bacci Romano・Monteferri・fuxricambi（旧 fdricambiauto）・teilezentrale・5-A.nrw・wum-autoteile・abarth-online・MrFiat・ricambio.co.uk・dmdautomotors・500line・nonsoloricambidepoca・Lucar500・SVK500・maf500。
> 出典記号：**[n]＝本文を実際に読んだ（WebFetch 成功）**／**[Sn]＝検索結果の抜粋しか読めなかった**（403・500・socket hang up・ログイン壁）。
> ⚠️ **読めなかった主要ページ**：Gerstl の商品ページ（403・Playwright でも 403）／Julcar の商品ページ（HTTP 500）／eBay の PBP 出品（403）／**500forum.de の全スレ（socket hang up・HTTP2 エラー＝独語の故障事例はすべて抜粋）**／500forum.it の大半（ログイン壁。ただし t=23644 は1ページ目だけ読めた）。
> ⚠️ **日本語の一次情報はみんカラ GARA500 氏の整備手帳1本しか見つからなかった**（2017年・500F への組付け記録）。日本のショップ記事・回転数の実測は見つからず。

---

## 0. 先に結論（材料の要約・判断はオーナーに委ねる）

1. **市販キットの中身はほぼ同じ構造**＝4速の後ろ（リアカバー側）に5速ギア対を「載せる」方式（独語で aufgesetzt、伊語で a sbalzo＝片持ち）。製造元は Bacci Romano（伊）が最多で、各店はその転売か同型品[S6][S10]。例外＝Lavazza（カバー側に軸受を追加した3点支持）[S6][S13]と Monteferri（5速軸を後部ケースの軸受で受ける）[S14]。
2. **「ボルトオンではない」は全言語で一致**＝2速フォークの面取り・スピードメーター駆動ウォームの短縮・ケースの穴拡大・リバースロックアウトの切除が要り、旋盤仕事を伴う[6][29][30][32][41][S5]。取説は伊語で不親切という声が英・独で共通[29][32]。
3. **故障の型は決まっている**＝①5速ギアの下にある軸受が過負荷で壊れる（独フォーラム「既知の不良箱のほぼ全部で同じ軸受」・寿命の目安 50,000 km）[S4][S12] ②組付け精度不足による2速フォークとの干渉・シフト不良・異音[35][S9][S13] ③輸送・製造ロットの当たり外れ（ケース凹み・シフトロッドの穴位置）[29][S9]。
4. **「5速は巡航専用・加速ギアではない」**が英国側の定説（軸が片持ちだから）[35][36]。一方で「Nanni キットで10年・日常使用・問題なし」[29][33][36]、「Bacci の載せ式は25年以上無事」[S6]、「2011年から無事」[S12]という長期無事例も複数ある。**「専門家が組んで定期点検すれば長く走る」**が独語側の総括[S4]。
5. **効果**：4速比 0.875 → 5速 0.743 は歯数からの計算で **−15%**（同じ速度で回転が 15% 下がる＝4,000 rpm なら約 −600 rpm）。店・フォーラムの言い値は「−650 rpm」[12]「4速より 800 rpm 長い」[27][S2 相当][19]「1000 rpm 落ちる」[S13]「300 rpm しか落ちない」[S8]とばらつく（§8 食い違い）。
6. **店側の推奨条件**：「650cc 以上」「35 hp 以上・平坦路向け（0.703 の場合）」「40 PS 以上でないと BIS 比＋5速は意味が薄い」[16][29][S7]。D'Angelo は「排気量を問わない」と書く[2]。保証の明記は eBay 出品の「メーカー保証1年」[27]以外に見つからず。
7. **代替案**＝ファイナル 9/39（Gerstl €409）へ替えて「5速キットを避ける」と明言する英国オーナーがいる[39]。独語では BIS の 9/39 を「貧者の5速」と呼び、平坦路・高速では十分だが山では辛いとする[S7]。

---

## 1. 市販キットの一覧

### 1-1. 優先5店

| 店 | 製品 | 価格 | 歯数／比 | 適合 | 構成・備考 | 出典 |
|---|---|---|---|---|---|---|
| **FD Ricambi** | VB1101 Gearbox "Stradale" 5 Speed Conversion Kit | **€726**（税込・在庫あり） | 35/26（0.743）。「他の比も要相談」（検索抜粋） | 500 N/D/F/L/R/Giardiniera・126/126p/BIS・Bianchina | 部品内訳・加工要否は商品ページに**書いていない**。取説 PDF と YouTube 組付け動画へのリンクあり。「同じ型式でも部品が違うことがある＝現物と比べて買え」の注意書き | [1] |
| **D'Angelo Motori** | Kit 5ª marcia 35/26 standard/stradale | **€419**（税別） | 35/26 | 500 F/L/R・126 | アルミ製リアカバー＋取説。「**ミッション全体を開ける必要はなく後部を外すだけ**」「長距離・最高速を求める人向け」 | [3] |
| 〃 | Kit 5ª marcia 25/22 | €450（税別・在庫12） | 25/22 | 同上 | 同構成。corta/sportiva の断りは無し | [4] |
| 〃 | Kit trasformazione cambio 5 marce con 3ª e 4ª corta（D3882） | **€1,650**（税別） | 5速の歯数は非公開。3/4速ショート | 500・126 | 5速キット＋**強化ドライブシャフト（浸炭・太径）**＋ミッション軸受＋3/4速シンクロ付きショート＋軸受対＋シフトロッド支持＋ガスケット＋5速セレクター。「**どの排気量のエンジンにも適合**」 | [2] |
| 〃 | Cambio completo 5 marce sincronizzato（D3162） | €2,418.03（税別） | 1速 12/39・3速 19/27・4速 22/24・5速 35/26 | 500 F/L/R・126（**126 ベルハウジング・サイドマウントのセルモーター**） | 完成ミッション。「3/4速ショートで坂と山で加速が稼げ、長い5速で長距離の快適さと燃費」 | [5] |
| **Julcar**（euroitalia500） | Kit modifica cambio quinta marcia con rapporto 35/26 | **€408.20**（抜粋） | 35/26 | 500・126 | **抜粋のみ**：「ごく一部の箱は2速スライダーが約 3 mm 長く、その場合 26 歯側の縁を旋盤で削って歯合わせする」「良いセレクターはステンレス製・スプリング式（割れる O リング無し）・側面が閉じて埃を入れない」。セレクターは別売 €69.67 | [S2] |
| **Axel Gerstl** | 5-Gang-Umbausatz "Stradale" Fiat 500 (126) | **読めず（403）** | 35/26（抜粋）「万能で街乗り・純正 500 向き」「他の比は要相談」 | 500・126 | 商品ページ・英語版とも 403。価格・構成は取れなかった。同社は別に **9/39 ファイナル歯車セット €409** を売る（代替案 §7） | [S1][39] |
| **PBP Klaudia Lorens**（eBay） | 5 Gang Getriebe Umbausatz Fiat 500 126 5 speed conversion kit（item 235206836430） | **EUR 580**（抜粋） | 非公開 | 500・126 | eBay は .com/.de とも 403。抜粋：在庫10以上・9個販売・所在 Brivio（伊）・返品可。構成不明 | [S3] |

### 1-2. 他店（価格帯の把握用）

| 店 | 製品 | 価格 | 歯数／比 | 備考 | 出典 |
|---|---|---|---|---|---|
| Bacci Romano（製造元） | RCE04 "5 Speed convertion kit" | 非公開 | 非公開（転売品は 35/26） | 取説 PDF が公開（§4 に全文要旨）。別に **RCE03 クロス5速 11/36-15/31-19/29-21/25-22/22**、KE002 ブッシュ＋ニードル軸受、KE009 5速 H ゲート | [6][7] |
| fuxxelaborazioni（eBay・PicClick 転載） | KIT QUINTA MARCIA Bacci 35/26 | €578 | 35/26 | 「**追加物なのでシンクロの有無を問わない**」「現行4速より 800 rpm 長い」「**メーカー保証1年**」 | [27] |
| 500automotor | M181 Kit 5ª marcia 35/26（ヘリカル） | €580（定価 €695） | 35/26 | 電話注文のみ | [10] |
| 〃 | M182 Kit 5ª marcia 直歯 | €580（取寄せ +20%） | **25/20・25/21・25/22・24/22・24/21・23/19・特注** | 直歯＝競技向け | [11] |
| 〃 | M184 Cambio ravvicinato 5 marce（ギア一式） | €1,190 | 1速 12/39・3速 19/27・4速 22/24・5速は **25/20〜24/22 から選択** | 「購入前に電話で比を決める」 | [9] |
| fuxricambi（旧 fdricambiauto） | Kit 5 marce ravvicinato sfilabile sincronizzato | €1,220 | 12/39・19/27・22/24・**25/22** | 全ギア＋5速取説。「最高速はデフとタイヤで変わる」 | [8] |
| fiat500sport（NANNI） | 0110A Fiat 500 gearbox kit 5 speed with gaskets | €597（定価 €1,050） | 非公開 | 構成非公開 | [20] |
| 〃 | 0116B 5ª corta 40/33 ギア対 | €190 | 40/33 | 「4速より **300 rpm** 長いだけ＝パワー志向」 | [18] |
| 〃 | 0116A 5ª lunga 42/31 ギア対 | €190 | 42/31 | 「di allungo＝4速より約 **800 rpm** 長い・高速向け」 | [19] |
| Monteferri（製造元） | Kit quinta marcia FIAT 500／126 | 非公開（フォーラム抜粋 €550→共同購入 €440） | **Z36/Z26**（標準）・**Z25/Z22**（ショート） | 構成＝閉止ケース・レバー・5速フォーク・ギア対・セレクター・2速スリーブ・締結・戻しバネ。**5速軸を後部ケースの軸受で受ける**（Lavazza の特徴を採用） | [21][S14] |
| teilezentrale（独） | 完成5速シンクロ箱 52753 | €2,100（定価 €2,499）＋交換保証金 €200 | 1速 11/36・2速 15/31・3速 20/26・4速 39/34（0.872）・**5速 35/26（0.743）／オプション 27/19（0.703）** | 「27/19 は **35 hp 以上・平坦路向け**」。ベル＝110F／126A／126A2 BIS／120F | [16] |
| 5-A.nrw（独・Philipp Ahmann＝"Fiatos"） | 再生5速ミッション 126/500R | €2,419 | 35/26＝0.743・デフ 8/39 | 「5速で **約 650 rpm 下がる**」。短軸（500）／長軸（126）を指定 | [12][S10] |
| wum-autoteile（独） | 210011 5-Gang Getriebe-Umbausatz | €830 | 非公開 | 「**Rennsportartikel ohne Gutachten**（競技部品・認証なし）」 | [14] |
| abarth-online.de | 500-005 5-Ganggetriebe Umbausatz | €1,190 | 非公開 | 構成非公開 | [13] |
| MrFiat（米） | TM-500-042 | $1,170 | 35/26 | 英 fiatforum で「法外に高い」と評される | [15][36] |
| ricambio.co.uk（英） | RIC-1206 5th Gear Conversion Kit | **£1,194**（ページ）／£995（検索抜粋） | 35/26 ヘリカル | 入荷待ち | [17][S16] |
| dmdautomotors | Kit 5ª marcia ad innesto frontale 35/26 | €599 | 35/26 | 「取付は簡単で初心者でも」 | [22] |
| 500line | Kit quinta 35/26 alta qualità | €549 | 35/26 | 「全分解不要・手作り」 | [23] |
| nonsoloricambidepoca | 35/26 kit | €695.58 | 35/26 | Julcar と同文 | [24] |
| Lucar500 | 35/26 kit | €499 | 35/26 | 詳細なし | [25] |
| SVK500 d'epoca | 35/26 kit | €645（税込・25 kg） | 35/26 | 「街乗り用・長距離か最高速向け」 | [26] |
| maf500 | MT046M rapporto medio | 価格なし | 非公開（検索抜粋は Z36/Z26） | 500 D/F/L/R/Giardiniera | [28] |

> **価格帯のまとめ**：5速だけ足す「載せ式」キットは **€408〜€726**（伊直販の下限〜FD の上限）、英米の転売で **£1,000〜$1,170**。3/4速ショート込みのフルキットは **€1,190〜€1,650**、完成ミッションは **€2,100〜€2,419**。英国オーナーは「欧州直販なら £350、英国転売は 100% 上乗せ」と不満[30]。

### 1-3. 適合（ノンシンクロ 500 箱／シンクロ 126 箱）

- Bacci 転売品の説明：「**追加物なのでシンクロの有無を問わない**（ESSENDO UN AGGIUNTA NON CAMBIA SE SINCRONIZZATO O NO）」[27]。FD Ricambi も N〜R・126・BIS を一括で適合と書く[1]。
- ただし組付けの差がある：**スピードメーター駆動ウォームの削り量が 110F（500）と 126A で違う**（GARA500 実測：残り 21 mm／22.5 mm）[41]。独フォーラムも「500 箱か 126 箱かで短縮量が変わる」[S5]。
- Nanni は 500 用と 126 用でキット番号を分ける＝**メインシャフト（クラスターギア）が両者で違うため**（fiatforum の検索抜粋・本文未読）[S18]。
- 5速化とは別に「500 箱をシンクロ化するキット」は**存在しない**（fiatforum の hobbler「見たことがない」）。シンクロが欲しければ 126 箱ごと載せ替え。**126 のドライブシャフトは長すぎる**ので 500 のシャフトへ入替えか 25 mm 短いカップリングが要る[34]。

---

## 2. 比のバリエーション

| 5速の歯数 | 比 | 位置づけ | 誰が売る | 出典 |
|---|---|---|---|---|
| **35/26** | 0.743 | 標準・「万能・街乗り・純正 500 向き」。4速 0.875（39/34＝0.872）に対し歯数計算で **−15%** | ほぼ全店 | [1][3][12][16][27] |
| 36/26 | 0.722 | Monteferri の「標準」 | Monteferri・maf500 | [21][28] |
| **27/19** | 0.703 | teilezentrale のオプション。「**35 hp 以上・平坦路向け**」。独フォーラム「35×26 は4速に近すぎる・27×19 が長くて良い」 | teilezentrale | [16][S8] |
| 42/31 | 0.738 | NANNI「lunga・4速より約 800 rpm 長い」 | fiat500sport | [19] |
| 40/33 | 0.825 | NANNI「corta・4速より 300 rpm 長いだけ＝パワー志向」 | fiat500sport | [18] |
| 25/22 | 0.880 | ショート（3/4速ショートと組む競技・山向け） | D'Angelo・500automotor・fuxricambi・Monteferri | [4][8][9][21] |
| 25/20・25/21・24/21・24/22・23/19 | 0.80・0.84・0.875・0.917・0.826 | 直歯・競技用・電話で決める | 500automotor | [9][11] |
| 22/22 | 1.000 | Bacci RCE03 クロス5速（5速＝直結） | Bacci | [7] |

> ⚠️ 依頼文にあった「0.78・0.80」は **0.80＝25/20 が直歯の競技用**として存在。0.78 は見つからず。
> ⚠️ 「35/26 は4速に近すぎる」[S8]と「35/26 が万能」[1][S1]は立場の違い（§8）。

---

## 3. 故障・不具合の事例

### 3-1. 軸受の破損（最多の報告・独フォーラム）

- 「5速化の**寿命は約 50,000 km**。問題は5速ギアが乗る軸の軸受が大幅に強く負荷される点」「**既知の不良ミッションのほぼ全てで、特定の軸受が壊れていた**＝この軸受が5速化で特に強く負荷される」[S4][S12]。
- 長期実例：**Gozzoli 製の再生 126 箱＋5速を 43,550 km で装着し、98,191 km で降ろした（約 54,000 km 使用）**＝軸を修正・全軸受交換（1個は不良）・損傷したシフトフォーク修理・デフのシム調整。結論「**プロが組んで定期的に点検すれば、非常に長く走れる**」[S4]。
- 設計上の理由（英国側の説明）：「**5速の軸は通常、片側でしか支持されていない**＝だから5速は加速ギアではなく巡航ギア」（hobbler・Middle Barton Garage の Tony Castle-Miller の言として）[35][36]。
- Lavazza の3点支持について独フォーラム：「この構造の長所であり短所は3つの軸受で支えること。**合わなければ最悪、合えば最良**」[S4][S6]。

### 3-2. シフト不良・干渉（組付け精度）

- 「初期の5速化では、5速を入れると**5速ギアが2速のシフトフォークに擦る**」＝2速フォークを上面で削って5速のスライドピースを通す必要[S5][S9]。Bacci 取説にもこの面取り指示がある（§4）[6]。
- 「Bacci のシフトロッドのネジ穴が**スピードメーター駆動側へ寄りすぎて開いていることがある**＝フォークに長穴を開け正しい位置に座ぐりを作らないと変速できない」[S9]。
- 英 fiatforum（2023）：Nanni 5速の車で1速交換後に**5速が入らず、5速を入れようとすると3・4速も入らなくなった**。摩耗した「lollipop」（セレクター）を替えて一旦直ったが再発。助言＝インターロックプランジャーの順序（薄2・厚1）確認・「箱を降ろして見るしかない」[35]。
- 「5速が入っているのにニュートラルのよう・2速が入らない」というスレ題も独フォーラムにある（本文は読めず）[S9]。
- 組付けミス例：**ハブを逆向きに組んで全体が長くなりギアが干渉**＝「よくある誤り」[30]。

### 3-3. 異音

- 伊フォーラム：500F 箱に5速キット＋tripla（出力側3連ギア）を新品にしたら**1速で金属音・3速で擦れ音**。原因候補＝tripla の不良・歯数違い・**軸方向のガタ**。対処＝リアカバー裏の軸受に **0.5 mm のシム**を足して tripla の縦動きを止めた[S13][S15]。
- 独フォーラム：「5速箱の2速で異音」スレあり（本文読めず）[S9]。

### 3-4. 製造・輸送の当たり外れ

- 英国：キットが**箱ではなくビニール袋で届き、アルミケースの鼻先（セレクター軸の出口）が凹んでオイルシールが変形**していた（2015・Nanni 系）[29]。
- 伊フォーラム（実読）：Bacci キットを 126 シンクロ箱に組む途中、**2速スライダーが標準より 3 mm 長い個体**に当たり、5速ピニオンの位置が合わない。専門家 Febo の助言＝ピニオンの肩を削る（裏返さない）・シンクロ箱にはスペーサー不要・スピードメーターギアは 5 kgm で締めれば元のボール不要[40]。Julcar の商品説明も同じ注意を載せる[S2]。

### 3-5. 見つからなかった故障

- **軸の折損・ケース割れ・オイル漏れの5速起因事例は、4言語で見つからず**（オイル漏れの話題は一般整備のみ）。

---

## 4. 対策・改良品・「ならし」・保証

### 4-1. 構造の違い（軸受の追加）

| 方式 | 5速軸の支持 | 評価 | 出典 |
|---|---|---|---|
| Bacci「載せ式」（aufgesetzt） | 片持ち＝上軸はシフトベルで軸方向を保持し、**Bacci のカバーが上側軸受を（シール無しで）挟む**。ホローナットのネジ部を **2 mm だけ**貫通ドリルして止めネジを効かせる | 「25年以上・私も多くの人も問題なし」／「Lavazza の半額以下」 | [S6][S11] |
| Lavazza | **カバー内に軸受を追加した3点支持**。4速ギアを5速として使う設計 | 「合えば最良・合わなければ最悪」「Bacci の2倍以上の値段」 | [S6][S13] |
| Monteferri | **5速軸を後部ケースの軸受で受ける（ブッシュではない）** | 共同購入スレで「Lavazza の求めていた特徴を持つ」 | [21][S14] |
| Nanni | 軸1本を交換する方式（歯を太くして比を変える） | 英国で「10年日常使用・問題なし」複数 | [S6][29][33][36] |
| D'Angelo D3882 | 5速化と同時に**強化ドライブシャフト＋ミッション軸受を新品に** | 「ホイールジョイントの問題を無くす」 | [2] |

### 4-2. 組付けの要点（Bacci 純正取説 RCE04・PDF 全文を読んだ）[6]

1. ミッションを降ろし、上蓋と後蓋を外す。
2. リバースフォーク止めボルトを外し、2つのギアを同時に入れて主軸・副軸のナットを緩める。
3. 上側2速ギアを RE04/02 に交換。スピードメーター駆動ギアと2速のハブを外して**図1のとおり加工**。
4. リバース操作ロッドを抜き（**ボールをケース内へ落とさないよう注意**）、キットのロッド RE04/05＋RE04/07 を入れる。5速スリーブを前後させると**2速フォークに当たるので写真2のとおり面取り**。**この面取りは現地で行うこと＝2速フォークを外すと安全ローラーがケース内へ落ち、全分解しないと回収できない**。
5. 後蓋のスタッドを抜き、**ケース上部の穴を φ7 mm に拡大**。
6. 5速ギア RE04/03 をニードルケージ RE04/08 と共に、下側5速ギア RE04/04 は軽く圧入。
7. 2ギア同時噛みで主軸ボルト RE04/12 と副軸ナット（**ワッシャー無し**）を **トルク 5 kgm** で締め、φ5 ドリルで軽く座ぐって止めネジ RE04/15 を打つ。
8. 新しい後蓋 RE04/01 を位置決めピンで載せ、レバー RE04/06 と共に締める。
9. **純正セレクターを改造**（3速側のレバー当たりを削除）し、H ゲート KE009（別売）をニュートラル位置で調整。
> 取説に**オイル量・粘度・ならし・保証の記述は無い**。

### 4-3. 追加で要る加工（取説に無く、実装者が報告したもの）

- スピードメーター駆動ウォームの削り（硬化鋼＝グラインダー）：**110F 箱は残り 21 mm・126A 箱は 22.5 mm**[41]。
- 2速セレクタースリーブの短縮（旋盤）[29][S5]。
- **リバースロックアウトの一部を Dremel で切除**＝押し下げ無しで5速へ入れるため。精度を誤るとリバースの歯を傷める[29][30][31]。
- シフトリンケージのゴムカップリングを短縮：**16 cm → 13 cm・φ11 穴**（GARA500）[41]／「5インチ・穴間 4.25 インチ」（英）[30]／「30 mm 短縮」（126）[32]。ricambio.co.uk は専用の短縮カップリングを別売[S16 相当の検索結果]。
- パイロットベアリングの短縮（126）[32]。
- ケース内側の突起を削ってシフトレバーの干渉を除く（GARA500）＝「**後戻りが出来ない**」[41]。
- 5速ゲート（H パターン板）：4速の板は平アルミ、5速用は**ローラー2個入りのデテント付き**で穴位置が合わず新規に開ける[30]。

### 4-4. 油量・粘度・ならし

- 5速化に伴うオイル量・粘度の変更指示は**店・取説・フォーラムのいずれにも見つからず**。参考＝126 箱の規定は 1.1 L・SAE 80W/90・**GL-4**（GL-5 はシンクロリングに不向き）[S17]。
- 「ならし」の指示も見つからず。独側の実務的助言は「**プロが組み・定期点検**」[S4]、伊側は「**tripla の軸方向ガタが 0.5 mm を超えたらシム**」[S15]。

### 4-5. 保証

- 明記が見つかったのは eBay（fuxxelaborazioni）の「**メーカー保証1年**」[27]のみ。FD・D'Angelo・500automotor・NANNI・teilezentrale・Gerstl（抜粋）は保証を書いていない。wum-autoteile は「**認証なしの競技部品**」と断る[14]。

---

## 5. 効果の実測談

| 報告者・条件 | 数字 | 出典 |
|---|---|---|
| Damon500（英）・**純正 650＋126 箱＋Nanni 5速**・125/12 | 「**110 km/h を一日中巡航**・クランク折損の心配なし・**130 km/h 超**まで伸びる」「85 mph まで出る・70 mph でフル積載でも無理なく巡航」。5速化前は「110 km/h で忙しく、バルブバウンスで 115 km/h 以上は下りでも無理」 | [29][33][38] |
| cinque500（英）・Nanni・126 箱 | 「10年乗って信頼性に問題なし」＝「巡航専用」説に反論 | [36] |
| MaluchHunter（英・126） | 完成者は「70 mph で回転が下がり燃費が良くなった」と満足 | [32] |
| 5-A.nrw（独・店） | 35/26 で「**約 650 rpm 下がる**」 | [12] |
| Bacci 転売（伊）／NANNI 42/31 | 「現行4速より **800 rpm** 長い」 | [27][19] |
| 500forum.it 抜粋 | 「標準 35-26 は4速より **+26 km/h**・ヘリカルで静か・**1000 rpm 落ちる**」 | [S13] |
| 500forum.de 抜粋 | 「5速で **約 300 rpm** 下がる・直線では4速より少し速くなる」（設定は不明） | [S8] |
| 独 126 フォーラム | 「€597 のキットの5速は**4速より約 10% 長いだけ**でよく調整されている」 | [S12] |
| 参考（5速なし）hobbler・652cc チューン・126 箱 | 14.1 mph/1000 rpm＝60 mph@4,250・70 mph@5,000 | [37] |
| 参考（5速なし）Bleeding Knuckles・126 箱＋BIS デフ 9/39 | 62 mph@4,000（4速）・70 mph@4,500 | [37][39] |

- **騒音**：ヘリカル歯の 35/26 は「静か」[S13]。直歯（500automotor M182）は競技用[11]。
- **燃費**：「長距離で燃費が下がる」は店の常套句[5][16][22]だが、数字を出した実測は見つからず。
- **登り**：「5速は加速ギアではない」[35][36]。「山では BIS の長い比は辛い」[S7]。5速で登れるかの直接の実測談は見つからず（3/4速ショートと組むフルキットが「山向け」と売られている[5]）。
- 計算上の目安（歯数から）：4速 0.875 → 5速 0.743 で回転は **×0.849**。4,000 rpm なら約 3,400 rpm（−600 rpm 前後）。上の「300〜1000 rpm」のばらつきは走行速度・エンジン・比の違いを含む（§8）。

---

## 6. ショップ側の言い分

- **FD Ricambi**：「35/26 は特に街乗りと純正 500 に最良の万能解。他の比は要相談」（抜粋）。加工の要否は書かず、取説 PDF と動画を添える[1][S1]。
- **D'Angelo**：単品キットは「全分解不要・後部だけ外す」「長距離・最高速向け」[3]。フルキット D3882 は「**どの排気量にも適合**」[2]。完成箱は「3/4 ショート＝山で加速、5速＝長距離の快適と燃費」[5]。
- **teilezentrale**：オプションの長い 0.703 は「**35 hp 以上・平坦路向け**」と限定[16]。
- **Julcar**（抜粋）：個体差（3 mm 長いスライダー）への対処法とセレクターの品質条件を商品説明に書く＝**組む側の技量を前提**にしている[S2]。
- **dmdautomotors／500line**：「初心者でも簡単」「全分解不要」＝楽観的な売り文句[22][23]。
- **wum-autoteile**：「競技部品・認証なし」＝ドイツの車検（TÜV）向けの断り[14]。
- 英国オーナーの店評：「主要な英国店のキットは**取説なし**で 100% 上乗せ」[30]、「Nanni Ricambi は国際対応が悪い。Leo van der Laan や Axel Gerstl を勧める」[30]、「MrFiat は法外に高い」[36]。
- 独フォーラムの総括：「**€1,000 未満でプラグ＆プレイのキットは無い**。多くはミッションのプロの助けが要る」[S12]、「キットは30年以上、後加工なしには組めたことがない」[S5]。

---

## 7. 代替案（5速化せずに巡航回転を下げる）

| 手段 | 数字 | 誰がどう語るか | 出典 |
|---|---|---|---|
| **ファイナル 8/41 → 8/39**（126 デフ） | 5.125 → 4.875（−4.9%） | 英 hobbler「126 のクラウン＆ピニオンを入れるのが**安くて簡単な代替**」。伊 Febo は逆に「**499cc＋5速なら 8/41 のまま**が良い」（5速化する場合の助言） | [36][40][43] |
| **ファイナル 9/39**（BIS・695SS） | 4.333（8/41 比 −15.5%） | 英 Bounding Bambino「**5速キットを避けるために 9/39 を注文**」。Bleeding Knuckles「60 mph@4,000 で穏やかな巡航（チューン 650）」。fiat500 は「純正 650 では良かったが 594 に戻したら外した」。hobbler「**比を上げすぎるとエンジンが回りきらず最高速がむしろ落ちる**」。部品＝Gerstl 新品 €409・Tecnotrasmissioni €199。独では「**貧者の5速**＝平坦・高速は最高、山は辛い」「BIS 比＋5速は約 40 PS 以上で初めて意味がある」 | [39][S7] |
| **9/39 ＋ 5速の併用** | — | Bleeding Knuckles「**最低でも 9/39、できれば5速も**」 | [33] |
| **タイヤ大径化** | — | 独フォーラム「タイヤ周長は総減速比の計算要素」（一般論のみ）。5速との定量比較は見つからず | [S7] |
| 5速化と 8/39 の**組合せ不可**の注意 | — | 伊：500L の 8/41 クラウンに 126 ピニオンを混ぜるのは「**噛み合わない**（Non si accoppiano!!!）」 | [40] |

> 比較の要点（フォーラムの言い分）：ファイナルは**全ギアが一緒に長くなる**ので 1〜3速の加速と登坂が犠牲になる[S7][39]。5速化は**1〜4速を残して巡航だけ長くできる**が、片持ち軸の耐久と組付け技量が要る[S4][35]。3/4速ショート付きのフルキットは両方を狙う分だけ高い（€1,190〜1,650）[2][8][9]。

---

## 8. 食い違い（両論併記）

1. **回転低下の幅**：「約 650 rpm」[12]／「800 rpm」[19][27]／「1000 rpm」[S13]／「約 300 rpm」[S8]／「4速より約 10% 長いだけ」[S12]。歯数計算では −15%。速度・設定が揃っていないため単純比較不可。
2. **35/26 の評価**：FD・Gerstl「万能」[1][S1] vs 独フォーラム「4速に近すぎる・27/19 が良い」[S8]。
3. **「巡航専用」**：英 hobbler「片持ち軸だから加速ギアではない」[35][36] vs cinque500・Damon500「10年日常使用で問題なし」[29][36]。両立しうる（巡航に使えば長持ち）が、断定はできない。
4. **寿命**：「約 50,000 km」[S4] vs 「25年以上問題なし」[S6]「2011年から無事」[S12] vs 「54,000 km で軸受1個不良・フォーク損傷」[S4]。**使い方と組付け精度の差**と各所が説明するが、統計はない。
5. **適合の書き方**：D'Angelo「どの排気量にも」[2] vs teilezentrale「0.703 は 35 hp 以上」[16] vs 英「650cc 以上なら最良の改造」[29] vs 独「BIS 比＋5速は 40 PS から」[S7]。
6. **ricambio.co.uk の価格**：商品ページ £1,194[17] vs 検索抜粋 £995[S16]（時期差か）。
7. **Nanni キットの 500/126 区分**：fiatforum の抜粋「Nanni だけ 500 用と 126 用を分けるのはメインシャフト同梱のため」[S18] vs Bacci 転売「追加物だからどちらでも同じ」[27]。
8. **難易度**：dmdautomotors「初心者でも簡単」[22] vs 英「total headache」[32]・独「30年間、後加工なしに組めたことがない」[S5]。

---

## 9. 裏が取れなかった事

- **Gerstl のキットの価格・構成・保証**（403）。
- **Julcar の商品ページ本文**（500）＝3 mm スライダーとセレクターの記述は抜粋と同文の転売店[24]で間接確認したのみ。
- **PBP Klaudia Lorens の出品内容**（403）＝価格 €580 と販売数のみ。
- **500forum.de の全スレ本文**＝「50,000 km」「Gozzoli 箱 43,550→98,191 km」「同じ軸受が壊れる」「Bacci 25年」は検索エンジンの抜粋。**どの軸受か（品番・位置）は特定できず**。
- **500forum.it**＝t=20135「Consiglio quinta marcia」（5ページ・a sbalzo と Lavazza の比較）・t=13389「共同購入」（30ページ）はログイン壁。
- **日本語**＝GARA500 氏の組付け記録のみ。**組付け後の回転数・不具合・日本のショップの推奨/非推奨は見つからず**。
- **燃費の実数・登坂での実測・オイル量変更・ならし指示**＝いずれも見つからず。
- **軸折損・ケース割れ・5速起因のオイル漏れ**＝事例なし。
- Bacci 取説 PDF の写真1〜3（面取り位置・穴位置）は画像のみで本文化できず。

---

## 出典一覧

### 本文を読んだもの [n]

| # | サイト | URL | 取った要旨 |
|---|---|---|---|
| 1 | FD Ricambi | https://www.fdricambi.com/en/vb1101-gearbox-stradale-5-speed-conversion-kit/ | €726・適合一覧・取説 PDF/動画・部品内訳なし |
| 2 | D'Angelo Motori | https://www.dangelomotori.it/prodotto/kit-trasformazione-cambio-5-marce-con-3-e-4-corta-per-fiat-500-126/ | D3882 €1,650 税別・構成・「どの排気量にも」 |
| 3 | D'Angelo Motori | https://www.dangelomotori.it/prodotto/kit-5-marcia-35-26-standard-stradale-per-fiat-500-f-l-r-e-126-depoca/ | €419 税別・後部だけ外す・長距離向け |
| 4 | D'Angelo Motori | https://www.dangelomotori.it/prodotto/kit-5-marcia-25-22-per-fiat-500-f-l-r-e-126-depoca-2/ | 25/22 €450 税別 |
| 5 | D'Angelo Motori | https://www.dangelomotori.it/prodotto/cambio-sincronizzato-completo-a-5-marce-per-fiat-500-f-l-r-e-fiat-126-motore-126/ | D3162 €2,418 税別・歯数・126 ベル |
| 6 | Bacci Romano（PDF） | https://www.bacciromano.com/_files/uploads/fiat_500_kit_montaggio_5_rce04.pdf | RCE04 組付け手順12項・部品表・5 kgm・φ7 穴・2速フォーク面取り |
| 7 | Bacci Romano | https://www.bacciromano.com/en/products/products/vintage-car/fiat/126/ | RCE03 クロス比・RCE04・KE002・KE009 |
| 8 | fuxricambi | https://www.fuxricambi.it/cambio-e-trasmissione/3209-kit-5-marce-ravvicinato-sfilabile-sincronizzato-fiat-500-126 | €1,220・12/39・19/27・22/24・25/22 |
| 9 | 500automotor | https://500automotor.com/prodotto/cambio-ravvicinato-per-fiat-500-e-fiat-126-5-pezzi-sincronizzato-5-marcia/ | M184 €1,190・5速比の選択肢 |
| 10 | 500automotor | https://500automotor.com/prodotto/kit-5-marcia-35-26-per-fiat-500-e-126/ | M181 €580・ヘリカル |
| 11 | 500automotor | https://500automotor.com/prodotto/kit-5-marcia-25-20-25-21-25-22-24-22-24-21-23-19-ed-anche-su-misura-per-fiat-500-e-126/ | M182 直歯・比一覧 |
| 12 | 5-A.nrw | https://www.5-a.nrw/5-gang-getriebe-fiat-126-500r | 再生箱 €2,419・0.743・−650 rpm・短軸/長軸 |
| 13 | abarth-online.de | https://www.abarth-online.de/500-005 | €1,190 |
| 14 | wum-autoteile | https://shop.wum-autoteile.de/5-Gang-Getriebe-Umbausatz-Fiat-500-126-5-speed-conversion-kit | €830・「Rennsportartikel ohne Gutachten」 |
| 15 | MrFiat | https://mrfiat.com/fiat-500-5-speed-conversion-kit.html | $1,170・35/26 |
| 16 | teilezentrale | https://www.teilezentrale.de/en/gearbox-5-fiat-500-126.html | 完成箱 €2,100・全歯数・0.703 は 35 hp 以上平坦路 |
| 17 | ricambio.co.uk | https://www.ricambio.co.uk/products/5th-gear-conversion-kit-classic-fiat-500-126 | £1,194・35/26・入荷待ち |
| 18 | fiat500sport | https://www.fiat500sport.com/prodotto/ingranaggi-5-marcia-corta-rapporto-40-33-coppia/ | 40/33 €190・+300 rpm |
| 19 | fiat500sport | https://www.fiat500sport.com/prodotto/ingranaggi-5-marcia-lunga-rapporto-42-31/ | 42/31 €190・+800 rpm |
| 20 | fiat500sport | https://www.fiat500sport.com/en/product/fiat-500-gearbox-kit-5-speed-with-gaskets/ | NANNI 0110A €597 |
| 21 | Monteferri | https://www.ingranaggimonteferri.it/fiat-storiche | Z36/Z26・Z25/Z22・構成 |
| 22 | dmdautomotors | https://dmdautomotors.com/products/kit-5-marcia-per-fiat-500-126-ad-innesto-frontale-35-26 | €599・「簡単」 |
| 23 | 500line | https://www.500line.it/products/kit-quinta-marcia-35-26-per-fiat-500-e-126-alta-qualita | €549・全分解不要 |
| 24 | nonsoloricambidepoca | https://www.nonsoloricambidepoca.it/en-us/fiat-500-126-fifth-gear-change-kit-with-35-26-ratio-1401/ | €695.58・Julcar 同文 |
| 25 | Lucar500 | https://lucar500.it/prodotto/kit-modifica-cambio-quinta-marcia-con-rapporto-35-26-fiat-500-126/ | €499 |
| 26 | SVK500 d'epoca | https://www.svk500depoca.it/prodotto/meccanica/motore/kit-modifica-cambio-quinta-marcia-con-rapporto-35-26-fiat | €645 税込・街乗り長距離向け |
| 27 | PicClick（eBay fuxxelaborazioni 転載） | https://picclick.it/KIT-QUINTA-MARCIA-FIAT-500-126-bacci-122664453662.html | Bacci 35/26 €578・シンクロ不問・+800 rpm・保証1年 |
| 28 | maf500 | https://www.maf500.com/3195/Kit-Modifica-Cambio-Quinta-Marcia-Con-Rapporto-Medio-Fiat-500-126 | MT046M・価格なし |
| 29 | fiatforum | https://www.fiatforum.com/threads/5-speed.420736/ | Damon500 の推奨・加工項目・ケース凹み・取説 |
| 30 | fiatforum | https://www.fiatforum.com/threads/5-speed.420736/page-2 | ゲート・ロックアウト・ハブ逆組・£350 vs 100%・店評 |
| 31 | fiatforum | https://www.fiatforum.com/threads/5-speed.420736/page-3 | ロックアウト切除の手順・完成 |
| 32 | fiatforum（126） | https://www.fiatforum.com/threads/5th-gear-transmission-addition.442648/ | 「total headache」・加工一覧・70 mph 低回転・燃費 |
| 33 | fiatforum | https://www.fiatforum.com/threads/gearbox-final-drive-ratios.433578/ | 9/39・Nanni 10年・「9/39 最低・5速も」 |
| 34 | fiatforum | https://www.fiatforum.com/threads/gearbox-conversion-kits-crash-to-synchro.471951/ | シンクロ化キット無し・126 シャフト長い |
| 35 | fiatforum | https://www.fiatforum.com/threads/nanni-5-speed-gear-selection-problem.501329/ | 5速不入・lollipop・プランジャー・巡航専用 |
| 36 | fiatforum（2026-01） | https://www.fiatforum.com/threads/5-speed-transmission-upgrade.521503/ | 片持ち軸・Castle-Miller・10年反論・126 デフ代替・MrFiat 評 |
| 37 | fiatforum | https://www.fiatforum.com/threads/cruising-speed.487480/ | 14.1 mph/1000・62 mph@4000・6000 rpm 警告 |
| 38 | fiatforum | https://www.fiatforum.com/threads/now-fast-does-your-500-go-state-engine-size-tuning.354066/ | Damon500 85 mph・70 mph 巡航 |
| 39 | fiatforum（2024） | https://www.fiatforum.com/threads/high-final-drive.507293/ | 9/39 で5速回避・Gerstl €409・比の上げすぎ警告 |
| 40 | 500forum.it（1ページ目のみ可読） | https://www.500forum.it/forum/viewtopic.php?t=23644 | Bacci on 126 箱・3 mm スライダー・Febo の助言・8/41 と 126 ピニオン非互換 |
| 41 | みんカラ GARA500 | https://minkara.carview.co.jp/userid/2560392/car/2112446/4279160/note.aspx | 500F 5速化（2017）・削り量 21/22.5 mm・φ7・16→13 cm・不可逆 |
| 42 | みんカラ GARA500 | https://minkara.carview.co.jp/userid/2560392/car/2112446/4278499/note.aspx | シンクロ史（5速の記述なし） |
| 43 | みんカラ GARA500 | https://minkara.carview.co.jp/userid/2560392/car/2112446/4278720/note.aspx | ファイナル比表 8/41・8/39・9/39・10/37・11/36 |
| 44 | Gozzoli | https://www.autotrasformazionigozzoli.com/fiat-500-elaborazione.html | ミッション再生・特注比（5速の具体なし） |

### 抜粋しか読めなかったもの [Sn]

| # | サイト | URL | 状態 | 取った要旨 |
|---|---|---|---|---|
| S1 | Axel Gerstl | https://webshop.fiat500126.com/de/tuning/getriebe/5-gang-umbausatz-stradale | 403（Playwright も 403） | 35/26 万能・他の比は要相談 |
| S2 | Julcar | https://euroitalia500-commerce.it/index.php?id_product=1610&controller=product | HTTP 500 | €408.20・3 mm スライダー・セレクター仕様・別売 €69.67 |
| S3 | eBay PBP Klaudia Lorens | https://www.ebay.com/itm/235206836430 | 403（.de も） | EUR 580・在庫10+・9個販売・Brivio |
| S4 | 500forum.de | https://www.500forum.de/index.php/Thread/8394-Erfahrungen-5-Gang-Getriebe/（3ページ）＋ Thread/37379 | socket hang up／HTTP2 エラー | 50,000 km・同じ軸受・Gozzoli 43,550→98,191 km・プロ組付け・Gozzoli/Bruno Vecchio・費用 €600/€1,000+ |
| S5 | 500forum.de | https://www.500forum.de/index.php/Thread/34289-5-Gang-Umbausatz-Stradale-Fiat-500-126/ ＋ Thread/31915 | 同上 | 合わない・ベル/フォーク/ウォーム加工・旋盤・30年 |
| S6 | 500forum.de | https://www.500forum.de/index.php/Thread/44175-Unterschiedliche-5-Gang-Getriebe/ | 同上 | Bacci 最多・Lavazza 3軸受・Nanni 軸交換・Bacci 25年・Lavazza 2倍超 |
| S7 | 500forum.de | https://www.500forum.de/index.php/Thread/32269-Bis-%C3%9Cbersetzung-oder-5-Gang/ | 同上 | BIS＝貧者の5速・40 PS から・山は辛い |
| S8 | 500forum.de | https://www.500forum.de/index.php/Thread/36725-Langer-5-er-Gang/ ＋ Thread/10103 | 同上 | 35×26 は近すぎ・27×19・−300 rpm・跳び 1200 vs 800 |
| S9 | 500forum.de | Thread/24608（5. Gang kratzt）・Thread/29714・Thread/35057 | 同上 | 2速フォーク干渉・Bacci ロッド穴位置・2速異音 |
| S10 | 500forum.de | https://www.500forum.de/index.php/Thread/33022-5-Gang-Gear-Bacci-Powered-by-Fiatos/ | 同上 | Bacci €850（Fiatos 経由）vs €1,200・30年以上 |
| S11 | 500forum.de | https://www.500forum.de/index.php/Thread/30069-Aufgesetzter-5-Gang/ | 同上 | 上軸の軸方向保持・カバーが軸受を挟む・2 mm ドリル |
| S12 | maluch-forum.de／126forum.de | https://www.maluch-forum.de/Fiat-126/11430-5-gang-getriebe.html ・ https://126forum.de/Fiat-126/11450-5-gang-getriebe.html | socket hang up | €1,000 未満に P&P 無し・2011年から無事・€597 キット 10% 長い・同じ軸受 |
| S13 | 500forum.it | https://www.500forum.it/forum/viewtopic.php?t=20135（5ページ） | ログイン壁 | +26 km/h・−1000 rpm・ヘリカル静か・a sbalzo vs Lavazza・0.5 mm シム |
| S14 | 500forum.it | https://www.500forum.it/forum/viewtopic.php?t=13389（共同購入・30ページ） | ログイン壁 | Monteferri €550→440・Bacci €450・軸受支持・Lavazza/Bacci の評価 |
| S15 | 500forum.it | https://www.500forum.it/forum/viewtopic.php?t=22120 ・ t=561 | ログイン壁 | キット €300＋工賃 €120＋tripla/軸受 €200・ガタ 0.5 mm |
| S16 | ricambio.co.uk（検索抜粋） | https://www.ricambio.co.uk/5th-gear-conversion-kit-classic-fiat-500-126 | 抜粋 | £995（ページは £1,194）・短縮カップリング別売 |
| S17 | 500forum.de（油量） | https://www.500forum.de/index.php/Thread/23127-Getriebe%C3%B6l-126-Getriebe/ | 抜粋 | 126 箱 1.1 L・80W/90・GL-4 |
| S18 | fiatforum（検索抜粋・スレ特定できず） | https://www.fiatforum.com/threads/5-speed.420736/ 周辺 | 抜粋 | 「Nanni だけ 500/126 でキットを分けるのはメインシャフト同梱のため」「5速はドッグクラッチ噛合」 |

### 読めず・使わなかったもの
- YouTube「Fiat 500, 126 - 5 speed gearbox inner workings and rebuild」（説明文が取れず）／FD Ricambi の取説 PDF（リンク先未取得）／forum.elaborare.com（403）／eBay.co.uk 353149303757（403）／Julcar トップ（5速の商品が見えず）／FLATOUT ブログ（5速記事なし）／日本のショップ（vehiclefield＝国産エンジン載せ替えの話で対象外）。
