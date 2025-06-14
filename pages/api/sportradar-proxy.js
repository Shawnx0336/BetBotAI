// pages/api/sportradar-proxy.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { endpoint } = req.query;
  
  // Get API key from server-side environment (NO NEXT_PUBLIC_ prefix)
  const apiKey = process.env.SPORTRADAR_API_KEY;
  
  if (!apiKey) {
    console.error('SPORTRADAR_API_KEY not configured in server environment');
    return res.status(500).json({ error: 'Sportradar API key not configured' });
  }

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  try {
    // Build the full Sportradar URL
    const sportradarUrl = `https://api.sportradar.us/${endpoint}?api_key=${apiKey}`;
    
    console.log(`Fetching from Sportradar: ${sportradarUrl.replace(apiKey, '***HIDDEN***')}`);
    
    const response = await fetch(sportradarUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BetBot-AI/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Sportradar API error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: `Sportradar API error: ${response.statusText}`,
        details: errorText 
      });
    }

    const data = await response.json();
    res.status(200).json(data);
    
  } catch (error) {
    console.error('Sportradar proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch Sportradar data' });
  }
}
