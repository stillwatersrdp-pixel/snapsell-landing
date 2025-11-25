export async function onRequest(context) {
  // 1. 取得請求內容
  const request = context.request;
  
  // 只允許 POST 請求
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // 2. 從 Cloudflare 環境變數取得 API Key (安全！)
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing API Key in Server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json();
    const { prompt, imageBase64, mimeType } = body;

    // 3. 由伺服器端向 Google 發送請求 (不會有 CORS 問題)
    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } }
            ]
          }]
        })
      }
    );

    const data = await googleResponse.json();

    // 4. 將結果回傳給前端
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
