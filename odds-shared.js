import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_BASE = "https://api.the-odds-api.com/v4";

// Cache odds for 1 hour to avoid duplicate API calls
let oddsCache = null;
let cacheTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const SPORTS = [
  { key: "basketball_nba", label: "🏀 NBA" },
  { key: "americanfootball_nfl", label: "🏈 NFL" },
  { key: "baseball_mlb", label: "⚾ MLB" },
  { key: "icehockey_nhl", label: "🏒 NHL" },
  { key: "soccer_epl", label: "⚽ EPL" },
  { key: "soccer_uefa_champs_league", label: "⚽ Champions League" },
  { key: "soccer_spain_la_liga", label: "⚽ La Liga" },
  { key: "soccer_italy_serie_a", label: "⚽ Serie A" },
  { key: "basketball_euroleague", label: "🏀 EuroLeague" },
  { key: "mma_mixed_martial_arts", label: "🥊 MMA/UFC" },
];

function isGameSoon(commenceTime) {
  const now = new Date();
  const game = new Date(commenceTime);
  const twoDays = new Date(now);
  twoDays.setDate(twoDays.getDate() + 2);
  return game >= now && game <= twoDays;
}

export async function getSharedOdds(sportsFilter = null) {
  // Return cache if fresh
  if (oddsCache && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
    console.log("📦 Using cached odds");
    return oddsCache;
  }

  const sportsToFetch = sportsFilter || SPORTS;
  const results = [];

  for (const sport of sportsToFetch) {
    try {
      const url = new URL(ODDS_BASE + "/sports/" + sport.key + "/odds");
      url.searchParams.set("apiKey", ODDS_API_KEY);
      url.searchParams.set("regions", "us,uk,eu");
      url.searchParams.set("markets", "h2h,spreads,totals");
      url.searchParams.set("bookmakers", "draftkings,fanduel");
      url.searchParams.set("oddsFormat", "american");
      url.searchParams.set("dateFormat", "iso");

      const res = await fetch(url.toString());
      if (!res.ok) {
        console.warn("⚠️ Odds error " + sport.key + ": " + res.status);
        continue;
      }
      const games = await res.json();
      if (Array.isArray(games) && games.length > 0) {
        const filtered = games.filter(g => isGameSoon(g.commence_time));
        if (filtered.length > 0) {
          results.push({ ...sport, games: filtered });
          console.log("✅ " + sport.label + ": " + filtered.length + " games");
        }
      }
    } catch(e) {
      console.warn("⚠️ Failed " + sport.key + ": " + e.message);
    }
  }

  // Cache the results
  oddsCache = results;
  cacheTime = Date.now();

  return results;
}

export function formatOddsText(sportsData) {
  let text = "";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York"
  });
  text += "Today is " + today + ".\n\n";
  text += "Available games with DraftKings/FanDuel odds:\n\n";

  for (const sport of sportsData) {
    text += "=== " + sport.label + " ===\n";
    for (const game of sport.games.slice(0, 6)) {
      const gameTime = new Date(game.commence_time).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short"
      });
      text += "\n" + game.away_team + " @ " + game.home_team + " — " + gameTime + "\n";
      const book = game.bookmakers?.find(b => b.key === "draftkings" || b.key === "fanduel") || game.bookmakers?.[0];
      if (!book) continue;
      text += "  Book: " + book.title + "\n";
      for (const market of book.markets || []) {
        if (market.key === "h2h") text += "  ML: " + market.outcomes.map(o => o.name + " " + (o.price > 0 ? "+" : "") + o.price).join(" | ") + "\n";
        if (market.key === "spreads") text += "  Spread: " + market.outcomes.map(o => o.name + " " + (o.point > 0 ? "+" : "") + o.point + " (" + (o.price > 0 ? "+" : "") + o.price + ")").join(" | ") + "\n";
        if (market.key === "totals") text += "  Total: " + market.outcomes.map(o => o.name + " " + o.point + " (" + (o.price > 0 ? "+" : "") + o.price + ")").join(" | ") + "\n";
      }
    }
    text += "\n";
  }
  return text;
}

export { SPORTS };
