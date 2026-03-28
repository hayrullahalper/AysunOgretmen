import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_INSTRUCTION = `
Sen "Aysun Öğretmen" uygulamasının eğitim asistanısın. 
Görevin ilkokul seviyesindeki öğrenciler için pedagojik, nazik, teşvik edici ve müfredata uygun içerikler üretmektir.
Dilin her zaman çocuklara uygun, anlaşılır ve profesyonel olmalıdır. Gereksiz aşırı "eğlenceli" tondan kaçın, eğitici ve rehberlik edici ol.
Tüm yanıtlarını belirtilen JSON formatında vermelisin.
Soruların cevapları için kısa ve açıklayıcı bir "explanation" (açıklama) alanı ekle.
`;

export const geminiService = {
  generateQuestions: async (grade: string, subject: string, topic: string, type: string) => {
    const response = await ai.models.generateContent({
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
    });

    return JSON.parse(response.text);
  },

  generateStory: async (topic: string, questionCount: number, length: 'Kısa' | 'Orta' | 'Uzun') => {
    const lengthMap = { 'Kısa': 'yaklaşık 100 kelime', 'Orta': 'yaklaşık 300 kelime', 'Uzun': 'yaklaşık 600 kelime' };
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `${topic} konusu hakkında ilkokul seviyesinde ${lengthMap[length]} bir hikaye yaz ve bu hikaye ile ilgili ${questionCount} adet okuma-anlama sorusu oluştur.`,
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
    });

    return JSON.parse(response.text);
  },

  generateStoryImage: async (summary: string) => {
    const response = await ai.models.generateContent({
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
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Image generation failed");
  },

  generateInstantQuestion: async (studentName: string) => {
    const response = await ai.models.generateContent({
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
    });

    return JSON.parse(response.text);
  },

  generateSpecialDayContent: async (day: string, type: 'Şiir' | 'Hikaye' | 'Etkinlik') => {
    const response = await ai.models.generateContent({
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
    });
    return JSON.parse(response.text);
  },

  generateColoringPage: async (topic: string) => {
    const response = await ai.models.generateContent({
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
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Image generation failed");
  },

  generateDuelQuestion: async (grade: string, subject: string, topic: string) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `${grade}. sınıf ${subject} dersi, ${topic} konusu hakkında 2 öğrencinin yarışabileceği, hızlı cevaplanabilecek 3 şıklı bir test sorusu üret.`,
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
    });
    return JSON.parse(response.text);
  },

  generateWeeklyResearch: async (grade: string) => {
    const response = await ai.models.generateContent({
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
    });
    return JSON.parse(response.text);
  }
};
