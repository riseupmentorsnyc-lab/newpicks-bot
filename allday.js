import OpenAI from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

dotenv.config();

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PREMIUM_BOT_TOKEN = process.env.PREMIUM_BOT_TOKEN;
const PREMIUM_CHANNEL_ID = "-1003952874901";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_VIP_CHANNEL = process.env.DISCORD_VIP_CHANNEL;
const WHOP_LINK = "https://officialshahnyc.gumroad.com/l/iimxvb";

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

function isGameSoonOrToday(commenceTime) {
  const now = new Date();
  const game = new Date(commenceTime);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 2);
  return game >= now && game <= tomorrow;
}

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
      if (games.length > 0) {
        results.push({ ...sport, games });
        console.log("✅ " + sport.label + ": " + games.length + " games");
      }
    } catch(e) { console.log("⚠️ " + sport.label + " error"); }
  }
  return results;
}

function formatOdds(sportsData) {
  let text = "";
  for (const sport of sportsData) {
    text += "=== " + sport.label + " ===\n";
    for (const game of sport.games.filter(g => isGameSoonOrToday(g.commence_time)).slice(0, 5)) {
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

async function generateAlldayPicks(oddsText, session) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const sessions = {
    morning: { emoji: "🌅", label: "MORNING CARD", time: "7AM ET", focus: "full day overview and best morning plays" },
    afternoon: { emoji: "☀️", label: "AFTERNOON UPDATE", time: "12PM ET", focus: "updated lines and afternoon value plays" },
    evening: { emoji: "🌆", label: "EVENING CARD", time: "6PM ET", focus: "primetime games and best evening parlays" },
    latenight: { emoji: "🌙", label: "LATE NIGHT PLAYS", time: "9PM ET", focus: "west coast games and late night value" }
  };

  const s = sessions[session];
  const date = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", timeZone:"America/New_York" });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: "You are an elite sports betting analyst providing all-day premium picks for DraftKings and FanDuel. You analyze every game available and find the best value plays throughout the day. Focus on " + s.focus + "."
      },
      {
        role: "user",
        content: oddsText + "\n\nGenerate the " + s.label + " for premium members. Format EXACTLY like this:\n\n" +
          s.emoji + " " + s.label + " — " + date + "\n" +
          "💎 Premium Members Only | " + s.time + "\n\n" +
          "─────────────────────────\n\n" +
          "🎯 TOP PLAYS\n\n" +
          "Play 1: [TEAM/BET] [LINE] ✅\n" +
          "League: [league] | Book: DraftKings/FanDuel\n" +
          "💡 [Sharp 2 sentence analysis]\n\n" +
          "Play 2: [TEAM/BET] [LINE] ✅\n" +
          "League: [league] | Book: DraftKings/FanDuel\n" +
          "💡 [Sharp 2 sentence analysis]\n\n" +
          "Play 3: [TEAM/BET] [LINE] ✅\n" +
          "League: [league] | Book: DraftKings/FanDuel\n" +
          "💡 [Sharp 2 sentence analysis]\n\n" +
          "─────────────────────────\n\n" +
          "🎰 PARLAY OF THE SESSION\n" +
          "Legs: [2-3 plays combined]\n" +
          "Target Payout: +[XXX] on DraftKings\n" +
          "💡 [Why these work together]\n\n" +
          "─────────────────────────\n\n" +
          "🔥 BEST BET OF THE SESSION\n" +
          "[Single highest confidence play with full breakdown]\n\n" +
          "─────────────────────────\n\n" +
          "⚠️ Premium members only. Entertainment only. 21+"
      }
    ]
  });
  return response.choices[0].message.content;
}

async function postToPremiumTelegram(message) {
  const res = await fetch("https://api.telegram.org/bot" + PREMIUM_BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: PREMIUM_CHANNEL_ID, text: message, parse_mode: "HTML", disable_web_page_preview: true })
  });
  const data = await res.json();
  if (data.ok) console.log("✅ Posted to premium Telegram");
  else console.error("Telegram error:", JSON.stringify(data));
}

async function postToDiscordVIP(message) {
  if (!DISCORD_BOT_TOKEN || !DISCORD_VIP_CHANNEL) return;
  const res = await fetch("https://discord.com/api/v10/channels/" + DISCORD_VIP_CHANNEL + "/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bot " + DISCORD_BOT_TOKEN },
    body: JSON.stringify({ content: message })
  });
  const data = await res.json();
  if (data.id) console.log("✅ Posted to Discord VIP");
  else console.error("Discord VIP error:", JSON.stringify(data));
}

async function logPicks(message, session) {
  if (!existsSync("./logs")) await mkdir("./logs");
  const date = new Date().toISOString().split("T")[0];
  await appendFile("./logs/allday-" + date + ".txt", "\n[" + session.toUpperCase() + "] " + new Date().toISOString() + "\n" + message + "\n");
}

export async function runAlldaySession(session) {
  console.log("\n💎 All-day picks bot — " + session + " session starting...");
  const sportsData = await getAllOdds();
  if (sportsData.length === 0) { console.log("No games available."); return; }
  const oddsText = formatOdds(sportsData);
  console.log("🤖 Generating " + session + " picks...");
  const picks = await generateAlldayPicks(oddsText, session);
  console.log("✅ " + session + " picks generated");
  await logPicks(picks, session);
  await postToPremiumTelegram(picks);
  await postToDiscordVIP(picks);
  console.log("✅ " + session + " session complete!");
}

runAlldaySession("morning").catch(console.error);
