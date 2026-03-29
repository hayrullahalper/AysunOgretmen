import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Sen "Aysun Öğretmen" uygulamasının eğitim asistanısın. 
Görevin ilkokul seviyesindeki öğrenciler için pedagojik, nazik, teşvik edici ve müfredata uygun içerikler üretmektir.
Dilin her zaman çocuklara uygun, anlaşılır ve profesyonel olmalıdır. Gereksiz aşırı "eğlenceli" tondan kaçın, eğitici ve rehberlik edici ol.
Tüm yanıtlarını belirtilen JSON formatında vermelisin.
Soruların cevapları için kısa ve açıklayıcı bir "explanation" (açıklama) alanı ekle.
`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { params } = req.body;
    if (!params) {
      return res.status(400).json({ error: 'Missing params in request body' });
    }

    // Use the most up-to-date API key from the environment
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is missing in the environment." });
    }
    
    const aiInstance = new GoogleGenAI({ apiKey });

    // Inject system instruction if not present
    if (params.config) {
      params.config.systemInstruction = SYSTEM_INSTRUCTION;
    } else {
      params.config = { systemInstruction: SYSTEM_INSTRUCTION };
    }

    const callWithRetry = async (currentParams: any, retryCount = 0): Promise<any> => {
      try {
        return await aiInstance.models.generateContent(currentParams);
      } catch (error: any) {
        const isRetryable = error.message?.includes('429') || 
                            error.message?.includes('503') || 
                            error.message?.includes('UNAVAILABLE') ||
                            error.message?.includes('RESOURCE_EXHAUSTED');
        
        if (isRetryable && retryCount < 1) {
          const fallbackModel = "gemini-3.1-flash-lite-preview";
          if (currentParams.model !== fallbackModel) {
            console.warn(`Retrying with fallback model ${fallbackModel} due to: ${error.message}`);
            return await callWithRetry({ ...currentParams, model: fallbackModel }, retryCount + 1);
          }
        }
        throw error;
      }
    };

    const response = await callWithRetry(params);
    
    // Safe text extraction
    let text = "";
    try {
      text = response.text;
    } catch (e) {
      console.warn("Could not get text from response:", e);
    }

    // Handle multimodal response (images)
    const candidates = response.candidates || [];
    const parts = candidates[0]?.content?.parts || [];
    
    res.status(200).json({ text, parts });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const status = error.message?.includes('429') ? 429 : 
                   (error.message?.includes('API key not valid') || error.message?.includes('400')) ? 401 : 500;
    res.status(status).json({ error: error.message || "Internal Server Error", details: error.details || [] });
  }
}
