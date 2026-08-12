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
  // 「20W-50」「20の50」「冬季15w50夏季20w50」のように粘度しか書かれていない回答は
  // ブランドではないので集計から外す。銘柄と併記されたもの（「広島高潤 飛龍15w-50」）は残る。
  // 全体統計では61分の5の誤差でも、detail.html で1台に対して使うときは
  // その車にとって100%の誤りになるため、ブランドを名乗っていないものは数えない。
  if (v.replace(/[\s\-\/,、#＃]|w|の|冬季|夏季|通年/g, '').match(/^[0-9]+$/)) return null;
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

// 47都道府県（地図・集計の突き合わせ用の正解リスト）
const PREFECTURES_JA = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県"
];

// ローマ字表記・市区町村まで書かれた住所を、47都道府県のどれかに寄せる。
// 実データにある例：「TOYAMA」「高知県四万十市」「横浜市神奈川区」。
// どれにも当てはまらなければ null（地図に塗らない）。
function normalizePrefecture(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const exact = PREFECTURES_JA.find(p => p === s);
  if (exact) return exact;
  const en = {
    'HOKKAIDO':'北海道','AOMORI':'青森県','IWATE':'岩手県','MIYAGI':'宮城県','AKITA':'秋田県',
    'YAMAGATA':'山形県','FUKUSHIMA':'福島県','IBARAKI':'茨城県','TOCHIGI':'栃木県','GUNMA':'群馬県',
    'SAITAMA':'埼玉県','CHIBA':'千葉県','TOKYO':'東京都','KANAGAWA':'神奈川県','NIIGATA':'新潟県',
    'TOYAMA':'富山県','ISHIKAWA':'石川県','FUKUI':'福井県','YAMANASHI':'山梨県','NAGANO':'長野県',
    'GIFU':'岐阜県','SHIZUOKA':'静岡県','AICHI':'愛知県','MIE':'三重県','SHIGA':'滋賀県',
    'KYOTO':'京都府','OSAKA':'大阪府','HYOGO':'兵庫県','NARA':'奈良県','WAKAYAMA':'和歌山県',
    'TOTTORI':'鳥取県','SHIMANE':'島根県','OKAYAMA':'岡山県','HIROSHIMA':'広島県','YAMAGUCHI':'山口県',
    'TOKUSHIMA':'徳島県','KAGAWA':'香川県','EHIME':'愛媛県','KOCHI':'高知県','FUKUOKA':'福岡県',
    'SAGA':'佐賀県','NAGASAKI':'長崎県','KUMAMOTO':'熊本県','OITA':'大分県','MIYAZAKI':'宮崎県',
    'KAGOSHIMA':'鹿児島県','OKINAWA':'沖縄県'
  }[s.toUpperCase().replace(/[\s-]/g, '')];
  if (en) return en;
  // 「高知県四万十市」のように県名を丸ごと含む場合
  const contains = PREFECTURES_JA.find(p => s.includes(p));
  if (contains) return contains;
  // 「横浜市神奈川区」のように末尾の都道府県を落として書かれている場合。
  // 「北海道」は語幹が取れないので上の判定で拾い切っている。
  const stem = PREFECTURES_JA.find(p => {
    const base = p.replace(/[都府県]$/, '');
    return base.length >= 2 && s.includes(base);
  });
  return stem || null;
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

// タイヤサイズを「幅・扁平率・リム径」に分解して組み立て直す。
//
// 実データは「125R12」「145/70-12」「125R12 62S」「165/70/R10」「135／80R12」のように
// 区切りも大文字小文字も全角半角もばらばらなので、数字だけを順に拾って解釈する。
//
// 扁平率が書かれていないものは80とみなす（125R12 = 125/80R12 という旧車の慣習）。
// 表示はオーナーが実際に口にする短い形にし、80以外のときだけ扁平率を書く。
// ※以前は「145で始まり12で終わる」を全部 145/70R12 に寄せており、扁平80の
//   145R12（外径が違う別サイズ）を混ぜてしまっていた。
// ※リム径が読み取れないもの（「145」「165/70R」だけの回答）は集計に入れない。
function normalizeTireSize(t) {
  if (!t) return null;
  const v = String(t).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  if (v.match(/不明|未記入/)) return null;

  const nums = (v.match(/\d+/g) || []).map(Number);
  const width = nums.find(n => n >= 100 && n <= 235);
  if (!width) return null;
  const rest = nums.slice(nums.indexOf(width) + 1);
  // リム径は8〜16インチ。扁平率(30〜90)より先に現れることはない
  const rimIdx = rest.findIndex(n => n >= 8 && n <= 16);
  if (rimIdx === -1) return null;
  const rim = rest[rimIdx];
  const aspect = rest.slice(0, rimIdx).find(n => n >= 30 && n <= 90) || 80;
  return aspect === 80 ? `${width}R${rim}` : `${width}/${aspect}R${rim}`;
}

// 正規化済みのタイヤサイズからリム径(インチ)を取り出す。
// リム幅と違い、径はタイヤサイズに必ず含まれている冗長な情報なので、
// rim_diameter_in を別に集計せずこちらから導く（回答数もこちらの方が多い）。
function rimDiameterFromTireSize(label) {
  const m = /R(\d{1,2})$/.exec(String(label || ''));
  return m ? m[1] : null;
}

// リム幅(J)。3〜7インチの範囲外は誤入力として捨てる
// （タイヤ幅を書いた「125」、3.5の打ち間違いの「35」が実データにある）。
// 打ち間違いを直すのは推測になるので拾わない。
function normalizeRimWidth(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
  if (!isFinite(n) || n < 3 || n > 7) return null;
  return n + 'J';
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
