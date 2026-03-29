import { GoogleGenAI } from "@google/genai";

// Detect environment
const IS_AI_STUDIO = window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost');
const GEMINI_API_KEY = (process.env as any).GEMINI_API_KEY || "";

// Initialize SDK only if key is present (AI Studio mode)
let ai: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// Helper for calling Gemini with fallback models
async function callGeminiWithFallback(params: any, backupModel?: string): Promise<any> {
  try {
    // If we have a local key and are in AI Studio, use the SDK directly (Old Logic)
    if (ai && IS_AI_STUDIO) {
      const response = await ai.models.generateContent(params);
      
      let text = "";
      try {
        text = response.text;
      } catch (e) {
        console.warn("Could not get text from response:", e);
      }

      const candidates = response.candidates || [];
      const parts = candidates[0]?.content?.parts || [];
      return { text, parts };
    }

    // Otherwise, use the backend proxy (New Logic for Vercel)
    const response = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    const isQuotaError = error.message?.includes('429') || 
                        error.message?.includes('quota') || 
                        error.message?.includes('RESOURCE_EXHAUSTED');
    
    if (isQuotaError && backupModel && params.model !== backupModel) {
      console.warn(`Quota exceeded for ${params.model}, trying backup model ${backupModel}`);
      return await callGeminiWithFallback({ ...params, model: backupModel });
    }
    throw error;
  }
}

// Pollinations Fallback for Images
async function generateImageWithPollinations(prompt: string): Promise<string | null> {
  try {
    const seed = Math.floor(Math.random() * 1000000);
    const width = 1024;
    const height = 1024;
    // Pollinations API Key can be passed if available, but usually it's a public URL
    // We'll use the public URL with the prompt
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
    
    // Test if the image is accessible (optional but good for fallback)
    const response = await fetch(imageUrl, { method: 'HEAD' });
    if (response.ok) {
      return imageUrl;
    }
    return null;
  } catch (error) {
    console.error("Pollinations Fallback Error:", error);
    return null;
  }
}

const SYSTEM_INSTRUCTION = `
Sen "Aysun Öğretmen" uygulamasının eğitim asistanısın. 
Görevin ilkokul seviyesindeki öğrenciler için pedagojik, nazik, teşvik edici ve müfredata uygun içerikler üretmektir.
Dilin her zaman çocuklara uygun, anlaşılır ve profesyonel olmalıdır. Gereksiz aşırı "eğlenceli" tondan kaçın, eğitici ve rehberlik edici ol.
Tüm yanıtlarını belirtilen JSON formatında vermelisin.
Soruların cevapları için kısa ve açıklayıcı bir "explanation" (açıklama) alanı ekle.
`;

export const geminiService = {
  generateQuestions: async (grade: string, subject: string, topic: string, type: string) => {
    try {
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${grade}. sınıf ${subject} dersi, ${topic} konusu hakkında ${type} formatında sorular üret.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              questions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    question: { type: "STRING" },
                    options: { type: "ARRAY", items: { type: "STRING" } },
                    answer: { type: "STRING" },
                    explanation: { type: "STRING", description: "Doğru cevabın nedenini açıklayan kısa metin." }
                  },
                  required: ["question", "answer", "explanation"]
                }
              }
            },
            required: ["title", "questions"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");

      return JSON.parse(data.text);
    } catch (error: any) {
      console.error("Generate Questions Error:", error);
      throw new Error("Sorular oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
    }
  },

  generateStory: async (topic: string, questionCount: number, length: 'Kısa' | 'Orta' | 'Uzun') => {
    try {
      const lengthMap = { 'Kısa': 'yaklaşık 100 kelime', 'Orta': 'yaklaşık 300 kelime', 'Uzun': 'yaklaşık 600 kelime' };
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${topic} konusu hakkında ilkokul seviyesinde ${lengthMap[length]} bir hikaye yaz and bu hikaye ile ilgili ${questionCount} adet okuma-anlama sorusu oluştur.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              story: { type: "STRING" },
              summary: { type: "STRING", description: "Hikayenin görselleştirmesi için kısa bir sahne betimlemesi (İngilizce)." },
              questions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    question: { type: "STRING" },
                    answer: { type: "STRING" },
                    explanation: { type: "STRING", description: "Cevabın hikayedeki dayanağını açıklayan kısa metin." }
                  },
                  required: ["question", "answer", "explanation"]
                }
              }
            },
            required: ["title", "story", "summary", "questions"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");

      return JSON.parse(data.text);
    } catch (error: any) {
      console.error("Generate Story Error:", error);
      throw new Error("Hikaye oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
    }
  },

  generateStoryImage: async (summary: string) => {
    try {
      const data = await callGeminiWithFallback({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `A colorful, friendly, high-quality digital illustration for a children's storybook. Scene: ${summary}. Style: vibrant, cute, whimsical, professional illustration, no text.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          }
        },
      }, 'gemini-3.1-flash-image-preview');
      
      if (!data.parts) {
        throw new Error("Görsel oluşturma yanıtı boş döndü.");
      }

      for (const part of data.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Görsel verisi bulunamadı.");
    } catch (error: any) {
      console.error("Gemini Image Error:", error);
      
      const isQuotaError = error.message?.includes('429') || 
                          error.message?.includes('quota') || 
                          error.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isQuotaError) {
        console.warn("All Gemini image models exhausted, trying Pollinations fallback...");
        const prompt = `A colorful, friendly, high-quality digital illustration for a children's storybook. Scene: ${summary}. Style: vibrant, cute, whimsical, professional illustration, no text.`;
        return await generateImageWithPollinations(prompt);
      }
      
      throw new Error("Görsel oluşturulamadı.");
    }
  },

  generateInstantQuestion: async (studentName: string) => {
    try {
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${studentName} isimli öğrenci için rastgele, eğitici ve genel kültür/matematik/türkçe karışık bir ilkokul sorusu sor.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              question: { type: "STRING" },
              options: { type: "ARRAY", items: { type: "STRING" } },
              answer: { type: "STRING" },
              explanation: { type: "STRING" }
            },
            required: ["question", "answer", "options", "explanation"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");

      return JSON.parse(data.text);
    } catch (error: any) {
      console.error("Generate Instant Question Error:", error);
      throw new Error("Soru oluşturulurken bir hata oluştu.");
    }
  },

  generateSpecialDayContent: async (day: string, type: 'Şiir' | 'Hikaye' | 'Etkinlik') => {
    try {
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${day} özel günü için ilkokul seviyesinde bir ${type} üret.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              content: { type: "STRING" },
              suggestions: { type: "ARRAY", items: { type: "STRING" }, description: "Öğretmenler için ek öneriler." }
            },
            required: ["title", "content"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");
      return JSON.parse(data.text);
    } catch (error: any) {
      console.error("Generate Special Day Error:", error);
      throw new Error("İçerik oluşturulurken bir hata oluştu.");
    }
  },

  generateColoringPage: async (topic: string) => {
    try {
      const data = await callGeminiWithFallback({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `A simple, high-quality black and white line art coloring page for kids about ${topic}. No shading, clean outlines, white background.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        },
      }, 'gemini-3.1-flash-image-preview');
      
      if (!data.parts) {
        throw new Error("Görsel oluşturulamadı.");
      }

      for (const part of data.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Görsel verisi bulunamadı.");
    } catch (error: any) {
      console.error("Coloring Page Error:", error);
      
      const isQuotaError = error.message?.includes('429') || 
                          error.message?.includes('quota') || 
                          error.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isQuotaError) {
        console.warn("All Gemini image models exhausted for coloring page, trying Pollinations fallback...");
        const prompt = `A simple, high-quality black and white line art coloring page for kids about ${topic}. No shading, clean outlines, white background.`;
        return await generateImageWithPollinations(prompt);
      }
      
      throw new Error("Boyama sayfası oluşturulamadı.");
    }
  },

  generateDuelQuestion: async (grade: string, subject: string, topic: string) => {
    try {
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${grade}. sınıf ${subject} dersi, ${topic} konusu hakkında 2 öğrencinin yarışabileceği, hızlı cevaplanabilecek 3 şıklı bir test sorusu üret. (Rastgelelik ID: ${Math.random().toString(36).substring(7)})`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              question: { type: "STRING" },
              options: { type: "ARRAY", items: { type: "STRING" }, description: "Tam olarak 3 şık olmalı." },
              answer: { type: "STRING" },
              explanation: { type: "STRING" }
            },
            required: ["question", "options", "answer", "explanation"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");
      return JSON.parse(data.text);
    } catch (error: any) {
      console.error("Generate Duel Question Error:", error);
      throw new Error("Düello sorusu oluşturulurken bir hata oluştu.");
    }
  },

  generateWeeklyResearch: async (grade: string) => {
    try {
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${grade}. sınıf ilkokul öğrencileri için bu hafta araştırılabilecek, çocukların hayal gücünü zorlayan, doğa, uzay, hayvanlar alemi veya ilginç icatlar gibi çok ilgi çekici ve öğretici bir konu belirle. Ayrıca bu konuyla ilgili çocukların izleyebileceği bir video materyal önerisi (YouTube araması için anahtar kelimeler) ekle.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              topic: { type: "STRING" },
              description: { type: "STRING" },
              researchQuestions: { type: "ARRAY", items: { type: "STRING" } },
              videoSearchKeywords: { type: "STRING" }
            },
            required: ["topic", "description", "researchQuestions", "videoSearchKeywords"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");
      return JSON.parse(data.text);
    } catch (error: any) {
      console.error("Generate Weekly Research Error:", error);
      throw new Error("Haftalık araştırma konusu oluşturulurken bir hata oluştu.");
    }
  }
};
