export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rateLimit = global.rateLimit = global.rateLimit || new Map();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (rateLimit.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 5) return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  rateLimit.set(ip, [...recent, now]);

  try {
    const { prompt, system, history } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    let messages;
    if (history && history.length > 0) {
      messages = history;
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    const body = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages,
    };

    if (system) {
      body.system = system;
    } else {
      body.system = `You are an expert travel planner with deep knowledge of destinations worldwide. 
Only recommend real, verified locations that genuinely exist. 
Never invent place names, restaurants, or attractions. 
Always include the most iconic and must-see spots for each destination - never miss major landmarks. 
Respond ONLY with valid JSON. Never use apostrophes in contractions inside JSON strings (use plain English without contractions). 
Never use special characters that would break JSON parsing.`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
