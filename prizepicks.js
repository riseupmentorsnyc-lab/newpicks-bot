import OpenAI from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const EXTRA_CHANNEL_ID = process.env.EXTRA_CHANNEL_ID;
const PREMIUM_BOT_TOKEN = process.env.PREMIUM_BOT_TOKEN;
const PREMIUM_CHANNEL_ID = "-1003952874901";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_FREE_CHANNEL = process.env.DISCORD_FREE_CHANNEL;
const DISCORD_VIP_CHANNEL = process.env.DISCORD_VIP_CHANNEL;

async function getNBAPlayers() {
  try {
    const res = await fetch("https://api.balldontlie.io/v1/games?seasons[]=2024&per_page=5", {
      headers: { "Authorization": "0" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch(e) { return null; }
}

async function getMLBGames() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + today + "&hydrate=probablePitcher");
    const data = await res.json();
    return data.dates?.[0]?.games || [];
  } catch(e) { return []; }
}

async function getNBAGames() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch("https://api.balldontlie.io/v1/games?dates[]=" + today, {
      headers: { "Authorization": "0" }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch(e) { return []; }
}

async function generatePrizePicksBoard(nbaGames, mlbGames) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York"
  });

  let context = "Today is " + date + ".\n\n";
  
  if (nbaGames.length > 0) {
    context += "NBA Games today:\n";
    for (const g of nbaGames.slice(0, 5)) {
      context += g.visitor_team?.full_name + " @ " + g.home_team?.full_name + "\n";
    }
    context += "\n";
  }

  if (mlbGames.length > 0) {
    context += "MLB Games today:\n";
    for (const g of mlbGames.slice(0, 5)) {
      const away = g.teams?.away?.team?.name;
      const home = g.teams?.home?.team?.name;
      const awayPitcher = g.teams?.away?.probablePitcher?.fullName || "TBD";
      const homePitcher = g.teams?.home?.probablePitcher?.fullName || "TBD";
      context += away + " (" + awayPitcher + ") @ " + home + " (" + homePitcher + ")\n";
    }
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: "You are an elite PrizePicks analyst. You create player prop picks for PrizePicks based on matchups, recent form, and statistical trends. PrizePicks offers Over/Under on player stats like points, rebounds, assists, strikeouts, hits, etc. Create realistic prop lines based on player averages and matchups."
      },
      {
        role: "user",
        content: context + "\n\nCreate today's PrizePicks board. Format EXACTLY like this:\n\n" +
          "🏆 PRIZEPICKS BOARD — " + date + "\n" +
          "Free Picks | PrizePicks.com\n\n" +
          "─────────────────────────\n\n" +
          "⚡ POWER PLAY (2-Pick | 3x Payout)\n\n" +
          "Pick 1: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL]\n" +
          "💡 [One sentence why]\n\n" +
          "Pick 2: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL]\n" +
          "💡 [One sentence why]\n\n" +
          "─────────────────────────\n\n" +
          "🔥 FLEX PLAY (3-Pick | 2.25x Payout)\n\n" +
          "Pick 1: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL]\n" +
          "💡 [One sentence why]\n\n" +
          "Pick 2: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL]\n" +
          "💡 [One sentence why]\n\n" +
          "Pick 3: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL]\n" +
          "💡 [One sentence why]\n\n" +
          "─────────────────────────\n\n" +
          "💎 PREMIUM BOARD (5-Pick | 10x Payout)\n" +
          "[Available in premium channel only]\n\n" +
          "─────────────────────────\n\n" +
          "📱 Download PrizePicks: prizepicks.com\n" +
          "Use code NYC for bonus entries!\n\n" +
          "⚠️ For entertainment only. 21+ only. Bet responsibly."
      }
    ]
  });
  return response.choices[0].message.content;
}

async function generatePremiumPrizePicksBoard(nbaGames, mlbGames) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York"
  });

  let context = "Today is " + date + ".\n\n";
  if (nbaGames.length > 0) {
    context += "NBA Games:\n";
    for (const g of nbaGames.slice(0, 5)) {
      context += g.visitor_team?.full_name + " @ " + g.home_team?.full_name + "\n";
    }
  }
  if (mlbGames.length > 0) {
    context += "\nMLB Games:\n";
    for (const g of mlbGames.slice(0, 5)) {
      const away = g.teams?.away?.team?.name;
      const home = g.teams?.home?.team?.name;
      const pitcher = g.teams?.home?.probablePitcher?.fullName || "TBD";
      context += away + " @ " + home + " (" + pitcher + ")\n";
    }
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: "You are an elite PrizePicks analyst providing exclusive premium picks. Create a comprehensive 5-pick power play board with deep analysis for serious PrizePicks players."
      },
      {
        role: "user",
        content: context + "\n\nCreate the PREMIUM PrizePicks board with full analysis. Format EXACTLY like this:\n\n" +
          "💎 PREMIUM PRIZEPICKS BOARD — " + date + "\n" +
          "VIP Members Only 🔒\n\n" +
          "─────────────────────────\n\n" +
          "🏆 POWER PLAY (5-Pick | 10x Payout)\n\n" +
          "Pick 1: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL] | Confidence: ⭐⭐⭐⭐⭐\n" +
          "💡 [2 sentence deep analysis]\n" +
          "📊 Edge: [why this line has value]\n\n" +
          "Pick 2: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL] | Confidence: ⭐⭐⭐⭐⭐\n" +
          "💡 [2 sentence deep analysis]\n" +
          "📊 Edge: [why this line has value]\n\n" +
          "Pick 3: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL] | Confidence: ⭐⭐⭐⭐⭐\n" +
          "💡 [2 sentence deep analysis]\n" +
          "📊 Edge: [why this line has value]\n\n" +
          "Pick 4: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL] | Confidence: ⭐⭐⭐⭐⭐\n" +
          "💡 [2 sentence deep analysis]\n" +
          "📊 Edge: [why this line has value]\n\n" +
          "Pick 5: [Player Name]\n" +
          "Stat: [OVER/UNDER] [LINE] [STAT TYPE]\n" +
          "Sport: [NBA/MLB/NHL/NFL] | Confidence: ⭐⭐⭐⭐⭐\n" +
          "💡 [2 sentence deep analysis]\n" +
          "📊 Edge: [why this line has value]\n\n" +
          "─────────────────────────\n\n" +
          "🎯 BEST BET OF THE DAY\n" +
          "[Single highest confidence prop pick with full breakdown]\n\n" +
          "─────────────────────────\n\n" +
          "📱 prizepicks.com\n" +
          "⚠️ VIP members only. Entertainment only. 21+"
      }
    ]
  });
  return response.choices[0].message.content;
}

async function postToTelegram(message, chatId, token) {
  const t = token || process.env.TELEGRAM_BOT_TOKEN;
  await fetch("https://api.telegram.org/bot" + t + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true })
  });
}

async function postToDiscord(message, channelId) {
  if (!DISCORD_BOT_TOKEN || !channelId) return;
  await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bot " + DISCORD_BOT_TOKEN },
    body: JSON.stringify({ content: message })
  });
}

async function logPicks(message, type) {
  if (!existsSync("./logs")) await mkdir("./logs");
  const date = new Date().toISOString().split("T")[0];
  await appendFile("./logs/prizepicks-" + type + "-" + date + ".txt", "\n" + new Date().toISOString() + "\n" + message + "\n");
}

export async function runPrizePicksBot() {
  console.log("\n🏆 PrizePicks Bot starting...");

  const [nbaGames, mlbGames] = await Promise.all([getNBAGames(), getMLBGames()]);
  console.log("NBA games:", nbaGames.length, "| MLB games:", mlbGames.length);

  // Generate free board
  console.log("🤖 Generating free PrizePicks board...");
  const freeBoard = await generatePrizePicksBoard(nbaGames, mlbGames);
  await logPicks(freeBoard, "free");

  // Post free board to all free channels
  await postToTelegram(freeBoard, CHANNEL_ID, TOKEN);
  if (EXTRA_CHANNEL_ID) await postToTelegram(freeBoard, EXTRA_CHANNEL_ID, TOKEN);
  await postToDiscord(freeBoard, DISCORD_FREE_CHANNEL);
  console.log("✅ Free PrizePicks board posted!");

  // Generate premium board
  console.log("🤖 Generating premium PrizePicks board...");
  const premiumBoard = await generatePremiumPrizePicksBoard(nbaGames, mlbGames);
  await logPicks(premiumBoard, "premium");

  // Post premium board to VIP channels
  await postToTelegram(premiumBoard, PREMIUM_CHANNEL_ID, PREMIUM_BOT_TOKEN);
  await postToDiscord(premiumBoard, DISCORD_VIP_CHANNEL);
  console.log("✅ Premium PrizePicks board posted!");

  console.log("✅ PrizePicks Bot complete!");
}

runPrizePicksBot().catch(console.error);
