export async function onRequest(context) {
  const request = context.request;

  // 1. CORS 處理 (必要)
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
    // 取得 OpenAI Key (變數名稱改為 OPENAI_API_KEY)
    const apiKey = context.env.OPENAI_API_KEY;
    
    // 🚨 如果沒有 Key，自動進入「測試模式 (Demo Mode)」
    if (!apiKey) {
      return new Response(JSON.stringify(getMockData()), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) throw new Error("未接收到圖片");

    // 2. 呼叫 OpenAI API (GPT-4o-mini)
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // 使用最快且便宜的視覺模型
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `你是一位專業的二手選物拍賣專家。請分析這張商品圖片，生成一份「社群轉售風格」的文案。
                
                請回傳純 JSON 格式 (不要 Markdown 標記)，必須包含以下欄位：
                1. title: 商品標題 (精簡有力)
                2. price: 預估二手市場價格 (純數字，台幣 NTD)
                3. description: 詳細文案。語氣親切熱情，像在跟朋友推薦。分段落，加入 Emoji。
                4. tags: 3-5 個相關標籤 (hashtags)
                5. seller: 隨機生成一個賣家名稱`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }, // 強制 JSON 模式
        max_tokens: 500
      })
    });

    const data = await openAiResponse.json();

    // 錯誤處理
    if (data.error) {
      throw new Error(`OpenAI Error: ${data.error.message}`);
    }

    // 3. 解析 OpenAI 回傳的資料
    const content = data.choices[0].message.content;
    const parsedData = JSON.parse(content);

    return new Response(JSON.stringify(parsedData), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// --- 測試用假資料 (當沒有 API Key 時使用) ---
function getMockData() {
  return {
    title: "【測試模式】北歐風極簡收納籃",
    price: "880",
    description: "這是在沒有 API Key 時顯示的測試資料。如果看到這個，代表你的前端 UI 是正常的！\n\n這款收納籃真的超級實用，放在客廳或臥室都很有質感。手工編織的細節很美，容量也很大，可以放雜誌、毛毯或是小朋友的玩具。雖然是二手但狀況極新，幾乎沒有使用痕跡喔！❤️",
    tags: ["收納神器", "居家佈置", "極簡風"],
    seller: "SnapSell 測試員"
  };
}
