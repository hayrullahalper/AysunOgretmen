import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const SYSTEM_INSTRUCTION = `
Sen "Aysun Öğretmen" uygulamasının eğitim asistanısın. 
Görevin ilkokul seviyesindeki öğrenciler için pedagojik, nazik, teşvik edici ve müfredata uygun içerikler üretmektir.
Dilin her zaman çocuklara uygun, anlaşılır ve profesyonel olmalıdır. Gereksiz aşırı "eğlenceli" tondan kaçın, eğitici ve rehberlik edici ol.
Tüm yanıtlarını belirtilen JSON formatında vermelisin.
Soruların cevapları için kısa ve açıklayıcı bir "explanation" (açıklama) alanı ekle.
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      if (!req.body || !req.body.params) {
        return res.status(400).json({ error: "Missing params in request body" });
      }
      const { params } = req.body;
      
      // Use the most up-to-date API key from the environment
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
      if (!apiKey) {
        throw new Error("Gemini API key is missing in the environment.");
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
      
      res.json({ text, parts });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      const status = error.message?.includes('429') ? 429 : 
                     (error.message?.includes('API key not valid') || error.message?.includes('400')) ? 401 : 500;
      res.status(status).json({ error: error.message || "Internal Server Error", details: error.details || [] });
    }
  });

  app.post("/api/pollinations/generate", async (req, res) => {
    try {
      const { prompt, model = 'flux', width = 1024, height = 1024, seed = Math.floor(Math.random() * 1000000), enhance = false } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
      }

      const apiKey = process.env.POLLINATIONS_API_KEY || "";
      const encodedPrompt = encodeURIComponent(prompt);
      
      // Base URL: gen.pollinations.ai/image/
      let imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model}&width=${width}&height=${height}&seed=${seed}&enhance=${enhance}`;
      
      if (apiKey) {
        imageUrl += `&key=${apiKey}`;
      }
      
      res.status(200).json({ url: imageUrl });
    } catch (error: any) {
      console.error("Pollinations Proxy Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
