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
      const { params } = req.body;
      
      // Use the most up-to-date API key from the environment
      // Check both GEMINI_API_KEY and API_KEY (used for some image models)
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
      if (!apiKey) {
        throw new Error("Gemini API key is missing in the environment. Please configure GEMINI_API_KEY or API_KEY in your environment variables.");
      }
      
      const aiInstance = new GoogleGenAI({ apiKey });

      // Inject system instruction if not present
      if (params.config) {
        params.config.systemInstruction = SYSTEM_INSTRUCTION;
      } else {
        params.config = { systemInstruction: SYSTEM_INSTRUCTION };
      }

      const response = await aiInstance.models.generateContent(params);
      
      // Handle multimodal response (images)
      const candidates = response.candidates || [];
      const parts = candidates[0]?.content?.parts || [];
      
      res.json({ text: response.text, parts });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      const status = error.message?.includes('429') ? 429 : 
                     (error.message?.includes('API key not valid') || error.message?.includes('400')) ? 401 : 500;
      res.status(status).json({ error: error.message });
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
