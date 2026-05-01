import OpenAI from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

dotenv.config();

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PREMIUM_BOT_TOKEN = process.env.PREMIUM_BOT_TOKEN;
const PREMIUM_CHANNEL_ID = process.env.PREMIUM_CHANNEL_ID;
const WHOP_LINK = "https://whop.com/joined/nyc-daily-picks/products/premium-picks-1a/";

const SPORTS = [
  { key: "basketball_nba", label: "🏀 NBA" },
  { key: "americanfootball_nfl", label: "🏈 NFL" },
  { key: "baseball_mlb", label: "⚾ MLB" },
  { key: "icehockey_nhl", label: "🏒 NHL" },
];

async function fetchOdds(sportKey) {
  const url = new URL("https://api.the-odds-api.com/v4/sports/" + sportKey + "/odds");
  url.searchParams.set("apiKey", ODDS_API_KEY);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("bookmakers", "draftkings,fanduel");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  return res.json();
}

async function getAllOdds() {
  const results = [];
  for (const sport of SPORTS) {
    try {
      const games = await fetchOdds(sport.key);
      if (games.length > 0) results.push({ ...sport, games });
    } catch(e) { console.log("Odds error:", e.message); }
  }
  return results;
}

function formatOdds(sportsData) {
  let text = "";
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", timeZone:"America/New_York" });
  text += "Today is " + today + " (ET).\n\n";
  for (const sport of sportsData) {
    text += "=== " + sport.label + " ===\n";
    for (const game of sport.games.slice(0, 8)) {
      const gameTime = new Date(game.commence_time).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", timeZone:"America/New_York", timeZoneName:"short" });
      text += "\n" + game.away_team + " @ " + game.home_team + " — " + gameTime + "\n";
      const book = game.bookmakers?.find(b => b.key === "draftkings" || b.key === "fanduel") || game.bookmakers?.[0];
      if (!book) continue;
      text += "  Book: " + book.title + "\n";
      for (const market of book.markets || []) {
        if (market.key === "h2h") text += "  Moneyline: " + market.outcomes.map(o => o.name + " " + (o.price > 0 ? "+" : "") + o.price).join(" | ") + "\n";
        if (market.key === "spreads") text += "  Spread: " + market.outcomes.map(o => o.name + " " + (o.point > 0 ? "+" : "") + o.point + " (" + (o.price > 0 ? "+" : "") + o.price + ")").join(" | ") + "\n";
        if (market.key === "totals") text += "  Total: " + market.outcomes.map(o => o.name + " " + o.point + " (" + (o.price > 0 ? "+" : "") + o.price + ")").join(" | ") + "\n";
      }
    }
    text += "\n";
  }
  return text;
}

async function generatePremiumPicks(oddsText) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const date = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", timeZone:"America/New_York" });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2000,
    messages: [
      { role: "system", content: "You are an elite sports analyst providing exclusive premium picks for serious DraftKings and FanDuel bettors in NYC. Your analysis is deeper, sharper and more detailed than standard picks. You identify line value, sharp money patterns, and key matchup edges." },
      { role: "user", content: oddsText + "\n\nGenerate today's PREMIUM picks for our VIP members. Format EXACTLY like this:\n\n💎 PREMIUM PICKS — " + date + "\nNYC Daily Picks | Members Only 🔒\n\n─────────────────────────\n\nPick 1: [TEAM/BET] [LINE] ✅\nSport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel\n💡 [2-3 sentence sharp analysis with specific reasoning]\n📊 Edge: [why this line has value]\n\nPick 2: [TEAM/BET] [LINE] ✅\nSport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel\n💡 [2-3 sentence sharp analysis]\n📊 Edge: [why this line has value]\n\nPick 3: [TEAM/BET] [LINE] ✅\nSport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel\n💡 [2-3 sentence sharp analysis]\n📊 Edge: [why this line has value]\n\nPick 4: [TEAM/BET] [LINE] ✅\nSport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel\n💡 [2-3 sentence sharp analysis]\n📊 Edge: [why this line has value]\n\nPick 5: [TEAM/BET] [LINE] ✅\nSport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel\n💡 [2-3 sentence sharp analysis]\n📊 Edge: [why this line has value]\n\n─────────────────────────\n\n🎰 PREMIUM PARLAY\nLegs: [3-4 picks combined]\nApprox. Payout: +[XXX] on DraftKings\n💡 [Why these legs correlate well]\n\n─────────────────────────\n\n🔥 SHARP PLAY OF THE DAY\n[Single best value play with full breakdown]\n\n─────────────────────────\n\n⚠️ Premium members only. Not for redistribution.\nBet responsibly. 21+ only." }
    ]
  });
  return response.choices[0].message.content;
}

async function postToPremiumChannel(message) {
  const res = await fetch("https://api.telegram.org/bot" + PREMIUM_BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: PREMIUM_CHANNEL_ID, text: message, parse_mode: "HTML", disable_web_page_preview: true })
  });
  const data = await res.json();
  if (!data.ok) throw new Error("Telegram error: " + JSON.stringify(data));
  return data;
}

async function logPremiumPicks(message) {
  if (!existsSync("./logs")) await mkdir("./logs");
  const date = new Date().toISOString().split("T")[0];
  await appendFile("./logs/premium-picks-" + date + ".txt", "\n" + "=".repeat(60) + "\n" + new Date().toISOString() + "\n" + message + "\n");
}

export async function runPremiumBot() {
  console.log("\n💎 Premium Picks Bot starting...");
  const sportsData = await getAllOdds();
  if (sportsData.length === 0) { console.log("No games today."); return; }
  const oddsText = formatOdds(sportsData);
  console.log("🤖 Generating premium picks...");
  const picks = await generatePremiumPicks(oddsText);
  console.log("\n✅ Premium picks generated");
  await logPremiumPicks(picks);
  await postToPremiumChannel(picks);
  console.log("✅ Premium picks posted to channel!");
}
// Premium bot command handler
let premiumOffset = 0;

async function sendPremiumMsg(chatId, text) {
  await fetch("https://api.telegram.org/bot" + PREMIUM_BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function pollPremium() {
  try {
    const res = await fetch("https://api.telegram.org/bot" + PREMIUM_BOT_TOKEN + "/getUpdates?offset=" + premiumOffset + "&timeout=30");
    const data = await res.json();
    if (data.ok && data.result.length > 0) {
      for (const u of data.result) {
        premiumOffset = u.update_id + 1;
        if (u.message && u.message.text) {
          const chatId = u.message.chat.id;
          const cmd = u.message.text.trim().toLowerCase().split(" ")[0];
          if (cmd === "/start" || cmd === "/welcome") {
            await sendPremiumMsg(chatId,
              "💎 <b>Welcome to Daily Premium Picks!</b>\n\n" +
              "You have access to our worldwide elite picks posted daily at 7AM ET.\n\n" +
              "Covering NBA, NFL, MLB, NHL, EPL, Champions League, MMA, Tennis & more.\n\n" +
              "Join your private channel below 👇\n" +
              "t.me/+your_private_invite_link"
            );
          } else if (cmd === "/picks") {
            await sendPremiumMsg(chatId, "💎 Today's premium picks are posted in your private channel every morning at 7AM ET. Check the channel!");
          } else if (cmd === "/record") {
            await sendPremiumMsg(chatId, "📊 <b>All-Time Record</b>\n\nResults tracked and posted nightly at 11PM ET in your channel. Check the channel for the latest record!");
          } else if (cmd === "/help") {
            await sendPremiumMsg(chatId,
              "💎 <b>Daily Premium Picks Bot</b>\n\n" +
              "/start — Welcome message\n" +
              "/picks — Today's picks info\n" +
              "/record — Win/loss record\n" +
              "/help — This menu"
            );
          } else {
            await sendPremiumMsg(chatId, "Use /start to get started or /help for all commands. 💎");
          }
        }
      }
    }
  } catch(e) { console.error("Premium poll error:", e.message); }
  setTimeout(pollPremium, 1000);
}

// Start polling for premium bot commands
pollPremium();

runPremiumBot().catch(console.error);
