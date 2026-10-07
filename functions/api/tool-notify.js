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
 * 必要な環境変数: SUPABASE_URL / SUPABASE_SECRET_KEY / BREVO_API_KEY（/api/inquiry と同じ）
 */

const SENDER_EMAIL = "news@registro500.com";
const SENDER_NAME = "Registro500 Giappone";
const ADMIN_EMAIL = "registro500giappone@gmail.com";
const SITE = "https://www.registro500.com";
const CLAIM_WINDOW_MS = 30 * 60 * 1000;

const CAT_LABEL = {
  turn: "回す", grip: "つかむ・切る・叩く", measure: "測る・調べる", lift: "持ち上げる・支える",
  special: "専用工具", light: "照らす・手を守る", repair: "応急・補修",
};
const USAGE_LABEL = { carry: "車に積む", garage: "ガレージで使う", both: "両方" };

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

    const owner = `${car.handle_name || "オーナー"}様（${car.model_display_c || ""} / ${car.document_id}）`;
    const subject = `【Registro500】おすすめ工具に新しい投稿：${tool.name}`;
    const body = `おすすめ工具に新しい投稿がありました。

投稿者: ${owner}
工具名: ${tool.name}
分類　: ${CAT_LABEL[tool.category] || tool.category} ／ ${USAGE_LABEL[tool.usage] || tool.usage}
一言　:
${tool.comment}

写真　: ${tool.photo_url || "なし"}

一覧で見る: ${SITE}/tools
購入リンクを付けるときは「工具のリンクを付けて」と指示してください。
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
