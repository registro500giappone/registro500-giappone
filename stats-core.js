// stats-core.js
// 登録車両データ(cars)の集計用・正規化関数の共通ファイル。
//
// オーナーの入力欄は自由記述のものが多く、同じ意味の値が「650」「650cc」「白」「ホワイト」の
// ように割れる。DBに保存された原文は本人が書いたものなので書き換えず、
// 集計するときだけこの関数群を通して寄せる（＝表示用の正規化と保存値を分ける）。
//
// 以前は stats.html と goods.html が同じ辞書を別々に持っており、
// オートマイスターの扱いだけが食い違っていた。ここに集約して二重管理をやめる。

// 排気量(cc)を範囲でまとめる。「650cc」「499.5」のような単位付き・小数も拾う。
function getEngineCategory(v) {
  if (!v) return null;
  let cc = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  if (isNaN(cc)) return null;
  if (cc >= 4000) cc = cc / 10;
  if (cc <= 500) return "～500cc";
  if (cc <= 540) return "～540cc";
  if (cc <= 600) return "～600cc";
  if (cc <= 650) return "～650cc";
  if (cc <= 700) return "～700cc";
  return "700cc超";
}

function normalizeEngineType(v) {
  if (!v) return null;
  let s = String(v).toUpperCase().replace(/[\s.-]/g, '');
  if (s.match(/不明|未記入|無し|わからない/)) return null;

  if (s.includes('110F')) return '110F (500F/L/R)';
  if (s.includes('110D')) return '110D (500D)';
  if (s.includes('126A1')) return '126A1 (126/Late 500)';
  if (s.includes('126A0')) return '126A0';
  if (s.includes('120')) return '120 (Giardiniera)';
  if (s.includes('100G')) return '100G (850系)';

  return s;
}

// 車種名(display_a)とグレード(display_b)で分類する。
// どちらもプルダウン由来なので、表記ゆれで別カテゴリに割れることがない。
// ※以前は結合済みの display_c を '500 L' のようなスペース込みの部分一致で判定しており、
//   「FIAT500L L」のような入力が「500 L」に集計されず独立した棒になっていた。
function getNormalizedModel(car) {
  const a = String(car.Model_DisplayA || '').trim();
  const b = String(car.Model_DisplayB || '').trim();
  if (!a && !b) return null;
  // 126はモデル名自体が世代を表す1階層なので、車種名だけで分ける。
  // display_c ならDB側で「標準」が除かれた形になっている。
  if (car.CarType === '126') return String(car.Model_DisplayC || a || '').trim() || null;
  if (b === 'Giardiniera') return 'Giardiniera';
  if (a === 'Nuova500' && ['D', 'F', 'L', 'R'].includes(b)) return '500 ' + b;
  // アバルト・派生モデル・その他車種は車種名＋グレードで1カテゴリ
  return (a + ' ' + b).trim();
}

// オイル・タイヤのメーカー名を日本語表記に寄せる。
// 辞書に無い場合は原文をそのまま返す（勝手に「その他」へ丸めると、
// 1台しか使っていない銘柄が消えてしまうため）。
//
// opts.excludeRetailUnavailable = true で、通販で買えない銘柄を null にする。
// 購入リンクを併記する goods.html のランキング用（買えないものを1位にしても仕方がない）。
function getBrandJa(t, opts) {
  if (!t) return null;
  const excludeRetailUnavailable = !!(opts && opts.excludeRetailUnavailable);
  let v = String(t).toLowerCase().trim();
  // 無効データ
  if (v.match(/不明|未記入|無し|メーカー不定|不定|普通|わからない|不定期|知らん/)) return null;
  // ---- オイルブランド ----
  if (v.match(/motul|モチュール/)) return 'モチュール';
  if (v.match(/lubross|ルブロス/)) return 'ルブロス';
  // プロショップ専売品・通販不可
  if (v.match(/automaister|オートマイスター/)) return excludeRetailUnavailable ? null : 'オートマイスター';
  if (v.match(/kendall|ケンドル/)) return 'ケンドル';
  if (v.match(/amalie|アマリー/)) return 'アマリー';
  if (v.match(/spectro|スペクトロ/)) return 'スペクトロ';
  if (v.match(/sunoco|スノコ/)) return 'スノコ';
  if (v.match(/liquimol|リキモリ/)) return 'リキモリ';
  if (v.match(/chevron|シェブロン/)) return 'シェブロン';
  if (v.match(/\belf\b/)) return 'elf';
  if (v.match(/unil.?opal|ユニルオパール|ユニルオパル/)) return 'ユニルオパール';
  if (v.match(/castrol|カストロール/)) return 'カストロール';
  if (v.match(/wako|ワコーズ/)) return 'ワコーズ';
  if (v.match(/agip|eni|アジップ/)) return 'Agip / eni';
  if (v.match(/gulf|ガルフ/)) return 'ガルフ';
  if (v.match(/nutec|ニューテック/)) return 'NUTEC';
  if (v.match(/\ba\.s\.h\b|ash oil|アッシュ/)) return 'A.S.H';
  if (v.match(/pennzoil|ペンズオイル|ペンズ/)) return 'ペンズオイル';
  if (v.match(/valvoline|バルボリン/)) return 'バルボリン';
  if (v.match(/revtech|レブテック/)) return 'RevTech';
  if (v.match(/polo lubr|polo turbo|polo classic/)) return 'POLO Lubricants';
  if (v.match(/ontario|オンタリオ/)) return 'オンタリオSS';
  if (v.match(/tcガレージ|tcgarage/)) return 'TCガレージ';
  if (v.match(/omega|オメガ/)) return 'オメガ';
  if (v.match(/bp |bp$/)) return 'BP';
  // ---- タイヤブランド ----
  if (v.match(/michelin|ミシュラン/)) return 'ミシュラン';
  if (v.match(/pirelli|ピレリ|cinturato|チンチュラート/)) return 'ピレリ';
  if (v.match(/bridgestone|ブリヂストン|ブリジストン|sneaker|スニーカー/)) return 'ブリヂストン';
  if (v.match(/yokohama|ヨコハマ|横浜|advan|アドバン/)) return 'ヨコハマ';
  if (v.match(/dunlop|ダンロップ|digityer|dunlpop/)) return 'ダンロップ';
  if (v.match(/toyo|トーヨー/)) return 'トーヨー';
  if (v.match(/falken|ファルケン/)) return 'ファルケン';
  if (v.match(/hankook|ハンコック/)) return 'ハンコック';
  if (v.match(/continental|コンチネンタル/)) return 'コンチネンタル';
  if (v.match(/meister|マイスター/)) return 'マイスター';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function getColorGroup(t) {
  if (!t) return null;
  const v = String(t).toLowerCase();
  if (v.match(/白|white|bianco|ビアンコ|アイボリー|ivory|象牙|パール/)) return '白/アイボリー系';
  if (v.match(/赤|red|rosso|ロッソ|レッド|ワイン|ボルドー/)) return '赤系';
  if (v.match(/黄|yellow|giallo|ジャッロ|イエロー|クリーム|positano|バニラ/)) return '黄系';
  if (v.match(/水色|light blue|azur|チェレステ|volare|アクア|空色|ターコイズ/)) return '水色系';
  if (v.match(/青|blue|blu|ブルー|ネイビー|紺/)) return 'ブルー系';
  if (v.match(/緑|green|verde|グリーン|ミント|抹茶/)) return '緑系';
  if (v.match(/灰|grey|grigio|グリージョ|グレー|ガンメタ|シルバー/)) return 'グレー系';
  if (v.match(/ベージュ|beige|茶|brown|sabbia/)) return 'ベージュ系';
  if (v.match(/黒|black|nero|ブラック/)) return '黒系';
  if (v.match(/オレンジ|orange/)) return 'オレンジ系';
  return 'その他';
}

// 「125/12」「125/80/12」「125r12」「125Ｒ12」(全角)を 125R12 に寄せる。
// 大文字化と空白除去を先に済ませてから前方・後方の数字だけで判定するので、
// 区切り文字が何であっても拾える。
function normalizeTireSize(t) {
  if (!t) return null;
  let v = String(t).toUpperCase().replace(/\s+/g, '');
  if (v.match(/不明|未記入/)) return null;
  if (v.match(/^125.*12$/)) return '125R12';
  if (v.match(/^135.*12$/)) return '135/80R12';
  if (v.match(/^145.*12$/)) return '145/70R12';
  return v;
}

function getCycleDistJa(t) {
  if (!t) return null;
  let v = String(t).replace(/,/g, '').toLowerCase();
  if (v.match(/不明|未記入/)) return null;
  if (v.match(/10000|１万/)) return '10,000km';
  if (v.match(/5000/)) return '5,000km';
  if (v.match(/3[0-9]{3}|2500|2800/)) return '3,000km前後';
  if (v.match(/2000|2[0-4][0-9]{2}/)) return '2,000km前後';
  if (v.match(/1[0-9]{3}|1500/)) return '1,500km以下';
  if (v.match(/km|キロ/)) {
    let m = v.match(/[0-9]+/);
    if (m) { let n = parseInt(m[0]); return n.toLocaleString() + 'km'; }
  }
  return null;
}

function getCycleTimeJa(t) {
  if (!t) return null;
  let v = String(t).toLowerCase();
  if (v.match(/不明|未記入|適当|適宜|気まぐれ|気分/)) return null;
  if (v.match(/半年|6ヶ月|6ケ月|6ヵ月|6か月|６か月|６ヶ月/)) return '半年/6ヶ月ごと';
  if (v.match(/1年|１年|12ヶ月|1年ごと/)) return '1年ごと';
  if (v.match(/車検|2年|２年/) && !v.match(/半年/)) return '車検/2年ごと';
  if (v.match(/随時|不定期|足す|減ったら|継足|継ぎ足|足し/)) return '随時・足し油';
  if (!v.match(/[0-9０-９]0{2}/)) return t;
  return null;
}
