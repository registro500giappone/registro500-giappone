/**
 * おすすめ工具の新規投稿を管理人へ即時に知らせる — POST /api/tool-notify
 *
 * 投稿ページ（/tools-edit）が保存に成功した直後に { toolId } を送ってくる。
 *
 * 踏み台にさせないための条件（すべて満たしたときだけ1通送る）:
 *   - Supabase のアクセストークンを /auth/v1/user で確かめ、ログイン中の本人を特定する
 *   - その投稿の車が本人の車である（owner_user_id か owner_email が一致）
 *   - 投稿から CLAIM_WINDOW_MS 以内
 *   - admin_notified_at が空の行だけを「先に印を付けてから」送る＝1件につき1回。
 *     同時に2回呼ばれても印を付けられるのは片方だけなので二重送信にならない。
 *     送信に失敗したら印を戻す（翌朝のダイジェストとは別経路なので、ここで落ちても投稿は残る）。
 * 宛先は固定の管理人アドレスだけ＝本文に何を書かれても他人へは届かない。
 *
 * 購入リンクの自動付与（2026-10-27 ユーザー決裁＝確認なしで付けてよい）:
 *   通知の前に Amazon Creators API で商品を探し、工具名の型番とメーカー名が商品名にそろう候補が
 *   ちょうど1つのときだけ amazon_url を付ける。型番が無い・候補が割れる・APIが使えない（403
 *   AssociateNotEligible＝販売実績の条件待ち）ときは何もしない。結果は管理人メールに書く。
 *   ここで何が起きても通知と投稿は止めない。
 *
 * 必要な環境変数: SUPABASE_URL / SUPABASE_SECRET_KEY / BREVO_API_KEY（/api/inquiry と同じ）
 *   任意: AMAZON_CLIENT_ID / AMAZON_CLIENT_SECRET（Creators API の認証情報＝py/.env の PAAPI_ACCESS_KEY / PAAPI_SECRET_KEY と同じ値）
 */

const SENDER_EMAIL = "news@registro500.com";
const SENDER_NAME = "Registro500 Giappone";
const ADMIN_EMAIL = "registro500giappone@gmail.com";
const SITE = "https://www.registro500.com";
const CLAIM_WINDOW_MS = 30 * 60 * 1000;

const CAT_LABEL = {
  turn: "回す", grip: "つかむ・切る・叩く", measure: "測る・調べる", lift: "持ち上げる・支える",
  special: "専用工具", light: "照らす・手を守る", repair: "応急・補修", part: "パーツ・消耗品",
};
const USAGE_LABEL = { carry: "車に積む", garage: "ガレージで使う", both: "車に積む・ガレージでも使う" };

// ── Amazon 購入リンクの自動付与 ──
const AMAZON_TAG = "registro500tl-22";  // /tools 専用タグ
const AMZ_TOKEN_URL = "https://api.amazon.co.jp/auth/o2/token";
const AMZ_SEARCH_URL = "https://creatorsapi.amazon/catalog/v1/searchItems";
const AMZ_MARKETPLACE = "www.amazon.co.jp";
const AMZ_TIMEOUT_MS = 6000;
const UNIT_RE = /^\d+(?:MM|CM|M|KG|G|V|W|A|PCS|PC|P|PCE)$/;  // 「84cm」などは型番ではない

const norm = (s) => String(s || "").normalize("NFKC").toUpperCase().replace(/[\s\-‐‑–—―ー_/.・]/g, "");

// 工具名から型番（数字を含む5文字以上の英数字）とメーカー名の候補を取り出す
export function parseToolName(name) {
  const nfkc = String(name || "").normalize("NFKC");
  const words = nfkc.split(/[^A-Za-z0-9\-]+/).filter(Boolean);
  const models = [], brands = [];
  for (const w of words) {
    const n = norm(w);
    if (/\d/.test(n) && n.length >= 5 && !UNIT_RE.test(n)) models.push(n);
    else if (/[A-Z]/.test(n) && n.length >= 2 && !UNIT_RE.test(n)) brands.push(n);
  }
  // 英字のメーカー名が無いとき（「オノウエ ○○」など）は先頭の語をメーカー名として使う
  if (!brands.length) {
    const head = nfkc.split(/[\s(（|｜]+/).filter(Boolean)[0];
    if (head && !models.includes(norm(head))) brands.push(norm(head));
  }
  return { models: [...new Set(models)], brands: [...new Set(brands)] };
}

// 検索結果から「型番とメーカー名がそろう」商品を選ぶ。ちょうど1つのときだけ返す
export function pickAmazonMatch(name, items) {
  const { models, brands } = parseToolName(name);
  if (!models.length || !brands.length) return { reason: "工具名に型番かメーカー名が無い" };
  const hits = new Map();
  for (const it of items || []) {
    const title = norm(it?.itemInfo?.title?.displayValue);
    const brand = norm(it?.itemInfo?.byLineInfo?.brand?.displayValue);
    if (!it?.asin || !title) continue;
    const modelOk = models.some((m) => title.includes(m));
    const brandOk = brands.some((b) => title.includes(b) || (brand && (brand.includes(b) || b.includes(brand))));
    if (modelOk && brandOk) hits.set(it.asin, it.itemInfo.title.displayValue);
  }
  if (hits.size === 0) return { reason: "型番とメーカー名がそろう商品が無い" };
  if (hits.size > 1) return { reason: `候補が${hits.size}つに割れた（${[...hits.keys()].join(", ")}）` };
  const [asin, title] = [...hits][0];
  return { asin, title, url: `https://www.amazon.co.jp/dp/${asin}?tag=${AMAZON_TAG}` };
}

async function findAmazon(env, name) {
  if (!env.AMAZON_CLIENT_ID || !env.AMAZON_CLIENT_SECRET) return { reason: "認証情報が未設定" };
  const { models, brands } = parseToolName(name);
  if (!models.length || !brands.length) return { reason: "工具名に型番かメーカー名が無い" };

  const tRes = await fetch(AMZ_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.AMAZON_CLIENT_ID,
      client_secret: env.AMAZON_CLIENT_SECRET,
      scope: "creatorsapi::default",
    }),
    signal: AbortSignal.timeout(AMZ_TIMEOUT_MS),
  });
  if (!tRes.ok) return { reason: `トークン取得に失敗（HTTP ${tRes.status}）` };
  const { access_token } = await tRes.json();

  const longest = models.slice().sort((a, b) => b.length - a.length)[0];
  const sRes = await fetch(AMZ_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
      "x-marketplace": AMZ_MARKETPLACE,
    },
    body: JSON.stringify({
      partnerTag: AMAZON_TAG,
      partnerType: "Associates",
      marketplace: AMZ_MARKETPLACE,
      keywords: `${brands[0]} ${longest}`,
      itemCount: 10,
      resources: ["itemInfo.title", "itemInfo.byLineInfo"],
    }),
    signal: AbortSignal.timeout(AMZ_TIMEOUT_MS),
  });
  if (!sRes.ok) {
    const detail = await sRes.text();
    if (sRes.status === 403 && detail.includes("AssociateNotEligible")) {
      return { reason: "APIの利用資格なし（直近30日の販売10件の条件待ち）" };
    }
    return { reason: `検索に失敗（HTTP ${sRes.status}: ${detail.slice(0, 200)}）` };
  }
  const data = await sRes.json();
  return pickAmazonMatch(name, data?.searchResult?.items);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.BREVO_API_KEY) {
    console.error("環境変数が未設定です");
    return json({ success: false }, 500);
  }

  let toolId;
  try {
    toolId = String((await request.json()).toolId || "").trim();
  } catch (e) {
    return json({ success: false }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(toolId)) return json({ success: false }, 400);

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const svc = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` };

  // 本人の確認
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json({ success: false }, 401);
  let user;
  try {
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return json({ success: false }, 401);
    user = await res.json();
  } catch (e) {
    console.error("Auth 確認エラー:", e);
    return json({ success: false }, 502);
  }
  if (!user || !user.id) return json({ success: false }, 401);

  try {
    // 投稿と車を引く
    const tRes = await fetch(
      `${base}/rest/v1/owner_tools?select=id,car_id,name,category,usage,comment,photo_url,created_at,admin_notified_at`
        + `&id=eq.${toolId}&limit=1`, { headers: svc });
    if (!tRes.ok) throw new Error(`owner_tools HTTP ${tRes.status}`);
    const tool = (await tRes.json())[0];
    if (!tool) return json({ success: false }, 404);
    if (tool.admin_notified_at) return json({ success: true, already: true });
    if (Date.now() - Date.parse(tool.created_at) > CLAIM_WINDOW_MS) return json({ success: false }, 409);

    const cRes = await fetch(
      `${base}/rest/v1/cars?select=document_id,handle_name,model_display_c,owner_user_id,owner_email`
        + `&document_id=eq.${encodeURIComponent(tool.car_id)}&limit=1`, { headers: svc });
    if (!cRes.ok) throw new Error(`cars HTTP ${cRes.status}`);
    const car = (await cRes.json())[0];
    const owns = car && (car.owner_user_id === user.id
      || (!car.owner_user_id && user.email
        && String(car.owner_email || "").toLowerCase() === String(user.email).toLowerCase()));
    if (!owns) return json({ success: false }, 403);

    // 先に印を付ける（空の行だけ）＝1件1回
    const claim = await fetch(
      `${base}/rest/v1/owner_tools?id=eq.${toolId}&admin_notified_at=is.null`, {
        method: "PATCH",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ admin_notified_at: new Date().toISOString() }),
      });
    if (!claim.ok) throw new Error(`claim HTTP ${claim.status}`);
    if (!(await claim.json()).length) return json({ success: true, already: true });

    // 購入リンクの自動付与（失敗しても通知は続ける）
    let amazonLine;
    try {
      const found = await findAmazon(env, tool.name);
      if (found.url) {
        const put = await fetch(`${base}/rest/v1/owner_tools?id=eq.${toolId}&amazon_url=is.null`, {
          method: "PATCH",
          headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ amazon_url: found.url }),
        });
        if (!put.ok) throw new Error(`amazon_url HTTP ${put.status}`);
        amazonLine = `購入リンクを自動で付けました。
　商品名: ${found.title}
　リンク: ${found.url}
違う商品だったら「リンクを外して」と指示してください。`;
      } else {
        amazonLine = `購入リンクは自動では付けていません（${found.reason}）。
付けるときは「工具のリンクを付けて」と指示してください。`;
      }
    } catch (e) {
      console.error("Amazon 自動リンクのエラー:", e);
      amazonLine = `購入リンクの自動付与でエラー（${e.message || e}）。
付けるときは「工具のリンクを付けて」と指示してください。`;
    }

    const owner = `${car.handle_name || "オーナー"}様（${car.model_display_c || ""} / ${car.document_id}）`;
    const subject = `【Registro500】おすすめ工具に新しい投稿：${tool.name}`;
    const body = `おすすめ工具に新しい投稿がありました。

投稿者: ${owner}
工具名: ${tool.name}
分類　: ${CAT_LABEL[tool.category] || tool.category} ／ ${USAGE_LABEL[tool.usage] || tool.usage}
おすすめポイント:
${tool.comment}

写真　: ${tool.photo_url || "なし"}

一覧で見る: ${SITE}/tools
${amazonLine}
`;
    const send = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: ADMIN_EMAIL }],
        subject,
        textContent: body,
      }),
    });
    if (!send.ok) {
      // 印を戻す（次に呼ばれたときに再送できるように）
      await fetch(`${base}/rest/v1/owner_tools?id=eq.${toolId}`, {
        method: "PATCH",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ admin_notified_at: null }),
      });
      throw new Error(`Brevo HTTP ${send.status} / ${await send.text()}`);
    }
    return json({ success: true });
  } catch (e) {
    console.error("tool-notify エラー:", e);
    return json({ success: false }, 502);
  }
}
