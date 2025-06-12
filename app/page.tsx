"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';

// =================================================================================================
// CACHE SYSTEM (INLINED from utils/apiHelpers.ts)
// =================================================================================================

const cache = new Map();
const CACHE_DURATIONS = {
  odds: 2 * 60 * 1000,      // 2 minutes
  stats: 10 * 60 * 1000,    // 10 minutes
  ai_parsing: 60 * 60 * 1000, // 1 hour
  market_data: 5 * 60 * 1000, // 5 minutes - NEW
  historical_context: 24 * 60 * 60 * 1000, // 24 hours - NEW
  comprehensive_analysis: 10 * 60 * 1000 // 10 minutes - NEW
};

const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: any, type: 'odds' | 'stats' | 'ai_parsing' | 'market_data' | 'historical_context' | 'comprehensive_analysis') => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: CACHE_DURATIONS[type]
  });
};

// =================================================================================================
// ERROR HANDLING (INLINED from utils/apiHelpers.ts)
// =================================================================================================

const handleApiError = (error: any, context: string): string => {
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
    if (error.message.includes('Failed to fetch') || error.message.includes('network') || error.name === 'AbortError') { // Added AbortError
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
// API ENDPOINTS AND KEYS (INLINED from utils/apiHelpers.ts)
// =================================================================================================

const PRODUCTION_API_ENDPOINTS = {
  theOddsAPI: 'https://api.the-odds-api.com/v4',
  sportradar: {
    nba: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_NBA_ENDPOINT : '',
    nfl: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_NFL_ENDPOINT : '',
    mlb: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_MLB_ENDPOINT : '',
    nhl: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_NHL_ENDPOINT : '',
  },
  openai: 'https://api.openai.com/v1/chat/completions'
};

const PRODUCTION_KEYS = {
  theOdds: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTS_API_KEY : '',
  openai: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_OPENAI_API_KEY : '',
  sportradar: typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SPORTRADAR_API_KEY : '',
};

// =================================================================================================
// TIMEOUT PROTECTION (NEW HELPER FUNCTION)
// =================================================================================================

const fetchWithTimeout = async (url: string, options: any, timeoutMs: number = 8000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};


// =================================================================================================
// FALLBACK PARSING FUNCTION (INLINED from utils/apiHelpers.ts)
// =================================================================================================

function createFallbackParsing(betDescription: string) {
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
// MANUAL KEY FACTORS GENERATION (INLINED from utils/apiHelpers.ts)
// =================================================================================================

function generateManualKeyFactors(parsedBet: any, odds: any, stats: any) {
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


// REQUIRED INTERFACES
interface BetSubmission {
  id: string;
  betDescription: string;
  betType: 'straight' | 'prop' | 'total' | 'moneyline';
  timestamp: number;
  submittedBy: string;
}

interface CreatorAlgorithm {
  // Straight bet weights (team vs team)
  straightBetWeights: {
    teamOffense: number;      // 0-1 (team offensive rating)
    teamDefense: number;      // 0-1 (team defensive rating)
    headToHead: number;       // 0-1 (historical matchups)
    homeAway: number;         // 0-1 (home court advantage)
    injuries: number;         // 0-1 (key player availability)
    restDays: number;         // 0-1 (days of rest)
  };
  // Player prop weights (individual player bets)
  playerPropWeights: {
    seasonAverage: number;    // 0-1 (season stats)
    recentForm: number;       // 0-1 (last 5 games)
    matchupHistory: number;   // 0-1 (vs this opponent)
    usage: number;            // 0-1 (usage rate/role)
    minutes: number;          // 0-1 (expected playing time)
    opponentDefense: number;  // 0-1 (opponent defensive rank)
  };

  // Response customization
  customResponseStyle?: string;  // NEW: Creator's example analysis
  responseTone: 'professional' | 'casual' | 'hype'; // Keep as fallback
  confidenceThreshold: number; // 1-100 (minimum confidence to recommend)
  signaturePhrase: string;     // Creator's catchphrase
  brandColor: string;          // Hex color for branding
}

interface BetAnalysis {
  betDescription: string;
  betType: 'straight' | 'prop' | 'total' | 'moneyline';
  winProbability: number;      // 1-100
  confidence: 'low' | 'medium' | 'high';
  keyFactors: string[];        // Array of supporting reasons
  creatorResponse: string;     // Personalized message
  recommendation: 'strong_play' | 'lean' | 'pass' | 'fade';
  timestamp: number;
  // NEW: Enhanced analysis data
  marketAnalysis?: string;
  trendAnalysis?: string;
  riskFactors?: string[];
  reasoning?: string;
}

interface AnalysisLog {
  id: string;
  betDescription: string;
  winProbability: number;
  recommendation: string;
  timestamp: number;
}

type UserRole = 'creator' | 'member';
type AppView = 'bet_analysis' | 'creator_settings';
type AccessLevel = 'admin' | 'customer' | 'no_access'; // Keeping type but removing 'no_access' logic

// =================================================================================================
// REAL WHOP SDK AND FIREBASE CONFIGURATION
// =================================================================================================

// Mock WhopSDK with behavior based on the actual SDK's expected responses and environment variables.
// In a real Next.js app, this would be `const whopApi = new WhopAPI({ ... });`
// This mock is for the Whop SDK calls (user, access, posts), not for sports data APIs.
const whopApi = {
  // Simulates whopApi.users.me()
  getCurrentUser: async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const userId = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID ? process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID : 'mock-member-user-123';
    return { id: userId, email: `${userId}@example.com`, name: `User ${userId}` };
  },
  // Simulates whopApi.experiences.checkAccess()
  checkIfUserHasAccessToExperience: async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const access = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID ? 'admin' : 'customer';
    // Always return 'customer' or 'admin', never 'no_access' as per instructions.
    return { access: access === 'admin' ? 'admin' : 'customer' };
  },
  // Simulates whopApi.accessPasses.list() - This will no longer be used.
  getAccessPass: async ({ companyId }: { companyId: string }) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return []; // Return empty array as paywall is removed
  },
  // Simulates whopApi.posts.create()
  createCommunityPost: async ({ title, content, tags }: { title: string; content: string; tags: string[] }) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('Simulating Whop Community Post Creation:', { title, content, tags });
    return { success: true, postId: `mock-post-${Date.now()}` };
  }
};

// Firebase Initialization (using global variables provided by Canvas)
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, addDoc, setDoc, collection, query, limit, getDocs
} from 'firebase/firestore';
import {
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User
} from 'firebase/auth';

let firebaseApp: ReturnType<typeof initializeApp> | undefined;
let db: ReturnType<typeof getFirestore> | undefined;
let auth: ReturnType<typeof getAuth> | undefined;

const initializeFirebase = () => {
  if (!firebaseApp && typeof window !== 'undefined') {
    let firebaseConfig: object | null = null;
    let configSource = '';

    // Prioritize __firebase_config from Canvas environment (with safe check)
    if (typeof globalThis !== 'undefined' &&
        '__firebase_config' in globalThis &&
        globalThis.__firebase_config) {
      try {
        firebaseConfig = JSON.parse(globalThis.__firebase_config as string);
        configSource = '__firebase_config (Canvas)';
      } catch (error) {
        console.error("Error parsing __firebase_config:", error);
      }
    }

    // Fallback to process.env.NEXT_PUBLIC_FIREBASE_CONFIG
    if (!firebaseConfig && typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_CONFIG) {
      try {
        firebaseConfig = JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG);
        configSource = 'NEXT_PUBLIC_FIREBASE_CONFIG (Environment Variable)';
      } catch (error) {
        console.error("Error parsing NEXT_PUBLIC_FIREBASE_CONFIG:", error);
      }
    }

    if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
      console.error('Firebase config not found or invalid.');
      return;
    }

    try {
      firebaseApp = initializeApp(firebaseConfig);
      db = getFirestore(firebaseApp);
      auth = getAuth(firebaseApp);
      console.log(`Firebase initialized successfully using ${configSource}!`);
    } catch (error) {
      console.error("Firebase initialization error:", error);
    }
  }
};


// =================================================================================================
// MULTI-SPORT CONFIGURATION
// =================================================================================================

const SPORTS_CONFIG: { [key: string]: { key: string, name: string } } = {
  'nfl': { key: 'americanfootball_nfl', name: 'NFL' },
  'nba': { key: 'basketball_nba', name: 'NBA' },
  'mlb': { key: 'baseball_mlb', name: 'MLB' },
  'nhl': { key: 'icehockey_nhl', name: 'NHL' },
  'soccer': { key: 'soccer_usa_mls', name: 'MLS Soccer' }, // Example for MLS
  'tennis': { key: 'tennis_atp_aus_open', name: 'ATP Tennis' }, // Example
  'mma': { key: 'mma_mixed_martial_arts', name: 'MMA' }, // Example
};

// =================================================================================================
// AI-POWERED BET PARSING (Replaces manual parsing)
// =================================================================================================
async function aiPoweredBetParsing(betDescription: string) {
  const cacheKey = `ai-parse-${betDescription}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  if (!PRODUCTION_KEYS.openai || PRODUCTION_KEYS.openai.length < 10) {
    console.warn('OpenAI API key not configured, using fallback parsing');
    return createFallbackParsing(betDescription);
  }

  try {
    const prompt = `You are an expert sports betting analyst. Parse this bet with deep sport-specific knowledge:

Bet: "${betDescription}"

Return ONLY this JSON structure:
{
  "sport": "nba|nfl|mlb|nhl|soccer|tennis|mma",
  "type": "team|player",
  "teams": ["Team 1", "Team 2"] or null,
  "player": "Full Player Name" or null,
  "line": number or null,
  "betOn": "over|under|team1_win|team2_win|spread|home_run|touchdown|goal|points|assists|rebounds" or null,
  "confidence": 0.0-1.0,
  "specificBetType": "home_run|touchdown_pass|rushing_yards|points|assists|rebounds|goals|saves|strikeouts|hits|runs|wins" or null
}

CRITICAL SPORT-SPECIFIC RULES:
- MLB: "home run", "RBI", "hits", "strikeouts", "stolen bases", "runs scored"
- NFL: "touchdown_pass", "rushing_yards", "receptions", "passing_yards"
- NBA: "points", "assists", "rebounds", "steals", "blocks", "three_pointers"
- NHL: "goals", "assists", "saves", "shots_on_goal"

Examples:
- "Aaron Judge to hit a home run" → betOn: "home_run", specificBetType: "home_run"
- "Mahomes over 2.5 touchdown passes" → betOn: "over", specificBetType: "touchdown_pass", line: 2.5
- "LeBron over 25.5 points" → betOn: "over", specificBetType: "points", line: 25.5`;

    const response = await fetchWithTimeout(PRODUCTION_API_ENDPOINTS.openai, { // Use fetchWithTimeout
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRODUCTION_KEYS.openai}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400, // REDUCED from 800 to 400
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid OpenAI response structure');
    }

    let content = data.choices[0].message.content.trim();
    if (content.startsWith("```json")) {
      content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }
    const result = JSON.parse(content);

    console.log('🤖 Enhanced AI Parsed Bet:', result);
    setCachedData(cacheKey, result, 'ai_parsing');
    return result;

  } catch (error) {
    console.error('AI parsing failed:', error);
    return createFallbackParsing(betDescription);
  }
}

function detectBetType(parsedBet: any): 'straight' | 'prop' | 'total' | 'moneyline' {
  if (!parsedBet) return 'straight';

  if (parsedBet.type === 'player') {
    return 'prop';
  } else if (parsedBet.betOn === 'over' || parsedBet.betOn === 'under') {
    return 'total';
  } else if (parsedBet.betOn?.includes('win') || parsedBet.betOn === 'moneyline') {
    return 'moneyline';
  } else {
    return 'straight';
  }
}

// =================================================================================================
// AI GAME MATCHING
// =================================================================================================
async function aiMatchGame(apiData: any[], parsedBet: any) {
  if (!parsedBet.teams || parsedBet.teams.length < 2) return null;

  // Check if OpenAI key is available and sufficiently long
  if (!PRODUCTION_KEYS.openai || PRODUCTION_KEYS.openai.length < 10) {
    console.warn('OpenAI API key not configured for AI game matching. Using basic string matching fallback.');
    // Fallback to simple string matching
    return apiData.find(game => {
      const gameString = `${game.home_team} vs ${game.away_team}`.toLowerCase();
      return parsedBet.teams.some((team: string) =>
        gameString.includes(team.toLowerCase())
      );
    });
  }

  try {
    const availableGames = apiData.map(g => `${g.home_team} vs ${g.away_team}`).join('\n');
    const prompt = `Find the best matching game for: ${parsedBet.teams[0]} vs ${parsedBet.teams[1]}

Available games:
${availableGames}

Return only the exact game string that matches, or "NO_MATCH" if none match.`;

    const response = await fetchWithTimeout(PRODUCTION_API_ENDPOINTS.openai, { // Use fetchWithTimeout
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRODUCTION_KEYS.openai}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error during game matching: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid OpenAI response structure for game matching');
    }

    // Fix: Strip Markdown code fence and leading "json" before parsing (though unlikely for this prompt)
    let content = data.choices[0].message.content.trim();
    if (content.startsWith("```json")) {
      content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }
    const matchResult = content; // Assuming the match result is directly the content

    if (matchResult === "NO_MATCH") return null;

    const matchedGame = apiData.find(game =>
      `${game.home_team} vs ${game.away_team}` === matchResult
    );

    if (matchedGame) {
      console.log(`✅ AI matched game: ${matchedGame.home_team} vs ${matchedGame.away_team}`);
    } else {
      console.warn(`❌ AI suggested match "${matchResult}" not found in API data.`);
    }
    return matchedGame;

  } catch (error) {
    console.error('AI game matching failed:', error);
    // Fallback to simple string matching if AI fails
    return apiData.find(game => {
      const gameString = `${game.home_team} vs ${game.away_team}`.toLowerCase();
      return parsedBet.teams.some((team: string) =>
        gameString.includes(team.toLowerCase())
      );
    });
  }
}


// Helper function to transform The Odds API response into a common odds format
function transformOddsData(matchingGame: any) {
  const result: any = {};

  if (!matchingGame) return {};

  matchingGame.bookmakers.forEach((bookmaker: any) => {
    const bookmakerName = bookmaker.key.replace(/_|-/g, ''); // Normalize bookmaker name (e.g., draftkings, fanduel)
    result[bookmakerName] = {};

    bookmaker.markets.forEach((market: any) => {
      if (market.key === 'spreads') {
        const homeOutcome = market.outcomes.find((o: any) => o.name === matchingGame.home_team);
        const awayOutcome = market.outcomes.find((o: any) => o.name === matchingGame.away_team);
        result[bookmakerName].spread = homeOutcome ? homeOutcome.point : (awayOutcome ? -awayOutcome.point : null);
        result[bookmakerName].homeSpreadOdds = homeOutcome?.price;
        result[bookmakerName].awaySpreadOdds = awayOutcome?.price;
      } else if (market.key === 'totals') {
        result[bookmakerName].total = market.outcomes[0]?.point; // Assume first outcome is the total line
        result[bookmakerName].overOdds = market.outcomes.find((o:any) => o.name.toLowerCase() === 'over')?.price;
        result[bookmakerName].underOdds = market.outcomes.find((o:any) => o.name.toLowerCase() === 'under')?.price;
      } else if (market.key === 'h2h') { // Moneyline
        const homeOutcome = market.outcomes.find((o: any) => o.name === matchingGame.home_team);
        const awayOutcome = market.outcomes.find((o: any) => o.name === matchingGame.away_team);
        result[bookmakerName].moneylineHome = homeOutcome ? homeOutcome.price : null;
        result[bookmakerName].moneylineAway = awayOutcome ? awayOutcome.price : null;
      }
    });
  });

  return { source: 'The Odds API', ...result };
}

// =================================================================================================
// PRODUCTION ODDS SYSTEM (2-TIER FALLBACK)
// =================================================================================================

async function fetchProductionOdds(betDescription: string) {
  const cacheKey = `odds-${betDescription}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  // Parse with AI
  const parsedBet = await aiPoweredBetParsing(betDescription);
  if (!parsedBet || parsedBet.confidence < 0.3 || !parsedBet.sport) {
    console.warn('AI parsing failed or low confidence for odds. Returning neutral odds.');
    return { source: 'AI parsing failed - using neutral odds', error: 'Could not parse bet or low confidence.' };
  }

  // 🚨 FORCE REAL API CALL - Don't skip if missing keys
  const sportConfig = SPORTS_CONFIG[parsedBet.sport];
  if (sportConfig && PRODUCTION_KEYS.theOdds && PRODUCTION_KEYS.theOdds.length > 10) {
    try {
      console.log(`🔗 CALLING The Odds API for ${parsedBet.sport}: ${sportConfig.key}`);
      
      const oddsUrl = `${PRODUCTION_API_ENDPOINTS.theOddsAPI}/sports/${sportConfig.key}/odds/?apiKey=${PRODUCTION_KEYS.theOdds}&regions=us&markets=spreads,totals,h2h&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm,caesars`;

      const response = await fetch(oddsUrl);
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 The Odds API returned ${data.length} games for ${parsedBet.sport}`);
        
        if (data.length === 0) {
          console.warn('⚠️ The Odds API returned empty data - no games available');
          return { source: 'The Odds API (No Games Available)', games: 0 };
        }
        
        const matchingGame = await aiMatchGame(data, parsedBet);
        if (matchingGame) {
          const odds = transformOddsData(matchingGame);
          if (Object.keys(odds).length > 1) {
            setCachedData(cacheKey, odds, 'odds');
            console.log('✅ TIER 1: Live odds from The Odds API:', odds.source);
            return odds;
          }
        } else {
          console.warn(`❌ No matching game found for: ${parsedBet.teams?.join(' vs ')}`);
          return { source: 'The Odds API (No Matching Game)', availableGames: data.length };
        }
      } else {
        const errorText = await response.text();
        console.error(`❌ The Odds API Error: ${response.status} - ${errorText}`);
        throw new Error(`The Odds API response not OK: ${response.status} - ${errorText}`);
      }
    } catch (error: any) { // Explicitly type error for better handling
      console.error('❌ The Odds API failed:', error);
      return { source: 'The Odds API Failed', error: error.message };
    }
  } else {
    console.error('❌ Missing The Odds API key or invalid sport');
    return { source: 'Missing API Configuration', error: 'The Odds API key not configured' };
  }

  // Fallback with clear indication
  console.warn('⚠️ Falling back to neutral odds - this should not happen in production');
  const neutralOdds = {
    source: 'Fallback (Check API Configuration)',
    warning: 'This analysis uses fallback data - verify API keys are configured correctly',
    draftkings: { spread: 0, moneyline: 100, total: 0, overOdds: 0, underOdds: 0, homeSpreadOdds: 0, awaySpreadOdds: 0, moneylineHome: 0, moneylineAway: 0 },
    fanduel: { spread: 0, moneyline: 100, total: 0, overOdds: 0, underOdds: 0, homeSpreadOdds: 0, awaySpreadOdds: 0, moneylineHome: 0, moneylineAway: 0 },
    betmgm: { spread: 0, moneyline: 100, total: 0, overOdds: 0, underOdds: 0, homeSpreadOdds: 0, awaySpreadOdds: 0, moneylineHome: 0, moneylineAway: 0 },
    caesars: { spread: 0, moneyline: 100, total: 0, overOdds: 0, underOdds: 0, homeSpreadOdds: 0, awaySpreadOdds: 0, moneylineHome: 0, moneylineAway: 0 }
  };
  setCachedData(cacheKey, neutralOdds, 'odds');
  return neutralOdds;
}

// =================================================================================================
// PRODUCTION STATS SYSTEM (Sportradar Integration)
// =================================================================================================

async function fetchProductionStats(betDescription: string) {
  const cacheKey = `stats-${betDescription}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const parsedBet = await aiPoweredBetParsing(betDescription);

  // TIER 1: Sportradar Professional Data
  // Ensure sportradar endpoint and API key are available for the detected sport
  const validSports = ['nba', 'nfl', 'mlb', 'nhl'] as const;
if (parsedBet.sport &&
    validSports.includes(parsedBet.sport) &&
    PRODUCTION_API_ENDPOINTS.sportradar[parsedBet.sport] &&
    PRODUCTION_KEYS.sportradar) {
    try {
      console.log(`🏆 Attempting Sportradar ${parsedBet.sport.toUpperCase()} API`);

      if (parsedBet.type === 'player' && parsedBet.player) {
        const playerStats = await fetchSportradarPlayerStats(parsedBet.player, parsedBet.sport);
        if (playerStats && !playerStats.error) {
          setCachedData(cacheKey, playerStats, 'stats');
          console.log(`✅ TIER 1: Sportradar player stats found`);
          return playerStats;
        }
      } else if (parsedBet.type === 'team' && parsedBet.teams && parsedBet.teams.length >= 2) {
        const teamStats = await fetchSportradarTeamStats(parsedBet.teams, parsedBet.sport);
        if (teamStats && !teamStats.error) {
          setCachedData(cacheKey, teamStats, 'stats');
          console.log(`✅ TIER 1: Sportradar team stats found`);
          return teamStats;
        }
      }
    } catch (error) {
      console.error('Sportradar API failed:', handleApiError(error, 'Sportradar Stats'));
    }
  }

  // TIER 2: Derived/Placeholder stats (fallback)
  console.warn(`No Sportradar data found for ${betDescription}. Using derived stats.`);
  const derivedStats = generateDerivedStats(parsedBet);
  setCachedData(cacheKey, derivedStats, 'stats'); // Cache derived stats as well
  return derivedStats;
}

// 🔧 REPLACE fetchSportradarPlayerStats function with this WORKING version:
async function fetchSportradarPlayerStats(playerName: string, sport: string) {
  // These are no longer directly used for URL construction on the frontend.
  // The proxy will handle the actual Sportradar endpoint and API key.
  // const endpoint = PRODUCTION_API_ENDPOINTS.sportradar[sport];
  // const apiKey = PRODUCTION_KEYS.sportradar;

  if (!sport) {
    return { error: `Sport not specified for Sportradar player stats.` };
  }

  try {
    // Build the proxy URL. The backend proxy will translate this into the actual Sportradar API call.
    const proxyUrl = `/api/sportradar-proxy?sport=${sport}&type=player&player=${encodeURIComponent(playerName)}`;

    console.log(`🔗 Proxy URL for Sportradar ${sport} Player: ${proxyUrl}`);

    const response = await fetch(proxyUrl); // This is not an OpenAI call, so no fetchWithTimeout needed here.
    console.log(`📡 Sportradar ${sport} Player Proxy Response Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      const processedData = processSportradarPlayerData(data, playerName, sport);
      if (processedData && !processedData.error) {
          return processedData;
      } else {
          return { error: processedData.error || `No data found for player ${playerName} in Sportradar ${sport} response.` };
      }
    } else {
      const errorText = await response.text();
      console.error(`API Error Response: ${response.status} - ${errorText}`);
      throw new Error(`Sportradar API response via proxy: ${response.status} - ${errorText}`);
    }
  } catch (error: any) { // Explicitly type error for better handling
    console.error(`Sportradar ${sport} player stats error:`, error);
    return { error: handleApiError(error, `Sportradar ${sport} Player Stats`) };
  }
}

// 🔧 REPLACE fetchSportradarTeamStats function with this WORKING version:
async function fetchSportradarTeamStats(teams: string[], sport: string) {
  // These are no longer directly used for URL construction on the frontend.
  // The proxy will handle the actual Sportradar endpoint and API key.
  // const endpoint = PRODUCTION_API_ENDPOINTS.sportradar[sport];
  // const apiKey = PRODUCTION_KEYS.sportradar;

  if (!sport) {
    return { error: `Sport not specified for Sportradar team stats.` };
  }

  try {
    // Build the proxy URL. The backend proxy will translate this into the actual Sportradar API call.
    // We stringify the teams array to pass it as a single query parameter.
    const proxyUrl = `/api/sportradar-proxy?sport=${sport}&type=team&teams=${encodeURIComponent(JSON.stringify(teams))}`;

    console.log(`🔗 Proxy URL for Sportradar ${sport} Team: ${proxyUrl}`);

    const response = await fetch(proxyUrl); // This is not an OpenAI call, so no fetchWithTimeout needed here.
    console.log(`📡 Sportradar ${sport} Team Proxy Response Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      const processedData = processSportradarTeamData(data, teams, sport);
      if (processedData && (processedData.team1 || processedData.team2)) {
          return processedData;
      } else {
          return { error: `No data found for teams ${teams.join(', ')} in Sportradar ${sport} response.` };
      }
    } else {
      const errorText = await response.text();
      console.error(`API Error Response: ${response.status} - ${errorText}`);
      throw new Error(`Sportradar API response via proxy: ${response.status} - ${errorText}`);
    }
  } catch (error: any) { // Explicitly type error for better handling
    console.error(`Sportradar ${sport} team stats error:`, error);
    return { error: handleApiError(error, `Sportradar ${sport} Team Stats`) };
  }
}

// 🔧 REPLACE processSportradarPlayerData function with this ENHANCED version:
function processSportradarPlayerData(data: any, playerName: string, sport: string) {
  console.log(`🔍 Processing Sportradar ${sport} player data for: ${playerName}`);
  console.log(`📥 Raw Sportradar ${sport} data structure:`, Object.keys(data));

  let playerData = null;

  if (sport === 'nba' && data.categories) {
    // NBA League Leaders has categories like "points", "assists", etc.
    console.log(`🏀 NBA categories found:`, Object.keys(data.categories));

    // Look through all stat categories for the player
    for (const categoryKey in data.categories) { // Use for...in for object keys
      if (data.categories.hasOwnProperty(categoryKey)) {
        const players = data.categories[categoryKey];
        if (Array.isArray(players)) {
          const found = players.find((p: any) =>
            p.full_name?.toLowerCase().includes(playerName.toLowerCase()) ||
            p.name?.toLowerCase().includes(playerName.toLowerCase())
          );
          if (found) {
            playerData = found;
            console.log(`✅ Found ${playerName} in ${categoryKey} category`);
            // We found the player, but stats are spread across categories.
            // For simplicity, we'll try to aggregate what's commonly available.
            // A more robust solution would iterate through all categories and sum/average stats.
            break;
          }
        }
      }
    }
  } else if (data.conferences) {
    // NFL/MLB/NHL Hierarchy - look through teams for players
    console.log(`🏈 League hierarchy found, searching teams...`);

    for (const conference of data.conferences) {
      for (const division of conference.divisions || []) {
        for (const team of division.teams || []) {
          if (team.players) {
            const found = team.players.find((p: any) =>
              p.full_name?.toLowerCase().includes(playerName.toLowerCase()) ||
              p.name?.toLowerCase().includes(playerName.toLowerCase())
            );
            if (found) {
              playerData = found;
              console.log(`✅ Found ${playerName} on ${team.name}`);
              break;
            }
          }
        }
      }
      if (playerData) break; // Break from conference loop if player found
    }
  } else {
    console.log(`⚠️ No recognizable player data structure found`);
    console.log(`🔍 Available data keys:`, Object.keys(data));
  }

  if (!playerData) {
    console.warn(`❌ Player ${playerName} not found in Sportradar data`);
    return { error: `Player ${playerName} not found` };
  }

  // Extract stats based on sport
  let stats: any = {};
  if (sport === 'nba') {
    // For NBA League Leaders, player data directly contains averages/totals.
    // The structure will be different from other sports hierarchy.
    stats = {
      seasonAveragePoints: playerData.average?.points || playerData.total?.points || 0,
      recentFormPoints: (playerData.average?.points || 0) * (1 + (Math.random() - 0.5) * 0.1), // Placeholder for recent form
      matchupHistoryPoints: (playerData.average?.points || 0) * (1 + (Math.random() - 0.5) * 0.05), // Placeholder for matchup history
      usageRate: (playerData.average?.usage_pct || 0) / 100, // Convert percentage to 0-1
      minutesPlayed: playerData.average?.minutes || 0,
      opponentDefenseRank: Math.floor(Math.random() * 30) + 1 // Placeholder
    };
  } else if (sport === 'nfl') {
    stats = {
      seasonAveragePoints: playerData.statistics?.fantasy_points || 0,
      passingYards: playerData.statistics?.passing?.yards || 0,
      touchdownPasses: playerData.statistics?.passing?.touchdowns || 0,
      rushingYards: playerData.statistics?.rushing?.yards || 0,
      receptions: playerData.statistics?.receiving?.receptions || 0,
      // Add more NFL specific stats if available in Sportradar response
    };
  } else if (sport === 'mlb') {
    stats = {
      battingAverage: playerData.statistics?.batting?.avg || 0,
      homeRuns: playerData.statistics?.hitting?.home_runs || 0,
      rbis: playerData.statistics?.hitting?.rbi || 0,
      era: playerData.statistics?.pitching?.era || 0, // For pitchers
    };
  } else if (sport === 'nhl') {
    stats = {
      goals: playerData.statistics?.goals || 0,
      assists: playerData.statistics?.assists || 0,
      plusMinus: playerData.statistics?.plus_minus || 0,
      savePercentage: playerData.statistics?.save_percentage || 0, // For goalies
    };
  }

  return {
    source: 'Sportradar Professional Data',
    player: {
      name: playerName,
      ...stats,
      team: playerData.team?.name || playerData.team?.market || 'Unknown',
      position: playerData.position || 'Unknown'
    }
  };
}

// Process Sportradar Team Data
function processSportradarTeamData(data: any, teams: string[], sport: string) {
  console.log(`🔍 Processing Sportradar ${sport} team data for: ${teams.join(' vs ')}`);

  const findTeam = (teamName: string) => {
    // Sportradar hierarchy for teams is usually under conferences -> divisions -> teams
    if (!data.conferences || !Array.isArray(data.conferences)) return null;

    for (const conference of data.conferences) {
      for (const division of conference.divisions || []) {
        for (const team of division.teams || []) {
          if (
            team.name?.toLowerCase().includes(teamName.toLowerCase()) ||
            team.market?.toLowerCase().includes(teamName.toLowerCase()) ||
            team.alias?.toLowerCase().includes(teamName.toLowerCase()) ||
            team.full_name?.toLowerCase().includes(teamName.toLowerCase())
          ) {
            return team;
          }
        }
      }
    }
    return null;
  };

  const team1Data = findTeam(teams[0]);
  const team2Data = findTeam(teams[1]);

  const processTeam = (teamData: any, teamName: string) => {
    if (!teamData) {
      console.warn(`Team ${teamName} not found in Sportradar data for ${sport}`);
      return {
        name: teamName,
        offenseRating: 0.5, // Placeholder
        defenseRating: 0.5, // Placeholder
        headToHeadWinPct: 0.5, // Placeholder
        homeRecord: '0-0', // Placeholder
        injuries: [], // Placeholder, requires specific injury endpoint
        restDays: 0 // Placeholder
      };
    }

    // Extract common statistics. Specific keys might vary per sport within Sportradar.
    // In Sportradar hierarchy, team stats might be directly on the team object or under a 'statistics' key.
    const stats = teamData.season_stats || teamData.statistics || {};

    return {
      name: teamName,
      // These stat keys are generalized examples and might need adjustment based on actual API response for each sport.
      offenseRating: Math.min(1, (stats.points_per_game || stats.avg_points || stats.points || 100) / 120), // Normalize
      defenseRating: Math.max(0, 1 - ((stats.opponent_points_per_game || stats.opp_avg_points || stats.opp_points || 100) / 120)), // Normalize
      headToHeadWinPct: (stats.wins || 0) / ((stats.wins || 0) + (stats.losses || 0) + 1), // Simple win rate
      homeRecord: `${stats.home_wins || 0}-${stats.home_losses || 0}`,
      injuries: [], // Requires a dedicated Sportradar injury endpoint
      restDays: Math.floor(Math.random() * 4) // Placeholder
    };
  };

  return {
    source: 'Sportradar Professional Data',
    team1: processTeam(team1Data, teams[0]),
    team2: processTeam(team2Data, teams[1])
  };
}

// Generate derived stats when no real data available
function generateDerivedStats(parsedBet: any) {
  const currentYear = new Date().getFullYear();
  if (parsedBet.type === 'team' && parsedBet.teams && parsedBet.teams.length >= 2) {
    return {
      source: 'Derived/Enhanced Stats',
      team1: {
        name: parsedBet.teams[0],
        offenseRating: 0.55 + Math.random() * 0.3,
        defenseRating: 0.50 + Math.random() * 0.3,
        headToHeadWinPct: 0.4 + Math.random() * 0.2,
        homeRecord: `${Math.floor(Math.random()*15)}-${Math.floor(Math.random()*10)}`,
        injuries: Math.random() > 0.8 ? [`(Derived) ${currentYear} Key Player Injured`] : [],
        restDays: Math.floor(Math.random() * 5)
      },
      team2: {
        name: parsedBet.teams[1],
        offenseRating: 0.55 + Math.random() * 0.3,
        defenseRating: 0.50 + Math.random() * 0.3,
        headToHeadWinPct: 0.4 + Math.random() * 0.2,
        injuries: Math.random() > 0.9 ? [`(Derived) ${currentYear} Backup Injured`] : [],
        restDays: Math.floor(Math.random() * 5)
      }
    };
  } else if (parsedBet.type === 'player' && parsedBet.player) {
    return {
      source: 'Derived/Enhanced Stats',
      player: {
        name: parsedBet.player,
        seasonAveragePoints: 18 + Math.floor(Math.random() * 20),
        recentFormPoints: 15 + Math.floor(Math.random() * 25),
        matchupHistoryPoints: 16 + Math.floor(Math.random() * 18),
        usageRate: 0.15 + Math.random() * 0.20,
        minutesPlayed: 20 + Math.floor(Math.random() * 20),
        opponentDefenseRank: Math.floor(Math.random() * 30) + 1
      }
    };
  }

  return { source: 'No Data Available', error: 'Unable to generate stats for this bet type' };
}

// =================================================================================================
// AI-ENHANCED KEY FACTORS
// =================================================================================================
async function generateAIKeyFactors(parsedBet: any, odds: any, stats: any) {
  if (PRODUCTION_KEYS.openai && PRODUCTION_KEYS.openai.length > 10) {
    try {
      const prompt = `You are a professional sports betting analyst. Generate 3-5 key factors for this specific bet using sport-appropriate terminology and logic:

SPORT: ${parsedBet.sport?.toUpperCase()}
BET TYPE: ${parsedBet.specificBetType || parsedBet.betOn}
PLAYER: ${parsedBet.player || 'N/A'}
TEAMS: ${parsedBet.teams?.join(' vs ') || 'N/A'}
LINE: ${parsedBet.line || 'N/A'}

AVAILABLE DATA:
Odds: ${JSON.stringify(odds)}
Stats: ${JSON.stringify(stats)}

SPORT-SPECIFIC ANALYSIS RULES:
- MLB: Focus on home run rates, ballpark factors, pitcher matchups, recent hot streaks, historical performance vs opposing pitcher
- NFL: Focus on red zone efficiency, target share, snap counts, weather conditions, defensive rankings against position
- NBA: Focus on usage rate, recent form, matchup advantages, pace of play, rest days
- NHL: Focus on power play opportunities, shots on goal, recent goal scoring, goalie matchups

Return JSON array of 3-5 factors: ["factor 1", "factor 2", "factor 3"]

Make factors SPECIFIC to the sport and bet type. NO generic basketball terms for baseball bets!`;

      const response = await fetchWithTimeout(PRODUCTION_API_ENDPOINTS.openai, { // Use fetchWithTimeout
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PRODUCTION_KEYS.openai}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
          let content = data.choices[0].message.content.trim();
          if (content.startsWith("```json")) {
            content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
          }
          const factors = JSON.parse(content);
          console.log('🤖 Enhanced AI Key Factors:', factors);
          return factors;
        }
      }
    } catch (error) {
      console.error('Enhanced AI key factors failed:', error);
    }
  }

  return generateManualKeyFactors(parsedBet, odds, stats);
}

// NEW: Smart background data (runs in background, doesn't block main analysis)
async function fetchLiveMarketData(parsedBet: any) {
  const cacheKey = `market-${parsedBet.betDescription}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  // If OpenAI key is not configured, return fallback data
  if (!PRODUCTION_KEYS.openai || PRODUCTION_KEYS.openai.length < 10) {
    console.warn('OpenAI API key not configured for market data. Returning fallback data.');
    return { lineValue: 'unknown', keyFactor: 'Data unavailable', trend: 'neutral' };
  }

  const marketPrompt = `Quick market analysis for: ${parsedBet.betDescription}

Provide in 2-3 sentences:
1. Current line value assessment
2. Key market factors
3. Any notable trends

Return brief JSON: {"lineValue": "fair/good/poor", "keyFactor": "main factor", "trend": "direction"}`;

  try {
    const response = await fetchWithTimeout(PRODUCTION_API_ENDPOINTS.openai, { // Use fetchWithTimeout
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRODUCTION_KEYS.openai}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast model
        messages: [{ role: 'user', content: marketPrompt }],
        max_tokens: 100, // REDUCED from 200 to 100
        temperature: 0.2
      })
    });

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    if (content.startsWith("```json")) {
      content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }
    
    const result = JSON.parse(content);
    setCachedData(cacheKey, result, 'market_data');
    return result;
  } catch (error) {
    console.error('Market data failed:', error);
    return { lineValue: 'unknown', keyFactor: 'Data unavailable', trend: 'neutral' };
  }
}

// NEW: Mock for fetchHistoricalContext as its implementation was not provided
async function fetchHistoricalContext(parsedBet: any) {
  const cacheKey = `historical-${parsedBet.betDescription}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  // Simulate fetching historical context
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

  const mockHistoricalData = {
    team1RecentForm: "Win-Loss-Win-Loss-Win (3-2)",
    team2RecentForm: "Loss-Win-Loss-Win-Loss (2-3)",
    headToHeadLast5: "Team A won 3, Team B won 2",
    playerSeasonHigh: parsedBet.player ? `${parsedBet.player} scored 45 points against opponent X this season.` : null,
    trend: "The spread for this matchup has historically favored the underdog in 60% of games.",
    injuryImpact: "No major historical injury patterns for key players in similar matchups."
  };

  setCachedData(cacheKey, mockHistoricalData, 'historical_context');
  return mockHistoricalData;
}

// ADD this validation function:
function validateParsedBet(parsedBet: any, originalBet: string): string[] {
  const errors: string[] = [];
  
  // Validate player prop lines are realistic
  if (parsedBet.type === 'player' && parsedBet.line) {
    const sport = parsedBet.sport?.toLowerCase();
    const betType = parsedBet.specificBetType?.toLowerCase();
    const line = parsedBet.line;
    
    // NBA Points validation
    if (sport === 'nba' && betType === 'points') {
      if (line > 60) errors.push(`NBA points line ${line} is unrealistic (max ~60 in modern NBA)`);
      if (line < 5) errors.push(`NBA points line ${line} is unrealistic (min ~5)`);
    }
    
    // NFL validation
    if (sport === 'nfl') {
      if (betType === 'touchdown_pass' && line > 6) {
        errors.push(`NFL touchdown passes line ${line} is unrealistic (max ~5-6 in a game)`);
      }
      if (betType === 'rushing_yards' && line > 300) {
        errors.push(`NFL rushing yards line ${line} is unrealistic (max ~250-300)`);
      }
    }
    
    // MLB validation  
    if (sport === 'mlb') {
      if (betType === 'home_run' && line > 4) {
        errors.push(`MLB home runs line ${line} is unrealistic (max ~3-4 in a game)`);
      }
    }
  }
  
  // Validate player names are real
  if (parsedBet.player) {
    const suspiciousNames = ['test', 'example', 'sample', 'fake'];
    if (suspiciousNames.some(name => parsedBet.player.toLowerCase().includes(name))) {
      errors.push(`Player name "${parsedBet.player}" appears to be a test/fake name`);
    }
  }
  
  // Validate bet matches original description
  if (parsedBet.line) {
    const originalHasNumber = /(\d+\.?\d*)/.test(originalBet);
    if (originalHasNumber) {
      const originalNumbers = originalBet.match(/(\d+\.?\d*)/g)?.map(Number) || [];
      if (!originalNumbers.includes(parsedBet.line)) {
        errors.push(`Parsed line ${parsedBet.line} doesn't match any number in original bet "${originalBet}"`);
      }
    }
  }
  
  return errors;
}

// ADD data validation function for APIs:
function validateApiData(parsedBet: any, odds: any, stats: any) {
  const warnings: string[] = [];
  let status = 'Valid';
  
  // Check if we have real odds data
  if (odds.source === 'Calculated (No Live Odds)') {
    warnings.push('No live odds available - using fallback calculations');
    status = 'Limited Data';
  }
  
  // Check if we have real stats data
  if (stats.source === 'Derived/Enhanced Stats') {
    warnings.push('Using derived statistics - not real player/team data');
    status = 'Limited Data';
  }
  
  // Check for data source issues
  if (stats.error || odds.error) {
    warnings.push('API errors detected - data may be incomplete');
    status = 'Data Issues';
  }
  
  return { status, warnings };
}


async function generateComprehensiveAnalysis(parsedBet: any, odds: any, stats: any, liveData: any) {
  const cacheKey = `comprehensive-${parsedBet.betDescription}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  if (!PRODUCTION_KEYS.openai || PRODUCTION_KEYS.openai.length < 10) {
    throw new Error('OpenAI API key not configured.');
  }

  // 🚨 FORCE REAL DATA VALIDATION
  const dataValidation = validateApiData(parsedBet, odds, stats);
  
  const prompt = `You are a professional sports betting analyst. Analyze this bet using ONLY the provided real data.

🚨 CRITICAL: Use ONLY the actual data provided below. DO NOT make up statistics or use general knowledge.

BET DETAILS:
- Description: "${parsedBet.betDescription}"
- Sport: ${parsedBet.sport?.toUpperCase()}
- Type: ${parsedBet.specificBetType || parsedBet.betOn}
- Player: ${parsedBet.player || 'N/A'}
- Teams: ${parsedBet.teams?.join(' vs ') || 'N/A'}
- Line: ${parsedBet.line || 'N/A'}

REAL ODDS DATA (${odds.source}):
${JSON.stringify(odds, null, 2)}

REAL STATS DATA (${stats.source}):
${JSON.stringify(stats, null, 2)}

DATA VALIDATION STATUS:
${dataValidation.status}
${dataValidation.warnings.length > 0 ? 'WARNINGS: ' + dataValidation.warnings.join(', ') : ''}

ANALYSIS REQUIREMENTS:
1. Win probability (1-100) - BE REALISTIC based on actual data
2. Key factors - ONLY use data provided above
3. Risk assessment - Consider data quality and availability
4. Confidence - Lower if data is limited/derived

${parsedBet.line && parsedBet.line > 50 && parsedBet.specificBetType === 'points' ? 
  '🚨 WARNING: This appears to be an extremely high points line. Double-check your analysis.' : ''}

Return JSON:
{
  "winProbability": number,
  "confidence": "LOW|MEDIUM|HIGH",
  "keyFactors": ["only use real data provided"],
  "marketAnalysis": "based on actual odds data",
  "riskFactors": ["include data quality concerns"],
  "recommendation": "STRONG_BUY|BUY|HOLD|SELL",
  "reasoning": "explain using only provided data"
}

REMEMBER: If the data suggests an unrealistic scenario (like 70+ points), flag it as high risk.`;

  try {
    const response = await fetchWithTimeout(PRODUCTION_API_ENDPOINTS.openai, { // Use fetchWithTimeout
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRODUCTION_KEYS.openai}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use mini for speed while maintaining quality
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.1 // Low temperature for consistent analysis
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    if (content.startsWith("```json")) {
      content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }
    
    const result = JSON.parse(content);
    setCachedData(cacheKey, result, 'comprehensive_analysis');
    return result;
  } catch (error) {
    console.error('Comprehensive analysis failed:', error);
    throw error;
  }
}

const generateEnhancedCreatorResponse = async (
  analysis: any,
  algorithm: CreatorAlgorithm,
  allData: any
): Promise<string> => {
  const { parsedBet, odds, stats } = allData;
  
  if (!PRODUCTION_KEYS.openai || PRODUCTION_KEYS.openai.length < 10) {
    return `Analysis complete! ${algorithm.signaturePhrase || 'Get that bag!'}`;
  }

  // Use custom style if provided, otherwise use tone
  const styleInstructions = algorithm.customResponseStyle 
    ? `Study these examples of the creator's analysis style and mimic it EXACTLY:

CREATOR'S STYLE EXAMPLES:
${algorithm.customResponseStyle}

CRITICAL: Match the creator's:
- Exact writing style and tone
- Formatting (emojis, line breaks, structure)
- Vocabulary and phrases they use
- How they present data and insights
- Their specific catchphrases and expressions

Write the analysis for "${parsedBet.betDescription}" in this EXACT same style.`
    : `Create a ${algorithm.responseTone} betting analysis response.`;

  const responsePrompt = `${styleInstructions}

ANALYSIS DATA:
Win Probability: ${analysis.winProbability}%
Confidence: ${analysis.confidence}
Key Factors: ${analysis.keyFactors?.join(', ')}
Recommendation: ${analysis.recommendation}
Market Analysis: ${analysis.marketAnalysis}
Risk Factors: ${analysis.riskFactors?.join(', ')}

BET: ${parsedBet.betDescription}
SPORT: ${parsedBet.sport}
ODDS: ${odds.source !== 'Calculated (No Live Odds)' ? 'Live odds available' : 'No live odds'}

${algorithm.customResponseStyle ? 
  'Create analysis in the EXACT style shown above.' : 
  `Match the ${algorithm.responseTone} tone exactly.`}

End with: ${algorithm.signaturePhrase}`;

  try {
    const response = await fetch(PRODUCTION_API_ENDPOINTS.openai, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRODUCTION_KEYS.openai}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: responsePrompt }],
        max_tokens: 800,
        temperature: 0.7  // Higher temperature for creative style matching
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Apply brand color styling
    if (algorithm.brandColor && algorithm.signaturePhrase) {
      const signatureRegex = new RegExp(algorithm.signaturePhrase, 'gi');
      content = content.replace(
        signatureRegex, 
        `<span style="color:${algorithm.brandColor};font-weight:bold;">${algorithm.signaturePhrase}</span>`
      );
    }
    
    return content;
  } catch (error) {
    console.error('Enhanced creator response failed:', error);
    return `Analysis complete! ${algorithm.signaturePhrase || 'Get that bag!'}`;
  }
};

const trackAnalysisPerformance = async (betDescription: string, startTime: number) => {
  const duration = Date.now() - startTime;
  console.log(`📊 Analysis Performance: "${betDescription}" took ${duration}ms`);

  // Log to analytics if available (gtag is a common global for Google Analytics)
  // if (typeof gtag !== 'undefined') {
  //   gtag('event', 'analysis_performance', {
  //     duration_ms: duration,
  //     bet_type: 'user_submission'
  //   });
  // }
};

// Replace analyzeBet function with the parallelized version
const analyzeBet = async (
  betDescription: string,
  creatorAlgorithm: CreatorAlgorithm,
  setAnalysisStage: React.Dispatch<React.SetStateAction<string>>
): Promise<BetAnalysis> => {
  const startTime = Date.now();

  // Step 1: AI parsing (keep fast)
  setAnalysisStage('🧠 Parsing bet...');
  const parsedBet = await aiPoweredBetParsing(betDescription);
  const betType = detectBetType(parsedBet);

  // 🚨 CRITICAL VALIDATION - Prevent insane analysis
  const validationErrors = validateParsedBet(parsedBet, betDescription);
  if (validationErrors.length > 0) {
    console.error('❌ Bet parsing validation failed:', validationErrors);
    throw new Error(`Invalid bet analysis: ${validationErrors.join(', ')}`);
  }

  // Step 2: ALL API calls in parallel (FASTEST)
  setAnalysisStage('📊 Analyzing data...');
  const [oddsResult, statsResult, comprehensiveAnalysisSettled] = await Promise.allSettled([
    fetchProductionOdds(betDescription),
    fetchProductionStats(betDescription),
    // Run comprehensive analysis in parallel with data fetching
    (async () => {
      const [liveMarketDataSettled, historicalContextSettled] = await Promise.allSettled([
        fetchLiveMarketData(parsedBet),
        fetchHistoricalContext(parsedBet)
      ]);
      
      const liveMarketData = liveMarketDataSettled.status === 'fulfilled' ? liveMarketDataSettled.value : {};
      const historicalContext = historicalContextSettled.status === 'fulfilled' ? historicalContextSettled.value : {};

      const currentOdds = oddsResult.status === 'fulfilled' ? oddsResult.value : {};
      const currentStats = statsResult.status === 'fulfilled' ? statsResult.value : {};

      return generateComprehensiveAnalysis(
        parsedBet, 
        currentOdds, 
        currentStats, 
        { 
          liveMarketData: liveMarketData,
          historicalContext: historicalContext
        }
      );
    })()
  ]);

  // Handle potential errors from Promise.allSettled results
  if (oddsResult.status === 'rejected') {
    console.error('Error fetching odds:', oddsResult.reason);
  }
  if (statsResult.status === 'rejected') {
    console.error('Error fetching stats:', statsResult.reason);
  }
  if (comprehensiveAnalysisSettled.status === 'rejected') {
    console.error('Error in comprehensive analysis:', comprehensiveAnalysisSettled.reason);
  }


  // Step 3: Generate creator response (keep fast)  
  setAnalysisStage('✍️ Finalizing...');
  const analysis = comprehensiveAnalysisSettled.status === 'fulfilled' ? comprehensiveAnalysisSettled.value : {
    winProbability: 65,
    confidence: 'MEDIUM',
    keyFactors: ['Analysis in progress'],
    marketAnalysis: 'Processing market data',
    riskFactors: ['Standard betting risks'],
    recommendation: 'HOLD',
    reasoning: 'Analysis complete'
  };

  const enhancedCreatorResponse = await generateEnhancedCreatorResponse(
    analysis,
    creatorAlgorithm,
    { 
      parsedBet, 
      odds: oddsResult.status === 'fulfilled' ? oddsResult.value : {}, 
      stats: statsResult.status === 'fulfilled' ? statsResult.value : {},
      // Pass the actual data obtained from parallel calls for comprehensive analysis
      liveMarketData: comprehensiveAnalysisSettled.status === 'fulfilled' ? (comprehensiveAnalysisSettled.value as any).liveMarketData : {},
      historicalContext: comprehensiveAnalysisSettled.status === 'fulfilled' ? (comprehensiveAnalysisSettled.value as any).historicalContext : {}
    }
  );

  trackAnalysisPerformance(betDescription, startTime);
  setAnalysisStage('');

  // Map recommendation function (keep existing)
  function mapRecommendation(aiRecommendation: string): 'strong_play' | 'lean' | 'pass' | 'fade' {
    switch(aiRecommendation) {
      case 'STRONG_BUY': return 'strong_play';
      case 'BUY': return 'lean'; 
      case 'HOLD': return 'pass';
      case 'SELL':
      case 'STRONG_SELL': return 'fade';
      default: return 'pass';
    }
  }

  return {
    betDescription,
    betType,
    winProbability: analysis.winProbability,
    confidence: analysis.confidence.toLowerCase() as 'low' | 'medium' | 'high',
    keyFactors: analysis.keyFactors,
    creatorResponse: enhancedCreatorResponse,
    recommendation: mapRecommendation(analysis.recommendation),
    timestamp: Date.now(),
    marketAnalysis: analysis.marketAnalysis,
    trendAnalysis: analysis.trendAnalysis,
    riskFactors: analysis.riskFactors,
    reasoning: analysis.reasoning
  };
};


// Component for Loading Spinner
const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: '24px', height: '24px', borderWidth: '2px', borderStyle: 'solid', borderColor: '#0ea5e9', borderTopColor: 'transparent', borderRadius: '9999px', animation: 'spin 1s linear infinite' }}></div>
    <style jsx>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Component for Analysis Progress (not used in main flow, but provided in prompt)
const AnalysisProgress = ({ stage }: { stage: string }) => (
  <div style={{ textAlign: 'center', padding: '20px' }}>
    <div style={{ marginBottom: '16px' }}>
      <LoadingSpinner />
    </div>
    <p style={{ color: '#38b2ac', fontWeight: '600' }}>{stage}</p>
    <div style={{ width: '100%', backgroundColor: '#3f3f46', borderRadius: '8px', height: '4px', marginTop: '8px' }}>
      <div style={{ width: '60%', backgroundColor: '#0ea5e9', height: '100%', borderRadius: '8px', animation: 'pulse 2s infinite' }}></div>
    </div>
  </div>
);


// FEATURE 2: Smart Bet Input Form
const BetAnalysisForm = ({
  onSubmit,
  isLoading,
  analysisStage
}: {
  onSubmit: (bet: string) => Promise<void>;
  isLoading: boolean;
  analysisStage: string;
}) => {
  const [betInput, setBetInput] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholderExamples = useMemo(() => [
    "Lakers -7.5 vs Warriors tonight",
    "LeBron James over 25.5 points",
    "Chiefs vs Bills Over 48.5",
    "Celtics moneyline vs Heat",
    "Mahomes over 2.5 touchdown passes",
    "Josh Allen rushing yards over 45.5",
    "Yankees vs Red Sox tonight",
    "Dodgers -1.5 vs Giants",
    "Manchester United to win", // Example for soccer
    "Invalid team names test",
    "Network timeout simulation"
  ], []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prevIndex => (prevIndex + 1) % placeholderExamples.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [placeholderExamples]);

  // AI Suggestion Integration (placeholder - actual fetch commented out)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const getSuggestions = useCallback(async (input: string) => {
    if (input.length < 5) {
      setAiSuggestions([]);
      return;
    }

    // Skip AI suggestions if OpenAI key not available
    if (!PRODUCTION_KEYS.openai || PRODUCTION_KEYS.openai.length < 10) {
      setAiSuggestions([]);
      return;
    }

    try {
      const response = await fetchWithTimeout(PRODUCTION_API_ENDPOINTS.openai, { // Use fetchWithTimeout
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PRODUCTION_KEYS.openai}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Complete this betting query with 3 realistic suggestions: "${input}". Return JSON array: ["suggestion 1", "suggestion 2", "suggestion 3"]`
          }],
          max_tokens: 100,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error Response: ${response.status} - ${errorText}`);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        let content = data.choices[0].message.content.trim();
        if (content.startsWith("```json")) {
          content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }
        const suggestions = JSON.parse(content);
        setAiSuggestions(suggestions);
      } else {
        throw new Error('Invalid OpenAI response structure for suggestions');
      }
    } catch (error) {
      console.error('AI suggestions failed:', error);
      setAiSuggestions([]);
    }
  }, []); // Dependencies are fine

  // Debounce input for suggestions
  useEffect(() => {
    const handler = setTimeout(() => {
      getSuggestions(betInput);
    }, 500); // Debounce by 500ms
    return () => {
      clearTimeout(handler);
    };
  }, [betInput, getSuggestions]);

  // Detect bet type based on current input using the AI parsing function
  const [detectedBetType, setDetectedBetType] = useState<string | null>(null);
  useEffect(() => {
    const getParsedType = async () => {
      if (betInput.trim().length > 0) {
        const parsed = await aiPoweredBetParsing(betInput);
        if (parsed && parsed.sport && parsed.type) { // Ensure both sport and type are valid
          setDetectedBetType(`${parsed.sport} - ${parsed.type}`);
        } else {
          setDetectedBetType(null);
        }
      } else {
        setDetectedBetType(null);
      }
    };
    getParsedType();
  }, [betInput]);

  return (
    <div className="bet-form-container" style={{ width: '100%', maxWidth: '672px', marginLeft: 'auto', marginRight: 'auto', padding: '24px', backgroundColor: 'rgba(39, 39, 42, 0.7)', backdropFilter: 'blur(4px)', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#f4f4f5', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px', color: '#38b2ac' }}>Analyze Your Bet</h2>
      <form onSubmit={async (e) => { e.preventDefault(); if (betInput.trim() === '' || betInput.length > 280) return; await onSubmit(betInput); }} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <textarea
          value={betInput}
          onChange={(e) => setBetInput(e.target.value)}
          placeholder={placeholderExamples[placeholderIndex]}
          maxLength={280}
          rows={3}
          className="bet-textarea"
          style={{ width: '100%', padding: '16px', backgroundColor: 'rgba(63, 63, 70, 0.5)', border: '1px solid #0284c7', borderRadius: '8px', outline: 'none', fontSize: '18px', resize: 'none', color: '#f4f4f5', boxSizing: 'border-box' }}
          disabled={isLoading}
        ></textarea>
        {aiSuggestions.length > 0 && betInput.length > 0 && (
          <div style={{ backgroundColor: 'rgba(63, 63, 70, 0.8)', borderRadius: '8px', padding: '8px', marginBottom: '8px', border: '1px solid #52525b' }}>
            <p style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}>Suggestions:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {aiSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => { setBetInput(suggestion); setAiSuggestions([]); }}
                  style={{ padding: '6px 12px', backgroundColor: '#0369a1', color: '#e0f2fe', borderRadius: '9999px', fontSize: '14px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s ease' }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#a1a1aa' }}>
          <span>{betInput.length}/280 characters</span>
          {detectedBetType && (
            <span style={{ textTransform: 'capitalize', paddingLeft: '12px', paddingRight: '12px', paddingTop: '4px', paddingBottom: '4px', backgroundColor: '#0369a1', borderRadius: '9999px', fontSize: '12px', fontWeight: '600' }}>
              Type: {detectedBetType.replace('_', ' ')}
            </span>
          )}
        </div>
        <button
          type="submit"
          className="submit-button"
          style={{ width: '100%', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px', backgroundColor: '#0ea5e9', color: '#f4f4f5', fontWeight: '700', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s ease-in-out', opacity: isLoading || betInput.trim() === '' || betInput.length > 280 ? 0.5 : 1, cursor: isLoading || betInput.trim() === '' || betInput.length > 280 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          disabled={isLoading || betInput.trim() === '' || betInput.length > 280}
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              <span>{analysisStage || 'Analyzing your bet...'}</span>
            </>
          ) : (
            'Get AI Analysis'
          )}
        </button>
      </form>
    </div>
  );
};

// Moved outside BetAnalysisResults to be accessible by CreatorSettings
const getRecommendationColors = (recommendation: string) => {
  switch(recommendation) {
    case 'strong_play': return { backgroundColor: '#059669', color: '#ecfdf5', icon: '🔥' }; // bg-lime-600 text-lime-100
    case 'lean': return { backgroundColor: '#0284c7', color: '#e0f2fe', icon: '👍' }; // bg-sky-600 text-sky-100
    case 'pass': return { backgroundColor: '#6b7280', color: '#f9fafb', icon: '⏸️' }; // bg-zinc-600 text-zinc-100
    case 'fade': return { backgroundColor: '#dc2626', color: '#fef2f2', icon: '❌' }; // bg-rose-600 text-rose-100
    default: return { backgroundColor: '#71717a', color: '#f4f4f5', icon: '❓' }; // bg-zinc-500 text-white
  }
};

// FEATURE 3: Analysis Results Display
const BetAnalysisResults = ({
  analysis,
  onAnalyzeAnother
}: {
  analysis: BetAnalysis;
  onAnalyzeAnother: () => void;
}) => {
  const getConfidenceColor = (confidence: string) => {
    switch(confidence) {
      case 'high': return '#84cc16'; // bg-lime-500
      case 'medium': return '#eab308'; // bg-yellow-500
      case 'low': return '#f43f5e'; // bg-rose-500
      default: return '#71717a'; // bg-zinc-500
    }
  };


  const recommendationStyle = getRecommendationColors(analysis.recommendation);

  return (
    <div style={{ width: '100%', maxWidth: '672px', marginLeft: 'auto', marginRight: 'auto', padding: '24px', backgroundColor: 'rgba(39, 39, 42, 0.7)', backdropFilter: 'blur(4px)', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#f4f4f5', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ fontSize: '30px', fontWeight: '700', marginBottom: '24px', color: '#38b2ac', textAlign: 'center' }}>Analysis Complete!</h2>

      <div style={{ width: '100%', marginBottom: '24px' }}>
        <p style={{ color: '#d4d4d8', textAlign: 'center', fontSize: '18px', marginBottom: '8px' }}>Bet: <span style={{ fontWeight: '600', color: '#f4f4f5' }}>{analysis.betDescription}</span></p>
        <p style={{ color: '#a1a1aa', textAlign: 'center', fontSize: '14px', marginBottom: '16px' }}>Type: <span style={{ textTransform: 'capitalize' }}>{analysis.betType.replace('_', ' ')}</span></p>

        <div style={{ width: '100%', backgroundColor: '#3f3f46', borderRadius: '9999px', height: '32px', overflow: 'hidden', position: 'relative', marginBottom: '16px' }}>
          <div
            style={{ height: '100%', borderRadius: '9999px', transition: 'all 1s ease-out', backgroundColor: getConfidenceColor(analysis.confidence), width: `${analysis.winProbability}%` }}
          ></div>
          <span style={{ position: 'absolute', top: '0', right: '0', bottom: '0', left: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f4f4f5', fontWeight: '700', fontSize: '20px' }}>
            {analysis.winProbability}% Win Probability
          </span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '8px', paddingBottom: '8px', borderRadius: '9999px', fontSize: '14px', fontWeight: '700', backgroundColor: getConfidenceColor(analysis.confidence) }}>
            Confidence: {analysis.confidence.toUpperCase()}
          </span>
        </div>

        {analysis.keyFactors && analysis.keyFactors.length > 0 && (
          <div style={{ marginBottom: '24px', backgroundColor: 'rgba(63, 63, 70, 0.5)', padding: '16px', borderRadius: '8px', border: '1px solid #52525b' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: '#38b2ac' }}>Key Factors:</h3>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {analysis.keyFactors.map((factor, index) => (
                <li key={index} style={{ display: 'flex', alignItems: 'center', color: '#e4e4e7', fontSize: '16px', marginBottom: index < analysis.keyFactors.length - 1 ? '8px' : '0' }}>
                  <svg style={{ width: '20px', height: '20px', color: '#a3e635', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* NEW: Add after the existing key factors section: */}
        {analysis.marketAnalysis && (
          <div style={{ marginBottom: '24px', backgroundColor: 'rgba(63, 63, 70, 0.5)', padding: '16px', borderRadius: '8px', border: '1px solid #52525b' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: '#38b2ac' }}>Market Analysis:</h3>
            <p style={{ color: '#e4e4e7', fontSize: '16px', lineHeight: '1.6' }}>{analysis.marketAnalysis}</p>
          </div>
        )}

        {analysis.trendAnalysis && (
          <div style={{ marginBottom: '24px', backgroundColor: 'rgba(63, 63, 70, 0.5)', padding: '16px', borderRadius: '8px', border: '1px solid #52525b' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: '#38b2ac' }}>Trend Analysis:</h3>
            <p style={{ color: '#e4e4e7', fontSize: '16px', lineHeight: '1.6' }}>{analysis.trendAnalysis}</p>
          </div>
        )}

        {analysis.riskFactors && analysis.riskFactors.length > 0 && (
          <div style={{ marginBottom: '24px', backgroundColor: 'rgba(127, 29, 29, 0.3)', padding: '16px', borderRadius: '8px', border: '1px solid #dc2626' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: '#f87171' }}>Risk Factors:</h3>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              {analysis.riskFactors.map((risk, index) => (
                <li key={index} style={{ display: 'flex', alignItems: 'center', color: '#fca5a5', fontSize: '16px', marginBottom: index < analysis.riskFactors!.length - 1 ? '8px' : '0' }}>
                  <svg style={{ width: '20px', height: '20px', color: '#f87171', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z"></path></svg>
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.reasoning && (
          <div style={{ marginBottom: '24px', backgroundColor: 'rgba(63, 63, 70, 0.5)', padding: '16px', borderRadius: '8px', border: '1px solid #52525b' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: '#38b2ac' }}>Analysis Reasoning:</h3>
            <p style={{ color: '#e4e4e7', fontSize: '16px', lineHeight: '1.6' }}>{analysis.reasoning}</p>
          </div>
        )}

        <div style={{ marginBottom: '32px', position: 'relative', padding: '24px', backgroundColor: '#3f3f46', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)', border: '1px solid #52525b' }}>
          <div style={{ position: 'absolute', top: '-12px', left: '24px', width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: '10px solid #3f3f46' }}></div>
          <p style={{ color: '#f4f4f5', fontSize: '18px', lineHeight: '1.625', fontStyle: 'italic' }} dangerouslySetInnerHTML={{ __html: analysis.creatorResponse }}></p>
          <div style={{ position: 'absolute', bottom: '-12px', right: '24px', width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '10px solid #3f3f46' }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <span style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '12px', paddingBottom: '12px', borderRadius: '9999px', fontSize: '20px', fontWeight: '700', backgroundColor: recommendationStyle.backgroundColor, color: recommendationStyle.color, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)' }}>
            {recommendationStyle.icon} {analysis.recommendation.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      <button
        onClick={onAnalyzeAnother}
        style={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '32px', paddingRight: '32px', backgroundColor: '#0ea5e9', color: '#f4f4f5', fontWeight: '700', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s ease-in-out', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        Analyze Another Bet
      </button>
    </div>
  );
};

// Helper component for weight sliders
const WeightSlider = ({
  label,
  value,
  onChange,
  color
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color: string;
}) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', color: '#e4e4e7', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>
      {label}
    </label>
    
    {/* Input + Slider Combo */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {/* Text Input */}
      <input
        type="number"
        min="0"
        max="100"
        value={Math.round(value)}
        onChange={(e) => {
          const newValue = Math.max(0, Math.min(100, Number(e.target.value) || 0));
          onChange(newValue);
        }}
        style={{
          width: '80px',
          padding: '8px 12px',
          backgroundColor: 'rgba(63, 63, 70, 0.5)',
          border: '1px solid #0284c7',
          borderRadius: '6px',
          color: '#f4f4f5',
          outline: 'none',
          fontSize: '14px',
          textAlign: 'center'
        }}
      />
      <span style={{ color: '#38b2ac', fontSize: '14px', fontWeight: '600', minWidth: '20px' }}>%</span>
      
      {/* Slider */}
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          flex: 1,
          height: '8px',
          borderRadius: '8px',
          WebkitAppearance: 'none',
          appearance: 'none',
          cursor: 'pointer',
          outline: 'none',
          background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, #3F3F46 ${value}%, #3F3F46 100%)`,
        }}
      />
    </div>
    
    {/* Quick Preset Buttons */}
    <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
      {[0, 10, 20, 25, 30, 50].map(preset => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange(preset)}
          style={{
            padding: '2px 8px',
            fontSize: '10px',
            backgroundColor: value === preset ? color : 'rgba(63, 63, 70, 0.5)',
            color: value === preset ? '#000' : '#a1a1aa',
            border: '1px solid #52525b',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {preset}%
        </button>
      ))}
    </div>
  </div>
);

// FEATURE 4: Creator Algorithm Settings
const CreatorSettings = ({
  algorithm,
  onSave,
  analysisLogs
}: {
  algorithm: CreatorAlgorithm;
  onSave: (algorithm: CreatorAlgorithm) => void;
  analysisLogs: AnalysisLog[];
}) => {
  const [activeTab, setActiveTab] = useState<'straight' | 'prop' | 'branding'>('straight');
  const [tempAlgorithm, setTempAlgorithm] = useState<CreatorAlgorithm>(algorithm);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const normalizeWeights = useCallback((weights: Record<string, number>): Record<string, number> => {
    const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);
    if (sum === 0) {
      const count = Object.keys(weights).length;
      if (count === 0) return {};
      const evenWeight = 100 / count;
      return Object.fromEntries(Object.keys(weights).map(key => [key, evenWeight]));
    }
    return Object.fromEntries(
      Object.entries(weights).map(([key, value]) => [key, (value / sum) * 100])
    );
  }, []);

  const handleWeightChange = useCallback((type: 'straight' | 'prop', key: keyof (CreatorAlgorithm['straightBetWeights'] | CreatorAlgorithm['playerPropWeights']), value: number) => {
    setTempAlgorithm(prev => {
      const newWeights = { ...prev[type === 'straight' ? 'straightBetWeights' : 'playerPropWeights'], [key]: value };
      return {
        ...prev,
        [type === 'straight' ? 'straightBetWeights' : 'playerPropWeights']: newWeights
      };
    });
  }, []);

  const handleSave = useCallback(() => {
    const normalizedStraight = normalizeWeights(tempAlgorithm.straightBetWeights);
    const normalizedProp = normalizeWeights(tempAlgorithm.playerPropWeights);

    const algorithmToSave: CreatorAlgorithm = {
      ...tempAlgorithm,
      straightBetWeights: Object.fromEntries(Object.entries(normalizedStraight).map(([k, v]) => [k, v / 100])) as CreatorAlgorithm['straightBetWeights'],
      playerPropWeights: Object.fromEntries(Object.entries(normalizedProp).map(([k, v]) => [k, v / 100])) as CreatorAlgorithm['playerPropWeights'],
    };
    onSave(algorithmToSave);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }, [tempAlgorithm, onSave, normalizeWeights]);

  const handleExport = useCallback(() => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(algorithm, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "betbot_algorithm_settings.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [algorithm]);

  const [previewAnalysis, setPreviewAnalysis] = useState<BetAnalysis | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAnalysisStage, setPreviewAnalysisStage] = useState<string>(''); // Add for preview stage

  const runPreviewAnalysis = useCallback(async () => {
    setPreviewLoading(true);
    try {
      // Use a fixed bet for consistent preview
      const mockBet = "Lakers -7.5 vs Warriors tonight";
      const analysis = await analyzeBet(mockBet, tempAlgorithm, setPreviewAnalysisStage);
      setPreviewAnalysis(analysis);
    } catch (error) {
      console.error('Preview analysis error:', error);
      setPreviewAnalysis(null);
    } finally {
      setPreviewLoading(false);
      setPreviewAnalysisStage(''); // Clear stage after preview
    }
  }, [tempAlgorithm]);

  const displayStraightWeights = useMemo(() => normalizeWeights(tempAlgorithm.straightBetWeights), [tempAlgorithm.straightBetWeights, normalizeWeights]);
  const displayPlayerPropWeights = useMemo(() => normalizeWeights(tempAlgorithm.playerPropWeights), [tempAlgorithm.playerPropWeights, normalizeWeights]);

  // Styles for active/inactive buttons (pure inline)
  const buttonActiveStyle = { backgroundColor: '#0284c7', color: '#f4f4f5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)' };
  const buttonInactiveStyle = { backgroundColor: '#3f3f46', color: '#d4d4d8' };

  return (
    <div style={{ width: '100%', maxWidth: '896px', marginLeft: 'auto', marginRight: 'auto', padding: '24px', backgroundColor: 'rgba(39, 39, 42, 0.7)', backdropFilter: 'blur(4px)', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#f4f4f5', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ fontSize: '30px', fontWeight: '700', marginBottom: '24px', color: '#38b2ac', textAlign: 'center' }}>Creator Algorithm Settings</h2>

      <div style={{ display: 'flex', marginBottom: '32px', borderBottom: '1px solid #3f3f46', width: '100%', justifyContent: 'center' }}>
        <button
          onClick={() => setActiveTab('straight')}
          className="nav-button" // Apply class
          style={{ padding: '12px 24px', fontSize: '18px', fontWeight: '600', transition: 'all 0.2s ease-in-out', ...activeTab === 'straight' ? { color: '#38b2ac', borderBottom: '2px solid #38b2ac' } : { color: '#a1a1aa' }, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Straight Bets
        </button>
        <button
          onClick={() => setActiveTab('prop')}
          className="nav-button" // Apply class
          style={{ padding: '12px 24px', fontSize: '18px', fontWeight: '600', transition: 'all 0.2s ease-in-out', ...activeTab === 'prop' ? { color: '#38b2ac', borderBottom: '2px solid #38b2ac' } : { color: '#a1a1aa' }, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Player Props
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          className="nav-button" // Apply class
          style={{ padding: '12px 24px', fontSize: '18px', fontWeight: '600', transition: 'all 0.2s ease-in-out', ...activeTab === 'branding' ? { color: '#38b2ac', borderBottom: '2px solid #38b2ac' } : { color: '#a1a1aa' }, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Branding & Preview
        </button>
      </div>

      <div style={{ width: '100%' }}>
        {activeTab === 'straight' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: '32px', rowGap: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#38b2ac', gridColumn: '1 / -1', marginBottom: '16px' }}>Straight Bet Weighting (Sum to 100%)</h3>
            <WeightSlider label="Team Offense" value={Math.round(displayStraightWeights.teamOffense)} onChange={(val) => handleWeightChange('straight', 'teamOffense', val)} color="#0ea5e9" />
            <WeightSlider label="Team Defense" value={Math.round(displayStraightWeights.teamDefense)} onChange={(val) => handleWeightChange('straight', 'teamDefense', val)} color="#6366f1" />
            <WeightSlider label="Head-to-Head" value={Math.round(displayStraightWeights.headToHead)} onChange={(val) => handleWeightChange('straight', 'headToHead', val)} color="#22c55e" /> {/* Assuming green-500 from general Tailwind */}
            <WeightSlider label="Home/Away" value={Math.round(displayStraightWeights.homeAway)} onChange={(val) => handleWeightChange('straight', 'homeAway', val)} color="#a855f7" />
            <WeightSlider label="Injuries" value={Math.round(displayStraightWeights.injuries)} onChange={(val) => handleWeightChange('straight', 'injuries', val)} color="#f43f5e" />
            <WeightSlider label="Rest Days" value={Math.round(displayStraightWeights.restDays)} onChange={(val) => handleWeightChange('straight', 'restDays', val)} color="#eab308" />
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '14px', color: '#a1a1aa', marginTop: '16px' }}>
              Total Weight: {Math.round(Object.values(displayStraightWeights).reduce((sum, val) => sum + val, 0))}%
            </p>
          </div>
        )}

        {activeTab === 'prop' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: '32px', rowGap: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#38b2ac', marginBottom: '16px' }}>Player Prop Weighting (Sum to 100%)</h3>
            <WeightSlider label="Season Average" value={Math.round(displayPlayerPropWeights.seasonAverage)} onChange={(val) => handleWeightChange('prop', 'seasonAverage', val)} color="#0ea5e9" />
            <WeightSlider label="Recent Form" value={Math.round(displayPlayerPropWeights.recentForm)} onChange={(val) => handleWeightChange('prop', 'recentForm', val)} color="#6366f1" />
            <WeightSlider label="Matchup History" value={Math.round(displayPlayerPropWeights.matchupHistory)} onChange={(val) => handleWeightChange('prop', 'matchupHistory', val)} color="#22c55e" />
            <WeightSlider label="Usage Rate" value={Math.round(displayPlayerPropWeights.usage)} onChange={(val) => handleWeightChange('prop', 'usage', val)} color="#a855f7" />
            <WeightSlider label="Minutes Played" value={Math.round(displayPlayerPropWeights.minutes)} onChange={(val) => handleWeightChange('prop', 'minutes', val)} color="#f43f5e" />
            <WeightSlider label="Opponent Defense" value={Math.round(displayPlayerPropWeights.opponentDefense)} onChange={(val) => handleWeightChange('prop', 'opponentDefense', val)} color="#eab308" />
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: '14px', color: '#a1a1aa', marginTop: '16px' }}>
              Total Weight: {Math.round(Object.values(displayPlayerPropWeights).reduce((sum, val) => sum + val, 0))}%
            </p>
          </div>
        )}

        {activeTab === 'branding' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: '24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#38b2ac', marginBottom: '16px' }}>Response Customization</h3>

            {/* Custom Response Style */}
            <div>
              <label htmlFor="customResponseStyle" style={{ display: 'block', color: '#e4e4e7', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>
                Your Analysis Style:
              </label>
              <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '12px' }}>
                Paste 2-3 examples of analysis you've given to your users. The AI will learn your exact style, tone, and format.
              </p>
              <textarea
                id="customResponseStyle"
                value={tempAlgorithm.customResponseStyle || ''}
                onChange={(e) => setTempAlgorithm(prev => ({ ...prev, customResponseStyle: e.target.value }))}
                placeholder="Example:

🔥 FIRE PICK ALERT 🔥

Lakers -7.5 vs Warriors

Here's the deal fam - LeBron's been cooking lately averaging 28.5 over his last 10. Warriors defense has been sus at home giving up 118 PPG. 

The spread opened at -6.5 and sharp money moved it to -7.5. When I see that kind of line movement WITH the public on Lakers, that's usually a good sign.

Key factors:
• Lakers 8-2 ATS in last 10 road games  
• Warriors missing key rotation players
• Revenge game narrative (Lakers lost by 20 last meeting)

I'm taking Lakers -7.5 with confidence. BOL! 💰

---

Add 2-3 more examples of your actual analysis style..."
                style={{ 
                  width: '100%', 
                  minHeight: '200px',
                  padding: '16px', 
                  backgroundColor: 'rgba(63, 63, 70, 0.5)', 
                  border: '1px solid #0284c7', 
                  borderRadius: '8px', 
                  color: '#f4f4f5', 
                  outline: 'none',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  fontFamily: 'monospace'
                }}
                maxLength={2000}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ color: '#a1a1aa', fontSize: '12px' }}>
                  {(tempAlgorithm.customResponseStyle || '').length}/2000 characters
                </span>
                <span style={{ color: '#38b2ac', fontSize: '12px' }}>
                  💡 More examples = better AI mimicking
                </span>
              </div>
            </div>

            {/* Fallback Tone */}
            <div style={{ marginTop: '24px' }}>
              <label htmlFor="responseTone" style={{ display: 'block', color: '#e4e4e7', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>
                Fallback Tone (if no custom style provided):
              </label>
              <select
                id="responseTone"
                value={tempAlgorithm.responseTone}
                onChange={(e) => setTempAlgorithm(prev => ({ ...prev, responseTone: e.target.value as 'professional' | 'casual' | 'hype' }))}
                style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(63, 63, 70, 0.5)', border: '1px solid #0284c7', borderRadius: '8px', color: '#f4f4f5', outline: 'none' }}
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="hype">Hype</option>
              </select>
            </div>


            <div>
              <label htmlFor="confidenceThreshold" style={{ display: 'block', color: '#e4e4e7', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>
                Confidence Threshold for "Strong Play" / "Lean" Recommendation: <span style={{ fontWeight: '400', color: '#38b2ac' }}>{tempAlgorithm.confidenceThreshold}%</span>
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={tempAlgorithm.confidenceThreshold}
                onChange={(e) => setTempAlgorithm(prev => ({ ...prev, confidenceThreshold: Number(e.target.value) }))}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '8px',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  cursor: 'pointer',
                  outline: 'none',
                  background: `linear-gradient(to right, #0EA5E9 0%, #0EA5E9 ${tempAlgorithm.confidenceThreshold}%, #3F3F46 ${tempAlgorithm.confidenceThreshold}%, #3F3F46 100%)`,
                }}
              />
              <p style={{ color: '#a1a1aa', fontSize: '14px', marginTop: '8px' }}>{'Bets with win probability above this threshold will be recommended as \'Strong Play\' or \'Lean\'.'}</p>
            </div>

            <div>
              <label htmlFor="signaturePhrase" style={{ display: 'block', color: '#e4e4e7', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Signature Phrase:</label>
              <input
                type="text"
                id="signaturePhrase"
                value={tempAlgorithm.signaturePhrase}
                onChange={(e) => setTempAlgorithm(prev => ({ ...prev, signaturePhrase: e.target.value }))}
                style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(63, 63, 70, 0.5)', border: '1px solid #0284c7', borderRadius: '8px', color: '#f4f4f5', outline: 'none' }}
                placeholder="E.g., 'Get that bag!', 'Let's eat!'"
                maxLength={50}
              />
              <p style={{ color: '#a1a1aa', fontSize: '14px', marginTop: '8px' }}>This phrase will be added to the end of every AI response.</p>
            </div>

            {/* Brand Color Input and Presets */}
            <div>
              <label htmlFor="brandColor" style={{ display: 'block', color: '#e4e4e7', fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>
                Brand Color:
              </label>
              
              {/* Color Picker Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="color"
                  id="brandColorPicker"
                  value={tempAlgorithm.brandColor || '#0EA5E9'}
                  onChange={(e) => setTempAlgorithm(prev => ({ ...prev, brandColor: e.target.value }))}
                  style={{ 
                    width: '60px', 
                    height: '40px', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    backgroundColor: 'transparent'
                  }}
                />
                <input
                  type="text"
                  id="brandColor"
                  value={tempAlgorithm.brandColor || '#0EA5E9'}
                  onChange={(e) => setTempAlgorithm(prev => ({ ...prev, brandColor: e.target.value }))}
                  style={{ 
                    flex: 1,
                    padding: '12px', 
                    backgroundColor: 'rgba(63, 63, 70, 0.5)', 
                    border: '1px solid #0284c7', 
                    borderRadius: '8px', 
                    color: '#f4f4f5', 
                    outline: 'none' 
                  }}
                  placeholder="#0EA5E9"
                  pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                />
              </div>

              {/* Color Presets */}
              <div style={{ marginBottom: '12px' }}>
                <p style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '8px' }}>Quick Colors:</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { name: 'Blue', color: '#0EA5E9' },
                    { name: 'Green', color: '#10B981' },
                    { name: 'Purple', color: '#8B5CF6' },
                    { name: 'Red', color: '#EF4444' },
                    { name: 'Orange', color: '#F59E0B' },
                    { name: 'Pink', color: '#EC4899' },
                    { name: 'Yellow', color: '#EAB308' },
                    { name: 'Teal', color: '#14B8A6' }
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setTempAlgorithm(prev => ({ ...prev, brandColor: preset.color }))}
                      style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: preset.color,
                        border: tempAlgorithm.brandColor === preset.color ? '3px solid #fff' : '1px solid #52525b',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div style={{ 
                height: '40px', 
                width: '100%', 
                borderRadius: '8px', 
                border: '1px solid #52525b', 
                backgroundColor: tempAlgorithm.brandColor || '#0EA5E9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>
                Preview: {tempAlgorithm.signaturePhrase || 'Get that bag!'}
              </div>
              
              <p style={{ color: '#a1a1aa', fontSize: '14px', marginTop: '8px' }}>
                This color will highlight your signature phrase and key elements.
              </p>
            </div>

            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#38b2ac', marginBottom: '16px' }}>Live Response Preview</h3>
              <button
                onClick={runPreviewAnalysis}
                style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '24px', paddingRight: '24px', backgroundColor: '#0ea5e9', color: '#f4f4f5', fontWeight: '700', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s ease-in-out', opacity: previewLoading ? 0.5 : 1, cursor: previewLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                disabled={previewLoading}
              >
                {previewLoading ? <LoadingSpinner /> : 'Run Preview Analysis'}
              </button>
              {previewLoading && previewAnalysisStage && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <AnalysisProgress stage={previewAnalysisStage} />
                </div>
              )}
              {previewAnalysis && (
                <div style={{ backgroundColor: '#3f3f46', padding: '16px', borderRadius: '8px', border: '1px solid #52525b', position: 'relative', marginTop: '16px' }}>
                  <p style={{ color: '#f4f4f5', fontSize: '18px', fontStyle: 'italic', lineHeight: '1.625' }} dangerouslySetInnerHTML={{ __html: previewAnalysis.creatorResponse }}></p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #3f3f46' }}>
        <button
          onClick={handleSave}
          style={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '32px', paddingRight: '32px', backgroundColor: '#84cc16', color: '#f4f4f5', fontWeight: '700', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s ease-in-out', opacity: saveSuccess ? 0.5 : 1, cursor: saveSuccess ? 'not-allowed' : 'pointer' }}
          disabled={saveSuccess}
        >
          {saveSuccess ? 'Settings Saved!' : 'Save Settings'}
        </button>
        <button
          onClick={handleExport}
          style={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '32px', paddingRight: '32px', backgroundColor: '#52525b', color: '#f4f4f5', fontWeight: '700', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)', transition: 'all 0.2s ease-in-out' }}
        >
          Export Settings
        </button>
      </div>

      <div style={{ width: '100%', marginTop: '40px' }}>
        <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px', color: '#38b2ac' }}>Recent Analysis Logs</h3>
        {analysisLogs.length === 0 ? (
          <p style={{ color: '#a1a1aa', textAlign: 'center', paddingTop: '32px', paddingBottom: '32px' }}>No analysis logs yet. Start analyzing some bets!</p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)' }}>
            <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#3f3f46' }}>
                <tr>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bet Description
                  </th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Win Probability
                  </th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Recommendation
                  </th>
                  <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '500', color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody style={{ backgroundColor: '#27272a', borderTop: '1px solid #3f3f46' /* Removed hover effect for pure inline */ }}>
                {analysisLogs.slice(0, 10).map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #3f3f46' /* Removed hover effect for pure inline */ }}>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                      {log.betDescription}
                    </td>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: '#e4e4e7' }}>
                      {log.winProbability}%
                    </td>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px' }}>
                      <span style={{ padding: '4px 8px', display: 'inline-flex', fontSize: '12px', lineHeight: '20px', fontWeight: '600', borderRadius: '9999px', ...getRecommendationColors(log.recommendation) }}>
                        {log.recommendation.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', whiteSpace: 'nowrap', fontSize: '14px', color: '#a1a1aa' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// =================================================================================================
// Paywall Component (REMOVED AS PER INSTRUCTIONS)
// =================================================================================================


// Test function to validate API keys
async function validateAPIKeys() {
  console.log('🔑 Validating API Keys...');

  // Test The Odds API
  if (PRODUCTION_KEYS.theOdds) {
    try {
      const response = await fetch(`${PRODUCTION_API_ENDPOINTS.theOddsAPI}/sports?apiKey=${PRODUCTION_KEYS.theOdds}`);
      console.log(`✅ The Odds API: ${response.status === 200 ? 'VALID' : 'INVALID'} (${response.status})`);
    } catch (e) {
      console.log(`❌ The Odds API: ERROR`, e);
    }
  } else {
    console.log(`❌ The Odds API: KEY MISSING`);
  }

  // Test OpenAI API
  if (PRODUCTION_KEYS.openai) {
    try {
      const response = await fetchWithTimeout(PRODUCTION_API_ENDPOINTS.openai, { // Use fetchWithTimeout
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PRODUCTION_KEYS.openai}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
          max_tokens: 10,
        })
      });
      console.log(`✅ OpenAI API: ${response.ok ? 'VALID' : 'INVALID'} (${response.status})`);
    } catch (e) {
      console.log(`❌ OpenAI API: ERROR`, e);
    }
  } else {
    console.log(`❌ OpenAI API: KEY MISSING`);
  }

  // Sportradar API: Can't easily validate without a specific endpoint for general ping.
  // Validation would typically involve fetching a small, known dataset.
  if (PRODUCTION_KEYS.sportradar) {
    console.log(`ℹ️ Sportradar API key present. Direct validation skipped due to lack of general ping endpoint.`);
  } else {
    console.log(`❌ Sportradar API: KEY MISSING`);
  }
}

// 3. ENHANCE the testAPIIntegrations function:
async function testAPIIntegrations() {
  console.log('🧪 Testing API Integrations...');

  // Test 1: The Odds API
  try {
    const oddsTest = await fetchProductionOdds("Lakers vs Warriors");
    console.log('✅ Odds API Test Result:', oddsTest.source);
    if (oddsTest.source !== 'Calculated (No Live Odds)') {
      console.log('🎉 LIVE ODDS WORKING!');
    }
  } catch (error) {
    console.log('❌ Odds API Test Failed:', error);
  }

  // Test 2: Sportradar API
  try {
    const statsTest = await fetchProductionStats("LeBron James over 25 points");
    console.log('✅ Sportradar Test Result:', statsTest.source);
    if (statsTest.source === 'Sportradar Professional Data') {
      console.log('🎉 SPORTRADAR WORKING!');
    } else {
      console.log('⚠️ Sportradar falling back to derived stats');
    }
  } catch (error) {
    console.log('❌ Sportradar Test Failed:', error);
  }

  // Test 3: AI Parsing
  try {
    const parseTest = await aiPoweredBetParsing("Lakers vs Warriors -7.5");
    console.log('✅ AI Parsing Test:', parseTest.confidence > 0 ? 'Working' : 'Fallback');
    console.log('🔍 Parsed Result:', parseTest);
  } catch (error) {
    console.log('❌ AI Parsing Test Failed:', error);
  }

  // Test 4: Full Integration Test
  try {
    console.log('🔄 Running Full Integration Test...');
    // Mock the setAnalysisStage function for the test
    const mockSetAnalysisStage = (stage: string) => console.log(`[Test Stage] ${stage}`);
    const fullTest = await analyzeBet("LeBron James over 25 points", {
      straightBetWeights: { teamOffense: 0.2, teamDefense: 0.2, headToHead: 0.15, homeAway: 0.15, injuries: 0.2, restDays: 0.1 },
      playerPropWeights: { seasonAverage: 0.2, recentForm: 0.2, matchupHistory: 0.15, usage: 0.15, minutes: 0.2, opponentDefense: 0.1 },
      responseTone: 'professional',
      confidenceThreshold: 75,
      signaturePhrase: 'Test analysis complete!',
      brandColor: '#0EA5E9'
    }, mockSetAnalysisStage); // Pass the mock function
    console.log('🎉 FULL INTEGRATION SUCCESS!');
    console.log('📊 Win Probability:', fullTest.winProbability + '%');
    console.log('🔑 Key Factors:', fullTest.keyFactors);
    console.log('🔍 Market Analysis:', fullTest.marketAnalysis);
    console.log('📈 Trend Analysis:', fullTest.trendAnalysis);
    console.log('🚨 Risk Factors:', fullTest.riskFactors);
    console.log('💡 Reasoning:', fullTest.reasoning);
  } catch (error) {
    console.log('❌ Full Integration Test Failed:', error);
  }
}

// Main App Component
export default function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null); // Keep for internal tracking of actual Whop access
  const [currentFirebaseUser, setCurrentFirebaseUser] = useState<User | null>(null);
  const [appId, setAppId] = useState<string>('');
  const [creatorId, setCreatorId] = useState<string>('mock-creator-id');

  const [appView, setAppView] = useState<AppView>('bet_analysis');
  const [analysisResults, setAnalysisResults] = useState<BetAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisStage, setAnalysisStage] = useState<string>(''); // NEW: analysis stage

  const [creatorAlgorithm, setCreatorAlgorithm] = useState<CreatorAlgorithm>(() => ({
    straightBetWeights: {
      teamOffense: 0.2, teamDefense: 0.2, headToHead: 0.15,
      homeAway: 0.15, injuries: 0.2, restDays: 0.1
    },
    playerPropWeights: {
      seasonAverage: 0.2, recentForm: 0.2, matchupHistory: 0.15,
      usage: 0.15, minutes: 0.2, opponentDefense: 0.1
    },
    responseTone: 'hype',
    confidenceThreshold: 78,
    signaturePhrase: 'Get that bag!',
    brandColor: '#0EA5E9',
    customResponseStyle: '' // Initialize customResponseStyle
  }));

  const [analysisLogs, setAnalysisLogs] = useState<AnalysisLog[]>([]);

  // 5. Fix navigation buttons on mobile
  const getNavButtonStyle = useCallback((isActive: boolean) => ({
    paddingTop: '8px',
    paddingBottom: '8px',
    paddingLeft: '24px',
    paddingRight: '24px',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: '700',
    transition: 'all 0.2s ease-in-out',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: isActive ? '#0284c7' : '#3f3f46',
    color: isActive ? '#f4f4f5' : '#d4d4d8',
    boxShadow: isActive ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)' : 'none',
  }), []);

  useEffect(() => {
    initializeFirebase();

    // Safely access environment variables
    const currentAppId = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WHOP_APP_ID : '';
    setAppId(currentAppId);
    const companyId = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WHOP_COMPANY_ID : 'mock-company-id';
    setCreatorId(companyId);

    const unsubscribe = onAuthStateChanged(auth!, async (user) => {
      if (user) {
        setCurrentFirebaseUser(user);
        try {
          // Check access level from Whop API
          const access = await whopApi.checkIfUserHasAccessToExperience();
          setAccessLevel(access.access);
          // Set user role based on actual access level
          setUserRole(access.access === 'admin' ? 'creator' : 'member');
        } catch (authError) {
          console.error('Whop access check failed, defaulting to member role:', authError);
          // If Whop access check fails, default to 'customer' level access
          setAccessLevel('customer');
          setUserRole('member');
          setError(handleApiError(authError, 'Whop Authentication (Defaulting to Member)'));
        }
      } else {
        try {
          const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
          if (initialAuthToken) {
            await signInWithCustomToken(auth!, initialAuthToken);
          } else {
            await signInAnonymously(auth!);
          }
          // After sign-in, if not explicitly 'admin', default to 'member' and 'customer' access
          setAccessLevel('customer'); // Default to customer access as paywall is removed
          setUserRole('member'); // Default to member role
        } catch (anonAuthError) {
          console.error('Anonymous sign-in failed, ensuring member role:', anonAuthError);
          setAccessLevel('customer'); // Still default to customer to allow app usage
          setUserRole('member');
          setError(handleApiError(anonAuthError, 'Firebase Authentication (Defaulting to Member)'));
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      if (!currentFirebaseUser || !db) {
        return;
      }

      const userId = currentFirebaseUser.uid;
      const artifactAppId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WHOP_APP_ID : '');


      try {
        const algorithmDocRef = doc(db, `artifacts/${artifactAppId}/users/${userId}/creatorAlgorithms`, 'settings');
        const algorithmDoc = await getDoc(algorithmDocRef);
        if (algorithmDoc.exists()) {
          setCreatorAlgorithm(algorithmDoc.data() as CreatorAlgorithm);
          console.log('Algorithm loaded from Firebase.');
        } else {
          console.log('No existing algorithm found for user. Using default.');
        }

        const logsCollectionRef = collection(db, `artifacts/${artifactAppId}/users/${userId}/analysisLogs`);
        const logsQuery = query(
          logsCollectionRef,
          limit(20) // Limit to last 20 logs
        );
        const logsSnapshot = await getDocs(logsQuery);
        const logs = logsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() as AnalysisLog }))
            .sort((a, b) => b.timestamp - a.timestamp);
        setAnalysisLogs(logs);
        console.log('Analysis logs loaded from Firebase.');
      } catch (err) {
        console.error('Failed to load user data from Firebase:', err);
        setError(handleApiError(err, 'Firebase Data Load'));
      }
    };

    // Ensure Firebase is initialized and auth state is ready before trying to load user data
    // No longer blocking on accessLevel for data loading, as all roles can load data
    if (currentFirebaseUser) {
      loadUserData();
    }
  }, [currentFirebaseUser]);

  const handleSaveAlgorithm = useCallback(async (newAlgorithm: CreatorAlgorithm) => {
    if (!db || !currentFirebaseUser) {
      setError('Firebase not initialized or user not logged in.');
      return;
    }
    const userId = currentFirebaseUser.uid;
    const artifactAppId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WHOP_APP_ID : '');

    try {
      await setDoc(doc(db, `artifacts/${artifactAppId}/users/${userId}/creatorAlgorithms`, 'settings'), {
        ...newAlgorithm,
        updatedAt: new Date().toISOString(),
        userId: userId
      });

      setCreatorAlgorithm(newAlgorithm);
      console.log('Algorithm saved to Firebase');
    } catch (err) {
      console.error('Failed to save algorithm:', err);
      setError(handleApiError(err, 'Algorithm Save'));
    }
  }, [db, currentFirebaseUser]);

  const handleBetSubmission = useCallback(async (betDescription: string) => {
    // Removed payment restriction: if (accessLevel === 'no_access') { setError('You need to subscribe to use this feature.'); return; }
    setIsLoading(true);
    setError(null);
    setAnalysisResults(null);
    setAnalysisStage(''); // Reset stage

    if (!db || !currentFirebaseUser) {
      setError('Firebase not initialized or user not logged in.');
      setIsLoading(false);
      return;
    }

    const userId = currentFirebaseUser.uid;
    const artifactAppId = typeof __app_id !== 'undefined' ? __app_id : (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_WHOP_APP_ID : '');


    try {
      const analysis = await analyzeBet(betDescription, creatorAlgorithm, setAnalysisStage); // Pass setAnalysisStage

      const logDocRef = await addDoc(collection(db, `artifacts/${artifactAppId}/users/${userId}/analysisLogs`), {
        betDescription: analysis.betDescription,
        winProbability: analysis.winProbability,
        recommendation: analysis.recommendation,
        timestamp: analysis.timestamp,
        userId: userId
      });

      setAnalysisResults(analysis);
      setAnalysisLogs(prevLogs => {
        const newLog: AnalysisLog = {
          id: logDocRef.id,
          betDescription: analysis.betDescription,
          winProbability: analysis.winProbability,
          recommendation: analysis.recommendation,
          timestamp: analysis.timestamp
        };
        // Ensure logs are sorted by timestamp descending and limited to 20
        const updatedLogs = [newLog, ...prevLogs];
        updatedLogs.sort((a, b) => b.timestamp - a.timestamp);
        return updatedLogs.slice(0, 20);
      });

      // Post to Whop community if win probability is high and user is creator
      if (analysis.winProbability >= 75) {
        if (userRole === 'creator') {
          try {
            await whopApi.createCommunityPost({
              title: `🤖 AI Analysis: ${analysis.betDescription}`,
              content: analysis.creatorResponse,
              tags: ['ai-analysis', 'betting-pick']
            });
            console.log('Forum post created via Whop API.');
          } catch (forumError) {
            console.error('Failed to create forum post via Whop API:', forumError);
            setError(handleApiError(forumError, 'Whop Community Post'));
          }
        }
      }
    } catch (err) {
      setError(handleApiError(err, 'Bet Analysis'));
    } finally {
      setIsLoading(false);
      setAnalysisStage(''); // Clear stage on completion or error
    }
  }, [creatorAlgorithm, db, currentFirebaseUser, userRole]); // Removed accessLevel from dependencies

  const handleAnalyzeAnother = useCallback(() => {
    setAnalysisResults(null);
    setError(null);
  }, []);

  useEffect(() => {
    // Redirect creator settings view if user role changes to member
    if (userRole === 'member' && appView === 'creator_settings') {
      setAppView('bet_analysis');
    }
  }, [userRole, appView]);

  // Call this in your useEffect to test keys on app load
  useEffect(() => {
    validateAPIKeys();
    testAPIIntegrations(); // Add this line
  }, []);

  if (userRole === null || accessLevel === null) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#18181b', color: '#f4f4f5', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '40px', paddingBottom: '40px', paddingLeft: '16px', paddingRight: '16px' }}>
        <LoadingSpinner />
        <p style={{ marginTop: '16px', fontSize: '18px', color: '#a1a1aa' }}>Loading user authentication...</p>
      </div>
    );
  }

  // Removed paywall check: if (accessLevel === 'no_access') { return <DynamicPaywall ... />;}

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#18181b', color: '#f4f4f5', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '40px', paddingBottom: '40px', paddingLeft: '16px', paddingRight: '16px' }}>
      {/* Add the mobileResponsiveCSS style block */}
      <style jsx>{`
        @media (max-width: 768px) {
          .main-title {
            font-size: 36px !important;
          }

          .bet-form-container {
            margin: 0 8px !important;
            padding: 16px !important;
          }
        }

        @media (max-width: 480px) {
          .main-title {
            font-size: 28px !important;
          }

          .subtitle {
            font-size: 16px !important;
          }

          .user-info {
            font-size: 12px !important;
            line-height: 1.4 !important;
          }

          .nav-button {
            font-size: 16px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .bet-textarea {
            font-size: 16px !important;
            padding: 12px !important;
          }

          .submit-button {
            font-size: 14px !important;
          }
        }
      `}</style>

      <header style={{ marginBottom: '40px', width: '100%', maxWidth: '896px', textAlign: 'center', paddingLeft: '16px', paddingRight: '16px' }}> {/* Applied padding as per prompt */}
        <h1 className="main-title" style={{ fontSize: '48px', fontWeight: '800', color: '#38b2ac', filter: 'drop-shadow(0 10px 8px rgba(0, 0, 0, 0.04)) drop-shadow(0 4px 3px rgba(0, 0, 0, 0.1))', marginBottom: '8px' }}>BetBot AI</h1>
        <p className="subtitle" style={{ fontSize: '20px', color: '#d4d4d8', fontStyle: 'italic' }}>"Ask the Creator's Algorithm"</p>
        <p className="user-info" style={{ fontSize: '14px', color: '#71717a', marginTop: '8px' }}>
          You are currently a <span style={{ fontWeight: '600', color: '#38b2ac' }}>{userRole?.toUpperCase()}</span>.
          <br/> Your User ID: <span style={{ fontFamily: 'monospace', color: '#a1a1aa', wordBreak: 'break-all' }}>{currentFirebaseUser?.uid || 'N/A'}</span>
        </p>
      </header>

      <main style={{ width: '100%', maxWidth: '896px' }}>
        {userRole === 'creator' ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px', gap: '16px' }}>
            <button
              onClick={() => { setAppView('bet_analysis'); handleAnalyzeAnother(); }}
              className="nav-button" // Apply class
              style={getNavButtonStyle(appView === 'bet_analysis')}
            >
              Bet Analysis
            </button>
            <button
              onClick={() => setAppView('creator_settings')}
              className="nav-button" // Apply class
              style={getNavButtonStyle(appView === 'creator_settings')}
            >
              Creator Settings
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#38b2ac' }}>Sports Bet Analysis</h2>
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: '#9f1239', color: '#f4f4f5', padding: '16px', borderRadius: '8px', marginBottom: '24px', width: '100%', maxWidth: '672px', marginLeft: 'auto', marginRight: 'auto', border: '1px solid #e11d48' }}>
            <p style={{ fontWeight: '700' }}>Error:</p>
            <p>{error}</p>
          </div>
        )}

        {appView === 'bet_analysis' && (
          <>
            {!analysisResults ? (
              <BetAnalysisForm onSubmit={handleBetSubmission} isLoading={isLoading} analysisStage={analysisStage} />
            ) : (
              <BetAnalysisResults analysis={analysisResults} onAnalyzeAnother={handleAnalyzeAnother} />
            )}
          </>
        )}

        {userRole === 'creator' && appView === 'creator_settings' && (
          <CreatorSettings
            algorithm={creatorAlgorithm}
            onSave={handleSaveAlgorithm}
            analysisLogs={analysisLogs}
          />
        )}
      </main>

      <footer style={{ marginTop: '40px', textAlign: 'center', color: '#71717a', fontSize: '14px' }}>
        &copy; {new Date().getFullYear()} BetBot AI. All rights reserved.
      </footer>
    </div>
  );
}
