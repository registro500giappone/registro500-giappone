/**
 * detect-license-plate
 * Supabase Edge Function
 *
 * Google Cloud Vision API を使ってナンバープレートを検出し
 * ピクセル座標で返す。
 *
 * 入力: { imageBase64: string, width: number, height: number }
 * 出力: { plates: [{ x, y, width, height, score }] }
 *
 * Supabase Secrets に GOOGLE_VISION_API_KEY を設定すること。
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://www.registro500.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  // CORS プリフライト
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const apiKey = Deno.env.get("GOOGLE_VISION_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Vision API key not configured" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  let body: { imageBase64: string; width: number; height: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const { imageBase64, width, height } = body;
  if (!imageBase64 || !width || !height) {
    return new Response(
      JSON.stringify({ error: "imageBase64, width, height are required" }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Vision API 呼び出し
  const visionResp = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [
              { type: "OBJECT_LOCALIZATION", maxResults: 10 },
            ],
          },
        ],
      }),
    }
  );

  if (!visionResp.ok) {
    const errText = await visionResp.text();
    return new Response(
      JSON.stringify({ error: "Vision API error", detail: errText }),
      { status: 502, headers: CORS_HEADERS }
    );
  }

  const visionData = await visionResp.json();
  const annotations = visionData?.responses?.[0]?.localizedObjectAnnotations ?? [];

  const plates: { x: number; y: number; width: number; height: number; score: number }[] = [];

  for (const obj of annotations) {
    const name: string = (obj.name ?? "").toLowerCase();
    // "Vehicle registration plate" などを検出
    if (!name.includes("plate") && !name.includes("registration") && !name.includes("number")) {
      continue;
    }
    const score: number = obj.score ?? 0;
    if (score < 0.3) continue;

    const verts: { x?: number; y?: number }[] = obj.boundingPoly?.normalizedVertices ?? [];
    const xs = verts.map((v) => v.x ?? 0);
    const ys = verts.map((v) => v.y ?? 0);
    const nx1 = Math.min(...xs);
    const ny1 = Math.min(...ys);
    const nx2 = Math.max(...xs);
    const ny2 = Math.max(...ys);

    // 正規化座標 → ピクセル
    const px = Math.round(nx1 * width);
    const py = Math.round(ny1 * height);
    const pw = Math.round((nx2 - nx1) * width);
    const ph = Math.round((ny2 - ny1) * height);

    if (pw > 0 && ph > 0) {
      plates.push({ x: px, y: py, width: pw, height: ph, score });
    }
  }

  return new Response(JSON.stringify({ plates }), {
    status: 200,
    headers: CORS_HEADERS,
  });
});
