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
                        error.message?.includes('RESOURCE_EXHAUSTED') ||
                        error.message?.includes('503') ||
                        error.message?.includes('UNAVAILABLE');
    
    if (isQuotaError && backupModel && params.model !== backupModel) {
      console.warn(`Quota exceeded or service unavailable for ${params.model}, trying backup model ${backupModel}`);
      return await callGeminiWithFallback({ ...params, model: backupModel });
    }
    throw error;
  }
}

// Pollinations Fallback for Images
async function generateImageWithPollinations(prompt: string): Promise<string | null> {
  try {
    const response = await fetch("/api/pollinations/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Pollinations Proxy Error: ${response.status}`);
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error("Pollinations Fallback Error:", error);
    return null;
  }
}

const CULTURE_TOPICS = [
  "Cezeri’nin Harikaları: Dünyanın ilk robotlarını ve dişli çarklarını yapan dahi.",
  "İbn-i Sina’nın Şifa Kitabı: Avrupa’da yüzyıllarca okutulan tıp dehası.",
  "Mimar Sinan’ın Mimari Sırları: Selimiye ve deprem izolatörleri.",
  "Hezarfen Ahmed Çelebi: Galata Kulesi’nden Üsküdar’a kanatlanan ilk insan.",
  "Piri Reis’in Gizemli Haritası: Amerika kıtasını ilk çizen Türk denizcisi.",
  "Ali Kuşçu ve Ay’ın Haritası: İstanbul’un enlem ve boylamını belirleyen gökbilimci.",
  "Harezmi ve Sıfır’ın Gücü: Matematiğe '0' rakamını kazandıran bilgin.",
  "Biruni ve Yer Küre: Dünyanın çapını bin yıl önce ölçen dahi.",
  "Farabi ve Kanun Enstrümanı: Müziği ve felsefeyi birleştiren 'Muallim-i Sani'.",
  "Akşemseddin ve Mikroplar: Mikropları Pasteur’den önce tarif eden bilgin.",
  "Lagari Hasan Çelebi: Roketle uçuş denemesi yapan ilk insan.",
  "Selçuklu Geometrisi: Camilerdeki bitmeyen düğüm motiflerinin matematiği.",
  "Ahilik Teşkilatı: Dürüst esnaflığın ve yardımlaşmanın merkezi.",
  "Kuş Evleri: Osmanlı mimarisinde hayvan sevgisinin en zarif hali.",
  "Sadaka Taşları: Kimseyi incitmeden yapılan gizli yardımlaşma geleneği.",
  "Matrakçı Nasuh: Hem dahi bir matematikçi hem de usta bir minyatür sanatçısı.",
  "Evliya Çelebi’nin Seyahatnamesi: Karış karış dünyayı gezen en ünlü gezginimiz.",
  "Uluğ Bey’in Gözlemevi: Semerkand’da yıldızların haritasını çıkaran hakan.",
  "Osmanlı’da Şifahaneler: Müzik ve su sesiyle tedavi yöntemleri.",
  "Enderun Mektebi: Saraydaki yetenekli çocukların yetiştirildiği okul.",
  "Milli Akıllı Cihaz TOGG: Türkiye’nin yollarındaki yerli gururu.",
  "Göklerin Hakimi Bayraktar: İHA ve SİHA’larımızın dünya çapındaki başarısı.",
  "İlk Astronotumuz Alper Gezeravcı: Uzaydaki ilk Türk ve bilimsel deneyleri.",
  "TCG Anadolu: Dünyanın ilk SİHA gemisi ve denizlerdeki kalemiz.",
  "Kızılelma İnsansız Savaş Uçağı: Geleceğin hava savunma teknolojisi.",
  "Türksat Uyduları: Uzaydaki haberleşme elçilerimiz.",
  "Hürkuş ve Vecihi Hürkuş: Yerli uçağımızın ve ilk pilotumuzun hikayesi.",
  "Antarktika Türk Bilim Üssü: Beyaz kıtadaki Türk bilim insanları.",
  "Marmaray ve Avrasya Tüneli: Denizin altındaki mühendislik harikaları.",
  "TEKNOFEST Ruhu: Dünyanın en büyük havacılık ve teknoloji festivali.",
  "Milli Muharip Uçak KAAN: Gökyüzündeki yerli çelik kanatlarımız.",
  "BOR Madeni: Dünyanın en büyük rezervine sahip olduğumuz enerji kaynağı.",
  "Yusufeli Barajı: Mühendislik harikası dev barajlarımız.",
  "Geleceğe Nefes: Türkiye’nin milyonlarca fidan dikme rekorları.",
  "İstanbul Havalimanı: Dünyanın en büyük ve modern havalimanlarından biri.",
  "UNESCO Listesindeki Efes: Antik dünyanın kütüphane merkezi.",
  "Göbeklitepe: Tarihin sıfır noktası ve Şanlıurfa’nın gizemi.",
  "Peri Bacaları ve Kapadokya: Doğanın taşlarla yaptığı dev sanat.",
  "Pamukkale Travertenleri: Beyaz cennetin nasıl oluştuğu.",
  "Nemrut Dağı Dev Heykelleri: Kommagene Krallığı’nın mirası.",
  "Sümela Manastırı: Sarp kayalıklara inşa edilen tarih.",
  "Anadolu’nun Yedi Bölgesi: Her bölgenin kendine has bitkisi ve iklimi.",
  "Çini Sanatı ve İznik: Toprağın ateşle buluştuğu renkli sanat.",
  "Ebru Sanatı: Suyun üzerine nakşedilen renklerin dansı.",
  "Hacivat ve Karagöz: Geleneksel gölge oyunumuzun incelikleri.",
  "Türk Kahvesi ve Lokum: Misafirperverliğimizin dünya markaları.",
  "Lale Devri ve Laleler: Hollanda’ya bizden giden meşhur çiçek.",
  "Anadolu Kilim Motifleri: Her ilmeğin bir anlamı olan dokumalar.",
  "İstiklal Marşı ve Mehmet Akif: Bağımsızlık sembolümüzün yazılış hikayesi.",
  "Çanakkale Geçilmez: Tarihin akışını değiştiren büyük zafer.",
  "Dürüstlük ve Ahde Vefa: Sözünde durmanın önemi.",
  "Merhamet ve Şefkat: Sokak hayvanlarını koruma bilinci.",
  "Vatanseverlik: Toprağımıza ve bayrağımıza sahip çıkmak.",
  "Sabır ve Azim: Thomas Edison veya Naim Süleymanoğlu gibi vazgeçmemek.",
  "Adaletli Olmak: Herkese hakkını vermek.",
  "Saygı ve Nezaket: Küçüklere sevgi, büyüklere hürmet.",
  "Çalışkanlık: Zamanı iyi kullanma sanatı.",
  "Tasarruf ve İsraf: Su ve ekmek israfının önlenmesi.",
  "Yardımlaşma (İmece): Bir işi beraberce bitirmenin keyfi.",
  "Özgüven: 'Ben de başarabilirim' diyebilmek.",
  "Van Kedisi: Bir gözü mavi, bir gözü yeşil dostumuz.",
  "Ankara Tavşanı: Dünyaca ünlü yumuşacık tüylü canlı.",
  "Sivas Kangalı: Sürülerin sadık ve güçlü koruyucusu.",
  "Deniz Kaplumbağası Caretta: Sahillerimizin narin misafirleri.",
  "Anadolu Parsı: Ormanlarımızın gizemli efsanesi.",
  "Tiftik Keçisi: Ankara’nın kıymetli yün kaynağı.",
  "Kelaynak Kuşları: Nesli koruma altındaki özel kuşlar.",
  "Denizatı: Babaların yavruları taşıdığı ilginç balık.",
  "Bukalemun: Renk değiştirme ustalığının sırrı.",
  "Arıların Mimarlığı: Altıgen peteklerin matematiksel mucizesi.",
  "Karıncaların Gücü: Kendi ağırlığının kat kat fazlasını taşıyanlar.",
  "Ahtapotların Üç Kalbi: Denizlerin sekiz kollu zekileri.",
  "Kuşların Göç Yolları: İstanbul Boğazı’ndan geçen leylekler.",
  "Fillerin Hafızası: Hiçbir şeyi unutmayan dev dostlar.",
  "Zürafaların Dili: Neden zürafalar hiç ses çıkarmaz?",
  "Güneş Sistemi’nin Rekorları: En sıcak ve en soğuk gezegenler.",
  "Karadelikler: Işığı bile yutan uzay canavarları.",
  "Yapay Zeka: Bilgisayarlar nasıl öğrenir?",
  "Sanal Gerçeklik (VR): Gözlükle başka dünyalara gitmek.",
  "3D Yazıcılar: Evde oyuncak basmak mümkün mü?",
  "Elektrikli Arabalar: Petrolsüz giden sessiz araçlar.",
  "Mars’ta Su Var mı?: Kızıl gezegendeki yaşam araştırmaları.",
  "Astronotlar Nasıl Beslenir?: Uzay yemeklerinin sırrı.",
  "Işık Hızı: Işık ne kadar hızlı hareket eder?",
  "Yerçekimi: Newton’un başına düşen elma masalı.",
  "Atomun İçindeki Dünya: En küçük yapı taşlarımız.",
  "Geri Dönüşüm: Plastik şişeden nasıl tişört yapılır?",
  "Yenilenebilir Enerji: Güneş panelleri ve rüzgar gülü.",
  "Nanoteknoloji: Maddenin en küçük parçasıyla üretim.",
  "Kuantum Bilgisayarlar: Geleceğin süper hızlı makineleri.",
  "Kalbimiz Nasıl Çalışır?: Hiç durmayan dev pompa.",
  "Beynimizin Odaları: Sağ beyin ve sol beyin ne yapar?",
  "İskelet Sistemi: Vücudumuzun çelik kafesi.",
  "Beş Duyumuz: Burnumuzun tadı almadaki rolü.",
  "Mikroplarla Savaş: Bağışıklık sisteminin askerleri.",
  "Uyku ve Rüyalar: Beynimiz gece ne yapar?",
  "Vitaminler: Hangi meyve hangi gücü verir?",
  "Diş Sağlığı: Çürüklerle savaşan diş minesi.",
  "Kan Grupları: Vücudumuzun hayat sıvısı.",
  "Neden Terleriz?: Vücudumuzun doğal soğutma sistemi.",
  "Mete Gazoz’un Oku: Olimpiyat şampiyonluğunun sırrı.",
  "Filenin Sultanları: Voleybolda neden dünyanın en iyisiyiz?",
  "Naim Süleymanoğlu: Dünyayı kaldıran küçük dev adam.",
  "Geleneksel Okçuluk: Zihgir ve kepade nedir?",
  "Satranç Stratejileri: Hamleleri önceden görmek.",
  "Origami: Kağıt katlama sanatı ile ne yapılır?",
  "Karışık Renkler: Hangi renkler birleşince ne olur?",
  "Türk Müziği Makamları: Rast ve Nihavend ne hissettirir?",
  "Olimpiyat Meşalesi: Tarihi ve anlamı.",
  "Dünya Çocuk Oyunları: Körebe ve saklambaç her yerde aynı mı?",
  "Atasözleri Bilmecesi: 'Damlaya damlaya göl olur' ne anlatır?",
  "Zıt Anlamlılar: Kelimelerin tersi ile oyun.",
  "Trafik İşaretleri: Üçgen ve yuvarlak tabelaların farkı.",
  "Takvim ve Zaman: Artık yıl neden 4 yılda bir gelir?",
  "Dünyanın Yedi Harikası: Tac Mahal’den Çin Seddi’ne.",
  "Para Birimleri: Eskiden para yerine ne kullanılırdı?",
  "Alfabelerin Hikayesi: Göktürk alfabesinden bugüne.",
  "Büyük Patlama (Big Bang): Evren nasıl başladı?",
  "İklim Değişikliği: Dünyayı nasıl koruruz?",
  "Okuma Kültürü: Kütüphaneler neden sessiz yerlerdir?"
];

const CREATIVE_CONSTRAINTS = [
  "Soruyu bir bilmece gibi kurgula.",
  "Soruyu bir hikaye kahramanı (örneğin bir astronot veya bir kaşif) üzerinden sor.",
  "Sorunun içine şaşırtıcı ve az bilinen bir 'Biliyor muydunuz?' bilgisi ekle.",
  "Soruyu günlük hayattan çok somut bir örnekle ilişkilendir.",
  "Soruyu bir diyalog şeklinde kurgula.",
  "Soruda karşılaştırma yaparak (en büyük, en hızlı, en eski gibi) merak uyandır.",
  "Soruyu bir gizemi çözüyormuş gibi kurgula."
];

const SYSTEM_INSTRUCTION = `
Sen "Aysun Öğretmen" uygulamasının eğitim asistanısın. 
Görevin ilkokul seviyesindeki öğrenciler için pedagojik, nazik, teşvik edici ve müfredata uygun içerikler üretmektir.
Dilin her zaman çocuklara uygun, anlaşılır ve profesyonel olmalıdır. Gereksiz aşırı "eğlenceli" tondan kaçın, eğitici ve rehberlik edici ol.

ÖNEMLİ KURALLAR:
1. Ürettiğin içerikler her seferinde benzersiz, yaratıcı ve şaşırtıcı olmalıdır. 
2. Çoktan seçmeli sorularda seçenekler (options) TAM OLARAK 3 adet olmalıdır (A, B ve C seçenekleri). Ne eksik ne fazla.
3. Seçenekler (options) SADECE cevabın kendisini içermelidir. Başına "A)", "B)", "C)" gibi harfler ASLA ekleme. (Örn: "Ankara" doğru, "A) Ankara" yanlış).
4. Özellikle "Genel Kültür" gibi konularda hep aynı soruları sormaktan kaçın. 
5. Genel Kültür dışındaki tüm sorular "Milli Maarif Modeli"ne uygun, değerler eğitimini destekleyen ve pedagojik olarak doğru olmalıdır.
6. Sorular ilkokul seviyesindeki (6-10 yaş) çocukların bilişsel düzeyine, kelime dağarcığına ve okuma hızına tam olarak uygun olmalıdır. Karmaşık terimlerden ve çok soyut kavramlardan kaçın.
7. Tüm yanıtlarını belirtilen JSON formatında vermelisin.
8. Soruların cevapları için kısa ve açıklayıcı bir "explanation" (açıklama) alanı ekle.
`;

// Helper to strip A) B) C) prefixes from options
function stripPrefixes(options: string[]): string[] {
  return options.map(opt => {
    // Matches "A) ", "A- ", "A. ", "1) ", etc. at the start of the string
    return opt.replace(/^[A-Z0-9][\)\-\.]\s*/i, '').trim();
  });
}

// Helper to shuffle options
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const geminiService = {
  generateQuestions: async (grade: string, subject: string, topic: string, type: string) => {
    try {
      let finalTopic = topic;
      const isGeneralCulture = subject === 'Genel Kültür' || topic.toLowerCase().includes('genel kültür');
      
      if (isGeneralCulture) {
        const randomTopic = CULTURE_TOPICS[Math.floor(Math.random() * CULTURE_TOPICS.length)];
        finalTopic = `${topic} (Özellikle şu alt konuya odaklan: ${randomTopic})`;
      }

      const randomSeed = Math.random().toString(36).substring(7);
      const timestamp = Date.now();
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];
      
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `
          ${grade}. sınıf ${subject} dersi, ${finalTopic} konusu hakkında ${type} formatında sorular üret. 
          
          KRİTİK TALİMATLAR:
          - Sorular her seferinde tamamen farklı, özgün ve daha önce sorulmamış olmalı.
          - Yaratıcı, merak uyandırıcı ve çocukların ilgisini çekecek bir dil kullan.
          - Eğer konu "Genel Kültür" ise, çok spesifik ve az bilinen ama ilkokul seviyesine uygun detaylara gir.
          - Yaratıcı Kısıtlama: ${creativeConstraint}
          - (Rastgelelik ID: ${randomSeed} - Zaman: ${timestamp})
        `,
        config: {
          temperature: 1.0,
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
                    options: { 
                      type: "ARRAY", 
                      items: { type: "STRING" }, 
                      minItems: 3,
                      maxItems: 3,
                      description: "Tam olarak 3 seçenek olmalı. SADECE cevabı içermeli, A) B) gibi harfler eklenmemeli." 
                    },
                    answer: { type: "STRING" },
                    explanation: { type: "STRING", description: "Doğru cevabın nedenini açıklayan kısa metin." }
                  },
                  required: ["question", "answer", "explanation", "options"]
                }
              }
            },
            required: ["title", "questions"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");

      const result = JSON.parse(data.text);
      if (result.questions) {
        result.questions = result.questions.map((q: any) => {
          let options = q.options ? stripPrefixes(q.options) : undefined;
          if (options && options.length > 0) {
            options = shuffleArray(options);
          }
          return { ...q, options };
        });
      }
      return result;
    } catch (error: any) {
      console.error("Generate Questions Error:", error);
      throw new Error("Sorular oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
    }
  },

  generateStory: async (topic: string, questionCount: number, length: 'Kısa' | 'Orta' | 'Uzun') => {
    try {
      const lengthMap = { 'Kısa': 'yaklaşık 100 kelime', 'Orta': 'yaklaşık 300 kelime', 'Uzun': 'yaklaşık 600 kelime' };
      const randomSeed = Math.random().toString(36).substring(7);
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];
      
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `
          ${topic} konusu hakkında ilkokul seviyesinde ${lengthMap[length]} bir hikaye yaz ve bu hikaye ile ilgili ${questionCount} adet okuma-anlama sorusu oluştur. 
          Hikaye ve sorular her seferinde tamamen farklı, yaratıcı ve özgün olmalı. 
          Yaratıcı Kısıtlama: ${creativeConstraint}
          (Rastgelelik ID: ${randomSeed} - Zaman: ${Date.now()})
        `,
        config: {
          temperature: 1.0,
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
    const prompt = `A colorful, friendly, high-quality digital illustration for a children's storybook. Scene: ${summary}. Style: vibrant, cute, whimsical, professional illustration, no text.`;
    
    try {
      const data = await callGeminiWithFallback({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: prompt,
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
      
      if (data && data.parts) {
        for (const part of data.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      
      // If we got here, Gemini didn't return an image, try fallback
      console.warn("Gemini did not return image data, trying Pollinations fallback...");
      return await generateImageWithPollinations(prompt);
    } catch (error: any) {
      console.error("Gemini Image Error, trying Pollinations fallback:", error);
      // Try Pollinations for ANY error in Gemini image generation
      return await generateImageWithPollinations(prompt);
    }
  },

  generateInstantQuestion: async (studentName: string) => {
    try {
      const randomTopic = CULTURE_TOPICS[Math.floor(Math.random() * CULTURE_TOPICS.length)];
      const randomSeed = Math.random().toString(36).substring(7);
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];
      
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `
          ${studentName} isimli öğrenci için rastgele, eğitici ve genel kültür/matematik/türkçe karışık bir ilkokul sorusu sor. 
          Özellikle şu konuyu veya benzerini kullanabilirsin: ${randomTopic}. 
          Soru her seferinde tamamen farklı, şaşırtıcı ve özgün olmalı. 
          Yaratıcı Kısıtlama: ${creativeConstraint}
          (Rastgelelik ID: ${randomSeed} - Zaman: ${Date.now()})
        `,
        config: {
          temperature: 1.0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              question: { type: "STRING" },
              options: { 
                type: "ARRAY", 
                items: { type: "STRING" }, 
                minItems: 3,
                maxItems: 3,
                description: "Tam olarak 3 seçenek olmalı. SADECE cevabı içermeli, A) B) gibi harfler eklenmemeli." 
              },
              answer: { type: "STRING" },
              explanation: { type: "STRING" }
            },
            required: ["question", "answer", "options", "explanation"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");

      const result = JSON.parse(data.text);
      if (result.options) {
        result.options = stripPrefixes(result.options);
      }
      return result;
    } catch (error: any) {
      console.error("Generate Instant Question Error:", error);
      throw new Error("Soru oluşturulurken bir hata oluştu.");
    }
  },

  generateSpecialDayContent: async (day: string, type: 'Şiir' | 'Hikaye' | 'Etkinlik') => {
    try {
      const randomSeed = Math.random().toString(36).substring(7);
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];
      
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `
          ${day} özel günü için ilkokul seviyesinde bir ${type} üret. 
          İçerik her seferinde tamamen farklı, yaratıcı ve özgün olmalı. 
          Yaratıcı Kısıtlama: ${creativeConstraint}
          (Rastgelelik ID: ${randomSeed} - Zaman: ${Date.now()})
        `,
        config: {
          temperature: 1.0,
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
    const prompt = `A simple, high-quality black and white line art coloring page for kids about ${topic}. No shading, clean outlines, white background.`;
    
    try {
      const data = await callGeminiWithFallback({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: prompt,
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
      
      if (data && data.parts) {
        for (const part of data.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }

      console.warn("Gemini did not return coloring page data, trying Pollinations fallback...");
      return await generateImageWithPollinations(prompt);
    } catch (error: any) {
      console.error("Coloring Page Gemini Error, trying Pollinations fallback:", error);
      return await generateImageWithPollinations(prompt);
    }
  },

  generateDuelQuestion: async (grade: string, subject: string, topic: string) => {
    try {
      let finalTopic = topic;
      if (subject === 'Genel Kültür' || topic.toLowerCase().includes('genel kültür')) {
        const randomTopic = CULTURE_TOPICS[Math.floor(Math.random() * CULTURE_TOPICS.length)];
        finalTopic = `${topic} (Özellikle şu alt konuya odaklan: ${randomTopic})`;
      }

      const randomSeed = Math.random().toString(36).substring(7);
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];

      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `
          ${grade}. sınıf ${subject} dersi, ${finalTopic} konusu hakkında 2 öğrencinin yarışabileceği, hızlı cevaplanabilecek 3 şıklı bir test sorusu üret. 
          Soru her seferinde tamamen farklı, şaşırtıcı ve özgün olmalı. 
          Yaratıcı Kısıtlama: ${creativeConstraint}
          (Rastgelelik ID: ${randomSeed} - Zaman: ${Date.now()})
        `,
        config: {
          temperature: 1.0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              question: { type: "STRING" },
              options: { 
                type: "ARRAY", 
                items: { type: "STRING" }, 
                minItems: 3,
                maxItems: 3,
                description: "Tam olarak 3 seçenek olmalı. SADECE cevabı içermeli, A) B) gibi harfler eklenmemeli." 
              },
              answer: { type: "STRING" },
              explanation: { type: "STRING" }
            },
            required: ["question", "options", "answer", "explanation"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");
      
      const result = JSON.parse(data.text);
      if (result.options) {
        result.options = shuffleArray(stripPrefixes(result.options));
      }
      return result;
    } catch (error: any) {
      console.error("Generate Duel Question Error:", error);
      throw new Error("Düello sorusu oluşturulurken bir hata oluştu.");
    }
  },

  generateQuestionsFromImages: async (
    grade: string, 
    subject: string, 
    files: { data: string, mimeType: string }[], 
    contentType: 'lesson' | 'story',
    counts: { mc: number, tf: number, open: number }
  ) => {
    try {
      const typeLabel = contentType === 'lesson' ? `${subject} dersi materyali` : 'hikaye kitabı';
      const prompt = `
        Ekteki dosyaları (${typeLabel}) analiz et. 
        Bu içeriğe dayalı olarak ${grade}. sınıf seviyesinde şu soruları üret:
        - ${counts.mc} adet çoktan seçmeli soru (her biri tam olarak 3 şıklı: A, B, C seçenekleri olmalı)
        - ${counts.tf} adet Doğru/Yanlış sorusu (Cevaplar "Doğru" veya "Yanlış" olmalı)
        - ${counts.open} adet açık uçlu soru
        
        Tüm soruların cevaplarını ve kısa açıklamalarını ekle.
        Yanıtı belirtilen JSON formatında ver.
      `;

      const fileParts = files.map(file => ({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType
        }
      }));

      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            ...fileParts
          ]
        },
        config: {
          temperature: 1.0,
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
                    type: { type: "STRING", enum: ["multiple-choice", "true-false", "open-ended"] },
                    question: { type: "STRING" },
                    options: { 
                      type: "ARRAY", 
                      items: { type: "STRING" }, 
                      minItems: 3,
                      maxItems: 3,
                      description: "Sadece çoktan seçmeli sorular için tam olarak 3 seçenek olmalı. SADECE cevabı içermeli, A) B) gibi harfler eklenmemeli." 
                    },
                    answer: { type: "STRING" },
                    explanation: { type: "STRING" }
                  },
                  required: ["type", "question", "answer", "explanation"]
                }
              }
            },
            required: ["title", "questions"]
          }
        }
      }, "gemini-3.1-pro-preview");

      const result = JSON.parse(data.text);
      if (result.questions) {
        result.questions = result.questions.map((q: any) => {
          let options = q.options ? stripPrefixes(q.options) : undefined;
          if (options && options.length > 0) {
            options = shuffleArray(options);
          }
          return { ...q, options };
        });
      }
      return result;
    } catch (error: any) {
      console.error("Generate Questions From Files Error:", error);
      throw new Error("Dosyalardan soru oluşturulurken bir hata oluştu. Lütfen dosyaların net olduğundan emin olun.");
    }
  },

  generateDetailedQuestions: async (
    grade: string, 
    subject: string, 
    topic: string, 
    counts: { mc: number, tf: number, open: number }
  ) => {
    try {
      let finalTopic = topic;
      const isGeneralCulture = subject === 'Genel Kültür' || topic.toLowerCase().includes('genel kültür');
      
      if (isGeneralCulture) {
        const randomTopic = CULTURE_TOPICS[Math.floor(Math.random() * CULTURE_TOPICS.length)];
        finalTopic = `${topic} (Özellikle şu alt konuya odaklan: ${randomTopic})`;
      }

      const randomSeed = Math.random().toString(36).substring(7);
      const timestamp = Date.now();
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];
      
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `
          ${grade}. sınıf ${subject} dersi, ${finalTopic} konusu hakkında şu soruları üret:
          - ${counts.mc} adet çoktan seçmeli soru (her biri tam olarak 3 şıklı)
          - ${counts.tf} adet Doğru/Yanlış sorusu
          - ${counts.open} adet açık uçlu soru
          
          KRİTİK TALİMATLAR:
          - Sorular her seferinde tamamen farklı, özgün ve daha önce sorulmamış olmalı.
          - Yaratıcı, merak uyandırıcı ve çocukların ilgisini çekecek bir dil kullan.
          - Eğer konu "Genel Kültür" değilse, "Milli Maarif Modeli"ne uygun içerik üret.
          - Yaratıcı Kısıtlama: ${creativeConstraint}
          - (Rastgelelik ID: ${randomSeed} - Zaman: ${timestamp})
        `,
        config: {
          temperature: 1.0,
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
                    type: { type: "STRING", enum: ["multiple-choice", "true-false", "open-ended"] },
                    question: { type: "STRING" },
                    options: { 
                      type: "ARRAY", 
                      items: { type: "STRING" }, 
                      minItems: 3,
                      maxItems: 3,
                      description: "Sadece çoktan seçmeli sorular için tam olarak 3 seçenek olmalı. SADECE cevabı içermeli, A) B) gibi harfler eklenmemeli." 
                    },
                    answer: { type: "STRING" },
                    explanation: { type: "STRING" }
                  },
                  required: ["type", "question", "answer", "explanation"]
                }
              }
            },
            required: ["title", "questions"]
          }
        }
      }, "gemini-3.1-flash-lite-preview");

      const result = JSON.parse(data.text);
      if (result.questions) {
        result.questions = result.questions.map((q: any) => {
          let options = q.options ? stripPrefixes(q.options) : undefined;
          if (options && options.length > 0) {
            options = shuffleArray(options);
          }
          return { ...q, options };
        });
      }
      return result;
    } catch (error: any) {
      console.error("Generate Detailed Questions Error:", error);
      throw new Error("Sorular oluşturulurken bir hata oluştu.");
    }
  },

  generateWeeklyResearch: async (grade: string) => {
    try {
      const randomTopic = CULTURE_TOPICS[Math.floor(Math.random() * CULTURE_TOPICS.length)];
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];
      
      const data = await callGeminiWithFallback({
        model: "gemini-3-flash-preview",
        contents: `${grade}. sınıf ilkokul öğrencileri için bu hafta araştırılabilecek, çocukların hayal gücünü zorlayan, doğa, uzay, hayvanlar alemi veya ilginç icatlar gibi çok ilgi çekici ve öğretici bir konu belirle. Özellikle şu konuyu veya benzerini kullanabilirsin: ${randomTopic}. Konu her seferinde farklı, şaşırtıcı ve özgün olmalı. Yaratıcı Kısıtlama: ${creativeConstraint}. (Rastgelelik ID: ${Math.random().toString(36).substring(7)} - Zaman: ${Date.now()}) Ayrıca bu konuyla ilgili çocukların izleyebileceği bir video materyal önerisi (YouTube araması için anahtar kelimeler) ekle. Araştırma sorularının her biri için kısa ve öğretici cevaplar da üret.`,
        config: {
          temperature: 1.0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              topic: { type: "STRING" },
              description: { type: "STRING" },
              researchQuestions: { 
                type: "ARRAY", 
                items: { 
                  type: "OBJECT",
                  properties: {
                    question: { type: "STRING" },
                    answer: { type: "STRING" }
                  },
                  required: ["question", "answer"]
                } 
              },
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
