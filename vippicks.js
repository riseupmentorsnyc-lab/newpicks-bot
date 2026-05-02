import OpenAI from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

dotenv.config();

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const PREMIUM_BOT_TOKEN = process.env.PREMIUM_BOT_TOKEN;
const PREMIUM_CHANNEL_ID = "-1003952874901";

const EARLY_DROPS_CHANNEL = "1499680588460720258";
const HIGH_CONFIDENCE_CHANNEL = "1499680764663693502";

const SPORTS = [
  { key: "basketball_nba", label: "🏀 NBA" },
  { key: "americanfootball_nfl", label: "🏈 NFL" },
  { key: "baseball_mlb", label: "⚾ MLB" },
  { key: "icehockey_nhl", label: "🏒 NHL" },
  { key: "soccer_epl", label: "⚽ EPL" },
  { key: "soccer_uefa_champs_league", label: "⚽ UCL" },
  { key: "soccer_spain_la_liga", label: "⚽ La Liga" },
  { key: "soccer_italy_serie_a", label: "⚽ Serie A" },
  { key: "mma_mixed_martial_arts", label: "🥊 MMA" },
];

async function fetchOdds(sportKey) {
  try {
    const url = new URL("https://api.the-odds-api.com/v4/sports/" + sportKey + "/odds");
    url.searchParams.set("apiKey", ODDS_API_KEY);
    url.searchParams.set("regions", "us,uk,eu");
    url.searchParams.set("markets", "h2h,spreads,totals");
    url.searchParams.set("bookmakers", "draftkings,fanduel");
    url.searchParams.set("oddsFormat", "american");
    url.searchParams.set("dateFormat", "iso");
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    return res.json();
  } catch(e) { return []; }
}

async function getAllOdds() {
  const results = [];
  for (const sport of SPORTS) {
    try {
      const games = await fetchOdds(sport.key);
      const filtered = Array.isArray(games) ? games : [];
      if (filtered.length > 0) results.push({ ...sport, games: filtered });
    } catch(e) { }
  }
  return results;
}

function formatOdds(sportsData) {
  let text = "";
  for (const sport of sportsData) {
    text += "=== " + sport.label + " ===\n";
    for (const game of sport.games.slice(0, 5)) {
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

async function generateEarlyDrops(oddsText) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const date = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", timeZone:"America/New_York" });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content: "You are an elite sports betting analyst. Your job is to find the TOP 3 highest confidence plays of the day from all available games. These are exclusive early picks for VIP members only. Be extremely selective — only pick plays with 8+ confidence out of 10. Format them as clean simplified betting tickets."
      },
      {
        role: "user",
        content: oddsText + "\n\nGenerate the TOP 3 EARLY DROP picks for today. These must be the absolute best plays available. Format EXACTLY like this:\n\n" +
          "⚡ EARLY DROPS — " + date + "\n" +
          "💎 VIP Exclusive | First Look 🔒\n\n" +
          "─────────────────────────\n\n" +
          "🎫 TICKET #1\n" +
          "┌─────────────────────┐\n" +
          "│ [TEAM/BET]          │\n" +
          "│ [LINE]              │\n" +
          "│ [League] | [Book]   │\n" +
          "│ Confidence: ⭐⭐⭐⭐⭐ │\n" +
          "└─────────────────────┘\n" +
          "💡 [One sharp sentence why]\n\n" +
          "🎫 TICKET #2\n" +
          "┌─────────────────────┐\n" +
          "│ [TEAM/BET]          │\n" +
          "│ [LINE]              │\n" +
          "│ [League] | [Book]   │\n" +
          "│ Confidence: ⭐⭐⭐⭐⭐ │\n" +
          "└─────────────────────┘\n" +
          "💡 [One sharp sentence why]\n\n" +
          "🎫 TICKET #3\n" +
          "┌─────────────────────┐\n" +
          "│ [TEAM/BET]          │\n" +
          "│ [LINE]              │\n" +
          "│ [League] | [Book]   │\n" +
          "│ Confidence: ⭐⭐⭐⭐⭐ │\n" +
          "└─────────────────────┘\n" +
          "💡 [One sharp sentence why]\n\n" +
          "─────────────────────────\n\n" +
          "🎰 EARLY PARLAY\n" +
          "Legs: Ticket #1 + Ticket #2 + Ticket #3\n" +
          "Target: +[XXX] on DraftKings\n\n" +
          "─────────────────────────\n\n" +
          "⚠️ VIP members only. Entertainment only. 21+"
      }
    ]
  });
  return response.choices[0].message.content;
}

async function generateHighConfidence(oddsText) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const date = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", timeZone:"America/New_York" });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content: "You are an elite sports betting analyst specializing in finding ONLY the highest value plays. You must rate every potential play and only include those with 9+ confidence out of 10. These are the cream of the crop — plays where the line has significant value. Be very selective. Maximum 3 plays."
      },
      {
        role: "user",
        content: oddsText + "\n\nFind ONLY the highest confidence plays (9-10/10) for today. Format EXACTLY like this:\n\n" +
          "🔥 HIGH CONFIDENCE PLAYS — " + date + "\n" +
          "💎 Elite Plays Only | 9-10 Confidence\n\n" +
          "─────────────────────────\n\n" +
          "🏆 PLAY #1 — CONFIDENCE: 9.5/10\n" +
          "▶ [TEAM/BET] [LINE]\n" +
          "▶ League: [league]\n" +
          "▶ Book: DraftKings/FanDuel\n" +
          "▶ Why: [2 sentence sharp analysis]\n" +
          "▶ Edge: [specific line value reason]\n" +
          "▶ Stake: [Low/Medium/High] confidence unit\n\n" +
          "🏆 PLAY #2 — CONFIDENCE: 9/10\n" +
          "▶ [TEAM/BET] [LINE]\n" +
          "▶ League: [league]\n" +
          "▶ Book: DraftKings/FanDuel\n" +
          "▶ Why: [2 sentence sharp analysis]\n" +
          "▶ Edge: [specific line value reason]\n" +
          "▶ Stake: [Low/Medium/High] confidence unit\n\n" +
          "🏆 PLAY #3 — CONFIDENCE: 9/10\n" +
          "▶ [TEAM/BET] [LINE]\n" +
          "▶ League: [league]\n" +
          "▶ Book: DraftKings/FanDuel\n" +
          "▶ Why: [2 sentence sharp analysis]\n" +
          "▶ Edge: [specific line value reason]\n" +
          "▶ Stake: [Low/Medium/High] confidence unit\n\n" +
          "─────────────────────────\n\n" +
          "💰 POWER PARLAY\n" +
          "All 3 legs combined\n" +
          "Target: +[XXX] on DraftKings\n\n" +
          "─────────────────────────\n\n" +
          "⚠️ Only our best plays make it here. Entertainment only. 21+"
      }
    ]
  });
  return response.choices[0].message.content;
}

async function postToDiscord(message, channelId) {
  if (!DISCORD_BOT_TOKEN || !channelId) return;
  try {
    const res = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bot " + DISCORD_BOT_TOKEN },
      body: JSON.stringify({ content: message })
    });
    const data = await res.json();
    if (data.id) console.log("✅ Posted to Discord channel " + channelId);
    else console.error("❌ Discord error:", JSON.stringify(data));
  } catch(e) { console.error("Discord error:", e.message); }
}

async function postToTelegram(message) {
  try {
    const res = await fetch("https://api.telegram.org/bot" + PREMIUM_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: PREMIUM_CHANNEL_ID, text: message, parse_mode: "HTML", disable_web_page_preview: true })
    });
    const data = await res.json();
    if (data.ok) console.log("✅ Posted to premium Telegram");
    else console.error("Telegram error:", JSON.stringify(data));
  } catch(e) { console.error("Telegram error:", e.message); }
}

async function logPost(message, type) {
  if (!existsSync("./logs")) await mkdir("./logs");
  const date = new Date().toISOString().split("T")[0];
  await appendFile("./logs/" + type + "-" + date + ".txt", "\n" + new Date().toISOString() + "\n" + message + "\n");
}

export async function runEarlyDrops() {
  console.log("\n⚡ Early Drops Bot starting...");
  const sportsData = await getAllOdds();
  if (sportsData.length === 0) { console.log("No games today."); return; }
  const oddsText = formatOdds(sportsData);
  console.log("🤖 Generating early drops...");
  const picks = await generateEarlyDrops(oddsText);
  console.log("✅ Early drops generated");
  await logPost(picks, "early-drops");
  await postToDiscord(picks, EARLY_DROPS_CHANNEL);
  await postToTelegram(picks);
  console.log("✅ Early drops posted!");
}

export async function runHighConfidence() {
  console.log("\n🔥 High Confidence Plays Bot starting...");
  const sportsData = await getAllOdds();
  if (sportsData.length === 0) { console.log("No games today."); return; }
  const oddsText = formatOdds(sportsData);
  console.log("🤖 Generating high confidence plays...");
  const picks = await generateHighConfidence(oddsText);
  console.log("✅ High confidence plays generated");
  await logPost(picks, "high-confidence");
  await postToDiscord(picks, HIGH_CONFIDENCE_CHANNEL);
  await postToTelegram(picks);
  console.log("✅ High confidence plays posted!");
}

runEarlyDrops().catch(console.error);
