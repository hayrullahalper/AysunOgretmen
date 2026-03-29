import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Sadece POST isteklerine izin ver
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  try {
    const { model, contents, config, backupModel } = req.body;
    
    // Check for API key in multiple possible environment variable names
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!apiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is missing from environment variables!");
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const callWithFallback = async (params: any, backup?: string) => {
      try {
        return await ai.models.generateContent(params);
      } catch (error: any) {
        console.error(`Gemini Error (${params.model}):`, error.message);
        
        const isQuotaError = error.message?.includes('429') || 
                            error.message?.includes('quota') || 
                            error.message?.includes('RESOURCE_EXHAUSTED');
        
        // If it's an image generation request and Gemini fails, try Pollinations
        const isImageRequest = params.contents?.parts?.some((p: any) => 
          p.text?.toLowerCase().includes('generate image') || 
          p.text?.toLowerCase().includes('create image') ||
          p.text?.toLowerCase().includes('boyama sayfası')
        );

        if (isImageRequest) {
          console.log("Attempting Pollinations fallback for image generation...");
          try {
            const prompt = params.contents.parts.find((p: any) => p.text)?.text || "educational illustration";
            const pollinationsApiKey = process.env.POLLINATIONS_API_KEY || "sk_olWrubIUZIpHq2OC28VwnYYtkWstUa4q";
            
            // Pollinations simple image generation
            const seed = Math.floor(Math.random() * 1000000);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&nologo=true`;
            
            // Fetch the image and convert to base64 to match Gemini's response format
            const imgRes = await fetch(imageUrl);
            if (!imgRes.ok) throw new Error(`Pollinations failed: ${imgRes.statusText}`);
            
            const buffer = await imgRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');

            return {
              candidates: [{
                content: {
                  parts: [{
                    inlineData: {
                      data: base64,
                      mimeType: "image/png"
                    }
                  }]
                }
              }]
            };
          } catch (pollError) {
            console.error("Pollinations fallback failed:", pollError);
          }
        }

        if (isQuotaError && backup && params.model !== backup) {
          console.warn(`Quota exceeded for ${params.model}, trying backup model ${backup}`);
          return await ai.models.generateContent({ ...params, model: backup });
        }
        throw error;
      }
    };

    const response = await callWithFallback({
      model,
      contents,
      config
    }, backupModel);

    res.status(200).json(response);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(error.status || 500).json({ 
      error: error.message || "Internal Server Error",
      details: error.details || []
    });
  }
}
