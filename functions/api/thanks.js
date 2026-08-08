/**
 * 新規登録オーナーへの完了メール — POST /api/thanks
 *
 * これは移設ではなく「壊れていたものの作り直し」。
 * edit.html は新規登録時に GAS へ {action:'send_thanks_email'} をPOSTしていたが、
 * main.gs の doPost にその分岐が無く 'Unknown action' で落ちていた。しかも
 * mode:'no-cors' で投げているためフロントはエラーに気づけず、**登録者に完了メールが
 * 届かない状態が気づかれないまま続いていた**（2026-08-08 調査で判明）。
 * 文面は main.gs sendNotifications() のものを流用し、古い vercel.app のURLだけ直した。
 *
 * 宛先はリクエストの値を信用せず、docId で cars を引いた owner_email に送る。
 * 任意のアドレスへ送れる踏み台にしないため。あわせて、登録直後以外は送らないよう
 * created_at に時間の窓をかけている（同じdocIdの再送で嫌がらせに使われるのを防ぐ）。
 *
 * 必要な環境変数（Cloudflare Pages の設定画面で登録する）:
 *   SUPABASE_URL / SUPABASE_SECRET_KEY / BREVO_API_KEY
 */

const SENDER_EMAIL = "news@registro500.com";
const SENDER_NAME = "Registro500 Giappone";
const SITE = "https://www.registro500.com";

// 登録直後の呼び出しだけを通す窓。フロントは保存の直後に叩くので30分あれば十分。
const FRESH_WINDOW_MS = 30 * 60 * 1000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.BREVO_API_KEY) {
    console.error("環境変数が未設定です");
    return json({ success: false, error: "サーバー設定が未完了です。" }, 500);
  }

  let form;
  try {
    const payload = await request.json();
    form = payload.formData || payload;
  } catch (e) {
    return json({ success: false, error: "リクエストの形式が不正です。" }, 400);
  }

  const docId = String(form.docId || "").trim();
  if (!docId) return json({ success: false, error: "docId がありません。" }, 400);

  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/cars`
    + `?select=handle_name,owner_email,created_at`
    + `&document_id=eq.${encodeURIComponent(docId)}&limit=1`;

  let car;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase HTTP ${res.status} / ${await res.text()}`);
    car = (await res.json())[0];
  } catch (e) {
    console.error("Supabase 参照エラー:", e);
    return json({ success: false, error: "登録内容の確認に失敗しました。" }, 502);
  }

  const to = String((car && car.owner_email) || "").trim();
  if (!to.includes("@")) {
    // 車両が無い/メール未登録。登録処理自体は成功しているのでフロントは止めない。
    return json({ success: false, error: "送信先が見つかりません。" }, 404);
  }

  const createdAt = car.created_at ? Date.parse(car.created_at) : NaN;
  if (!Number.isNaN(createdAt) && Date.now() - createdAt > FRESH_WINDOW_MS) {
    return json({ success: false, error: "登録直後の呼び出しではありません。" }, 409);
  }

  const subject = "【Registro500】愛車の登録が完了しました";
  const body = `
${car.handle_name || "オーナー"} 様

Registro500 Giappone へのご登録、誠にありがとうございます。
登録が完了いたしました。

■あなたの愛車ページ
${SITE}/detail.html?doc=${docId}

※他のオーナー様へのお知らせは、毎朝の「新着まとめメール」にて配信されます。
---------------------------------------------------------
Registro500 Giappone 運営事務局
`;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        textContent: body,
      }),
    });
    if (!res.ok) throw new Error(`Brevo HTTP ${res.status} / ${await res.text()}`);
  } catch (e) {
    console.error("Brevo 送信エラー:", e);
    return json({ success: false, error: "メール送信に失敗しました。" }, 502);
  }

  return json({ success: true });
}
