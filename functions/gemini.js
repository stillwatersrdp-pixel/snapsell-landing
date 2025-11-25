export async function onRequest(context) {
  const request = context.request;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("伺服器端缺少 GEMINI_API_KEY");

    const body = await request.json();
    const { imageBase64, mimeType } = body;
    if (!imageBase64) throw new Error("未接收到圖片");

    const prompt = `
      你是一位專業的二手選物拍賣專家。請分析這張商品圖片，生成一份「社群轉售風格」的文案。
      
      回傳純 JSON (不要 Markdown, 不要 \`\`\`json 標記)，必須包含：
      title、price、description（分段、有 Emoji、強調甜甜價/割愛/狀況很好）、tags（3-5 個 hashtag）、seller。
    `;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const googleResponse = await fetch(url, {
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
    });

    const data = await googleResponse.json();
    if (data.error) throw new Error(`Google API Error: ${data.error.message}`);

    try {
      const text = data.candidates[0].content.parts[0].text;
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);
      return new Response(JSON.stringify(parsedData), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      throw new Error("AI 回傳格式解析失敗，請重試");
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
