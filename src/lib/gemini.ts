import { GoogleGenAI } from "@google/genai";
import { db, auth } from "../firebase";

// Detect environment
const IS_AI_STUDIO = window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost');
const GEMINI_API_KEY = (process.env as any).GEMINI_API_KEY || "";


const FALLBACK_CHAIN = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite-preview",
  "gemini-2.5-flash-preview",
  "gemini-2.0-flash-lite-preview"
];

// Initialize SDK only if key is present (AI Studio mode)
let ai: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}


// Helper for calling Gemini with robust fallback mechanism
async function callGeminiWithFallback(params: any, customFallbackChain?: string[] | string): Promise<any> {
  const modelsToTry = [
    params.model, 
    ...(Array.isArray(customFallbackChain) 
        ? customFallbackChain 
        : (typeof customFallbackChain === 'string' ? [customFallbackChain] : FALLBACK_CHAIN.filter(m => m !== params.model)))
  ];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const currentParams = { 
        ...params, 
        model: modelName,
        config: {
          ...params.config,
          // Optimize for speed by limiting output if not specified
          maxOutputTokens: params.config?.maxOutputTokens || 2048,
        }
      };
      
      // If we have a local key and are in AI Studio, use the SDK directly
      if (ai && IS_AI_STUDIO) {
        const response = await ai.models.generateContent(currentParams);
        
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

      // Otherwise, use the backend proxy
      const response = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: currentParams }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const result = await response.json();
      // Backend should ideally return usage info too, but for now we assume it's tracked or handled
      return result;
    } catch (error: any) {
      lastError = error;
      const isRetryable = error.message?.includes('429') || 
                         error.message?.includes('quota') || 
                         error.message?.includes('RESOURCE_EXHAUSTED') ||
                         error.message?.includes('503') ||
                         error.message?.includes('UNAVAILABLE') ||
                         error.message?.includes('500') ||
                         error.message?.includes('Internal Server Error');
      
      if (isRetryable) {
        console.warn(`Model ${modelName} failed, trying next in fallback chain...`, error.message);
        continue;
      }
      // If not retryable (e.g. invalid prompt), throw immediately
      throw error;
    }
  }
  throw lastError;
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
  "Okuma Kültürü: Kütüphaneler neden sessiz yerlerdir?",
  "Coğrafya ve Dünya: Kıtaların isimleri ve yerleri",
  "Coğrafya ve Dünya: Okyanuslar ve denizlerin önemi",
  "Coğrafya ve Dünya: Türkiye’nin coğrafi konumu ve bölgeleri",
  "Coğrafya ve Dünya: Dünyanın yedi harikası (Eski ve Yeni)",
  "Coğrafya ve Dünya: En yüksek dağlar ve en uzun nehirler",
  "Coğrafya ve Dünya: Çöller ve kutuplardaki yaşam",
  "Coğrafya ve Dünya: Volkanlar ve depremlerin bilimsel açıklaması",
  "Coğrafya ve Dünya: Harita okuma ve pusula kullanımı",
  "Coğrafya ve Dünya: Ülkelerin bayrakları ve simgeleri",
  "Coğrafya ve Dünya: Mevsimlerin nasıl oluştuğu",
  "Coğrafya ve Dünya: Popüler dünya başkentleri",
  "Coğrafya ve Dünya: Yağmur ormanlarının ekosistemi",
  "Coğrafya ve Dünya: Mağaralar ve yer altı suları",
  "Coğrafya ve Dünya: Bulut çeşitleri ve hava olayları",
  "Coğrafya ve Dünya: Küresel ısınma ve iklim değişikliği",
  "Coğrafya ve Dünya: Göller ve tatlı su kaynakları",
  "Coğrafya ve Dünya: Adalar ve yarımadalar arasındaki farklar",
  "Coğrafya ve Dünya: Ekvator ve kutup çizgileri",
  "Coğrafya ve Dünya: Erozyon ve heyelan nedir?",
  "Coğrafya ve Dünya: Doğal kaynakların korunması",
  "Hayvanlar ve Doğa Bilimi: Nesli tükenmiş canlılar (Dinozorlar, Mamutlar)",
  "Hayvanlar ve Doğa Bilimi: Deniz altındaki biyolojik çeşitlilik",
  "Hayvanlar ve Doğa Bilimi: Kuşların göç yolları ve nedenleri",
  "Hayvanlar ve Doğa Bilimi: Arıların ekosistemdeki hayati rolü",
  "Hayvanlar ve Doğa Bilimi: Hayvanlarda kamuflaj yeteneği",
  "Hayvanlar ve Doğa Bilimi: Dünyanın en hızlı ve en yavaş canlıları",
  "Hayvanlar ve Doğa Bilimi: Bitkilerin bölümleri ve fotosentez",
  "Hayvanlar ve Doğa Bilimi: Tohumun çimlenme aşamaları",
  "Hayvanlar ve Doğa Bilimi: Gececil hayvanların özellikleri",
  "Hayvanlar ve Doğa Bilimi: Kış uykusuna yatan canlılar",
  "Hayvanlar ve Doğa Bilimi: Evcil hayvanların bakımı ve sorumlulukları",
  "Hayvanlar ve Doğa Bilimi: Bitkilerin tozlaşma süreci",
  "Hayvanlar ve Doğa Bilimi: Mantarların doğadaki görevi",
  "Hayvanlar ve Doğa Bilimi: Ormanların faydaları",
  "Hayvanlar ve Doğa Bilimi: Deniz canlılarının solunumu",
  "Hayvanlar ve Doğa Bilimi: Sürüngenlerin özellikleri",
  "Hayvanlar ve Doğa Bilimi: Memeli hayvanların ortak özellikleri",
  "Hayvanlar ve Doğa Bilimi: Eklem bacaklılar ve böcekler",
  "Hayvanlar ve Doğa Bilimi: Bakteriler ve mikroplar (Yararlı ve zararlı)",
  "Hayvanlar ve Doğa Bilimi: Toprağın oluşumu ve canlılığı",
  "Uzay, Fen ve Teknoloji: Güneş sistemimiz ve gezegenler",
  "Uzay, Fen ve Teknoloji: Ay’ın evreleri ve gelgit olayı",
  "Uzay, Fen ve Teknoloji: Yıldız kümeleri ve takımyıldızları",
  "Uzay, Fen ve Teknoloji: İlk uzay yolculuğu ve astronotlar",
  "Uzay, Fen ve Teknoloji: Yerçekimi kuvveti ve Newton",
  "Uzay, Fen ve Teknoloji: Teleskop ve mikroskobun çalışma prensibi",
  "Uzay, Fen ve Teknoloji: Suyun doğadaki döngüsü",
  "Uzay, Fen ve Teknoloji: Maddenin halleri: Katı, sıvı, gaz",
  "Uzay, Fen ve Teknoloji: Mıknatıslar ve manyetik alan",
  "Uzay, Fen ve Teknoloji: Geri dönüşümün önemi",
  "Uzay, Fen ve Teknoloji: Yenilenebilir enerji (Güneş ve Rüzgar)",
  "Uzay, Fen ve Teknoloji: İnsan iskeleti ve kas sistemi",
  "Uzay, Fen ve Teknoloji: Beş duyu organımız",
  "Uzay, Fen ve Teknoloji: Işığın kırılması ve yansıması",
  "Uzay, Fen ve Teknoloji: Sesin yayılması ve yankı",
  "Uzay, Fen ve Teknoloji: Elektrik akımı ve devreler",
  "Uzay, Fen ve Teknoloji: Robotik ve kodlamanın temelleri",
  "Uzay, Fen ve Teknoloji: Yapay zekanın günlük hayattaki yeri",
  "Uzay, Fen ve Teknoloji: İnternetin nasıl çalıştığı",
  "Uzay, Fen ve Teknoloji: İnsan beyni ve sinir sistemi",
  "Tarih ve Medeniyet Mirası: Tekerleğin icadı ve ulaşım devrimi",
  "Tarih ve Medeniyet Mirası: Yazının icadı: Sümerler ve Hiyeroglifler",
  "Tarih ve Medeniyet Mirası: Eski Mısır medeniyeti ve piramitler",
  "Tarih ve Medeniyet Mirası: Mezopotamya: Uygarlığın doğuşu",
  "Tarih ve Medeniyet Mirası: Kurtuluş Savaşı ve Milli Mücadele",
  "Tarih ve Medeniyet Mirası: Cumhuriyetin ilanı ve kazanımları",
  "Tarih ve Medeniyet Mirası: Tarihteki önemli Türk devletleri (Göktürkler, Uygurlar vb.)",
  "Tarih ve Medeniyet Mirası: İpek Yolu ve Baharat Yolu",
  "Tarih ve Medeniyet Mirası: Orta Çağ, Yeni Çağ ve Yakın Çağ ayrımı",
  "Tarih ve Medeniyet Mirası: UNESCO Dünya Mirası listesindeki yerler",
  "Tarih ve Medeniyet Mirası: İlk yerleşim yerleri (Göbeklitepe, Çatalhöyük)",
  "Tarih ve Medeniyet Mirası: Olimpiyat Oyunlarının tarihi",
  "Tarih ve Medeniyet Mirası: Türk bayrağının anlamı ve tarihçesi",
  "Tarih ve Medeniyet Mirası: Antik Yunan ve Roma mimarisi",
  "Tarih ve Medeniyet Mirası: Aztek ve Maya medeniyetleri",
  "Tarih ve Medeniyet Mirası: Keşifler Çağı: Kristof Kolomb ve Macellan",
  "Tarih ve Medeniyet Mirası: Sanayi Devrimi ve etkileri",
  "Tarih ve Medeniyet Mirası: Milli bayramlarımızın önemi",
  "Tarih ve Medeniyet Mirası: Demokrasi nedir? (Basit anlatım)",
  "Tarih ve Medeniyet Mirası: Müzelerin toplumdaki yeri",
  "Türk-İslam Kültürü ve Bilimi: İbni Sina: Tıp dünyasına katkıları",
  "Türk-İslam Kültürü ve Bilimi: Cezeri: Sibernetiğin kurucusu ve makineleri",
  "Türk-İslam Kültürü ve Bilimi: Biruni: Gökbilim ve matematik çalışmaları",
  "Türk-İslam Kültürü ve Bilimi: Ali Kuşçu: Ay haritası ve astronomi",
  "Türk-İslam Kültürü ve Bilimi: Harezmi: Cebirin temelleri ve sıfır rakamı",
  "Türk-İslam Kültürü ve Bilimi: Mimar Sinan’ın mühendislik dehası",
  "Türk-İslam Kültürü ve Bilimi: Piri Reis ve tarihi dünya haritaları",
  "Türk-İslam Kültürü ve Bilimi: Evliya Çelebi ve Seyahatname’den notlar",
  "Türk-İslam Kültürü ve Bilimi: Farabi ve müzik kuramları",
  "Türk-İslam Kültürü ve Bilimi: Fuat Sezgin: Bilim tarihi araştırmaları",
  "Türk-İslam Kültürü ve Bilimi: Aziz Sancar: DNA onarımı ve Nobel ödülü",
  "Türk-İslam Kültürü ve Bilimi: Hezarfen Ahmed Çelebi: Uçuş denemeleri",
  "Türk-İslam Kültürü ve Bilimi: Katip Çelebi ve coğrafya kitapları",
  "Türk-İslam Kültürü ve Bilimi: Uluğ Bey ve yıldız katalogları",
  "Türk-İslam Kültürü ve Bilimi: Türk-İslam mimarisinde geometrik desenler",
  "Türk-İslam Kültürü ve Bilimi: Darüşşifalar: Eski Türk hastaneleri",
  "Türk-İslam Kültürü ve Bilimi: Rasathaneler: Gözlemevlerinin tarihi",
  "Türk-İslam Kültürü ve Bilimi: Ebru sanatı ve kağıt süsleme",
  "Türk-İslam Kültürü ve Bilimi: Çini ve seramik sanatının incelikleri",
  "Türk-İslam Kültürü ve Bilimi: Hat sanatı ve güzel yazı",
  "Edebiyat, Sanat ve Dil: Yunus Emre and insan sevgisi",
  "Edebiyat, Sanat ve Dil: Mevlana: Hoşgörü ve Mesnevi",
  "Edebiyat, Sanat ve Dil: Nasrettin Hoca fıkraları ve dersler",
  "Edebiyat, Sanat ve Dil: Dede Korkut hikayeleri",
  "Edebiyat, Sanat ve Dil: Mehmet Akif Ersoy ve İstiklal Marşı",
  "Edebiyat, Sanat ve Dil: Karagöz ve Hacivat: Gölge oyunu",
  "Edebiyat, Sanat ve Dil: Keloğlan masalları ve zeka",
  "Edebiyat, Sanat ve Dil: Dünyaca ünlü ressamlar (Da Vinci, Van Gogh)",
  "Edebiyat, Sanat ve Dil: Klasik müzik bestecileri (Mozart, Beethoven)",
  "Edebiyat, Sanat ve Dil: Türk halk ozanları (Aşık Veysel, Karacaoğlan)",
  "Edebiyat, Sanat ve Dil: Şiir ve kafiye nedir?",
  "Edebiyat, Sanat ve Dil: Atasözleri ve deyimlerin hikayeleri",
  "Edebiyat, Sanat ve Dil: Dünyadaki dil aileleri",
  "Edebiyat, Sanat ve Dil: Kitapların bölümleri ve kütüphane kuralları",
  "Edebiyat, Sanat ve Dil: Tiyatro ve sahne sanatları",
  "Edebiyat, Sanat ve Dil: Heykel sanatı ve ünlü eserler",
  "Edebiyat, Sanat ve Dil: Sinemanın icadı ve animasyon",
  "Edebiyat, Sanat ve Dil: Bale ve modern dans",
  "Edebiyat, Sanat ve Dil: Renklerin dili ve karışımları",
  "Edebiyat, Sanat ve Dil: Türkçenin konuşulduğu coğrafyalar",
  "Sağlık, Spor ve Yaşam: Dengeli beslenme ve vitaminler",
  "Sağlık, Spor ve Yaşam: Kişisel hijyen ve el yıkamanın önemi",
  "Sağlık, Spor ve Yaşam: Uyku düzeninin zihne etkileri",
  "Sağlık, Spor ve Yaşam: Spor dalları ve temel kuralları",
  "Sağlık, Spor ve Yaşam: Satranç ve strateji geliştirme",
  "Sağlık, Spor ve Yaşam: Trafik işaretleri ve yaya güvenliği",
  "Sağlık, Spor ve Yaşam: İlk yardımın temel prensipleri",
  "Sağlık, Spor ve Yaşam: Paranın tarihçesi: Takastan dijital paraya",
  "Sağlık, Spor ve Yaşam: Tasarruf bilinci ve israfın önlenmesi",
  "Sağlık, Spor ve Yaşam: Görgü kuralları ve sosyal nezaket",
  "Sağlık, Spor ve Yaşam: Dijital güvenlik ve şifre belirleme",
  "Sağlık, Spor ve Yaşam: Hobilerin ruh sağlığına faydaları",
  "Sağlık, Spor ve Yaşam: Mesleklerin tanıtımı ve görevleri",
  "Sağlık, Spor ve Yaşam: Diş sağlığı ve doğru fırçalama",
  "Sağlık, Spor ve Yaşam: Kahvaltının gün içindeki önemi",
  "Sağlık, Spor ve Yaşam: Su içmenin vücuda faydaları",
  "Sağlık, Spor ve Yaşam: Güneşten korunma yolları",
  "Sağlık, Spor ve Yaşam: Doğa yürüyüşü ve kamp kuralları",
  "Sağlık, Spor ve Yaşam: Bisiklet sürme ve kask kullanımı",
  "Sağlık, Spor ve Yaşam: Takım ruhu ve iş birliği",
  "Değerler ve Sosyal Beceriler: Dürüstlük ve doğru sözlülük",
  "Değerler ve Sosyal Beceriler: Sabır ve azimli olma",
  "Değerler ve Sosyal Beceriler: Merhamet ve empati kurma",
  "Değerler ve Sosyal Beceriler: Saygı: Yaşlılara ve çevreye hürmet",
  "Değerler ve Sosyal Beceriler: Adalet ve hakkaniyet kavramı",
  "Değerler ve Sosyal Beceriler: Sorumluluk bilinci ve görev paylaşımı",
  "Değerler ve Sosyal Beceriler: Vatan sevgisi ve topluma hizmet",
  "Değerler ve Sosyal Beceriler: Yardımseverlik ve paylaşma",
  "Değerler ve Sosyal Beceriler: Estetik bakış açısı ve çevreyi güzelleştirme",
  "Değerler ve Sosyal Beceriler: Özdenetim: Öfke ve heyecan kontrolü",
  "Değerler ve Sosyal Beceriler: Çalışkanlık ve üretkenlik",
  "Değerler ve Sosyal Beceriler: Mütevazılık ve alçakgönüllülük",
  "Değerler ve Sosyal Beceriler: Misafirperverlik geleneği",
  "Değerler ve Sosyal Beceriler: Komşuluk hakları ve dayanışma",
  "Değerler ve Sosyal Beceriler: Hayvan haklarına duyarlılık",
  "Değerler ve Sosyal Beceriler: Engelli bireylerle iletişim ve empati",
  "Değerler ve Sosyal Beceriler: Eleştirel düşünme: Sorular sorma",
  "Değerler ve Sosyal Beceriler: Problem çözme teknikleri",
  "Değerler ve Sosyal Beceriler: Özgüven ve kendini ifade etme",
  "Değerler ve Sosyal Beceriler: Zaman yönetimi ve planlama",
  "İcatlar ve Keşifler: Ampulün icadı ve aydınlanma",
  "İcatlar ve Keşifler: Telefonun gelişimi: Kabloludan akıllıya",
  "İcatlar ve Keşifler: Matbaanın icadı ve bilginin yayılması",
  "İcatlar ve Keşifler: Pusulanın denizcilikteki önemi",
  "İcatlar ve Keşifler: Uçağın icadı ve havacılık tarihi",
  "İcatlar ve Keşifler: Penisilin ve tıptaki devrimler",
  "İcatlar ve Keşifler: Kağıdın Çin’den dünyaya yolculuğu",
  "İcatlar ve Keşifler: Camın keşfi ve kullanım alanları",
  "İcatlar ve Keşifler: Plastik ve çevreye olan etkileri",
  "İcatlar ve Keşifler: Mikrodalga ve fırın teknolojisi",
  "İcatlar ve Keşifler: Pilin icadı ve depolanabilir enerji",
  "İcatlar ve Keşifler: Asansörün binalara etkisi",
  "İcatlar ve Keşifler: Gözlüğün icadı ve optik",
  "İcatlar ve Keşifler: Buharlı makineler ve trenler",
  "İcatlar ve Keşifler: Fotoğraf makinesinin gelişimi",
  "Genel Bilgi ve Merak Edilenler: Gökkuşağı neden ve nasıl oluşur?",
  "Genel Bilgi ve Merak Edilenler: Deniz suyu neden tuzludur?",
  "Genel Bilgi ve Merak Edilenler: Kar tanelerinin eşsiz yapıları",
  "Genel Bilgi ve Merak Edilenler: Yankı neden oluşur?",
  "Genel Bilgi ve Merak Edilenler: Dünyanın en büyük kütüphaneleri",
  "Genel Bilgi ve Merak Edilenler: Guinness Rekorlar Kitabı nedir?",
  "Genel Bilgi ve Merak Edilenler: Takvimlerin oluşumu ve zaman ölçümü",
  "Genel Bilgi ve Merak Edilenler: Farklı dillerde selamlaşma biçimleri",
  "Genel Bilgi ve Merak Edilenler: Gökyüzünün mavi görünme nedeni",
  "Genel Bilgi ve Merak Edilenler: Ateşin kontrol altına alınmasının önemi",
  "Genel Bilgi ve Merak Edilenler: Müze türleri (Arkeoloji, Sanat, Teknoloji)",
  "Genel Bilgi ve Merak Edilenler: Çevremizdeki geometrik şekillerin kullanımı",
  "Genel Bilgi ve Merak Edilenler: Balıklar su altında nasıl nefes alır?",
  "Genel Bilgi ve Merak Edilenler: Arıların dansla iletişim kurması",
  "Genel Bilgi ve Merak Edilenler: Bir ağacın yaşını nasıl anlarız?",
  "Genel Bilgi ve Merak Edilenler: Mıknatıs hangi maddeleri çekmez?",
  "Genel Bilgi ve Merak Edilenler: Sıfır Atık nedir ve nasıl uygulanır?",
  "Genel Bilgi ve Merak Edilenler: İlk yardım çantasında neler olmalı?",
  "Genel Bilgi ve Merak Edilenler: Kütüphane kartı nasıl alınır?",
  "Genel Bilgi ve Merak Edilenler: Bilimsel bir deneyin aşamaları",
  "Genel Bilgi ve Merak Edilenler: Medya okuryazarlığı: Doğru haber nedir?",
  "Genel Bilgi ve Merak Edilenler: Siber zorbalıktan korunma yolları",
  "Genel Bilgi ve Merak Edilenler: Yardımlaşma kurumları (Kızılay, Yeşilay vb.)",
  "Genel Bilgi ve Merak Edilenler: Sağlıklı bir kahvaltı tabağı hazırlama",
  "Genel Bilgi ve Merak Edilenler: Hayallerimizdeki gelecek ve meslekler"
];

const RESEARCH_TOPICS = [
  "Doğa ve Çevre: Karıncalar yollarını nasıl bulur?",
  "Doğa ve Çevre: Neden bazı ağaçlar yaprak döker, bazıları dökmez?",
  "Doğa ve Çevre: Arıların doğadaki en önemli görevi nedir?",
  "Doğa ve Çevre: Deniz kaplumbağaları (Caretta Caretta) neden kumsallara yumurta bırakır?",
  "Doğa ve Çevre: Geri dönüştürülen bir kağıt hangi aşamalardan geçer?",
  "Doğa ve Çevre: Toprak solucanlarının bahçeler için faydası nedir?",
  "Doğa ve Çevre: Bir bitki güneş ışığı almazsa ne olur?",
  "Doğa ve Çevre: Dünyanın en yaşlı ağacı kaç yaşındadır ve nerededir?",
  "Doğa ve Çevre: Kaktüsler susuzluğa nasıl dayanır?",
  "Doğa ve Çevre: Okyanusların en derin noktasında hangi canlılar yaşar?",
  "Doğa ve Çevre: Kar tanelerinin şekilleri neden birbirinden farklıdır?",
  "Doğa ve Çevre: Mantarlar bitki midir? Neden?",
  "Doğa ve Çevre: Mercan kayalıkları nedir ve neden 'denizlerin ormanı' denir?",
  "Doğa ve Çevre: Gökkuşağı oluşumu için hangi iki şey gereklidir?",
  "Doğa ve Çevre: Atmosfer tabakası dünyayı nelerden korur?",
  "Doğa ve Çevre: Sıfır atık bir evde neler yapılır?",
  "Doğa ve Çevre: Göçmen kuşlar yollarını nasıl şaşırmazlar?",
  "Doğa ve Çevre: Bir damla suyun buluttan bardağımıza yolculuğu.",
  "Doğa ve Çevre: Orman yangınları sonrası doğa kendini nasıl yeniler?",
  "Doğa ve Çevre: Nesli tükenmekte olan bir hayvanı seç ve nedenini araştır.",
  "Bilim, Uzay ve Teknoloji: Ay neden bazen tam daire, bazen yarım görünür?",
  "Bilim, Uzay ve Teknoloji: Mars gezegeni neden kırmızı renktedir?",
  "Bilim, Uzay ve Teknoloji: Astronotlar uzayda nasıl yemek yer ve uyurlar?",
  "Bilim, Uzay ve Teknoloji: Yerçekimi olmasaydı hayatımızda neler değişirdi?",
  "Bilim, Uzay ve Teknoloji: İlk bilgisayarlar ne kadar büyüklükteydi?",
  "Bilim, Uzay ve Teknoloji: Robotlar nasıl 'düşünür' ve hareket eder?",
  "Bilim, Uzay ve Teknoloji: Uçaklar o kadar ağır olmalarına rağmen nasıl uçarlar?",
  "Bilim, Uzay ve Teknoloji: Teleskopla gökyüzüne bakınca neler görebiliriz?",
  "Bilim, Uzay ve Teknoloji: Mıknatıslar hangi metalleri çeker, hangilerini çekmez?",
  "Bilim, Uzay ve Teknoloji: Ampul icat edilmeden önce evler nasıl aydınlanıyordu?",
  "Bilim, Uzay ve Teknoloji: Ses boşlukta (uzayda) neden yayılmaz?",
  "Bilim, Uzay ve Teknoloji: Suyun kaldırma kuvvetini kim, nasıl keşfetti?",
  "Bilim, Uzay ve Teknoloji: Güneş enerjisiyle çalışan araçlar nasıl çalışır?",
  "Bilim, Uzay ve Teknoloji: Mikroskop altında bir soğan zarı nasıl görünür?",
  "Bilim, Uzay ve Teknoloji: İnternet dünyayı nasıl birbirine bağlar?",
  "Bilim, Uzay ve Teknoloji: İlk roketi kim icat etti?",
  "Bilim, Uzay ve Teknoloji: Neden bazı nesneler suda yüzerken bazıları batar?",
  "Bilim, Uzay ve Teknoloji: Statik elektrik (kazak çarpması) neden olur?",
  "Bilim, Uzay ve Teknoloji: Pillerin içinde ne vardır?",
  "Bilim, Uzay ve Teknoloji: Drone'lar hangi alanlarda işimize yarar?",
  "Türk-İslam Kültürü ve Değerler: Mimar Sinan eserlerinde neden 'akustik' konusuna önem vermiştir?",
  "Türk-İslam Kültürü ve Değerler: Cezeri’nin yaptığı 'Filli Saat' nasıl çalışıyordu?",
  "Türk-İslam Kültürü ve Değerler: Ali Kuşçu’nun Ay haritası bugün nerede kullanılıyor?",
  "Türk-İslam Kültürü ve Değerler: Türk kahvesinin yanındaki suyun verilme amacı nedir?",
  "Türk-İslam Kültürü ve Değerler: Sadaka taşlarının toplumsal yardımlaşmadaki rolü nedir?",
  "Türk-İslam Kültürü ve Değerler: Yunus Emre’nin 'sevgi' üzerine söylediği bir sözü araştır.",
  "Türk-İslam Kültürü ve Değerler: Eski Türklerde 'İmece' usulü iş yapmak ne demektir?",
  "Türk-İslam Kültürü ve Değerler: Karagöz ve Hacivat oyunundaki karakterlerin özellikleri nelerdir?",
  "Türk-İslam Kültürü ve Değerler: Piri Reis haritasını çizerken hangi kaynaklardan yararlandı?",
  "Türk-İslam Kültürü ve Değerler: Türk misafirperverliğinde 'diş kirası' geleneği nedir?",
  "Türk-İslam Kültürü ve Değerler: Kuş evleri neden camilerin veya evlerin yüksek yerlerine yapılırdı?",
  "Türk-İslam Kültürü ve Değerler: Nasrettin Hoca fıkralarındaki gizli dersler nelerdir?",
  "Türk-İslam Kültürü ve Değerler: İbni Sina 'Küçük Kan Dolaşımı'nı nasıl tarif etmiştir?",
  "Türk-İslam Kültürü ve Değerler: Ebru sanatı yapılırken kullanılan 'kitre' ve 'öd' nedir?",
  "Türk-İslam Kültürü ve Değerler: Osmanlı döneminde 'Zimem Defteri' uygulaması nasıldı?",
  "Türk-İslam Kültürü ve Değerler: Mevlana’nın semazen gösterisindeki sembollerin anlamı nedir?",
  "Türk-İslam Kültürü ve Değerler: Çini sanatında neden en çok mavi ve beyaz renkler kullanılmış?",
  "Türk-İslam Kültürü ve Değerler: Harezmi 'Sıfır' rakamını bulmasaydı matematik nasıl olurdu?",
  "Türk-İslam Kültürü ve Değerler: Eski Türklerdeki 'Okçuluk' sporu ve Menzil okçuluğu.",
  "Türk-İslam Kültürü ve Değerler: Mahalle kültüründe 'Bakkal Amca' figürünün önemi.",
  "Tarih ve Genel Kültür: Tekerleğin ilk hali nasıldı ve neyden yapılmıştı?",
  "Tarih ve Genel Kültür: Paranın icadından önce insanlar nasıl alışveriş yapıyordu?",
  "Tarih ve Genel Kültür: İlk kütüphane nerede ve ne zaman kuruldu?",
  "Tarih ve Genel Kültür: Çanakkale Savaşı’nda Seyit Onbaşı’nın kahramanlığı.",
  "Tarih ve Genel Kültür: Hiyeroglif yazısı (resim yazısı) nasıl okunur?",
  "Tarih ve Genel Kültür: Dünyanın en eski yerleşim yeri Göbeklitepe nerede?",
  "Tarih ve Genel Kültür: İpek Yolu’nda hangi ticaret malları taşınırdı?",
  "Tarih ve Genel Kültür: İlk olimpiyat oyunları hangi amaçla yapıldı?",
  "Tarih ve Genel Kültür: Atatürk’ün çocukluk hayalleri ve okuduğu kitaplar.",
  "Tarih ve Genel Kültür: Kristof Kolomb dünyayı dolaşırken nereye varmak istiyordu?",
  "Tarih ve Genel Kültür: Matbaanın icadı kitap sayısını nasıl artırdı?",
  "Tarih ve Genel Kültür: İlk Türk uçağını yapan Vecihi Hürkuş kimdir?",
  "Tarih ve Genel Kültür: Anıtkabir’in mimari özellikleri ve sembolleri.",
  "Tarih and Genel Kültür: Eski Mısırlılar piramitleri nasıl inşa ettiler?",
  "Tarih and Genel Kültür: İstanbul’un fethinde gemilerin karadan yürütülmesi hikayesi.",
  "Tarih and Genel Kültür: İlk takvimler neye göre (Güneş/Ay) hazırlandı?",
  "Tarih and Genel Kültür: Türk bayrağındaki ay ve yıldızın tarihsel anlamı.",
  "Tarih and Genel Kültür: Yazı yazmak için kağıttan önce neler kullanılıyordu?",
  "Tarih and Genel Kültür: Dünyanın en büyük şelalesi hangisidir?",
  "Tarih and Genel Kültür: Tarihteki ünlü çocuk kahramanlar (örn. Şerife Bacı).",
  "Sağlık, Spor ve Beslenme: Vücudumuzdaki en güçlü kas hangisidir?",
  "Sağlık, Spor ve Beslenme: Meyveler neden farklı renklerdedir? (Renk-Vitamin ilişkisi)",
  "Sağlık, Spor ve Beslenme: Dişlerimizi fırçalamazsak bakteriler orada ne yapar?",
  "Sağlık, Spor ve Beslenme: Neden spor yapmadan önce ısınma hareketleri yapmalıyız?",
  "Sağlık, Spor ve Beslenme: Beynimiz uyurken neden çalışmaya devam eder?",
  "Sağlık, Spor ve Beslenme: Süt içmek kemiklerimizi nasıl güçlendirir?",
  "Sağlık, Spor ve Beslenme: C vitamini en çok hangi besinlerde bulunur?",
  "Sağlık, Spor ve Beslenme: Mikroplardan korunmak için doğru el yıkama süresi ne kadardır?",
  "Sağlık, Spor ve Beslenme: Şekerli içeceklerin vücudumuza zararları nelerdir?",
  "Sağlık, Spor ve Beslenme: Göz sağlığımızı korumak için ekran başında ne kadar durmalıyız?",
  "Sağlık, Spor ve Beslenme: Uyku sırasında büyüme hormonu nasıl çalışır?",
  "Sağlık, Spor ve Beslenme: Okçuluk sporu odaklanma becerisini nasıl artırır?",
  "Sağlık, Spor ve Beslenme: Sağlıklı bir kahvaltıda mutlaka olması gereken 5 besin.",
  "Sağlık, Spor ve Beslenme: Kan grupları nelerdir ve neden önemlidir?",
  "Sağlık, Spor ve Beslenme: Kalbimiz günde yaklaşık kaç kez çarpar?",
  "Sağlık, Spor ve Beslenme: Nefes alırken ciğerlerimizde neler olur?",
  "Sağlık, Spor ve Beslenme: Mevsimine göre beslenmek neden daha sağlıklıdır?",
  "Sağlık, Spor ve Beslenme: Satranç oynamanın beyin gelişimine etkileri.",
  "Sağlık, Spor ve Beslenme: Su içmek neden zihnimizi daha açık tutar?",
  "Sağlık, Spor ve Beslenme: Dirseğimizi bir yere çarptığımızda neden 'elektriklenmiş' gibi hissederiz?",
  "Sanat, Müzik ve Beceri: Renk çemberindeki ana renkler ve ara renkler nelerdir?",
  "Sanat, Müzik ve Beceri: Flüt, keman ve piyano arasındaki ses farkı nereden gelir?",
  "Sanat, Müzik ve Beceri: Karikatür çizmenin temel kuralları nelerdir?",
  "Sanat, Müzik ve Beceri: Kağıt katlama sanatı (Origami) ile neler yapılabilir?",
  "Sanat, Müzik ve Beceri: Dünyanın en ünlü tablosu 'Mona Lisa' neden bu kadar önemli?",
  "Sanat, Müzik ve Beceri: Bir şarkı bestelenirken notalar nasıl dizilir?",
  "Sanat, Müzik ve Beceri: Kukla tiyatrosu nasıl hazırlanır?",
  "Sanat, Müzik ve Beceri: Eski zamanlarda boyalar bitkilerden nasıl elde ediliyordu?",
  "Sanat, Müzik ve Beceri: Heykeltıraşlar bir taşı nasıl şekillendirir?",
  "Sanat, Müzik ve Beceri: Klasik müzik dinlemek ders çalışmaya yardımcı olur mu?",
  "Sanat, Müzik ve Beceri: İlk fotoğraf karesi neyin fotoğrafıydı?",
  "Sanat, Müzik ve Beceri: Çizgi filmlerde karakterler nasıl hareket ettirilir?",
  "Sanat, Müzik ve Beceri: Mimari bir maket yaparken nelere dikkat edilir?",
  "Sanat, Müzik ve Beceri: Ses sanatçıları seslerini nasıl korurlar?",
  "Sanat, Müzik ve Beceri: Geleneksel el sanatlarımızdan 'Bakırcılık' nasıl yapılır?",
  "Sanat, Müzik ve Beceri: Bir tiyatro oyununda dekorun görevi nedir?",
  "Sanat, Müzik ve Beceri: Bale dansçılarının giydiği özel ayakkabıların (puant) özelliği.",
  "Sanat, Müzik ve Beceri: Müzeler neden sessiz gezilmelidir?",
  "Sanat, Müzik ve Beceri: Mozaik sanatı küçük parçalarla nasıl oluşturulur?",
  "Sanat, Müzik ve Beceri: Türk sanat müziğindeki makamlar ve duygular.",
  "Sosyal Beceriler ve Erdemler: 'Empati kurmak' bir arkadaşlıkta neden önemlidir?",
  "Sosyal Beceriler ve Erdemler: Dürüstlük, insanların bize güvenmesini nasıl sağlar?",
  "Sosyal Beceriler ve Erdemler: Bir sorunu kavga etmeden çözmenin 3 yolu nedir?",
  "Sosyal Beceriler ve Erdemler: Teşekkür etmek ve özür dilemek neden birer nezaket kuralıdır?",
  "Sosyal Beceriler ve Erdemler: Hayvan barınakları için gönüllü olarak neler yapabiliriz?",
  "Sosyal Beceriler ve Erdemler: Bir plan yapıp ona uymak bize ne kazandırır?",
  "Sosyal Beceriler ve Erdemler: Başkalarının eşyasını izinsiz almamak neden bir kuraldır?",
  "Sosyal Beceriler ve Erdemler: Tasarruf yapmak sadece para biriktirmek midir?",
  "Sosyal Beceriler ve Erdemler: Grup çalışmalarında görev paylaşımı nasıl yapılır?",
  "Sosyal Beceriler ve Erdemler: Sabırlı olmak, zor bir ödevi bitirmemize nasıl yardım eder?",
  "Sosyal Beceriler ve Erdemler: Büyüklerimize saygı göstermenin farklı yolları nelerdir?",
  "Sosyal Beceriler ve Erdemler: Çevremizi temiz tutmak kime karşı sorumluluğumuzdur?",
  "Sosyal Beceriler ve Erdemler: Bir hobinin olması bizi neden mutlu eder?",
  "Sosyal Beceriler ve Erdemler: Yeni bir dilde 'merhaba' ve 'lütfen' demeyi öğrenmek.",
  "Sosyal Beceriler ve Erdemler: Okul kuralları neden vardır ve olmasaydı ne olurdu?",
  "Sosyal Beceriler ve Erdemler: Engelli bir bireyin hayatını kolaylaştırmak için neler yapabiliriz?",
  "Sosyal Beceriler ve Erdemler: İnternette tanımadığımız kişilerle neden konuşmamalıız?",
  "Sosyal Beceriler ve Erdemler: Kütüphanede kitap seçerken nelere dikkat etmeliyiz?",
  "Sosyal Beceriler ve Erdemler: Birine karşılıksız yardım etmenin (iyilik yapmanın) bize etkisi.",
  "Sosyal Beceriler ve Erdemler: Hatalarımızdan ders çıkarmak ne demektir?",
  "Yaşam Ve Genel Merak: Cam nasıl yapılır? Kum nasıl cama dönüşür?",
  "Yaşam Ve Genel Merak: Kurşun kalemlerin içindeki 'kurşun' aslında nedir?",
  "Yaşam Ve Genel Merak: Kağıt israfını önlemek için okulda neler yapabiliriz?",
  "Yaşam Ve Genel Merak: Bir pusula her zaman neden kuzeyi gösterir?",
  "Yaşam Ve Genel Merak: Neden deniz suyu içilmez?",
  "Yaşam Ve Genel Merak: Sabun mikropları nasıl öldürür?",
  "Yaşam Ve Genel Merak: Trafik ışıklarının renkleri neden kırmızı, sarı ve yeşildir?",
  "Yaşam Ve Genel Merak: Uçakların arkasında bıraktığı beyaz çizgi nedir?",
  "Yaşam Ve Genel Merak: Gözlerimiz neden kırpılır?",
  "Yaşam Ve Genel Merak: Bir saatin içindeki çarklar nasıl çalışır?",
  "Yaşam Ve Genel Merak: Giysilerimizin etiketindeki semboller ne anlama gelir?",
  "Yaşam Ve Genel Merak: Neden parmak izlerimiz birbirinden farklıdır?",
  "Yaşam Ve Genel Merak: Buzdolabı içini nasıl soğuk tutar?",
  "Yaşam Ve Genel Merak: Çay neden demlenince renk değiştirir?",
  "Yaşam Ve Genel Merak: Kışın neden kalın ve koyu renkli kıyafetler giyeriz?",
  "Yaşam Ve Genel Merak: Balıklar suyun altında nasıl uyurlar?",
  "Yaşam Ve Genel Merak: Yerel marketimizdeki meyveler bize hangi şehirlerden gelir?",
  "Yaşam Ve Genel Merak: Haritalardaki renkler (mavi, yeşil, kahverengi) neyi temsil eder?",
  "Yaşam Ve Genel Merak: Ateş böcekleri nasıl ışık saçar?",
  "Yaşam Ve Genel Merak: Eski insanlar zamanı suyla veya kumla nasıl ölçerdi?",
  "Şehirler, Ülkeler ve Kültürler: Japonya’da neden insanlar birbirini eğilerek selamlar?",
  "Şehirler, Ülkeler ve Kültürler: Venedik şehrinde neden yollar yerine kanallar vardır?",
  "Şehirler, Ülkeler ve Kültürler: Eskimoların yaşadığı 'İglo' evleri içini nasıl sıcak tutar?",
  "Şehirler, Ülkeler ve Kültürler: Hindistan’da neden baharatlı yemekler çok yaygındır?",
  "Şehirler, Ülkeler ve Kültürler: Hollanda’daki yel değirmenlerinin asıl amacı nedir?",
  "Şehirler, Ülkeler ve Kültürler: Brezilya’daki Amazon nehrinde hangi ilginç canlılar yaşar?",
  "Şehirler, Ülkeler ve Kültürler: Avustralya’daki kanguruların neden keseleri vardır?",
  "Şehirler, Ülkeler ve Kültürler: Paris’teki Eyfel Kulesi aslında ne için inşa edilmişti?",
  "Şehirler, Ülkeler ve Kültürler: Çin Seddi neden bu kadar uzun inşa edildi?",
  "Şehirler, Ülkeler ve Kültürler: Afrika savanlarında yaşayan hayvanların ortak özellikleri.",
  "Şehirler, Ülkeler ve Kültürler: İtalya’nın ünlü yemeği Pizzanın hikayesi nedir?",
  "Şehirler, Ülkeler ve Kültürler: İngiltere’deki 'Big Ben' saatinin özelliği nedir?",
  "Şehirler, Ülkeler ve Kültürler: Dünyanın en soğuk köyü (Oymyakon) neresidir ve orada yaşam nasıldır?",
  "Şehirler, Ülkeler ve Kültürler: Göçebe yaşayan topluluklar nasıl evlerde kalırlar?",
  "Şehirler, Ülkeler ve Kültürler: Kendi şehrinin en ünlü tarihi eserini araştır.",
  "Gelecek ve İcat Fikirleri: Gelecekte uçan arabalar olursa trafik nasıl yönetilir?",
  "Gelecek ve İcat Fikirleri: Deniz kirliliğini temizleyen bir robot tasarlasaydın nasıl olurdu?",
  "Gelecek ve İcat Fikirleri: Sadece güneş enerjisiyle çalışan bir okul nasıl görünür?",
  "Gelecek ve İcat Fikirleri: Mars’ta bir şehir kurulsaydı insanların neye ihtiyacı olurdu?",
  "Gelecek ve İcat Fikirleri: Hayvanların dilini anlayan bir makine yapılsaydı onlara ne sorardın?",
  "Gelecek ve İcat Fikirleri: Su israfını engelleyen bir musluk nasıl tasarlanabilir?",
  "Gelecek ve İcat Fikirleri: Geleceğin kıyafetleri hangi malzemelerden yapılabilir?",
  "Gelecek ve İcat Fikirleri: Akıllı şehirler ne demektir?",
  "Gelecek ve İcat Fikirleri: Robotlar ev işlerinde bize nasıl daha fazla yardım edebilir?",
  "Gelecek ve İcat Fikirleri: Bir bitkinin susadığını haber veren bir cihaz nasıl çalışır?",
  "Gelecek ve İcat Fikirleri: Uzay çöpleri nasıl temizlenebilir?",
  "Gelecek ve İcat Fikirleri: Işınlanma gerçek olsaydı ilk nereye giderdin?",
  "Gelecek ve İcat Fikirleri: Sürücüsüz otobüsler güvenli midir?",
  "Gelecek ve İcat Fikirleri: Üç boyutlu (3D) yazıcılarla ev yapılabilir mi?",
  "Gelecek ve İcat Fikirleri: Bir gün elektrikler tamamen kesilse hayatımız nasıl değişir?",
  "Karışık Eğlenceli Konular: Neden gıdıklanınca güleriz?",
  "Karışık Eğlenceli Konular: Sakızın tarihçesi: İlk sakızlar neyden yapılıyordu?",
  "Karışık Eğlenceli Konular: Bozuk paraların kenarları neden tırtıklıdır?",
  "Karışık Eğlenceli Konular: En hızlı koşan insan ile en hızlı koşan hayvanı kıyasla.",
  "Karışık Eğlenceli Konular: Neden soğan doğrarken gözlerimiz yaşarır?",
  "Karışık Eğlenceli Konular: Bir kutu sütün üzerindeki son kullanma tarihi neden önemlidir?",
  "Karışık Eğlenceli Konular: Kendi isminin anlamını ve kökenini araştır.",
  "Karışık Eğlenceli Konular: Dünyanın en küçük ülkesi hangisidir?",
  "Karışık Eğlenceli Konular: Gözlük ilk ne zaman icat edildi?"
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
2. Çoktan seçmeli sorularda seçenekler (options) TAM OLARAK 3 adet olmalıdır (A, B ve C seçenekleri). Ne eksik ne fazla. Bu kuralı ASLA ihlal etme.
3. Seçenekler (options) SADECE cevabın kendisini içermelidir. Başına "A)", "B)", "C)" gibi harfler ASLA ekleme. (Örn: "Ankara" doğru, "A) Ankara" yanlış).
4. Özellikle "Genel Kültür" gibi konularda hep aynı soruları sormaktan kaçın. 
5. Genel Kültür dışındaki tüm sorular "Milli Maarif Modeli"ne uygun, değerler eğitimini destekleyen ve pedagojik olarak doğru olmalıdır.
6. Sorular ilkokul seviyesindeki (6-10 yaş) çocukların bilişsel düzeyine, kelime dağarcığına ve okuma hızına TAM OLARAK uygun olmalıdır. Karmaşık terimlerden, çok soyut kavramlardan ve akademik dilden KESİNLİKLE kaçın. Sorular basit, anlaşılır ve somut olmalıdır.
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

// Helper to manage recent questions in localStorage
const RECENT_QUESTIONS_KEY = 'aysun_recent_questions';
const MAX_RECENT_QUESTIONS = 20;

function getRecentQuestions(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_QUESTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentQuestion(question: string) {
  try {
    const recent = getRecentQuestions();
    const updated = [question, ...recent].slice(0, MAX_RECENT_QUESTIONS);
    localStorage.setItem(RECENT_QUESTIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Error saving recent question:", e);
  }
}

export const geminiService = {
  generateQuestions: async (grade: string, subject: string, topic: string, type: string, style: 'simple' | 'narrative' = 'narrative') => {
    try {
      let finalTopic = topic;
      const isGeneralCulture = subject === 'Genel Kültür' || topic.toLowerCase().includes('genel kültür');
      
      if (isGeneralCulture) {
        const randomTopic = CULTURE_TOPICS[Math.floor(Math.random() * CULTURE_TOPICS.length)];
        finalTopic = `${topic} (Özellikle şu alt konuya odaklan: ${randomTopic})`;
      }

      const recentQuestions = getRecentQuestions();
      const avoidPrompt = recentQuestions.length > 0 
        ? `\nŞU SORULARI VEYA BENZERLERİNİ ASLA SORMA (DAHA ÖNCE SORULDU):\n${recentQuestions.join('\n')}`
        : '';

      const stylePrompt = style === 'simple' 
        ? "Sorular çok kısa, net ve doğrudan olmalı. Gereksiz hikayeleştirmeden kaçın."
        : "Sorular ilkokul seviyesinde, hafif hikayeleştirilmiş ve ilgi çekici olmalı.";

      const randomSeed = Math.random().toString(36).substring(7);
      const timestamp = Date.now();
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];
      
      const data = await callGeminiWithFallback({
        model: "gemini-3.1-flash-lite-preview",
        contents: `
          ${grade}. sınıf ${subject} dersi, ${finalTopic} konusu hakkında ${type} formatında sorular üret. 
          
          STİL TALİMATI: ${stylePrompt}
          ${avoidPrompt}

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
          addRecentQuestion(q.question);
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
        model: "gemini-3.1-flash-lite-preview",
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
        model: "gemini-3.1-flash-lite-preview",
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
        model: "gemini-3.1-flash-lite-preview",
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

  generateDuelQuestion: async (grade: string, subject: string, topic: string, style: 'simple' | 'narrative' = 'narrative') => {
    try {
      let finalTopic = topic;
      if (subject === 'Genel Kültür' || topic.toLowerCase().includes('genel kültür')) {
        const randomTopic = CULTURE_TOPICS[Math.floor(Math.random() * CULTURE_TOPICS.length)];
        finalTopic = `${topic} (Özellikle şu alt konuya odaklan: ${randomTopic})`;
      }

      const recentQuestions = getRecentQuestions();
      const avoidPrompt = recentQuestions.length > 0 
        ? `\nŞU SORULARI VEYA BENZERLERİNİ ASLA SORMA (DAHA ÖNCE SORULDU):\n${recentQuestions.join('\n')}`
        : '';

      const stylePrompt = style === 'simple' 
        ? "Soru çok kısa, net ve doğrudan olmalı. Gereksiz hikayeleştirmeden kaçın."
        : "Soru ilkokul seviyesinde, hafif hikayeleştirilmiş ve ilgi çekici olmalı.";

      const randomSeed = Math.random().toString(36).substring(7);
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];

      const data = await callGeminiWithFallback({
        model: "gemini-3.1-flash-lite-preview",
        contents: `
          ${grade}. sınıf ${subject} dersi, ${finalTopic} konusu hakkında 2 öğrencinin yarışabileceği, hızlı cevaplanabilecek 3 şıklı bir test sorusu üret. 
          
          STİL TALİMATI: ${stylePrompt}
          ${avoidPrompt}

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
      if (result.question) {
        addRecentQuestion(result.question);
      }
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
        model: "gemini-3.1-flash-lite-preview",
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
                      minItems: 2,
                      maxItems: 3,
                      description: "Çoktan seçmeli için 3, Doğru/Yanlış için 2 seçenek olmalı. SADECE cevabı içermeli, A) B) gibi harfler eklenmemeli." 
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
          addRecentQuestion(q.question);
          let options = q.options ? stripPrefixes(q.options) : undefined;
          if (options && options.length > 0) {
            if (q.type !== 'true-false') {
              options = shuffleArray(options);
            }
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
    counts: { mc: number, tf: number, open: number },
    style: 'simple' | 'narrative' = 'narrative'
  ) => {
    try {
      let finalTopic = topic;
      const isGeneralCulture = subject === 'Genel Kültür' || topic.toLowerCase().includes('genel kültür');
      
      if (isGeneralCulture) {
        const randomTopic = CULTURE_TOPICS[Math.floor(Math.random() * CULTURE_TOPICS.length)];
        finalTopic = `${topic} (Özellikle şu alt konuya odaklan: ${randomTopic})`;
      }

      const recentQuestions = getRecentQuestions();
      const avoidPrompt = recentQuestions.length > 0 
        ? `\nŞU SORULARI VEYA BENZERLERİNİ ASLA SORMA (DAHA ÖNCE SORULDU):\n${recentQuestions.join('\n')}`
        : '';

      const stylePrompt = style === 'simple' 
        ? "Sorular çok kısa, net ve doğrudan olmalı. Gereksiz hikayeleştirmeden kaçın."
        : "Sorular ilkokul seviyesinde, hafif hikayeleştirilmiş ve ilgi çekici olmalı.";

      const randomSeed = Math.random().toString(36).substring(7);
      const timestamp = Date.now();
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];
      
      const data = await callGeminiWithFallback({
        model: "gemini-3.1-flash-lite-preview",
        contents: `
          ${grade}. sınıf ${subject} dersi, ${finalTopic} konusu hakkında şu soruları üret:
          - ${counts.mc} adet çoktan seçmeli soru (her biri tam olarak 3 şıklı)
          - ${counts.tf} adet Doğru/Yanlış sorusu (Sadece 2 seçenek olmalı: "Doğru" ve "Yanlış")
          - ${counts.open} adet açık uçlu soru
          
          STİL TALİMATI: ${stylePrompt}
          ${avoidPrompt}

          KRİTİK TALİMATLAR:
          - Sorular her seferinde tamamen farklı, özgün ve daha önce sorulmamış olmalı.
          - Yaratıcı, merak uyandırıcı ve çocukların ilgisini çekecek bir dil kullan.
          - Eğer konu "Genel Kültür" değilse, "Milli Maarif Modeli"ne uygun içerik üret.
          - Çoktan seçmeli sorular için TAM OLARAK 3 seçenek üret.
          - Doğru/Yanlış soruları için TAM OLARAK 2 seçenek üret: ["Doğru", "Yanlış"].
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
                      minItems: 2,
                      maxItems: 3,
                      description: "Çoktan seçmeli için 3, Doğru/Yanlış için 2 seçenek olmalı." 
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
          addRecentQuestion(q.question);
          let options = q.options ? stripPrefixes(q.options) : undefined;
          if (options && options.length > 0) {
            // Only shuffle if it's NOT a true-false question
            if (q.type !== 'true-false') {
              options = shuffleArray(options);
            } else {
              // For true-false, ensure options are exactly ["Doğru", "Yanlış"] in order or just leave as is if AI followed instructions
              // But user said shuffling makes it nonsensical, so we keep order for TF
            }
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
      const randomTopic = RESEARCH_TOPICS[Math.floor(Math.random() * RESEARCH_TOPICS.length)];
      const creativeConstraint = CREATIVE_CONSTRAINTS[Math.floor(Math.random() * CREATIVE_CONSTRAINTS.length)];
      
      const data = await callGeminiWithFallback({
        model: "gemini-3.1-flash-lite-preview",
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
