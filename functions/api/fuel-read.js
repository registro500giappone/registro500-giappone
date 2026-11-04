/**
 * 給油レシートとメーターの写真を読む — POST /api/fuel-read
 *
 * 給油の記録（/my-fuel）から { image } を1枚ずつ送ってくる。image は端末で長辺1000px程度に
 * 縮めた JPEG の base64（data: の頭は付いていてもよい）。
 * 返すのは レシートの取引日・給油量・合計金額・油種 と メーターの走行距離 だけ。
 *
 * 守る線:
 *   - ログイン中で、車を登録しているオーナー（または管理人）からの要求だけ受ける
 *   - 1人1日（直近24時間）20回まで。数えるために fuel_read_log へ「誰がいつ」だけを残す
 *   - 写真は読むだけで保存しない（レシートに氏名・カード番号の一部・店の住所が写るため）
 *   - 読み取りは Gemini の有料枠のキー（送った写真は学習に使われない）
 *   - 読めた値は画面の確認欄に入れるだけ。保存するかはオーナーが決める
 *
 * 必要な環境変数: SUPABASE_URL / SUPABASE_SECRET_KEY / GEMINI_API_KEY
 */

const ADMIN_EMAIL = "registro500giappone@gmail.com";
const MODEL = "gemini-3.5-flash-lite"; // 2026-11-04 実物6枚＋メーター15台で選んだ（-latest は使わない＝中身が勝手に替わる）
const DAILY_LIMIT = 20; // レシートとメーターを別々に撮ると1回の給油で2回使う
const MAX_B64 = 2 * 1024 * 1024; // 縮めた写真なら 200KB 前後
const TIMEOUT_MS = 20000;

// レシートとメーターは1枚に一緒でも、どちらか片方だけの写真でもよい（2026-11-04 ユーザー指示＝1枚に収まらないことがある）
const PROMPT = `この写真には、給油レシートと車のオドメーター（走行距離計）の両方、またはどちらか片方だけが写っています。次をJSONで返してください。写っていない・読めない項目は必ず null（推測で埋めない）。

date: レシート上部の取引日（YYYY-MM-DD。下端の印字日ではない）
liters: 給油量（数値）
total_yen: 合計金額（「合計」の行・数値。広告の金額は拾わない）
fuel: regular / premium / diesel のどれか（スーパーマグナム等の銘柄名はハイオク=premium）
odometer_km: メーターの本体の距離計の数字（整数。トリップメーターの短い数字ではない。針で隠れた桁は推測せず null）`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// AI の返事を、画面に入れてよい形だけに絞る（形の合わない値は null）
export function cleanReading(r) {
  if (Array.isArray(r)) r = r[0];
  if (!r || typeof r !== "object") r = {};
  const num = (v) => {
    const n = typeof v === "string" ? Number(v.replace(/[,，\s円Lℓkm]/gi, "")) : Number(v);
    return v == null || v === "" || !Number.isFinite(n) ? null : n;
  };
  let date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null;
  if (date && Number.isNaN(Date.parse(date + "T00:00:00Z"))) date = null;
  let liters = num(r.liters);
  if (liters != null && (liters <= 0 || liters > 60)) liters = null;
  if (liters != null) liters = Math.round(liters * 100) / 100;
  let total = num(r.total_yen);
  if (total != null && (total < 0 || total > 1000000)) total = null;
  if (total != null) total = Math.round(total);
  const fuel = ["regular", "premium", "diesel"].includes(r.fuel) ? r.fuel : null;
  let odo = num(r.odometer_km);
  if (odo != null && (odo < 0 || odo > 999999 || !Number.isInteger(odo))) odo = null;
  return { date, liters, total_yen: total, fuel, odometer_km: odo };
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.GEMINI_API_KEY) {
    console.error("環境変数が未設定です");
    return json({ success: false }, 500);
  }

  let image;
  try {
    image = String((await request.json()).image || "").replace(/^data:image\/jpeg;base64,/, "");
  } catch (e) {
    return json({ success: false }, 400);
  }
  if (!image || image.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return json({ success: false, reason: "bad_image" }, 400);
  }

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const svc = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` };

  // 本人の確認（ログイン中で、車を登録しているオーナー）
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
  const email = String(user.email || "").toLowerCase();
  if (email !== ADMIN_EMAIL) try {
    const filter = email
      ? `or=(owner_user_id.eq.${user.id},owner_email.ilike.${encodeURIComponent(email)})`
      : `owner_user_id=eq.${user.id}`;
    const cRes = await fetch(`${base}/rest/v1/cars?select=document_id&${filter}&limit=1`, { headers: svc });
    if (!cRes.ok) throw new Error(`cars HTTP ${cRes.status}`);
    if (!(await cRes.json()).length) return json({ success: false }, 403);
  } catch (e) {
    console.error("車の確認エラー:", e);
    return json({ success: false }, 502);
  }

  // 1日の回数（直近24時間）。数えてから1件足す＝読み取りに失敗しても1回に数える
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const lRes = await fetch(
      `${base}/rest/v1/fuel_read_log?select=id&user_id=eq.${user.id}&created_at=gte.${encodeURIComponent(since)}&limit=${DAILY_LIMIT}`,
      { headers: svc });
    if (!lRes.ok) throw new Error(`log HTTP ${lRes.status}`);
    if ((await lRes.json()).length >= DAILY_LIMIT) return json({ success: false, reason: "daily_limit" }, 429);
    const iRes = await fetch(`${base}/rest/v1/fuel_read_log`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id }),
    });
    if (!iRes.ok) throw new Error(`log insert HTTP ${iRes.status}`);
  } catch (e) {
    console.error("回数の確認エラー:", e);
    return json({ success: false }, 502);
  }

  // 読む
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: image } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("Gemini HTTP", res.status, (await res.text()).slice(0, 300));
      return json({ success: true, reading: null, reason: `ai_${res.status}` });
    }
    const out = await res.json();
    const text = out?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) {}
    return json({ success: true, reading: cleanReading(parsed) });
  } catch (e) {
    console.error("読み取りエラー:", e);
    return json({ success: true, reading: null, reason: "ai_failed" });
  }
}
