import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";
import { readFile, appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SPORTS = [
  "basketball_nba",
  "baseball_mlb", 
  "icehockey_nhl",
  "americanfootball_nfl"
];

function today() {
  return new Date().toISOString().split("T")[0];
}

async function getTodaysPicks() {
  const file = "./logs/picks-" + today() + ".txt";
  if (!existsSync(file)) return null;
  const content = await readFile(file, "utf8");
  return content;
}

async function getScores() {
  let allScores = [];
  for (const sport of SPORTS) {
    try {
      const url = "https://api.the-odds-api.com/v4/sports/" + sport + "/scores/?apiKey=" + ODDS_API_KEY + "&daysFrom=1&dateFormat=iso";
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const completed = data.filter(g => g.completed === true);
      if (completed.length > 0) {
        allScores = allScores.concat(completed.map(g => ({
          sport: sport,
          home: g.home_team,
          away: g.away_team,
          scores: g.scores ? g.scores.map(s => s.name + ": " + s.score).join(", ") : "N/A",
          completed: g.completed
        })));
      }
    } catch(e) {
      console.log("Score fetch error for " + sport + ": " + e.message);
    }
  }
  return allScores;
}

async function analyzeResults(picks, scores) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  
  const prompt = "Here are today\'s picks that were made this morning:\n\n" + picks + "\n\n" +
    "Here are today\'s completed game scores:\n\n" + JSON.stringify(scores, null, 2) + "\n\n" +
    "For each pick, determine if it was a WIN or LOSS based on the final scores. " +
    "Format your response EXACTLY like this:\n\n" +
    "📊 RESULTS — " + new Date().toLocaleDateString("en-US", {month:"long", day:"numeric", year:"numeric", timeZone:"America/New_York"}) + "\n" +
    "NYC Daily Picks | DraftKings & FanDuel\n\n" +
    "Pick 1: [team/bet] — ✅ HIT or ❌ MISS\n" +
    "Pick 2: [team/bet] — ✅ HIT or ❌ MISS\n" +
    "Pick 3: [team/bet] — ✅ HIT or ❌ MISS\n" +
    "Pick 4: [team/bet] — ✅ HIT or ❌ MISS\n" +
    "Pick 5: [team/bet] — ✅ HIT or ❌ MISS\n\n" +
    "📅 Today: X-X\n" +
    "📈 Note: All-time record updated manually\n\n" +
    "If a game score is not available yet, mark as ⏳ PENDING\n\n" +
    "⚠️ For entertainment only. Bet responsibly. 21+";

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 800,
    messages: [
      { role: "system", content: "You are a sports results analyst. Match picks against scores accurately." },
      { role: "user", content: prompt }
    ]
  });
  
  return response.choices[0].message.content;
}

async function postToChannel(message) {
  await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID, text: message, parse_mode: "HTML" })
  });
}

async function logResults(message) {
  if (!existsSync("./logs")) await mkdir("./logs");
  const date = today();
  await appendFile("./logs/results-" + date + ".txt", "\n" + "=".repeat(60) + "\n" + new Date().toISOString() + "\n" + message + "\n");
}

export async function runResultsBot() {
  console.log("\n🏆 Auto Results Bot running...");
  
  const picks = await getTodaysPicks();
  if (!picks) {
    console.log("No picks found for today. Skipping results.");
    return;
  }
  
  console.log("📊 Fetching scores...");
  const scores = await getScores();
  console.log("Found " + scores.length + " completed games");
  
  if (scores.length === 0) {
    console.log("No completed games yet. Will retry later.");
    return;
  }
  
  console.log("🤖 GPT-4o analyzing results...");
  const results = await analyzeResults(picks, scores);
  
  console.log("\n✅ Results:\n" + results);
  
  await logResults(results);
  await postToChannel(results);
  
  console.log("✅ Results posted to channel!");
}

runResultsBot().catch(console.error);
