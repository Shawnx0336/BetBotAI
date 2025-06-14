// pages/api/sportradar-proxy.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { endpoint } = req.query;  // your frontend sends `endpoint` directly now
  const apiKey = process.env.SPORTRADAR_API_KEY;

  if (!apiKey) {
    console.error('Missing SPORTRADAR_API_KEY environment variable.');
    return res.status(500).json({ error: 'Server configuration error (missing API key)' });
  }

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  const sportradarApiUrl = `https://api.sportradar.us/${endpoint}?api_key=${apiKey}`;

  try {
    console.log(`Fetching Sportradar URL: ${sportradarApiUrl.replace(apiKey, '***HIDDEN***')}`);
    const response = await fetch(sportradarApiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Sportradar error (${response.status}): ${errorText}`);
      return res.status(response.status).json({
        error: `Sportradar API error: ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy fetch error:', error);
    res.status(500).json({ error: 'Server fetch error' });
  }
}
