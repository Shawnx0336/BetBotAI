// utils/apiHelpers.ts - Complete utility functions for BetBot AI

// =================================================================================================
// CACHE SYSTEM
// =================================================================================================

const cache = new Map();
const CACHE_DURATIONS = {
  odds: 2 * 60 * 1000,      // 2 minutes
  stats: 10 * 60 * 1000,    // 10 minutes
  ai_parsing: 60 * 60 * 1000 // 1 hour
};

export const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  return null;
};

export const setCachedData = (key: string, data: any, type: 'odds' | 'stats' | 'ai_parsing') => {
  cache.set(key, { 
    data, 
    timestamp: Date.now(),
    ttl: CACHE_DURATIONS[type]
  });
};

// =================================================================================================
// ERROR HANDLING
// =================================================================================================

export const handleApiError = (error: any, context: string): string => {
  if (error instanceof Error) {
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return `⏳ ${context} is temporarily busy. Please try again in a moment.`;
    }
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      return `🔐 ${context} access denied. Please check your API key or subscription.`;
    }
    if (error.message.includes('openai')) {
      return `🤖 AI analysis temporarily unavailable. Using fallback analysis.`;
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
      return `⚠️ Connection issue for ${context}. Please check your internet and try again.`;
    }
    if (error.message.includes('not found') || error.message.includes('404')) {
      return `⚠️ Data for ${context} not found. The game/player might not be active or recognizable.`;
    }
  }
  
  console.error(`${context} error:`, error);
  return `⚠️ ${context} encountered an issue. Our team has been notified.`;
};

// =================================================================================================
// API ENDPOINTS AND KEYS
// =================================================================================================

export const PRODUCTION_API_ENDPOINTS = {
  theOddsAPI: 'https://api.the-odds-api.com/v4',
  sportradar: {
    nba: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_NBA_ENDPOINT : '',
    nfl: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_NFL_ENDPOINT : '',
    mlb: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_MLB_ENDPOINT : '',
    nhl: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_NHL_ENDPOINT : '',
  },
  openai: 'https://api.openai.com/v1/chat/completions'
};

export const PRODUCTION_KEYS = {
  theOdds: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTS_API_KEY : '',
  sportradar: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_API_KEY : '',
  openai: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_OPENAI_API_KEY : '',
};

// =================================================================================================
// SPORTS CONFIGURATION
// =================================================================================================

export const SPORTS_CONFIG: { [key: string]: { key: string, name: string } } = {
  'nfl': { key: 'americanfootball_nfl', name: 'NFL' },
  'nba': { key: 'basketball_nba', name: 'NBA' },
  'mlb': { key: 'baseball_mlb', name: 'MLB' },
  'nhl': { key: 'icehockey_nhl', name: 'NHL' },
  'soccer': { key: 'soccer_usa_mls', name: 'MLS Soccer' },
  'tennis': { key: 'tennis_atp_aus_open', name: 'ATP Tennis' },
  'mma': { key: 'mma_mixed_martial_arts', name: 'MMA' },
};

// =================================================================================================
// FALLBACK PARSING FUNCTION
// =================================================================================================

export function createFallbackParsing(betDescription: string) {
  const lower = betDescription.toLowerCase();
  let result: any = {
    sport: null,
    type: 'team',
    teams: null,
    player: null, 
    line: null,
    betOn: null,
    confidence: 0.7,
    specificBetType: null
  };

  // Enhanced sport detection
  if (lower.includes('nfl') || lower.includes('football') || lower.includes('chiefs') || lower.includes('mahomes') || lower.includes('touchdown')) {
    result.sport = 'nfl';
    if (lower.includes('touchdown')) result.specificBetType = 'touchdown_pass';
    if (lower.includes('rushing yards')) result.specificBetType = 'rushing_yards';
  } else if (lower.includes('nba') || lower.includes('basketball') || lower.includes('lakers') || lower.includes('lebron') || lower.includes('points')) {
    result.sport = 'nba';
    if (lower.includes('points')) result.specificBetType = 'points';
    if (lower.includes('assists')) result.specificBetType = 'assists';
    if (lower.includes('rebounds')) result.specificBetType = 'rebounds';
  } else if (lower.includes('mlb') || lower.includes('baseball') || lower.includes('yankees') || lower.includes('home run')) {
    result.sport = 'mlb';
    if (lower.includes('home run')) result.specificBetType = 'home_run';
    if (lower.includes('hits')) result.specificBetType = 'hits';
    if (lower.includes('strikeouts')) result.specificBetType = 'strikeouts';
  } else if (lower.includes('nhl') || lower.includes('hockey') || lower.includes('oilers') || lower.includes('goals')) {
    result.sport = 'nhl';
    if (lower.includes('goals')) result.specificBetType = 'goals';
    if (lower.includes('saves')) result.specificBetType = 'saves';
  } else if (lower.includes('soccer') || lower.includes('manchester') || lower.includes('arsenal')) {
    result.sport = 'soccer';
    if (lower.includes('goals')) result.specificBetType = 'goals';
  }

  // Enhanced player detection
  const playerNames = ['lebron', 'mahomes', 'judge', 'mcdavid', 'curry', 'allen', 'burrow'];
  if (playerNames.some(name => lower.includes(name))) {
    result.type = 'player';
    if (lower.includes('lebron')) result.player = 'LeBron James';
    else if (lower.includes('mahomes')) result.player = 'Patrick Mahomes';
    else if (lower.includes('curry')) result.player = 'Stephen Curry';
    else if (lower.includes('judge')) result.player = 'Aaron Judge';
    else if (lower.includes('mcdavid')) result.player = 'Connor McDavid';
    else if (lower.includes('allen')) result.player = 'Josh Allen';
    else if (lower.includes('burrow')) result.player = 'Joe Burrow';
  }

  // Enhanced team detection
  const teamMatch = /(\w+(?:\s+\w+)?)\s+(?:vs|@)\s+(\w+(?:\s+\w+)?)/.exec(lower);
  if (teamMatch) {
    result.teams = [teamMatch[1].trim(), teamMatch[2].trim()];
  } else {
    const singleTeamMatch = /^(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:to\s+win|moneyline|ml)/.exec(lower);
    if (singleTeamMatch) {
      result.teams = [singleTeamMatch[1].trim()];
    }
  }

  // Enhanced bet type detection
  if (lower.includes('over')) result.betOn = 'over';
  else if (lower.includes('under')) result.betOn = 'under';
  
  if (lower.includes('moneyline') || lower.includes('ml') || lower.includes('to win')) {
    if (result.teams && result.teams.length > 0) {
      result.betOn = `${result.teams[0]}_win`;
      result.type = 'team';
    }
  }
  
  if (lower.includes('spread') || lower.includes('-') || lower.includes('+')) {
    result.betOn = 'spread';
    result.type = 'team';
  }

  // Extract numbers for lines
  const numberMatch = /(\d+\.?\d*)/.exec(lower);
  if (numberMatch) {
    const numberValue = parseFloat(numberMatch[1]);
    if (result.type === 'player' && result.player) {
      result.line = numberValue;
      result.betOn = result.betOn || (lower.includes('over') ? 'over' : 'under');
    } else if (result.type === 'team' && (lower.includes('total') || lower.includes('over') || lower.includes('under'))) {
        result.line = numberValue;
        result.betOn = result.betOn || (lower.includes('over') ? 'over' : 'under');
    } else if (result.type === 'team' && (lower.includes('spread') || lower.includes('-') || lower.includes('+'))) {
        result.line = parseFloat(numberMatch[1]) * (lower.includes('-') ? -1 : 1);
        result.betOn = 'spread';
    }
  }

  // Refine type based on detected betOn
  if (result.betOn === 'over' || result.betOn === 'under') {
    if (result.player) {
      result.type = 'prop';
    } else if (result.teams) {
      result.type = 'total';
    }
  } else if (result.betOn === 'spread' || result.betOn === 'team1_win' || result.betOn === 'team2_win') {
    result.type = 'straight';
  }

  // Final sport check
  if (!result.sport && (result.teams || result.player)) {
    result.sport = 'nba'; // Default if unsure
  }

  console.log('🔄 Fallback parsing result:', result);
  return result;
}

// =================================================================================================
// MANUAL KEY FACTORS GENERATION
// =================================================================================================

export function generateManualKeyFactors(parsedBet: any, odds: any, stats: any) {
  const factors = [];
  
  // Odds-based factors
  if (odds.source && odds.source !== 'Calculated (No Live Odds)') {
    factors.push(`Live odds available from ${odds.source}`);
    if (odds.draftkings?.spread) {
      factors.push(`Current spread: ${odds.draftkings.spread > 0 ? '+' : ''}${odds.draftkings.spread}`);
    }
    if (odds.draftkings?.total) {
      factors.push(`Total line: ${odds.draftkings.total}`);
    }
    if (odds.draftkings?.moneylineHome && odds.draftkings?.moneylineAway) {
        factors.push(`Moneyline for Home: ${odds.draftkings.moneylineHome}, Away: ${odds.draftkings.moneylineAway}`);
    }
  } else {
    factors.push('No live odds - analysis based on statistical models');
  }
  
  // Stats-based factors
  if (stats.source === 'Sportradar Professional Data') {
    if (parsedBet.type === 'player' && stats.player) {
      if (stats.player.seasonAveragePoints) {
        factors.push(`Sportradar Season Average: ${stats.player.seasonAveragePoints} points`);
      }
      if (stats.player.usageRate && stats.player.usageRate > 0.25) {
        factors.push(`Sportradar High Usage Rate: ${Math.round(stats.player.usageRate * 100)}%`);
      }
      if (stats.player.minutesPlayed && stats.player.minutesPlayed > 20) {
        factors.push(`Sportradar Minutes Played: ${stats.player.minutesPlayed} per game`);
      }
      if (stats.player.team) {
        factors.push(`Player team: ${stats.player.team}`);
      }
      if (stats.player.position) {
        factors.push(`Player position: ${stats.player.position}`);
      }
    } else if (parsedBet.type === 'team' && stats.team1 && stats.team2) {
      if (stats.team1.offenseRating && stats.team1.offenseRating > 0.7) {
        factors.push(`Sportradar ${stats.team1.name} has elite offense (${Math.round(stats.team1.offenseRating * 100)}% rating)`);
      }
      if (stats.team2.defenseRating && stats.team2.defenseRating > 0.7) {
        factors.push(`Sportradar ${stats.team2.name} has strong defense (${Math.round(stats.team2.defenseRating * 100)}% rating)`);
      }
      if (stats.team1.homeRecord && !stats.team1.homeRecord.includes('0-0')) {
        factors.push(`Sportradar ${stats.team1.name} home record: ${stats.team1.homeRecord}`);
      }
      if (stats.team1.injuries && stats.team1.injuries.length > 0) {
        factors.push(`Sportradar ${stats.team1.name} has ${stats.team1.injuries.length} reported injuries`);
      }
    }
  } else if (stats.source === 'Derived/Enhanced Stats') {
    factors.push('Analysis leverages dynamically generated statistical estimates');
    if (parsedBet.type === 'team' && stats.team1 && stats.team2) {
        if (stats.team1.offenseRating) factors.push(`Team 1 offense rating: ${Math.round(stats.team1.offenseRating * 100)}%`);
        if (stats.team2.defenseRating) factors.push(`Team 2 defense rating: ${Math.round(stats.team2.defenseRating * 100)}%`);
    } else if (parsedBet.type === 'player' && stats.player) {
        if (parsedBet.sport === 'mlb') {
          if (stats.player.homeRunsThisSeason) factors.push(`Player home runs this season: ${stats.player.homeRunsThisSeason}`);
          if (stats.player.battingAverage) factors.push(`Player batting average: ${stats.player.battingAverage.toFixed(3)}`);
          if (stats.player.homeRunsLast10Games !== undefined) factors.push(`Player home runs last 10 games: ${stats.player.homeRunsLast10Games}`);
        } else if (parsedBet.sport === 'nfl') {
          if (stats.player.touchdownPassesThisSeason) factors.push(`Player TD passes this season: ${stats.player.touchdownPassesThisSeason}`);
          if (stats.player.passingYardsPerGame) factors.push(`Player passing yards per game: ${stats.player.passingYardsPerGame}`);
        } else if (parsedBet.sport === 'nba') {
          if (stats.player.seasonAveragePoints) factors.push(`Player average points: ${stats.player.seasonAveragePoints}`);
          if (stats.player.usageRate) factors.push(`Player usage rate: ${Math.round(stats.player.usageRate * 100)}%`);
        }
    }
  } else {
    factors.push('Analysis based on general statistical trends');
  }
  
  // Ensure we always have at least 3 factors
  while (factors.length < 3) {
    factors.push('Additional general betting factors considered');
  }
  
  return factors.slice(0, 5); // Max 5 factors
}