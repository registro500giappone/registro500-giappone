/**
 * 車両ページ /detail?doc=DOC_<番号> — 静的な detail.html を返しつつ、SNS のカード用の head をその車のものに書き換える（2026-11-18）
 *
 * なぜサーバー側か: X・LINE・Facebook のカードは JS を動かさずに head だけ読む＝detail.html の updateOGP() での差し替えは効かない
 *   （それまでは全車「車両詳細 - Registro500 Giappone」＋サイトのロゴ画像だった）。/car/<番号> は functions/car/[no].js が 301 でここへ来る。
 * 読むのは公開キー＝RLS で匿名に見える車しか返らない。doc が無い・形が違う・見つからない・DB の失敗のときは雛形のまま返す。
 * 書き換えるもの: title・description・og:title・og:description・canonical・og:url（足す）・og:image（表紙の写真があるとき）
 * 文言は detail.html の updateOGP() と同じ組み立て（どちらかを変えたらもう片方も）。Registro312 の functions/car/[no].js と同じ考え方。
 */
const SB_URL = "https://ttlttclfovuzafvghvaq.supabase.co";
// 公開キー（config.js で全訪問者に配っている値・RLS が効く）。環境変数があればそちらを使う
const PUBLISHABLE = "sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt";
const DOC_RE = /^DOC_[1-9][0-9]{0,5}$/;

export function headFor(car, doc) {
  const is126 = String(car.car_type || "") === "126";
  const site = is126 ? "Registro126" : "Registro500";
  const model = car.model_display_c || (is126 ? "FIAT 126" : "FIAT 500");
  const who = car.handle_name ? `${car.handle_name}さんの` : "";
  const sold = car.is_sold ? "【過去所有】" : "";
  // ページの題名（タブ・検索結果）はサイトがオーナーを紹介する声＝「◯◯さんの」のまま
  const title = `${sold}${who}${model} - ${site}`;
  // カード（og:title / og:description）は誰が送っても同じものが届く＝「さん」も「私の」も付けない見出しの形
  // 持ち主が送ると自分に「さん」を付けることになるため。県は出す。
  const cardTitle = `${sold}${model}${car.year ? `・${car.year}年式` : ""}${car.handle_name ? `｜${car.handle_name}` : ""}`;
  const where = [car.body_color, car.prefecture].map(v => String(v || "").trim()).filter(Boolean).join("・");
  const desc = `${where ? where + "。" : ""}全国のクラシックFIAT ${is126 ? "126" : "500"}が集まる ${site} Giappone の登録車両です。`;
  const url = `https://www.registro500.com/detail?doc=${doc}`;
  // 表紙の写真（正方形）を上下は切らず、左右をサイトの地色で埋めて 1200×630 に（Cloudflare の画像変換・fit=pad）。
  // 地色 #e3dac4（og/site-ja.png と同じ）。作るのは functions/og-car/[file].js（短い URL＝X が中身をほどいて壊さない）。
  // 変換は registro500.com の Images → Transformations で有効化し、Sources に Firebase の置き場所だけを許可して動く。
  const image = /^https:\/\/firebasestorage\.googleapis\.com\//.test(car.photo_main || "")
    ? `https://www.registro500.com/og-car/${doc.slice(4)}.jpg`
    : null;
  return { title, cardTitle, desc, url, image };
}

async function loadCar(env, doc) {
  const key = env.SUPABASE_PUBLISHABLE_KEY || PUBLISHABLE;
  const r = await fetch(`${SB_URL}/rest/v1/cars?select=document_id,handle_name,model_display_c,car_type,is_sold,photo_main,year,body_color,prefecture&document_id=eq.${doc}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

export async function onRequestGet({ request, env, next }) {
  const page = await next();
  const doc = new URL(request.url).searchParams.get("doc") || "";
  return withCarHead(page, env, doc);
}

// functions/car/[no].js も使う（カード用クローラーには /car/<番号> で転送せずにこれを返す）
export async function withCarHead(page, env, doc) {
  if (!DOC_RE.test(doc) || !page.ok || !(page.headers.get("content-type") || "").includes("text/html")) return page;
  let car = null;
  try { car = await loadCar(env, doc); } catch { car = null; }
  if (!car) return page;

  const m = headFor(car, doc);
  const set = v => ({ element(el) { el.setAttribute("content", v); } });
  let rw = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(m.title); } })
    .on('meta[name="description"]', set(m.desc))
    .on('meta[property="og:title"]', set(m.cardTitle))
    .on('meta[property="og:description"]', set(m.desc))
    .on('link[rel="canonical"]', { element(el) { el.setAttribute("href", m.url); } })
    .on('meta[property="og:type"]', { element(el) { el.after(`<meta property="og:url" content="${m.url}">`, { html: true }); } });
  // 変換後は雛形と同じ 1200×630 なので、og:image:width / height の申告はそのまま
  if (m.image) rw = rw.on('meta[property="og:image"]', set(m.image));
  const out = rw.transform(page);
  const res = new Response(out.body, out);
  res.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return res;
}
