# 型式別・車両側諸元表（500/126）— 変速比・最終減速比・タイヤ・重量・性能

このドキュメントは手元の FIAT 純正マニュアル・整備書（PDF）**のみ**を典拠として作成した（2026-09-18）。
Web 知識・推測による補完は一切行っていない。値が見つからなかった項目は末尾「見つからなかった項目」に列挙する。
エンジン側の諸元は姉妹文書 `stock_specs.md` を参照（同じ書式）。

対象：500 N／500 D／500 F／500 L／500 R／Giardiniera（＋Furgoncino）／126（1次型 594cc）／126（2次型 652cc）
除外：126 BIS

**ページ表記**：`file p.NN` = PDF のページ番号（ビューアで開く番号）、`印刷 p.NN` = 紙面に刷られたページ番号。
**読み取り方法**：テキスト層のある PDF は `page.get_text()`、無い PDF は `get_pixmap(dpi=110〜150)` で画像化して目視。
**⚠️要再確認**＝スキャンが粗く数字の判読に自信が無い箇所。

---

## 0. 使った資料と、何が載っていたか

| 略称 | ファイル（`手元資料\` 配下） | 種別 | 車両側で使った頁 |
|---|---|---|---|
| **N取説** | `Fiat nuova 500 N - Manuale uso e manutenzione.pdf` | 画像・伊 | file p.45（印刷 p.42）変速比・タイヤ／file p.49（印刷 p.45）性能・燃費／file p.50（印刷 p.46）重量 |
| **N英文リーフ** | `FD Ricambi\Fiat 500 N General Technical Data (EN).pdf` | 画像・伊仏英西独 | p.1〜2（Dati tecnici：最終減速・タイヤ・最高速・燃費） |
| **D取説** | `Fiat 500 D uso e manutenzione.pdf` | 画像・伊 | file p.47（印刷 p.41）変速比・タイヤ／file p.50（印刷 p.44）重量・性能／file p.51（印刷 p.45）タンク・空気圧 |
| **D英文リーフ** | `FD Ricambi\Fiat 500 D General Technical Data (EN).pdf` | 画像・伊仏英西独 | p.1〜2（Dati tecnici） |
| **独語整備書N/D** | `FD Ricambi\Fiat 500 D Reparaturanleitung (DE).pdf` | テキスト層あり・独 | file p.6〜7（Neuer 500／500 Sport の重量・性能）／p.105・p.111・p.129（変速比・総減速比・変更履歴）／p.199・p.317（タイヤ）／p.319（軸重）／p.322（500 D 性能・重量） |
| **Caratteristiche** | `Caratteristiche e dati norme per le revisioni 500d - 500 (tipo110F)  -500 Giardiniera - 500 L.pdf` | テキスト層あり・伊 | file p.3（500D／Giardiniera 重量・性能）／p.15（変速比・8/41）／p.19（タイヤ）／p.48（車輪での総減速比）／file p.81=印刷 p.80（110F／Giardiniera 重量・性能・軸重）／file p.82=印刷 p.81（タンク・空気圧） |
| **L取説** | `Fiat 500 L manuale HD.pdf` | 画像・伊（「mod. 500」=110F 標準車＋「Varianti 500 L」） | file p.51（印刷 p.47）変速比／file p.52（印刷 p.48）8/41・タイヤ／file p.54（印刷 p.50）重量・性能／file p.55（印刷 p.51）500 L 型式／file p.61（印刷 p.56）500 L 寸法・タイヤ・重量／file p.64（印刷 p.59）タンク・空気圧 |
| **R取説** | `Manuale uso e manutenzione - Fiat 500 R.pdf` | 画像・伊（「Varianti alla vettura mod. 500」） | file p.2（変速比・8/39）／file p.3（タイヤ・重量・性能） |
| **G取説** | `Giardiniera- Manuale uso e manutenzione.pdf` | 画像・伊 | file p.42（印刷 p.39）変速比・タイヤ／file p.48（印刷 p.41）寸法・性能・重量／file p.49（印刷 p.42）Furgoncino |
| **独語整備書G** | `FD Ricambi\Fiat 500 Giardiniera Reparaturanleitung (DE).pdf`（表題「500 Kombi」） | 画像・独 | file p.6（印刷 p.8）8/41・総減速比・タイヤ／file p.8（印刷 p.10）寸法・重量・軸重／file p.9（印刷 p.11）性能／file p.26（印刷 p.28）変速比 |
| **126英** | `FD Ricambi\Fiat 126 Workshop Manual Autobook 853 1972-1976 (EN).pdf` | 画像・英 | file p.109（印刷 p.108）変速比・最終減速／file p.111（印刷 p.110）リム・タイヤ／file p.112（印刷 p.111）容量 |
| **126独** | `FD Ricambi\Fiat 126 Reparaturhandbuch (DE).pdf`（ab Juli 1977＝652cc） | 画像・独 | file p.88（印刷 p.86）変速比・8:39／file p.89（印刷 p.87）リム・タイヤ・回転円 |

参考（車両側の値は無かった）：`FD Ricambi\Fiat 500 Workshop Manual 1957-1973 (EN).pdf`（Autobook・テキスト層あり）は変速比・車重・タイヤの技術データ表を持たない（全 128 頁を語句検索、画像専用 4 頁＝白紙を確認）。`FIAT500マニュアル.pdf` は同書の日本語機械翻訳（同じ 128 頁）。`Fiat_500_D_manuale_ordine_corretto.pdf` は D取説と同内容（52 頁・画像）のため D取説を正とした。

---

## 1. 型式別 諸元表

### 1-1. 500 N（型式 110.000・479cc）

出典：`手元資料\Fiat nuova 500 N - Manuale uso e manutenzione.pdf` file p.45＝印刷 p.42「TRASMISSIONE／STERZO E RUOTE」・file p.49＝印刷 p.45「PRESTAZIONI」・file p.50＝印刷 p.46「PESI」／`手元資料\FD Ricambi\Fiat 500 N General Technical Data (EN).pdf` p.1〜2／`手元資料\FD Ricambi\Fiat 500 D Reparaturanleitung (DE).pdf`（表題「Neuer 500 und 500 D」）file p.6〜7・p.105・p.111・p.129

| 項目 | 値 | 出典・原文 |
|---|---|---|
| 1速 | **3,273**（独語整備書は 3,27＝36/11） | N取説 印刷 p.42 `in I marcia 3,273`／独語整備書 p.129 `1. Gang 1:3,27`・p.111 `36/11` |
| 2速 | 2,067 | N取説 `in II 2,067`／独語整備書 `1:2,06` |
| 3速 | 1,300 | N取説 `in III 1,300` |
| 4速 | 0,875 | N取説 `in IV 0,875`／独語整備書 `1:0,87` |
| 後退 | **4,134**（独語整備書 4,13＝36/11×24/19） | N取説 `in RM 4,134`／独語整備書 p.111 |
| 最終減速比 | **8/41**（=5,125） | N取説 `Rapporto di riduzione della coppia conica del differenziale 8/41`／N英文リーフ `Coppia conica di riduzione rapp. 8/41`／独語整備書 p.105 `8/41 beim Mod. «500»` |
| 総減速比（車輪で） | 1速 16,77／2速 10,59／3速 6,66／4速 4,48／後退 21,18 | 独語整備書 p.129 `Gesamtuntersetzung «500»`（8/41 時） |
| ⭐変更履歴 | **エンジン No.173487 から 1速・後退を変更**：1速 36/11=3,27 → 37/10=**3,70**、後退 4,13 → 37/10×25/18=**5,14** | 独語整備書 p.111 `ANMERKUNG - Ab Motor Nr. 173487 wurden die Untersetzungsverhältnisse für 1. und Rückwärtsgang ... abgeändert` |
| リム | 3½ × 12" | N取説 `Ruote a disco con cerchio 3½ × 12"` |
| タイヤ | **125-12**（低圧） | N取説 `Pneumatici a bassa pressione 125-12`／N英文リーフ `Pneumatici tipo 125-12` |
| 空気圧 | 前 1,10〜1,15／後 1,50〜1,60 kg/cm² | N取説 印刷 p.42／英文リーフは 1,15／1,6 |
| 車両重量（走行可能状態：燃料・スペア・工具込） | **470 kg** | N取説 印刷 p.46 `Peso della vettura in ordine di marcia (con rifornimenti, ruota di scorta, utensili ed accessori) 470 kg` |
| 総重量（満載） | **680 kg** | N取説 `Peso totale a pieno carico 680 kg` |
| （独語整備書の値・後期 N） | 走行可能重量：サンルーフ 500／カブリオ 490／Sport 510 kg・総重量 780／770／720 kg・軸重（サンルーフ・満載）前 320／後 460 kg・最低地上高 135 mm | 独語整備書 p.6 `Gewicht des fahrbereiten Wagens ... Sonnendach-Limousine 500 kg`・p.319（→ §3 食い違い①） |
| 最高速（各ギア） | 1速 25／2速 40／3速 60／4速 **85 km/h** | N取説 印刷 p.45 図「Velocità massime km/ora」25・40・60・85 |
| 最高速（公称） | **約 90 km/h** | N英文リーフ `VELOCITÀ circa 90 Km/h`（→ §3 ①） |
| （独語整備書の値） | 500：25／40／65／95 km/h、500 Sport：26／44／70／105 超 | 独語整備書 p.7 `Höchstgeschwindigkeiten ... 4. Gang 95 / über 105` |
| 最大登坂勾配（各ギア） | 1速 23％／2速 14％／3速 8％／4速 **4,5％** | N取説 印刷 p.45 図「Pendenze massime %」 |
| （独語整備書の値） | 500：20／12／6,5／3,5％、Sport：28／17／9／5％（満載） | 独語整備書 p.7 `Steigvermögen (bei Vollbelastung)` |
| 燃費 | **4,5 l/100 km**（CUNA 規格・高速道路を最高速の 2/3 で測定）・航続 約 420 km | N取説 印刷 p.45 `CONSUMO secondo norme CUNA (misurato su autostrada a 2/3 della velocità max) 4,5 lt/100 km`／英文リーフ `63 m.p. Imp. gall.` |
| 燃料タンク | 21 l | N取説 印刷 p.46・英文リーフ |
| 寸法 | 全長 2970・全幅 1320・全高 1325・ホイールベース 1840・トレッド前 1121／後 1135 mm | N取説 印刷 p.45 図／英文リーフ図 |
| 500 Sport の最終減速 | **8/39**・総減速比 15,95／10,07／6,33／4,26／後退 20,15 | 独語整備書 p.105 `8/39 beim Mod. «500 Sport»`・p.129 |

### 1-2. 500 D（型式 110D.000・499,5cc）

出典：`手元資料\Fiat 500 D uso e manutenzione.pdf` file p.47＝印刷 p.41・file p.50＝印刷 p.44・file p.51＝印刷 p.45／`手元資料\Caratteristiche e dati norme per le revisioni ....pdf` file p.3・p.15・p.19・p.48／`手元資料\FD Ricambi\Fiat 500 D General Technical Data (EN).pdf` p.1〜2／`手元資料\FD Ricambi\Fiat 500 D Reparaturanleitung (DE).pdf` file p.199・p.317・p.322

| 項目 | 値 | 出典・原文 |
|---|---|---|
| 1速 | **3,700** | D取説 印刷 p.41 `in I marcia 3,700`／Caratteristiche p.15 `in 1a marcia 3,70`・p.48 `1:3,70` |
| 2速 | 2,067 | D取説 `2,067`（Caratteristiche は 2,06） |
| 3速 | 1,300 | D取説 `1,300` |
| 4速 | 0,875 | D取説 `0,875`（Caratteristiche は 0,87） |
| 後退 | **5,140** | D取説 `in RM 5,140`／Caratteristiche `5,14` |
| 最終減速比 | **8/41**（=5,125） | D取説 `Rapporto di riduzione della coppia conica del differenziale 8/41`／Caratteristiche p.15 `Il rapporto di riduzione della coppia conica ... 8/41`／D英文リーフ `rapp. 8/41` |
| 総減速比（車輪で） | 1速 **18,96**／2速 10,59／3速 6,66／4速 4,48／後退 26,33 | Caratteristiche p.48 `Rapporti sulle ruote` |
| リム | 3½ × 12" | D取説／D英文リーフ `Dimensioni cerchioni ruote 3 1/2 x 12"` |
| タイヤ | **125-12**（4 プライ）：CEAT 125-12 DR 52-4 Ply／Pirelli 125-12 Rolle 4 p.r.／Pirelli 125-12 Sempione／Michelin 125-12-4 P.R. | D取説 印刷 p.41／Caratteristiche p.19（500 D 列） |
| 空気圧 | 軽負荷 前 1,20／後 1,60・満載 前 1,20／後 1,85 kg/cm² | D取説 印刷 p.45／Caratteristiche p.19／独語整備書 p.199・p.317 |
| 車両重量（走行可能状態） | **500 kg** | D取説 印刷 p.44 `Peso vettura in ordine di marcia (con rifornimenti, ruota scorta, utensili, accessori) 500 kg`／Caratteristiche p.3／独語整備書 p.322 |
| 積載 | 4 名＋40 kg | D取説 `Portata utile 4 persone + 40 kg` |
| 総重量（満載） | **820 kg** | D取説 `Peso totale a pieno carico 820 kg`／Caratteristiche p.3／独語整備書 p.322 |
| 軸重（満載） | 前 360／後 460 kg | 独語整備書 p.322 `Verteilung des Gesamtgewichts (4 Personen + 40 kg) vorn 360 / hinten 460` |
| 最高速（各ギア） | 1速 23／2速 40／3速 65／4速 **95 km/h 超**／後退 約 17 | D取説 印刷 p.44 図（23・40・65・>95）／Caratteristiche p.3 `oltre 95`／独語整備書 p.322（後退 17） |
| 最高速（公称） | oltre 95 km/h（over 60 m.p.h.） | D英文リーフ `VELOCITÀ oltre 95 km/h` |
| 最大登坂勾配（満載・慣らし後） | 1速 **26％**／2速 13％／3速 7％／4速 3,5％／後退 36％ | D取説 印刷 p.44 図／Caratteristiche p.3 `Pendenza massima superabile a pieno carico ... in R.M. 36`／独語整備書 p.322 |
| 燃料タンク | 21 l | D取説 印刷 p.45／D英文リーフ |
| 燃費 | 記載なし（→ §4） | — |
| 寸法 | 全長 2970・全幅 1322・全高 1325・WB 1840・トレッド 1121／1135・最小回転半径 4,30 m | Caratteristiche p.3／D取説 |

### 1-3. 500 F（型式 110F・499,5cc）

出典：`手元資料\Fiat 500 L manuale HD.pdf`（前半が「mod. 500」＝110F 標準車）file p.51＝印刷 p.47・file p.52＝印刷 p.48・file p.54＝印刷 p.50・file p.64＝印刷 p.59／`手元資料\Caratteristiche e dati norme per le revisioni ....pdf` file p.81＝印刷 p.80「DATI PRINCIPALI DEGLI AUTOVEICOLI」・file p.82＝印刷 p.81

| 項目 | 値 | 出典・原文 |
|---|---|---|
| 1速 | **3,700** | L取説 印刷 p.47 `in I marcia 3,700` |
| 2速 | 2,066 | L取説 `in II 2,066`（D は 2,067＝丸めの差） |
| 3速 | 1,300 | L取説 |
| 4速 | 0,875 | L取説 |
| 後退 | **5,144** | L取説 `in RM 5,144`（D は 5,140＝丸めの差） |
| 最終減速比 | **8/41** | L取説 印刷 p.48 `Rapporto della coppia conica di riduzione 8/41` |
| リム | 3½ × 12" | L取説 印刷 p.48 |
| タイヤ | 標準 **125-12（4 p.r.）**／ラジアル（オプション）**125 SR-12** | L取説 印刷 p.48 `Pneumatici normali 125-12 (4 p.r.) / radiali (a richiesta) 125 SR-12` |
| 空気圧 | 標準タイヤ：軽負荷 前 1,30／後 1,60・満載 前 1,30／後 1,90／ラジアル 前 1,10／後 1,60 kg/cm² | L取説 印刷 p.59／Caratteristiche 印刷 p.81（Berlina 列） |
| 車両重量（走行可能状態） | **520 kg** | L取説 印刷 p.50 `Peso vettura in ordine di marcia ... 520 kg`／Caratteristiche 印刷 p.80 `Berlina 520` |
| 積載 | 4 名＋40 kg | 同上 |
| 総重量（満載） | **840 kg** | L取説 `Peso totale a pieno carico 840 kg`／Caratteristiche 印刷 p.80 |
| 軸重（満載） | 前 370／後 470 kg | Caratteristiche 印刷 p.80 `Ripartizione sugli assi ... anter. 370 / poster. 470` |
| 牽引可能重量 | 300 kg | L取説 印刷 p.50 `Peso massimo rimorchiabile 300 kg` |
| 最高速（各ギア） | 1速 23／2速 40／3速 65／4速 **95 km/h 超**／後退 約 17 | L取説 印刷 p.50／Caratteristiche 印刷 p.80 `in 4a oltre 95 / in Retromarcia circa 17` |
| 最大登坂勾配（満載） | 1速 **26％**／2速 13％／3速 7％／4速 3,5％／後退 36％ | L取説 印刷 p.50／Caratteristiche 印刷 p.80 |
| 燃料タンク | **22 l** | L取説 印刷 p.59／Caratteristiche 印刷 p.81 |
| 寸法 | 全長 2970・全幅 1320・全高 1325・WB 1840・トレッド 1121／1135 mm | L取説 印刷 p.50 図 |
| 燃費 | 記載なし | — |

### 1-4. 500 L（型式 110 F/L）

出典：`手元資料\Fiat 500 L manuale HD.pdf` file p.55＝印刷 p.51「VARIANTI MODELLO 500 L」・file p.61＝印刷 p.56「DIMENSIONI／PNEUMATICI／PESI」。**変速比・最終減速・性能は 500 F と共通**（Varianti 章に別記なし＝標準車の値がそのまま適用）。

| 項目 | 値 | 出典・原文 |
|---|---|---|
| 型式 | tipo 110 F/L | L取説 印刷 p.51 `Sulla targhetta ... tipo 110 F/L` |
| 変速比・最終減速 | 500 F と同じ（3,700／2,066／1,300／0,875／R 5,144・8/41） | Varianti 章に記載なし |
| タイヤ | 標準 **125-12（4 p.r.）**／ラジアル **125 SR-12** | L取説 印刷 p.56 `Vengono montati pneumatici normali 125-12 (4 p.r.) / a carcassa radiale 125 SR-12` |
| 車両重量（走行可能状態） | **530 kg** | L取説 印刷 p.56 `Peso vettura in ordine di marcia ... 530 kg` |
| 総重量（満載） | **850 kg** | L取説 `Peso totale a pieno carico 850 kg` |
| 最高速・登坂 | 500 F と同じ（23／40／65／>95 km/h・26／13／7／3,5％） | Varianti 章に記載なし |
| 寸法 | 全長 **3025**（バンパー変更）・全幅 1320・全高 1325・WB 1840・オーバーハング前 534／後 651 mm | L取説 印刷 p.56 図 |
| 燃料タンク | 22 l | L取説 印刷 p.59 |

### 1-5. 500 R（型式 110 F・エンジン 126 A5.000・594cc）

出典：`手元資料\Manuale uso e manutenzione - Fiat 500 R.pdf`（「VARIANTI ALLA VETTURA MOD. 500」）file p.2〜3。⚠️スキャンが粗い（900px 幅）。

| 項目 | 値 | 出典・原文 |
|---|---|---|
| 1速 | **3,250** | R取説 p.2 `in I marcia 3,250` |
| 2速 | 2,067 | R取説 `2,067` |
| 3速 | 1,300 | R取説 `1,300` |
| 4速 | **0,872** | R取説 `0,872` |
| 後退 | **4,024** | R取説 `in RM 4,024` |
| 最終減速比 | **8/39**（=4,875） | R取説 `Rapporto della coppia conica di riduzione 8/39` |
| タイヤ | サイズ記載なし。「新デザインのディスクホイール・ホイールキャップ無し」「コンベンショナル構造・オプションでラジアル」 | R取説 p.3 `Pneumatici: a carcassa convenzionale. A richiesta: a carcassa radiale.`（→ §4） |
| 車両重量（走行可能状態） | **525 kg** ⚠️要再確認（525 と読める） | R取説 p.3 `Peso in ordine di marcia ... 525 kg` |
| 積載 | 4 名＋40 kg | R取説 |
| 総重量（満載） | **845 kg** ⚠️要再確認 | R取説 `Peso totale a pieno carico 845 kg` |
| 牽引可能重量 | 400 kg ⚠️要再確認 | R取説 `Peso massimo rimorchiabile 400 kg` |
| 最高速（各ギア） | 1速 **30**／2速 **45**／3速 **75**／4速 **約 100 km/h** | R取説 p.3 `VELOCITÀ massime ammissibili a pieno carico ... in IV circa 100` |
| 最大登坂勾配（満載） | 1速 **24,5％**／2速 14,5％／3速 8,5％／4速 4,5％ | R取説 p.3 `PENDENZE massime superabili ... 24,5 / 14,5 / 8,5 / 4,5` |
| 寸法 | 全長 2970・WB 1840（500 F と同じ図） | R取説 p.3 図 |
| 燃費・タンク | 記載なし | — |

### 1-6. Giardiniera（型式 120・499,5cc・横置き）＋ Furgoncino

出典：`手元資料\Giardiniera- Manuale uso e manutenzione.pdf` file p.42＝印刷 p.39・file p.48＝印刷 p.41・file p.49＝印刷 p.42／`手元資料\FD Ricambi\Fiat 500 Giardiniera Reparaturanleitung (DE).pdf`（500 Kombi）file p.6＝印刷 p.8・file p.8＝印刷 p.10・file p.9＝印刷 p.11・file p.26＝印刷 p.28／`手元資料\Caratteristiche ....pdf` file p.3・p.19・p.48・file p.81＝印刷 p.80・file p.82＝印刷 p.81

| 項目 | 値 | 出典・原文 |
|---|---|---|
| 1速 | **3,700** | G取説 印刷 p.39 `in I marcia 3,700`／独語整備書G 印刷 p.28 `1. Gang 3,700` |
| 2速 | 2,067 | 同上 |
| 3速 | 1,300 | 同上 |
| 4速 | 0,875 | 同上 |
| 後退 | **5,140** | 同上 |
| 最終減速比 | **8/41** | G取説 `8/41`／独語整備書G 印刷 p.8 `Untersetzung Triebling/Tellerrad 8/41` |
| 総減速比（車輪で） | 1速 **18,962**／2速 10,593／3速 6,662／4速 4,484／後退 26,342 | 独語整備書G 印刷 p.8 `Gesamtuntersetzung Motor/Hinterräder bei 8/41`（Caratteristiche p.48 の 18,96… と同値） |
| リム | 3½ × 12" | G取説／独語整備書G |
| タイヤ | **125-12（6 p.r.）または 125-12 C**（ベルリーナより強化）。銘柄：CEAT 125-12 DR 52-6 P.R.／Pirelli 125-12 Rolle 6 P.R.／Michelin 125-12 C-SDS。独語整備書G は「125-12G 4 p.r. Pirelli, CEAT／125-12C 4 p.r. Michelin」 | G取説 印刷 p.39 `Pneumatici a bassa pressione 125-12 (6 p.r.) oppure 125-12 C`／Caratteristiche p.19（Giardiniera 列）／独語整備書G 印刷 p.8（→ §3 ④） |
| 空気圧 | 前 1,20／後 1,90（軽負荷）・前 1,20／後 2,10（満載）・**貨物満載時 後 2,40** kg/cm² | Caratteristiche p.19 注 `(*) I pneumatici posteriori, per il trasporto cose a pieno carico, devono essere gonfiati a 2,40`／独語整備書G 印刷 p.8 |
| 車両重量（走行可能状態） | **555 kg**（D 期）／**560 kg**（110F 期） | G取説 印刷 p.41 `555 kg`／Caratteristiche p.3 `555`／独語整備書G 印刷 p.10 `vollgetankten, fahrbereiten 555 kg`（イタリア販売時＝燃料無し 540 kg）／Caratteristiche 印刷 p.80 `Giardiniera 560`（→ §3 ③） |
| 積載 | 320 kg＝4 名＋40 kg、または運転者＋250 kg（荷室） | G取説 印刷 p.41 `Portata utile (4 persone + 40 kg oppure conducente + 250 kg) 320 kg`／独語整備書G 印刷 p.10（荷台 200 kg ⚠️独語版は 200） |
| 総重量（満載） | **875 kg**（D 期）／**880 kg**（110F 期） | G取説（875 は Caratteristiche p.3・独語整備書G 印刷 p.10）／Caratteristiche 印刷 p.80 `880` |
| 軸重（満載） | 前 315／後 560 kg（独語整備書G）／前 320／後 560 kg（Caratteristiche 110F 期） | 独語整備書G 印刷 p.10／Caratteristiche 印刷 p.80 |
| 牽引可能重量 | 300 kg | G取説 印刷 p.41 |
| 最高速（各ギア） | 1速 23／2速 40／3速 65／4速 **95 km/h 超**／後退 約 17 | G取説 印刷 p.41／独語整備書G 印刷 p.11 `im 4. Gang 95 / im Rückwärtsgang 17`／Caratteristiche 印刷 p.80 |
| 最大登坂勾配（満載） | 1速 **22％**／2速 11,5％／3速 6％／4速 3％／後退 30％ | G取説 印刷 p.41 `22 / 11,5 / 6 / 3`／Caratteristiche p.3・印刷 p.80／独語整備書G 印刷 p.11（2速は「11％」と丸め） |
| 寸法 | 全長 3185（独語版 3182）・全幅 1323／1320・全高 1354・**WB 1940**・トレッド 1121／1131・最低地上高 134・最小回転半径 4,30 m | G取説 印刷 p.41 図／独語整備書G 印刷 p.10／Caratteristiche p.3 |
| 燃料タンク | 21 l（D 期）／22 l（110F 期） | 独語整備書G 印刷 p.8・p.11／Caratteristiche 印刷 p.81 |
| **Furgoncino 500** | タイヤ **125-12 C**・空気圧 前 1,4／後 2,4・走行可能重量 555 kg・積載（運転者込）320 kg・荷室 約 1,275 m²／0,80〜1,00 m³ | G取説 印刷 p.42「CARATTERISTICHE VERSIONE FURGONCINO 500」 |

### 1-7. 126（1次型・126A.000・594cc）

出典：`手元資料\FD Ricambi\Fiat 126 Workshop Manual Autobook 853 1972-1976 (EN).pdf` file p.109＝印刷 p.108「GEARBOX AND DIFFERENTIAL」・file p.111＝印刷 p.110「HUBS, WHEELS AND TYRES」・file p.112＝印刷 p.111「CAPACITIES」

| 項目 | 値 | 出典・原文 |
|---|---|---|
| 1速 | **3,25** | 126英 印刷 p.108 `Ratios: 1st 3.25 to 1` |
| 2速 | 2,067 | `2nd 2.067 to 1` |
| 3速 | 1,30 | `3rd 1.30 to 1` |
| 4速 | **0,872** | `4th .872 to 1` |
| 後退 | **4,024** | `Reverse 4.024 to 1` |
| 最終減速比 | **4,875（8/39）** | `Final drive 4.875 to 1 (8/39)` |
| シンクロ | 2・3・4速 | `Synchromesh On 2nd, 3rd and 4th`（500 系は非同期） |
| リム | **4.00 × 12** | 126英 印刷 p.110 `Rim size 4.00 × 12` |
| タイヤ | **135 × 12 ラジアル** | `Tyres Size 135 × 12 radial ply` |
| 空気圧 | 前 20 psi（1,4）／後 28 psi（2,0 kg/cm²） | 同上 |
| 燃料タンク | 21 l（予備 5 l 含む） | 126英 印刷 p.111 `Fuel tank 4.6 gal. (5.5 US gal. or 21 litres)` |
| 車両重量・総重量・最高速・登坂 | **記載なし**（Autobook の Technical Data 章に無し・冒頭 8 頁にも総括表なし） | → §4 |

### 1-8. 126（2次型・126A1.000／126A1.048・652cc・1977年7月〜）

出典：`手元資料\FD Ricambi\Fiat 126 Reparaturhandbuch (DE).pdf` file p.88＝印刷 p.86「Wechsel- und Ausgleichgetriebe／Lenkung」・file p.89＝印刷 p.87「Räder und Reifen」

| 項目 | 値 | 出典・原文 |
|---|---|---|
| 1速 | **3,250:1** | 126独 印刷 p.86 `Übersetzungsverhältnisse 1. Gang 3,250:1` |
| 2速 | 2,067:1 | 同上 |
| 3速 | 1,300:1 | 同上 |
| 4速 | 0,872:1 | 同上 |
| 後退 | 4,024:1 | 同上 |
| 最終減速比 | **8:39** | `Untersetzung Antriebskegelräder 8:39` |
| シンクロ | 2・3・4速 | `Synchronisierung 2., 3. und 4. Gang` |
| リム | 4,00 × 12 | 126独 印刷 p.87 `Felgen 4,00×12` |
| タイヤ | **135 SR 12**（冬用 Eisreifen 125-12） | `Reifen 135 SR 12 (Eisreifen 125-12)` |
| 空気圧 | 前 1,4／後 2,0 bar | 同上 |
| 回転円直径 | 8,6 m | 126独 印刷 p.86 `Wendekreisdurchmesser 8,6 m` |
| 車両重量・総重量・最高速・登坂 | **記載なし**（Mass- und Einstelltabelle にも 1.3 Modellbeschreibung にも無し） | → §4 |

---

## 2. 横断比較（変速機・最終減速）

| 型式 | 1速 | 2速 | 3速 | 4速 | 後退 | 最終減速（歯数＝比） | 総減速比 4速（資料値） | 出典 |
|---|---|---|---|---|---|---|---|---|
| 500 N（初期・〜エンジン No.173486） | 3,273 | 2,067 | 1,300 | 0,875 | 4,134 | 8/41＝5,125 | 4,48 | N取説／独語整備書 p.129 |
| 500 N（No.173487〜） | 3,70 | 2,06 | 1,30 | 0,87 | 5,14 | 8/41 | 4,48 | 独語整備書 p.111 |
| 500 Sport | 3,27 | 2,06 | 1,30 | 0,87 | 4,13 | **8/39＝4,875** | 4,26 | 独語整備書 p.105・p.129 |
| 500 D | 3,700 | 2,067 | 1,300 | 0,875 | 5,140 | 8/41 | 4,48 | D取説／Caratteristiche p.48 |
| 500 F／L | 3,700 | 2,066 | 1,300 | 0,875 | 5,144 | 8/41 | （記載なし・D と同一） | L取説 |
| Giardiniera | 3,700 | 2,067 | 1,300 | 0,875 | 5,140 | 8/41 | 4,484 | G取説／独語整備書G |
| 500 R | 3,250 | 2,067 | 1,300 | 0,872 | 4,024 | **8/39** | （記載なし） | R取説 |
| 126 594 | 3,25 | 2,067 | 1,30 | 0,872 | 4,024 | 8/39＝4,875 | （記載なし） | 126英 |
| 126 652 | 3,250 | 2,067 | 1,300 | 0,872 | 4,024 | 8:39 | （記載なし） | 126独 |

計算用メモ（資料値からの単純計算・出典なし）：4速×最終＝0,875×5,125＝4,484（500 D/F/G の資料値 4,48 と一致）／0,872×4,875＝4,251（500 R・126）。

## 2-2. 横断比較（重量・性能）

| 型式 | 走行可能重量 | 総重量 | 最高速 4速 | 登坂 1速／4速 | タイヤ | タンク | 出典 |
|---|---|---|---|---|---|---|---|
| 500 N（伊取説） | 470 kg | 680 kg | 85 km/h（公称 約 90） | 23％／4,5％ | 125-12 | 21 l | N取説・N英文リーフ |
| 500 N（独語整備書＝後期） | 500 kg | 780 kg | 95 km/h | 20％／3,5％ | 125-12 | 21 l | 独語整備書 p.6〜7 |
| 500 Sport | 510 kg | 720 kg（2 名＋70 kg） | 105 km/h 超 | 28％／5％ | 125-12 | 21 l | 独語整備書 p.6〜7 |
| 500 D | 500 kg | 820 kg | 95 km/h 超 | 26％／3,5％（R 36％） | 125-12 4 p.r. | 21 l | D取説 |
| 500 F | 520 kg | 840 kg | 95 km/h 超 | 26％／3,5％（R 36％） | 125-12 4 p.r.／125 SR-12 | 22 l | L取説・Caratteristiche |
| 500 L | 530 kg | 850 kg | （F と同じ） | （F と同じ） | 125-12 4 p.r.／125 SR-12 | 22 l | L取説 |
| 500 R | 525 kg ⚠️ | 845 kg ⚠️ | 約 100 km/h | 24,5％／4,5％ | サイズ記載なし | — | R取説 |
| Giardiniera | 555／560 kg | 875／880 kg | 95 km/h 超 | 22％／3％（R 30％） | 125-12 6 p.r.／125-12 C | 21／22 l | G取説・Caratteristiche |
| 126 594／652 | — | — | — | — | 135×12 ラジアル | 21 l | 126英・126独 |

---

## 3. 食い違い（型式間・資料間）

① **500 N の重量・性能が伊語取説と独語整備書で別物**：伊語 N取説（470 kg／680 kg・85 km/h・登坂 23／14／8／4,5％）に対し、独語整備書「Neuer 500」（500 kg／780 kg・95 km/h・20／12／6,5／3,5％）。N英文リーフは「15 CV・約 90 km/h」。独語版は Sport を併記し 500 の最高速を 95 としているので、**16,5 CV 化以降の後期 N（1957年11月〜）の値**とみられる（資料に明記はない・エンジン出力は `stock_specs.md` §1 参照）。⭐模型の出発点を「500 N」とするなら **どちらの N かを決めて出典を固定**すること。

② **500 N の 1速・後退はエンジン No.173487 で 3,27／4,13 → 3,70／5,14 に変更**（独語整備書 p.111）。伊語 N取説（3,273／4,134）は変更前の版。以後 D／F／L／Giardiniera はすべて 3,70／5,14。500 R と 126 は 3,25／4,024 に戻る（別設計の同期式ギアボックス）。

③ **Giardiniera の車重は D 期 555 kg → 110F 期 560 kg、総重量 875 → 880 kg**（Caratteristiche p.3 と 印刷 p.80）。独語整備書G は「イタリア販売時 540 kg／満タン走行可能 555 kg」と 2 段で書く＝**「in ordine di marcia」は燃料込み**の定義。荷台積載は伊語 250 kg／独語 200 kg（運転者を除く）で食い違う。

④ **Giardiniera のタイヤのプライ数**：伊語 G取説・Caratteristiche は 6 p.r.（125-12 DR 52-6 P.R.／Rolle 6 P.R.）または 125-12 C、独語整備書G は「125-12G 4 p.r.」。版の違いとみられる（どちらも Michelin は 125-12 C）。

⑤ **変速比の末尾桁**：2速 2,066（L取説）vs 2,067（他全部）、後退 5,144（L取説）vs 5,140（D・G）。歯数比 37/10×25/18＝5,1389 なので **5,14 が正しい丸め・5,144 は L取説の誤植か別の丸め**。2速は資料に歯数の記載がなく判定不能。⚠️模型では 2,067／5,14 を採る。

⑥ **500 F の空気圧が D と違う**：D＝前 1,20／後 1,60〜1,85、F＝前 1,30／後 1,60〜1,90（ラジアル 1,10／1,60）。Caratteristiche 印刷 p.81 と L取説 p.59 で一致するので誤記ではない。

⑦ **500 D の最高速表記**：取説図は「>95」、Caratteristiche p.3 は「oltre 95」、独語整備書 p.322 も「über 95」＝いずれも下限表記で上限値の記載は無い。500 R だけ「circa 100」と丸めの表記。

⑧ **Giardiniera 2速登坂**：伊語 11,5％、独語整備書G 11％（丸め）。

⑨ **タンク容量**：D 期 21 l → 110F 期 22 l（ベルリーナ・Giardiniera とも）。

---

## 4. 見つからなかった項目

- **前面投影面積・Cd**：全資料に記載なし（語句「area frontale／Stirnfläche／frontal area／coefficiente」で全テキスト層 PDF を検索、画像 PDF は Caratteristiche 章を目視）。模型では未取得として扱う。
- **500 R のタイヤサイズ**：R取説（Varianti 13 頁）は「コンベンショナル／オプションでラジアル」とのみ。他資料に R の記載なし。
- ⭐**【2026-09-18 解決】126 の車両重量**＝**594（1972-76）580 kg／652（1977年8月以降）600 kg**。出典＝`手元資料\マニュアル\FIAT126OwnersWorkshopManual.pdf`（**Haynes 126 Owners Workshop Manual**・画像のみ84頁・1頁＝見開き2頁）＝**file p.6 右＝印刷 p.9「General dimensions, weights and capacities → Kerb weight 1279 lb (580 kg)」**、**file p.62 右＝印刷 p.121「Chapter 12 Supplement → Weights → Kerb weight 1323 lbs (600 kg)」**。⚠️**この本は既調査の Autobook 853 とは別の本**＝`MANUALFIAT126.pdf` の方が Autobook の重複（同一書）。⭐同じ頁で全長 305.4／全幅 137.7／全高 133.5／軸距 184.0／輪距 前114.2・後120.3 cm（652 は全長 3109 mm）も取れた。
- **126 の総重量（満載）・最高速・登坂勾配・燃費**：Haynes にも無い（Haynes は「Maximum towing weight (braked) 400 kg」だけ）。Autobook・Reparaturhandbuch にも総括の車両データ表がない（3書とも修理データ主体）＝**総重量 900/920 kg は依然 Web の一般値**。
- **500 D／F／L／R／Giardiniera の燃費**：取説に CUNA 燃費の記載があるのは N取説と N英文リーフのみ（4,5 l/100 km）。
- **500 F／L／R・126 の総減速比（車輪で）**：資料値は D（Caratteristiche p.48）と Giardiniera（独語整備書G）と N/Sport（独語整備書 p.129）だけ。他は計算で出す（§2 メモ）。
- **500 R の燃料タンク容量・軸重**、**500 N（伊取説）の軸重**。
- **各型式の各ギア最高速の「上限」**（4速はすべて「oltre 95」等の下限表記）。
- **タイヤ外径・転がり半径**：どの資料にも数値なし（サイズ記号のみ）。
- **Abarth 595／695 の車両側諸元**：一次資料なし（`stock_specs.md` §7 と同じ状況）。

---

## 5. 補足メモ（読み取りの罠）

- **ページ番号のズレ**は資料ごとに違う：N取説 file−3〜4、D取説 file−6、L取説 file−4〜5、G取説 file−3〜7、独語整備書G file+2、126英 file−1、126独 file−2、Caratteristiche は D/G 章が file＝印刷・110F 章が file−1。**引用するときは file p. と 印刷 p. を両方書く**（本文の書式どおり）。
- Caratteristiche file p.3 は 2 列（500 D／Giardiniera）の表がテキスト抽出で縦一列に崩れる。画像で列を確認して読んだ（本表の値は画像確認済み）。
- 独語整備書N/D の p.129 の変速比は「Neuer 500」初期値。**500 D の値は file p.322 以降の「Modell 500 D」章に「Neuer 500 との相違点だけ」書かれ、変速比は p.111 の注記経由でしか分からない**。
- 500 L 取説は前半が 110F 標準車の取説そのもの。「500 F 単独の取説は手元に無い」が、**車両側の 500 F の値はこの本の前半で全部そろう**（エンジン操作系の話とは別）。
