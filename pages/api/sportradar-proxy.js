export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { endpoint } = req.query;
  const apiKey = process.env.SPORTRADAR_API_KEY;

  if (!apiKey) {
    console.error('SPORTRADAR_API_KEY missing from Netlify');
    return res.status(500).json({ error: 'Missing SPORTRADAR_API_KEY' });
  }

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  const sportradarUrl = `https://api.sportradar.us/${endpoint}?api_key=${apiKey}`;

  try {
    const response = await fetch(sportradarUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Sportradar error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ error: `Sportradar API error: ${response.statusText}`, details: errorText });
    }

    const data = await response.json();
    res.status(200).json(data);
    
  } catch (error) {
    console.error('Proxy fetch error:', error);
    res.status(500).json({ error: 'Proxy error fetching Sportradar' });
  }
}
