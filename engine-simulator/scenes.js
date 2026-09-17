// 場面（坂と直線）。勾配の数値と出典は ref/grades_research.md。
// ⚠️ プロファイルは「一次資料で確認できた最急勾配×区間長」と「区間全体の標高差」に合うように、残りの区間を均した近似＝縦断図そのものではない。
export const SCENES = [
  { id: 'dangozaka', name: '中央道 談合坂の上り（下り線 上野原IC→談合坂SA）', short: '談合坂', region: '東',
    entryKmh: 80, limitKmh: 80,
    profile: [{ len_m: 1000, gradePct: 1.0 }, { len_m: 1800, gradePct: 5.0 }, { len_m: 2500, gradePct: 2.0 }],
    facts: '区間 5.3km・標高差 +150m・最急 5.0% が 1.8km（鶴川大橋の先）・制限 80km/h。⚠️ 5% の上りは甲府方面（下り線）にある。東京方面（上り線）はほぼ平坦。',
    src: 'NEXCO 中日本 事後評価資料（最急 5.0%・L=1.8km）・国土地理院 標高API（238→385m）・施設間距離 5.3km' },
  { id: 'omega', name: '名阪国道 Ωカーブの上り（天理東IC→福住IC）', short: 'Ωカーブ', region: '西',
    entryKmh: 60, limitKmh: 60,
    profile: [{ len_m: 2000, gradePct: 2.5 }, { len_m: 2000, gradePct: 6.0 }, { len_m: 2500, gradePct: 2.0 }, { len_m: 2500, gradePct: 4.0 }, { len_m: 2000, gradePct: 2.0 }],
    facts: '11km 連続の上り・標高差 約 +350m（天理東 約145m→福住 約495m）・最急 6%・登坂車線あり・制限 60km/h（一部 70）。高速自動車国道ではなく国道25号の自動車専用道路。',
    src: 'Wikipedia「Ωカーブ」「名阪国道」（出典＝国土交通省 2021 資料・未閲覧）・国土地理院 標高API。勾配の分布は近似' },
  { id: 'kakuto', name: '九州道 加久藤越え（人吉IC→加久藤トンネル・下り線）', short: '加久藤', region: '西',
    entryKmh: 80, limitKmh: 80,
    profile: [{ len_m: 2000, gradePct: 1.0 }, { len_m: 5000, gradePct: 3.0 }, { len_m: 4000, gradePct: 0.6 }],
    // ⚠️ 標識読み（3.5〜4.0%）と標高差（+190m＝平均 1.7%）は両立しない（4.0% が 5km 続けば 200m で全部使い切る）。
    //    この道具は標高差を採って最急 3.0% で均した＝画面の「いちばん急な区間 3%」と標識の数字が食い違って見えないよう、その事情を facts に書く。
    facts: '約 11km・標高差 約 +190m・制限 80km/h。反対車線の「下り坂 最大傾斜」標識は 3.5〜4.0% だが、区間全体の標高差に合わせると平均 1.7%＝この道具では最急 3.0% で均している。緩いが長い＝速度が落ち切って張り付く坂。',
    src: '道路趣味サイトの標識読み（二次）・国土地理院 標高API・トンネル計画高 約330m' },
  { id: 'free', name: '一定勾配の坂（勾配と長さを自分で決める）', short: '自由', region: null,
    entryKmh: 80, limitKmh: null, gradePct: 4, length_m: 3000, adjustable: true,
    facts: '道路構造令の縦断勾配の上限＝設計速度 80km/h で標準 4%・特例 7%。高速道路で 5〜6% は限界に近い坂。', src: '道路構造令 第20条' },
  { id: 'drag', name: '0-400m（平地・全開）', short: '0-400', region: null, kind: 'drag', distance_m: 400,
    facts: '発進は 1速でクラッチをつないだ直後を回転 2500 の駆動力で近似。半クラッチの上手さは扱わない。変速は回転 5000 で 0.4 秒。', src: '—' },
];
export const sceneById = (id) => SCENES.find(s => s.id === id) || SCENES[0];
