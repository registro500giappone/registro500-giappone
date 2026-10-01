# 空冷 FIAT 500 / 126「10 インチ化」調査（2026-09-20）

> 目的：エンジン妄想シミュレーター第2弾「ミッション・タイヤ編」に **10 インチホイール**の選択肢を入れるための数値（外径→回転数）と、乗り味・注意点を集める。12・13 インチは `drive_final_tire_research.md` §3 で調査済＝ここでは **10 インチだけ**。
> 方法：WebSearch＋WebFetch（英・伊・独・日）。**本文を実際に読めたもの＝[n]、検索結果の抜粋しか読めなかったもの＝[Sn]** で区別。
> 対象店：Axel Gerstl（webshop.fiat500126.com）／FD Ricambi／Julcar（shop.euroitalia500.it）／D'Angelo Motori／PBP Klaudia Lorens（eBay）を優先。他に fiat500sport（NANNI）・500ricambi・Capasso・abarth-andronico・abarth-online.de（Scuderia Topolino）・autobelle・Mini 用タイヤ店（Blockley・Mini Sport・Pneuservice Italia・フジコーポレーション）。
> ⚠️ **読めなかった壁**：Gerstl は**前回同様に全ページ 403**。500forum.it は**ログイン壁**（10 インチのスレが5本あるのに1本しか読めず）。500forum.de は**6回とも socket hang up**（10 Zoll スレが6本ある）。Capasso・ricambauto・Pit Stop Racing・classicdriver・FIA 歴史DB は 403。500clubitalia は 404。詳細は §7。
> 外径＝**リム径 254.0mm＋2×（幅×扁平率）で算出**（表記「算出」）。基準＝純正 125/80R12＝504.8mm（前回レポート §3-1 と同じ式）。

---

## 1. 売られている 10 インチホイール

### 1-1. 優先5店の実態

| 店 | 10 インチの有無 | 内容 | 出典 |
|---|---|---|---|
| **D'Angelo Motori** | **あり（4×190 と 4×98 の両方）** | 「cerchi scomponibili 10 e 12 pollici」カテゴリに **10 インチ 4×190（€819.68 税別）**・10 インチ 4×98（€819.68 税別）・10 インチ 4×98 競技用（€1,049.18 税別）の3種。12 インチ分解式も同カテゴリ | [4][5][6] |
| Axel Gerstl | **不明（403）** | 検索抜粋に「Gerstl が大 PCD の 10 インチ鉄ホイールを扱う・4×190 の TÜV 証明あり」との独フォーラム要約があるが**本文未確認** | [S4][S14] |
| FD Ricambi | **なし** | 500 L のホイール・タイヤ一覧を読了＝12 インチのみ（Mille Miglia・Grifo・CMR 4.5×12・鉄 3.5×12）。「No 10-inch wheels or tyres」 | [16] |
| Julcar | **見つからず** | 検索でヒットなし（前回同様カテゴリページは読めない） | — |
| PBP Klaudia Lorens | **見つからず** | eBay 店の検索でヒットなし（12 インチ Mille Miglia 5×12 4×190 の出品は別売主） | — |

### 1-2. D'Angelo の 10 インチ（唯一「4×190 のまま履ける」新品）

- **「Serie cerchi in acciaio lucidato a specchio scomponibili 10 pollici attacco 4×190」**＝鏡面研磨スチール・センターフランジはアルミ・**5 インチ幅（内 3＋外 2）**・「per fiat 500 f-l-r e 126」・**€819.68（税別）**。ET・タイヤ推奨・ドラムとの干渉の記述は**なし** [5]。
- 4×98 競技用＝高張力鋼3ピース・**前 7 インチ（3+4）／後 8 インチ（4+4）**・€1,049.18 税別・「massima stabilità in curva e tenuta su pista」＝街乗り向けではない [6]。
- 同店に**「10 インチホイール用」前ディスクブレーキキット**（mono-pompante・ハブ 4×190・500 のナックル用・**€613.93 税別**・ピストン径 48mm・ベアリング込み・**トレッド +3mm**）と4ポット版がある＝**10 インチはディスク化するとキャリパーが当たるので専用キットが要る**という店側の前提 [7]。

### 1-3. 他店

- **NANNI（fiat500sport）**：「Cerchio ruota Fiat 500 Fiat 126, NANNI Ø 10 pollici componibile in lega」＝軽合金の分解式・**幅 4／5／6／7／8 インチ**から注文時に指定・**PCD 98mm（126 用）**・フランジは anticorodal 合金・ボルト付き・**€199.50（定価 €400.00 から値引き・1本）**。ET・タイヤ推奨・4×190 用アダプターの記述なし [1][2]。⚠️**500 に履くには 126（後期）ハブ化が前提**（§4-2）。
- **abarth-andronico**（当時物の在庫ページ）：Abarth 純正・BWA・Cromodora・OZ・Personal の 10 インチを **4½・5・5½ インチ幅**で掲載。「campanatura verso l'esterno adatto a 695 SS assetto corsa」の記述あり。価格・PCD・タイヤ記述なし [3]。
- **autobelle（個人売買）**：Albarelli 製 **4,5×10** 復元品「monatno su Fiat Abarth 695 SS assetto corsa, su 595 e 500 con parafanghi」／Albarelli 10 インチ €600「utilizzati sulla fiat 595/695 anni 60」／10 インチ完組 €800「per fiat 500 abarth anni 60/70」 [18]。抜粋には「4 cerchi sportivi dell'epoca da 10 pollici per fiat 500 **attacco 4×190** a euro 600」も [S5]。
- **Facebook グループ**：「Cerchi 10 pollici per 500 **foratura 4×190** 250€ + ss」（本文未読） [S11]。
- **Capasso Ricambi**：「CERCHIO LEGA RUOTA DA 10 POLLICI 500」と「CERCHIO 5×10 LEGA RUOTA DA 10 POLLICI MINI」の2商品が存在（403 で仕様・価格は読めず） [S12]。
- **Pit Stop Racing**：「1 cerchio Fiat 500 Abarth 10 pollici da restaurare originale」（403） [S13]。
- **500ricambi**：一覧を読了＝**10 インチなし**（3.5×12 鉄・4.5×12 アルミのみ） [17]。
- **abarth-online.de（Scuderia Topolino）**：リム一覧を読了＝12・13 インチのみ・**10 インチなし** [28]。
- **Mini 用 Cromodora/Minilite の流用**：独フォーラム抜粋「Mini 用 Cromodora の 10 インチ Abarth アルミは 500 にも似合う（**PCD を切削加工**）」「10 インチの鉄ホイールは希少で高い」 [S1]。伊フォーラム抜粋：Mini の 4×101.6 を 126 ハブ（4×98）に付けるには**穴を追加して M10 スタッド**か **M12×1.5 で直接**、または**フランジ式アダプター（片側トレッド +1.5cm）** [S9]。⚠️いずれも本文未読。

### 1-4. PCD の壁（10 インチ選びの根本）

- 500 のハブ＝**4×190**、126 後期＝**4×98**。「4×190 の 10 インチは見つけにくい。NANNI と D'Angelo に 4×190 の選択肢がある」（Goldnrust）[8]。
- 4×190 ドラムに 4×98 ホイールを付けるアダプターは「**市販品なし**」＝凹形に作らないと元のドラム固定ボルトに当たり、しかも**トレッドが大きく広がってアーチに当たる**（the hobbler）。代案＝**126 系のドラムに丸ごと替える**（cinque500）[10]。
- 逆向き（**126 ハブに 4×190 の純正ホイール**）のアダプターは市販あり＝鋼・**厚さ 8mm**・€96・「carreggiata の拡大をスペーサー相当として考慮せよ」[27]。

---

## 2. 10 インチで使われるタイヤ（Mini 用の流通）

| サイズ | 外径 mm（算出） | 125/80R12 比 | 入手性・実例 | 出典 |
|---|---|---|---|---|
| **145/80R10（145R10）** | 486.0 | **−3.7%** | Mini 純正（1959〜84・3.5J）。Nankang TR10 $55・Blockley・Camac・Dunlop [21]。Blockley 抜粋「145R10 の外径 19.3 インチ」[S22]。fiat500nelmondo「**145/80 on 10" rim ＝ 過去の Fiat 500 Abarth の型式承認を援用**」[14] | [14][21][S22] |
| **165/70R10** | 485.0 | **−3.9%** | **最も流通**（Nankang ECO-2 $72・Blockley・Dunlop R7・Aquajet・Avon CR6ZZ・Yokohama A008/A032R・Falken FK07E）[21]。Blockley 実測 **494mm**・推奨リム 5"・72T [20]。Pneuservice Italia Nankang €61・「cerchio da 4.5 pollici」[19]。日本＝フジコーポレーション 10 インチに DUNLOP SP4 ¥12,600〜・YOKOHAMA ADVAN HF Type D・A032R [26] | [19][20][21][26] |
| 145/70R10 | 457.0 | **−9.5%** | Blockley に radial あり（5.20×10 の radial 相当）[S15]。伊フォーラム抜粋「165/70/10 や 145/80/10 は簡単に見つかるが **145/70/10 は探しにくい**」[S6] | [S6][S15] |
| 155/70R10 | 471.0 | −6.7% | 独フォーラム抜粋に「165/70・155/70・145/70 の選択肢」とあるだけ [S2]。販売ページ見つからず | [S2] |
| 135R10 | 470.0 | −6.9% | 販売ページ・実例とも**見つからず** | — |
| 165/60R10 | 452.0 | −10.5% | fiat500nelmondo の「調査に出た大きいサイズ」に **165/60/10** の記載 [14]。**Mini 用の販売は見つからず**（検索は全部 165/60R12 に化ける） | [14] |
| 175/60R10 | 464.0 | −8.1% | **見つからず** | — |
| 175/50R10 | 429.0 | −15.0% | **見つからず**（A048R は 175/50R13 のみ） | — |

- **リム幅の対応（Mini 界隈の定説）**：5J が「best bet」・「5 or 5.5 でタイヤメーカー推奨内」・**5"×10 に 165/70×10 Yoko/Falken**・6J はサーキット用・4.5J（Minilite 純正幅）はオフセット次第でアーチ延長不要 [22]。165/70-10 は「サスが万全で、たいてい小さなフレアが要る」・6J は「ほぼ必ずボディ加工＋フレア」[23]。
- Falken の Mini 用は**在庫切れ（廃番？）**の報告あり（2025-09）[S15]。

---

## 3. Abarth の史実（10 インチは「競技仕様のオプション」）

- **595 SS の純正は 12 インチ鉄ホイール**。「Many 595 SS cars were upgraded to the cast wheels used on the 695 SS」＝10 インチの記述は**一切なし** [13]。
- 500forum.it の諸元まとめ（読めた）：**「Diam.cerchio: 12" pollici」幅「3"1/2 - 4"1/2 pollici」・「Diam.pneumatici: 125x12"」**＝595・595 SS・695・695 SS 共通。**Campagnolo Abarth 合金は「£. 2.500 lire cadauna」のオプション**。Assetto Corsa は前トレッド 1161mm（標準 1121mm） [12]。
- Campagnolo 5×10 スレ（読めた部分）：**原品はマグネシウム合金**・Abarth の標準は鉄で Campagnolo はオプション・2011 時点で原品 1本 €800 前後・Vescio の復刻 €1,500 前後・**「競技用は前が後ろより細い」2タイプ**・マグは「delicatissimo」で割れた報告あり＝展示か競技専用 [11]。
- fiatforum：**「Abarth did offer 10 inch wheels as an option on some of the Assetto Corsa models but they would have run with drums」** [9]。
- 検索抜粋（出典ページ不確定・500forum.it 系）：「**695 SS assetto corsa だけが 10 インチ（Campagnolo 合金または鉄）を履いたが、競技専用で公道の型式承認は無い**」「Abarth 全車の純正は鉄板、Campagnolo マグはオプションで1本約 25,000 リラ」 [S10]。
- classicdriver（403・抜粋のみ）：695 SS Assetto Corsa は「fender flares that accommodated wider Elektron magnesium wheels」 [S16]。
- virgilio の歴史記事：「Per la prima volta compaiono accessori a richiesta: cerchi in lega, …」＝合金ホイールがオプションだったことだけ [30]。
- FIA 歴史DB の 695 SS ホモロゲ票は **403 で読めず**＝**「10 インチが公式に認められた寸法か」は一次資料で確認できていない**（§7）。

> 結論：**公道仕様の 595/695 は 12 インチ**（鉄 3.5〜4.5J・Campagnolo 合金はオプション）。**10 インチは 695 SS Assetto Corsa の競技用オプション（ドラムのまま）**＝「Abarth 風」の 10 インチはこの競技車の姿を真似たもの。⛔「Abarth 純正は 10 インチ」とは書かない。

---

## 4. 乗り味・注意点

### 4-1. 外径→回転数・メーター・車高

- **165/70R10 と純正 12 インチの外径差は 17mm**（fiatforum 抜粋。算出では 19.8mm）＝「大差ではない。しかもタイヤの選択肢が Mini と同じで格段に広い」 [S7][9]。
- 「10 インチの低扁平は**ギアが短くなりメーターも狂う**」（Goldnrust）・「メーターを合わせるには転がり周長を保て」 [8]。
- **車高＝外径差の半分だけ下がる**（算出）：145/80R10・165/70R10 で約 **10mm**、145/70R10 で約 **24mm**、165/60R10 で約 **26mm**。競技車が 10 インチを使う理由＝「軽いホイール・ステアリングの直接感・**リアのサスを幾何が狂うほど下げずに車高を落とせる**」 [S19→[8] 同スレ]。
- 12 インチ側の類推（前回 [23]）：60 扁平は「アーチ余裕 1.3cm 増・地上高 1.3cm 減・メーターがかなり低く読む」。

### 4-2. 干渉（ドラム・キャリパー・フェンダー）

- **純正ドラムなら 10 インチは問題なし**（「I believe there is no issue with fitting 10" wheels with the standard drums」）。ディスク化は「合うものと合わないものがある」 [8]。
- ディスク＋10 インチの自作例＝Citroën GS 後輪ディスク＋Ducati Paso 903 キャリパー＋ワンオフハブで**リム内側の余裕 3mm**。既製キットは高価・自作で約 £300 [9]。→ D'Angelo に「10 インチ用」ディスクキットが別売されているのが裏付け [7]。
- フェンダー：伊フォーラム抜粋「**165/70 は 4.5 インチ幅に履けるがフェンダーに当たりうる**」「**10×5 に 165/70 R10 で、純正フェンダーの縁を折り込んで（bordi ribattuti）収まった**」「**ET で収まりが大きく変わる**」「以前フェンダーを叩いた苦い経験があり、10 インチ低扁平で逃げたい人もいる」 [S6]。当時物の 4.5×10 Albarelli は「**500 con parafanghi**（オーバーフェンダー付き）に」と売主が書く [18]。
- Mini 側の定説（幅 5J・165/70）＝「小さなフレアがたいてい要る」 [23]。

### 4-3. 乗り心地・操縦性

- 「小径＋高扁平はサイドウォールがたわみ**乗り心地が良くなる**。大径＋低扁平は**応答と操縦性が上がる代わりに硬い**」（Bugsymike）[8]。
- 「競技の 500 は 10 インチ＋低扁平スリック。**街乗りに向く低扁平の 10 インチは選択肢がない**」（Goldnrust）[8]＝街乗りの現実解は 145/80R10 か 165/70R10（扁平 70〜80）。
- Mini の 7J 幅は「group 5 アーチが要る・トルクステアで運転が苦痛」＝**幅は 5J が実用上の上限**という空気 [22]。
- 見た目：「10 インチにチャンキーなタイヤの姿」を複数が称賛 [8]。

### 4-4. 型式承認・保険

- fiat500nelmondo：**型式承認上はリム幅 3.5 インチが「10 でも 12 でも」条件**・145/80×10 は過去の Abarth の承認を援用できるという整理（イタリアの話） [14]。
- UK は保険会社への申告が要る・ギリシャは不要（フォーラム内の各国談） [8]。
- 独：TÜV の話題はフォーラム抜粋にあるが本文未読 [S1][S4]。

---

## 5. 日本での実例

- **カーセンサー**（読了）：①**500 L 1966年**「650cc エンジン・シンクロミッション・**10インチホイール**・レザートップ・ビンテージ・オイルパン・カットオフスイッチ・momo ステアリング・ETC」＝ウイングオート オールドタイマー（愛知）・車検整備別・応談 ②**500 1997年登録（H09）**「10インチホイール」＝ZOOM co., LTD（神奈川）・**車検 2027(R09)年09月まで**・応談 [24]。→ **10 インチのまま車検が通っている個体が最低1台ある**（②）。ただしタイヤサイズ・PCD・ホイール銘柄の記載なし。
- **価格.com**（読了）：同じ 1966 500 L の掲載＝「650cc エンジン・シンクロミッション・10インチホイール…」 [25]。検索抜粋には「**希少な Campagnolo の 10 インチ**を履いたレストア車」の掲載もあるが**本文で見つけられず** [S17]。
- **みんカラ・ブログ**：旧 500 の 10 インチ換装の記事は**見つからず**（検索は現行 500 ばかり）。Nuova Cinquecentista（nuova500.net）には**オーバーフェンダー車で舵角を大きく切るとタイヤが干渉する**記事があるが 10 インチの話ではない。
- **国内販売店**：10 インチホイールの商品ページは**見つからず**（フラワーパーツ・オンタリオSS・STANDARD SPEED は検索でヒットするが 10 インチの記載なし）。
- **国内のタイヤ**：165/70R10 はフジコーポレーションに DUNLOP SP4（¥12,600〜）・YOKOHAMA ADVAN HF Type D・A032R [26]＝**Mini 用の流通に乗れる**。
- **車検の議論**（はみ出し・メーター誤差）は**見つからず**。

---

## 6. ⭐ シミュレーターに入れる用の表

| id 案 | サイズ | 外径 mm（算出） | 125/80R12 比 | 実例の有無 | 店（ホイール／タイヤ） | 出典 |
|---|---|---|---|---|---|---|
| `t_145_80_10` | 145/80R10 | 486.0 | **−3.7%** | ○ Mini 純正サイズ・伊「Abarth の承認を援用」 | D'Angelo 4×190 5J／Nankang・Blockley・Camac | [5][14][21] |
| `t_165_70_10` | 165/70R10 | 485.0 | **−3.9%** | ◎ **10×5 に履いた実例（縁折り込み）**・最流通 | D'Angelo 4×190 5J・NANNI 4×98／Nankang・Yokohama・Dunlop・Falken・国内フジ | [5][1][20][21][26][S6] |
| `t_145_70_10` | 145/70R10 | 457.0 | −9.5% | △ 「探しにくい」・Blockley にあり | —／Blockley | [S6][S15] |
| `t_155_70_10` | 155/70R10 | 471.0 | −6.7% | △ 独フォーラムの選択肢に名前のみ | 販売ページ見つからず | [S2] |
| `t_165_60_10` | 165/60R10 | 452.0 | −10.5% | × 伊記事に名前のみ・販売見つからず | — | [14] |
| （参考）`t_135_10` | 135R10 | 470.0 | −6.9% | × 見つからず | — | — |
| （参考）`t_175_60_10`／`t_175_50_10` | 175/60R10／175/50R10 | 464.0／429.0 | −8.1%／−15.0% | × 見つからず | — | — |

> 提案：シミュレーターに入れるのは **145/80R10 と 165/70R10 の2つ**（どちらも −4% 弱＝「1段の 1/4」程度・回転数は約 +4%）。**両者の外径差は 1mm**＝回転数の差は出ないので、UI では「10 インチ（145/80 or 165/70）」1枠にまとめてもよい。145/70R10・165/60R10 は「−10%＝実例なし・入手難」として注記付き別枠か、出さない。⚠️実測値（Blockley 494mm [20]）は算出（485mm）より 9mm 大きい＝**外径は算出で統一し、注記で「実測は数 mm 大きい」と断る**（12 インチ側と同じ扱い）。
> ホイール側の前提＝**4×190 のまま履けるのは D'Angelo の 10×5J（€819.68 税別）だけ**（新品）。NANNI・Mini 用流用は **126 ハブ化（4×98）が前提**。

---

## 7. 出典一覧

### 本文を読めたもの
| # | URL | サイト | 要旨 |
|---|---|---|---|
| [1] | https://www.fiat500sport.com/prodotto/cerchio-ruota-fiat-500-126-nanni-o-10-pollici-componibile-in-lega-con-attacco-fiat-interasse-bulloni-ruota-98-mm-larghezze-4-5-6-7-8-pollici/ | fiat500sport（NANNI） | 10" 分解式合金・幅 4〜8"・PCD 98・€199.50 |
| [2] | https://www.fiat500sport.com/en/product/fiat-500-10-nanni-modular-light-alloy-wheel4-5-6-7-8-inches/ | 同 EN | Art. 0076・ET/PCD 記載なし |
| [3] | http://www.abarth-andronico.com/10pollici.asp | abarth-andronico | 当時物 10" 在庫（4½・5・5½）・695 SS assetto corsa |
| [4] | https://www.dangelomotori.it/product-category/cerchi-e-accessori/cerchi-scomponibili-10-e-12-pollici/ | D'Angelo | 10/12" 分解式5種と価格 |
| [5] | https://www.dangelomotori.it/en/product/alloy-wheels-in-stainless-steel-10-inches-decomposable-attachment-4x190/ | D'Angelo | 10" 4×190・5J（3+2）・€819.68 税別 |
| [6] | https://www.dangelomotori.it/prodotto/cerchi-in-acciaio-scomponibili-lucidati-a-specchio-10-attacco-4x98-per-fiat-500-126-da-corsa/ | D'Angelo | 10" 4×98 競技用・前 7J 後 8J・€1,049.18 |
| [7] | https://www.dangelomotori.it/prodotto/kit-freni-a-disco-anteriori-per-cerchio-10-pollici-mono-pompante-mozzo-4x190-per-fusello-500/ | D'Angelo | 10" 用ディスクキット・€613.93・トレッド +3mm |
| [8] | https://www.fiatforum.com/threads/10-rims-installation-how-to.497493/ | fiatforum | 4×190 は NANNI/D'Angelo・ドラムは問題なし・乗り心地・メーター |
| [9] | https://www.fiatforum.com/threads/disc-brakes-possible-with-10-wheels.302448/ | fiatforum | Assetto Corsa の 10" はドラム・自作ディスク余裕 3mm・165/70/10 |
| [10] | https://www.fiatforum.com/threads/4x190-4x98-adapter.521981/ | fiatforum | 4×190→4×98 アダプターは市販なし・トレッド拡大 |
| [11] | https://www.500forum.it/forum/viewtopic.php?f=52&t=11700 | 500forum.it | Campagnolo 5×10 はマグ・オプション・前後幅違いの競技型・割れる |
| [12] | https://www.500forum.it/forum/viewtopic.php?t=129 | 500forum.it | Abarth 595/695 諸元＝12" 3½〜4½・125×12・Campagnolo £2,500 |
| [13] | https://classicregister.com/guides/info-guide-1964-1971-fiat-abarth-595-esse-esse-ss | Classic Register | 595 SS は 12" 鉄・10" の記述なし |
| [14] | https://www.fiat500nelmondo.it/elaborare-una-fiat-500-in-una-supercar-oggi-parliamo-degli-pneumatici/ | fiat500nelmondo | 145/80×10 は Abarth 承認援用・165/60/10 の名・リム 3.5" 条件 |
| [15] | https://www.longstonegomme.it/pneumatici-auto-da-collezione/fiat/500.html | Longstone IT | 125R12 のみ・10" 記述なし |
| [16] | https://www.fdricambi.com/en/fiat-500-l/wheels-tires/ | FD Ricambi | 12" のみ・10" なし |
| [17] | https://www.500ricambi.it/Catalog/9/CERCHI-ACCESSORI/?page=2 | 500ricambi | 12" のみ・10" なし |
| [18] | https://www.autobelle.it/it/ricerca.xhtml?query=cerchi+10+pollici&command=ricerca | autobelle | Albarelli 4,5×10・€600／完組 €800 |
| [19] | https://www.pneuserviceitalia.com/prodotti/pneumatico-165-70-r10-72h-gomme-specifiche-per-mini-cooper-cooper-s-e-1275-gt-epoca/ | Pneuservice Italia | Nankang 165/70R10 €61・リム 4.5" |
| [20] | https://www.blockleytyre.com/product/165-70r10 | Blockley | 外径 494mm・リム 5"・72T・£63 |
| [21] | https://usa.minisport.com/mini-tuning-and-styling/mini-wheels-and-tyres/mini-10-tyres.html | Mini Sport USA | 10" タイヤの銘柄と価格（165/70R10・145/80R10・145R10） |
| [22] | https://www.pistonheads.com/gassing/topic.asp?t=298183 | PistonHeads | Mini 10" のリム幅の定説（5J・165/70） |
| [23] | https://classicmini.wordpress.com/2016/04/27/wheels-and-tires-what-fits-a-classic-mini/ | classicmini blog | 165/70-10 は小フレア・6J はボディ加工 |
| [24] | https://www.carsensor.net/usedcar/freeword/フィアット500+650cc/index.html | カーセンサー | 10 インチ掲載2台（車検 2027-09 の個体あり） |
| [25] | https://kakaku.com/kuruma/used/spec/Maker=32/Model=31077/Sort=u4/ | 価格.com | 500 L 1966 の 10 インチ掲載 |
| [26] | https://www.fujicorporation.com/shop/tire/list?season=0&inch=10&tc_prf=70&tc_wi=165&ttype=1 | フジコーポレーション | 165/70R10 国内価格 |
| [27] | https://picclick.it/Adattatori-Cerchi-Ruote-Fiat-500-126-Da-4X98-115081083562.html | picclick | 126 ハブ→4×190 アダプター 8mm €96 |
| [28] | https://www.abarth-online.de/Fiat-500-/Abarth/-Giannini/en/rims | Scuderia Topolino | 12/13" のみ |
| [29] | https://www.fiat500nelmondo.it/rivivi-la-storia-della-corsa-con-la-nuova-abarth-695-ss-in-miniatura/ | fiat500nelmondo | 模型の「CERCHI IN LEGA CAMPAGNOLO」のみ |
| [30] | https://www.virgilio.it/motori/auto-epoca/abarth-595-695-storia/290670/ | virgilio | 合金ホイールはオプション（寸法なし） |

### 抜粋のみ（本文未読）
| # | URL | 状態 | 要旨 |
|---|---|---|---|
| [S1] | https://www.500forum.de/index.php/Thread/25614-10-Zoll-Felgen/ | socket hang up | Mini 用 Cromodora 10" を PCD 切削・10" 鉄は希少高価 |
| [S2] | https://www.500forum.de/index.php/Thread/9438-10-Zoll-Reifen/ | socket hang up | 165/70・155/70・145/70 の選択肢 |
| [S3] | https://www.500forum.de/index.php/Thread/44332-Suche-Felgen-5x10-4-190/ | socket hang up | 5×10 4/190 を探す |
| [S4] | https://www.500forum.de/index.php/Thread/9420-Felgen-10-Zoll/ | socket hang up | Gerstl の 10" 鉄 4×190・TÜV（検索要約・要確認） |
| [S5] | autobelle 検索抜粋 | — | 当時物 10" 4×190 4本 €600 送料込 |
| [S6] | https://www.500forum.it/forum/viewtopic.php?t=3655&start=45 | ログイン壁 | 165/70 は 4.5J・10×5＋165/70R10 を縁折りで収めた・145/70/10 は探しにくい |
| [S7] | fiatforum 検索抜粋 | — | 165/70/10 と 12" 純正の外径差 17mm |
| [S8] | https://www.500forum.it/forum/viewtopic.php?t=6896 | ログイン壁 | 「cerchi low 10 pollici」題名のみ |
| [S9] | https://www.500forum.it/forum/viewtopic.php?f=43&start=15&t=15648 | ログイン壁 | Mini 4×101.6 の穴追加・M12×1.5・フランジ片側 +1.5cm |
| [S10] | 500forum.it 系（ページ不確定） | — | 695 SS assetto corsa だけ 10"・競技専用・公道承認なし・Campagnolo 約 25,000 リラ |
| [S11] | https://m.facebook.com/groups/355484924627664/posts/.../2883359711840160/ | 未取得 | 10" 4×190 4本 €250 |
| [S12] | https://www.capassoricambi.it/en/fiat-500-f-l-r-/32477-cerchio-lega-ruota-da-10-pollici-500.html ／ …/32479-cerchio-lega-ruota-da-10-pollici-mini.html | 403 | 10" 合金（500 用・Mini 5×10） |
| [S13] | https://www.pitstopracingcar.it/prodotti/1-cerchio-fiat-500-abarth---10-pollici---da-restaurare---originale-168125.aspx | 403 | 原品 10" 1本 |
| [S14] | https://webshop.fiat500126.com/en/tires-rims-und-accessories/rims/1 | 403（全ページ） | Gerstl リム一覧 |
| [S15] | minisport/blockley 検索抜粋 | — | Falken Mini 用は在庫切れ・Blockley 145/70R10 あり |
| [S16] | https://www.classicdriver.com/en/car/abarth/695-ss/1965/998696 | 403 | Assetto Corsa は Elektron マグ用フレア |
| [S17] | 価格.com 検索抜粋 | — | 「希少な Campagnolo 10 インチ」掲載車（本文で未発見） |
| [S18] | https://www.500forum.it/forum/viewtopic.php?t=23860 | ログイン壁 | 「Aiuto cerchi 10 pollici」 |
| [S19] | fiatforum [8] 同スレ抜粋 | — | 競技車の 10" の理由（軽さ・直接感・車高） |
| [S20] | https://www.500clubitalia.it/forums/topic/cerchi-10-pollici-da-adattare/ | 404 | — |
| [S21] | https://ricambauto.it/prodotto/cerchi-mod-abarth-replica-per-fiat-500/ | 403 | Abarth replica（寸法不明） |
| [S22] | Blockley/Coker 検索抜粋 | — | 145R10 外径 19.3"・165R10 488mm |

---

## 8. 裏が取れなかった事

1. **Gerstl に 10 インチがあるか**（403）。独フォーラム要約の「Gerstl の 10 インチ鉄・4×190・TÜV」は**本文で確認できていない**＝Gerstl を「10 インチの店」に数えない。
2. **D'Angelo 10×5J 4×190 の ET**・推奨タイヤ・ドラム／フェンダー干渉の店側の断り＝ページに記載なし。
3. **NANNI 10 インチの ET**と、4×190 で履くための手段（アダプターの有無）＝記載なし。
4. **Abarth 695 SS Assetto Corsa の 10 インチの一次資料**（FIA ホモロゲ票 403・classicdriver 403）＝「競技用オプション・ドラム」はフォーラム談 [9][11][S10] まで。**幅（4.5J か 5J か）と純正タイヤサイズは未確認**。
5. **145/70R10・155/70R10・165/60R10・175/60R10・175/50R10・135R10 を空冷 500 に履いた実例**＝ゼロ。165/60R10 以下は Mini 用の販売ページも見つからず。
6. **日本の実例のタイヤサイズ・PCD・ホイール銘柄**＝中古車掲載の「10インチホイール」の一語のみ。車検の通し方（はみ出し・メーター誤差）の議論は見つからず。
7. **乗り心地の数字付き体感談**（同じ車で 12→10 に替えた前後比較）＝**なし**。あるのは一般論（小径高扁平は柔らかい）と競技車の理屈だけ。
8. 500forum.it の 10 インチスレ5本（t=3655・6896・13969・15648・23860）と 500forum.de の6本は**壁の向こう**＝ここに「ET・縁折り・フェンダー」の実地情報が眠っている可能性が高い。
