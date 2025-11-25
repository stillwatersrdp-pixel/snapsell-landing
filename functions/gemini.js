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
      throw new Error("伺服器端缺少 GEMINI_API_KEY，請至 Cloudflare 後台設定");
    }
    const body = await request.json();
    const { imageBase64, mimeType } = body;
    if (!imageBase64) throw new Error("未接收到圖片");
    // 🔥 核心 Prompt：模仿你提供的截圖風格
    const prompt = `
      你是一位專業的二手精品與選物拍賣專家。請分析這張商品圖片，並生成一份「社群轉售風格」的拍賣文案。
      
      請回傳純 JSON 格式 (不要 Markdown)，包含以下欄位：
      1. title: 商品標題 (精簡有力，例如：義大利製真皮手提包)
      2. price: 預估二手市場價格 (純數字，台幣 NTD)
      3. description: 詳細文案。語氣要親切、熱情，像在跟朋友推薦。
         - 開頭要有吸引力 (例如：姐妹們快看過來！、這款真的超美...)
         - 描述材質、手感、適合場合。
         - 強調「甜甜價」、「割愛」、「狀況很好」。
         - 稍微長一點，分段落，加入適量 Emoji (✨, ❤️, 👜)。
      4. tags: 3-5 個相關標籤 (hashtags)
      5. seller: 隨機生成一個賣家名稱 (例如: Kelvin 選物)
    `;
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
    // 錯誤處理：如果 Google 回傳錯誤，要在這裡抓到
    if (data.error) {
      throw new Error(`Google API Error: ${data.error.message}`);
    }
    // 確保回傳的是正確的結構
    try {
      const text = data.candidates[0].content.parts[0].text;
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleanJson);
      
      return new Response(JSON.stringify(parsedData), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    } catch (e) {
      throw new Error("AI 回傳格式無法解析，請重試");
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
}
