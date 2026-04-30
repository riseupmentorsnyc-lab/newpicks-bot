/**
 * Daily Sports Picks Bot
 * Pulls odds from The Odds API, generates picks via OpenAI GPT-4o,
 * and posts to Telegram automatically.
 *
 * Usage: node bot.js
 * Cron:  0 9 * * * node /path/to/bot.js   (runs daily at 9AM ET)
 */

import OpenAI from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

const ODDS_BASE = "https://api.the-odds-api.com/v4";

const SPORTS = [
  { key: "basketball_nba", label: "🏀 NBA" },
  { key: "americanfootball_nfl", label: "🏈 NFL" },
  { key: "baseball_mlb", label: "⚾ MLB" },
  { key: "icehockey_nhl", label: "🏒 NHL" },
];

// ── Odds API ──────────────────────────────────────────────────────────────────
async function fetchOdds(sportKey) {
  const url = new URL(`${ODDS_BASE}/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", ODDS_API_KEY);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("bookmakers", "draftkings,fanduel");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    console.warn(`⚠️  Odds API error for ${sportKey}: ${res.status} ${err}`);
    return [];
  }
  return res.json();
}

async function getAllOdds() {
  const results = [];
  for (const sport of SPORTS) {
    try {
      const games = await fetchOdds(sport.key);
      if (games.length > 0) {
        results.push({ ...sport, games });
        console.log(`✅ ${sport.label}: ${games.length} games found`);
      } else {
        console.log(`⏭️  ${sport.label}: no games today`);
      }
    } catch (e) {
      console.warn(`⚠️  Failed to fetch ${sport.label}:`, e.message);
    }
  }
  return results;
}

// ── Format odds for GPT ───────────────────────────────────────────────────────
function formatOddsForPrompt(sportsData) {
  let text = "";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  text += `Today is ${today} (ET).\n\n`;
  text += `Here are today's available games with DraftKings/FanDuel odds:\n\n`;

  for (const sport of sportsData) {
    text += `=== ${sport.label} ===\n`;

    const games = sport.games.slice(0, 8);

    for (const game of games) {
      const gameTime = new Date(game.commence_time).toLocaleTimeString(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
          timeZoneName: "short",
        }
      );

      text += `\n${game.away_team} @ ${game.home_team} — ${gameTime}\n`;

      const book =
        game.bookmakers?.find(
          (b) => b.key === "draftkings" || b.key === "fanduel"
        ) || game.bookmakers?.[0];

      if (!book) {
        text += `  (no odds available)\n`;
        continue;
      }

      text += `  Book: ${book.title}\n`;

      for (const market of book.markets || []) {
        if (market.key === "h2h") {
          const lines = market.outcomes
            .map((o) => `${o.name} ${o.price > 0 ? "+" : ""}${o.price}`)
            .join(" | ");
          text += `  Moneyline: ${lines}\n`;
        }
        if (market.key === "spreads") {
          const lines = market.outcomes
            .map(
              (o) =>
                `${o.name} ${o.point > 0 ? "+" : ""}${o.point} (${o.price > 0 ? "+" : ""}${o.price})`
            )
            .join(" | ");
          text += `  Spread: ${lines}\n`;
        }
        if (market.key === "totals") {
          const lines = market.outcomes
            .map(
              (o) =>
                `${o.name} ${o.point} (${o.price > 0 ? "+" : ""}${o.price})`
            )
            .join(" | ");
          text += `  Total: ${lines}\n`;
        }
      }
    }
    text += "\n";
  }
  return text;
}

// ── OpenAI GPT-4o analysis ────────────────────────────────────────────────────
async function generatePicks(oddsText) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const systemPrompt = `You are an expert sports analyst and handicapper with deep knowledge of NBA, NFL, MLB, and NHL.
You analyze betting lines, identify value plays, and provide clear, confident picks for DraftKings and FanDuel bettors.
Your style is confident, analytical, and NYC-focused. You keep picks concise and actionable.
Always add a brief 1-sentence rationale for each pick.
IMPORTANT: Never guarantee wins. Always frame as your analysis/opinion.`;

  const userPrompt = `${oddsText}

Based on these lines, give me today's top 5 picks for DraftKings/FanDuel bettors.

Format your response EXACTLY like this (I will post it directly to Telegram):

🎯 TODAY'S TOP PICKS — [DATE]
NYC Sports Betting Daily | DraftKings & FanDuel

─────────────────────────

Pick 1: [TEAM/BET] [LINE] ✅
Sport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel
💡 [One-sentence sharp rationale]

Pick 2: [TEAM/BET] [LINE] ✅
Sport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel
💡 [One-sentence sharp rationale]

[...continue for all 5 picks]

─────────────────────────

🎰 PARLAY OF THE DAY
Legs: [Pick 1] + [Pick 2] + [Pick 3]
Approx. Payout: +[XXX] on DraftKings
💡 [One sentence on why these work together]

─────────────────────────

📊 Record this week: [leave as TBD — will be filled in manually]

⚠️ These are opinions for entertainment. Bet responsibly. 21+`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1200,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return response.choices[0].message.content;
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function postToTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHANNEL_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram error: ${JSON.stringify(data)}`);
  }
  return data;
}

// ── Logger ────────────────────────────────────────────────────────────────────
async function logPicks(message) {
  const { appendFile, mkdir } = await import("fs/promises");
  const { existsSync } = await import("fs");

  if (!existsSync("./logs")) await mkdir("./logs");

  const date = new Date().toISOString().split("T")[0];
  const entry = `\n${"=".repeat(60)}\n${new Date().toISOString()}\n${"=".repeat(60)}\n${message}\n`;

  await appendFile(`./logs/picks-${date}.txt`, entry);
  console.log(`📝 Picks logged to ./logs/picks-${date}.txt`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Daily Picks Bot starting...\n");

  console.log("📡 Fetching odds from The Odds API...");
  const sportsData = await getAllOdds();

  if (sportsData.length === 0) {
    console.log("❌ No games found today. Exiting.");
    process.exit(0);
  }

  const oddsText = formatOddsForPrompt(sportsData);
  console.log("\n📊 Odds summary prepared. Sending to GPT-4o...\n");

  console.log("🤖 GPT-4o is analyzing picks...");
  const picksMessage = await generatePicks(oddsText);
  console.log("\n✅ Picks generated:\n");
  console.log(picksMessage);

  await logPicks(picksMessage);

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    console.log("\n📨 Posting to Telegram...");
    await postToTelegram(picksMessage);
    console.log("✅ Posted to Telegram successfully!\n");
  } else {
    console.log("\n⚠️  Telegram not configured — check your .env file.\n");
  }

  console.log("✅ Bot run complete.\n");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
