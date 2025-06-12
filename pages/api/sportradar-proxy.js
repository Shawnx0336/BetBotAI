// pages/api/sportradar-proxy.js
import fetch from 'node-fetch'; // For Node.js environments

export default async function handler(req, res) {
  // Ensure this API route is only accessible via GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { sport, type, player, teams } = req.query; // Extract query parameters from frontend request

  // Retrieve API key and base endpoint from environment variables
  // IMPORTANT: Ensure these are set in your .env.local file.
  // For server-side access, use the variable name WITHOUT 'NEXT_PUBLIC_' prefix.
  const apiKey = process.env.SPORTRADAR_API_KEY; 
  const sportradarBaseEndpoint = process.env[`NEXT_PUBLIC_SPORTRADAR_${sport.toUpperCase()}_ENDPOINT`];

  if (!apiKey || !sportradarBaseEndpoint) {
    console.error('Sportradar API key (SPORTRADAR_API_KEY) or endpoint is not configured in backend environment variables.');
    return res.status(500).json({ error: 'Sportradar API configuration missing on server.' });
  }

  let sportradarApiUrl = '';

  try {
    if (type === 'player' && player && sport) {
      // Determine the correct Sportradar endpoint for player stats based on sport
      // NOTE: These URLs are examples and might need adjustment based on Sportradar API version and specific data needs.
      // For NBA, using season leaders for general player stats.
      if (sport === 'nba') {
        // Example for NBA: Fetching league leaders for player stats (adjust season year as needed)
        sportradarApiUrl = `${sportradarBaseEndpoint}/nba/v8/en/seasons/2024/REG/leaders.json?api_key=${apiKey}`;
      } else if (sport === 'nfl' || sport === 'mlb' || sport === 'nhl') {
        // For other sports, might need to fetch hierarchy and then filter players
        sportradarApiUrl = `${sportradarBaseEndpoint}/${sport}/v7/en/league/hierarchy.json?api_key=${apiKey}`;
      } else {
        return res.status(400).json({ error: `Sportradar player stats not implemented for sport: ${sport}` });
      }
      // This console log purposefully replaces the actual API key for security in logs
      console.log(`Backend fetching player stats for ${player} in ${sport} from: ${sportradarApiUrl.replace(apiKey, '***API_KEY_HIDDEN***')}`);

    } else if (type === 'team' && teams && sport) {
      const parsedTeams = JSON.parse(decodeURIComponent(teams)); // Decode and parse the teams array
      // Example for teams: Fetching league hierarchy for team data
      sportradarApiUrl = `${sportradarBaseEndpoint}/${sport}/v7/en/league/hierarchy.json?api_key=${apiKey}`;
      // This console log purposefully replaces the actual API key for security in logs
      console.log(`Backend fetching team stats for ${parsedTeams.join(', ')} in ${sport} from: ${sportradarApiUrl.replace(apiKey, '***API_KEY_HIDDEN***')}`);

    } else {
      return res.status(400).json({ error: 'Invalid or incomplete parameters for Sportradar proxy.' });
    }

    const sportradarResponse = await fetch(sportradarApiUrl);

    if (!sportradarResponse.ok) {
      const errorText = await sportradarResponse.text();
      console.error(`Sportradar API returned status ${sportradarResponse.status}: ${errorText}`);
      // Pass the error status and message back to the frontend
      return res.status(sportradarResponse.status).json({ 
        error: `Failed to fetch data from Sportradar: ${sportradarResponse.statusText}`, 
        details: errorText 
      });
    }

    const data = await sportradarResponse.json();
    res.status(200).json(data); // Send Sportradar's response back to the frontend
  } catch (error) {
    console.error("Sportradar proxy error:", error);
    res.status(500).json({ error: "Failed to fetch Sportradar data due to server error." });
  }
}
