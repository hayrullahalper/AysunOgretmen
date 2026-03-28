import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Helper for calling Gemini with fallback models
async function callGeminiWithFallback(params: any, backupModel?: string) {
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    const isQuotaError = error.message?.includes('429') || 
                        error.message?.includes('quota') || 
                        error.message?.includes('RESOURCE_EXHAUSTED');
    
    if (isQuotaError && backupModel && params.model !== backupModel) {
      console.warn(`Quota exceeded for ${params.model}, trying backup model ${backupModel}`);
      return await ai.models.generateContent({ ...params, model: backupModel });
    }
    throw error;
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
      const response = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${grade}. sınıf ${subject} dersi, ${topic} konusu hakkında ${type} formatında sorular üret.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.STRING },
                    explanation: { type: Type.STRING, description: "Doğru cevabın nedenini açıklayan kısa metin." }
                  },
                  required: ["question", "answer", "explanation"]
                }
              }
            },
            required: ["title", "questions"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");

      return JSON.parse(response.text);
    } catch (error: any) {
      console.error("Generate Questions Error:", error);
      throw new Error("Sorular oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
    }
  },

  generateStory: async (topic: string, questionCount: number, length: 'Kısa' | 'Orta' | 'Uzun') => {
    try {
      const lengthMap = { 'Kısa': 'yaklaşık 100 kelime', 'Orta': 'yaklaşık 300 kelime', 'Uzun': 'yaklaşık 600 kelime' };
      const response = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${topic} konusu hakkında ilkokul seviyesinde ${lengthMap[length]} bir hikaye yaz and bu hikaye ile ilgili ${questionCount} adet okuma-anlama sorusu oluştur.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              story: { type: Type.STRING },
              summary: { type: Type.STRING, description: "Hikayenin görselleştirmesi için kısa bir sahne betimlemesi (İngilizce)." },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING },
                    explanation: { type: Type.STRING, description: "Cevabın hikayedeki dayanağını açıklayan kısa metin." }
                  },
                  required: ["question", "answer", "explanation"]
                }
              }
            },
            required: ["title", "story", "summary", "questions"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");

      return JSON.parse(response.text);
    } catch (error: any) {
      console.error("Generate Story Error:", error);
      throw new Error("Hikaye oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
    }
  },

  generateStoryImage: async (summary: string) => {
    try {
      // Try primary image model
      const response = await callGeminiWithFallback({
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
      }, 'gemini-3.1-flash-image-preview'); // Try 3.1 as backup
      
      if (!response.candidates?.[0]?.content?.parts) {
        const safetyBlock = response.candidates?.[0]?.finishReason;
        throw new Error(safetyBlock === 'SAFETY' ? "Güvenlik filtresi nedeniyle görsel oluşturulamadı." : "Görsel oluşturma yanıtı boş döndü.");
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Görsel verisi bulunamadı.");
    } catch (error: any) {
      console.error("Gemini Image Error:", error);
      
      // Final fallback to picsum if all AI models fail
      const isQuotaError = error.message?.includes('429') || 
                          error.message?.includes('quota') || 
                          error.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isQuotaError) {
        console.warn("All image models exhausted, using fallback image.");
        return `https://picsum.photos/seed/${encodeURIComponent(summary.substring(0, 20))}/1024/576`;
      }
      
      throw new Error("Görsel oluşturulamadı.");
    }
  },

  generateInstantQuestion: async (studentName: string) => {
    try {
      const response = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${studentName} isimli öğrenci için rastgele, eğitici ve genel kültür/matematik/türkçe karışık bir ilkokul sorusu sor.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              answer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["question", "answer", "options", "explanation"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");

      return JSON.parse(response.text);
    } catch (error: any) {
      console.error("Generate Instant Question Error:", error);
      throw new Error("Soru oluşturulurken bir hata oluştu.");
    }
  },

  generateSpecialDayContent: async (day: string, type: 'Şiir' | 'Hikaye' | 'Etkinlik') => {
    try {
      const response = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${day} özel günü için ilkokul seviyesinde bir ${type} üret.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Öğretmenler için ek öneriler." }
            },
            required: ["title", "content"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");
      return JSON.parse(response.text);
    } catch (error: any) {
      console.error("Generate Special Day Error:", error);
      throw new Error("İçerik oluşturulurken bir hata oluştu.");
    }
  },

  generateColoringPage: async (topic: string) => {
    try {
      const response = await callGeminiWithFallback({
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
      
      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error("Görsel oluşturulamadı.");
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Görsel verisi bulunamadı.");
    } catch (error: any) {
      console.error("Coloring Page Error:", error);
      
      // Fallback for coloring page
      const isQuotaError = error.message?.includes('429') || 
                          error.message?.includes('quota') || 
                          error.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isQuotaError) {
        console.warn("All image models exhausted for coloring page, using fallback.");
        return `https://picsum.photos/seed/${encodeURIComponent(topic.substring(0, 20))}/1024/1024?grayscale`;
      }
      
      throw new Error("Boyama sayfası oluşturulamadı.");
    }
  },

  generateDuelQuestion: async (grade: string, subject: string, topic: string) => {
    try {
      const response = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${grade}. sınıf ${subject} dersi, ${topic} konusu hakkında 2 öğrencinin yarışabileceği, hızlı cevaplanabilecek 3 şıklı bir test sorusu üret. (Rastgelelik ID: ${Math.random().toString(36).substring(7)})`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tam olarak 3 şık olmalı." },
              answer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "answer", "explanation"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");
      return JSON.parse(response.text);
    } catch (error: any) {
      console.error("Generate Duel Question Error:", error);
      throw new Error("Düello sorusu oluşturulurken bir hata oluştu.");
    }
  },

  generateWeeklyResearch: async (grade: string) => {
    try {
      const response = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${grade}. sınıf ilkokul öğrencileri için bu hafta araştırılabilecek, çocukların hayal gücünü zorlayan, doğa, uzay, hayvanlar alemi veya ilginç icatlar gibi çok ilgi çekici ve öğretici bir konu belirle. Ayrıca bu konuyla ilgili çocukların izleyebileceği bir video materyal önerisi (YouTube araması için anahtar kelimeler) ekle.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              description: { type: Type.STRING },
              researchQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              videoSearchKeywords: { type: Type.STRING }
            },
            required: ["topic", "description", "researchQuestions", "videoSearchKeywords"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");
      return JSON.parse(response.text);
    } catch (error: any) {
      console.error("Generate Weekly Research Error:", error);
      throw new Error("Haftalık araştırma konusu oluşturulurken bir hata oluştu.");
    }
  }
};
