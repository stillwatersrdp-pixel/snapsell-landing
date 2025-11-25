export async function onRequest(context) {
  const request = context.request;

  // CORS 處理
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
    if (!apiKey) {
      throw new Error("伺服器端缺少 GEMINI_API_KEY");
    }

    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) throw new Error("未接收到圖片");

    // 🎯 策略修正：只使用最標準的模型名稱，並改用 v1 正式版 API
    const candidateModels = [
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];

    const prompt = `
      你是一位專業的二手選物拍賣專家。請分析這張商品圖片，生成一份「社群轉售風格」的文案。
      
      請回傳純 JSON 格式 (不要 Markdown, 不要 \`\`\`json 標記)，必須包含以下欄位：
      1. title: 商品標題 (精簡有力，例如：日系極簡收納籃)
      2. price: 預估二手市場價格 (純數字，台幣 NTD)
      3. description: 詳細文案。語氣親切熱情，像在跟朋友推薦。
         - 強調「甜甜價」、「割愛」、「狀況很好」。
         - 分段落，加入 Emoji (✨, ❤️, 👜)。
      4. tags: 3-5 個相關標籤 (hashtags)
      5. seller: 隨機生成一個賣家名稱 (例如: Kelvin 選物)
    `;

    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;
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
          }
        );

        const data = await googleResponse.json();

        if (data.error) {
          console.log(`模型 ${modelName} (v1) 失敗: ${data.error.message}`);
          throw new Error(data.error.message);
        }

        const text = data.candidates[0].content.parts[0].text;
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const parsedData = JSON.parse(cleanJson);
        
        return new Response(JSON.stringify(parsedData), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (e) {
        lastError = e;
      }
    }

    throw new Error(`所有模型都失敗 (v1 API)。最後錯誤: ${lastError.message}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
