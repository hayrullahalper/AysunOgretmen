export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}
