import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";
import { readFile, writeFile, appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

dotenv.config();

const TOKEN = process.env.TRACKER_BOT_TOKEN;
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

function dbFile() {
  return "./logs/tracker-db.json";
}

async function loadDB() {
  if (!existsSync(dbFile())) return { picks: [], allTimeWins: 0, allTimeLosses: 0 };
  const data = await readFile(dbFile(), "utf8");
  return JSON.parse(data);
}

async function saveDB(db) {
  if (!existsSync("./logs")) await mkdir("./logs");
  await writeFile(dbFile(), JSON.stringify(db, null, 2));
}

async function postToChannel(message) {
  await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID, text: message, parse_mode: "HTML" })
  });
}

// Called after bot.js posts picks — parses log and adds picks to tracker
export async function autoAddPicks() {
  console.log("\n📋 Auto-adding picks from log...");
  const file = "./logs/picks-" + today() + ".txt";
  if (!existsSync(file)) { console.log("No picks log found."); return; }
  
  const content = await readFile(file, "utf8");
  const db = await loadDB();
  
  // Remove any picks from today first to avoid duplicates
  db.picks = db.picks.filter(p => p.date !== today());
  
  // Parse picks from the log using GPT
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 500,
    messages: [
      { role: "system", content: "Extract betting picks from text. Return ONLY a JSON array like: [{id:1,pick:"Knicks -4.5 (-110)",sport:"NBA",book:"DraftKings"},{id:2,...}]. No other text." },
      { role: "user", content: "Extract all picks from this text:\n\n" + content }
    ]
  });
  
  let picks = [];
  try {
    const text = response.choices[0].message.content.replace(/```json|```/g, "").trim();
    picks = JSON.parse(text);
  } catch(e) {
    console.log("Failed to parse picks:", e.message);
    return;
  }
  
  // Add picks to DB with today date and pending status
  let counter = db.picks.length + 1;
  for (const p of picks) {
    db.picks.push({
      id: counter++,
      text: p.pick,
      sport: p.sport,
      book: p.book,
      result: "pending",
      date: today()
    });
  }
  
  await saveDB(db);
  console.log("✅ Auto-added " + picks.length + " picks to tracker");
}

// Called at 11PM — fetches scores and auto-marks wins/losses
export async function autoMarkResults() {
  console.log("\n🏆 Auto-marking results...");
  
  const db = await loadDB();
  const todaysPicks = db.picks.filter(p => p.date === today() && p.result === "pending");
  
  if (todaysPicks.length === 0) {
    console.log("No pending picks for today.");
    return;
  }
  
  // Fetch scores
  let allScores = [];
  for (const sport of SPORTS) {
    try {
      const url = "https://api.the-odds-api.com/v4/sports/" + sport + "/scores/?apiKey=" + ODDS_API_KEY + "&daysFrom=1&dateFormat=iso";
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const completed = data.filter(g => g.completed === true);
      allScores = allScores.concat(completed.map(g => ({
        sport, home: g.home_team, away: g.away_team,
        scores: g.scores ? g.scores.map(s => s.name + ": " + s.score).join(", ") : "N/A"
      })));
    } catch(e) { console.log("Score error:", e.message); }
  }
  
  if (allScores.length === 0) {
    console.log("No completed games found.");
    return;
  }
  
  // Use GPT to match picks against scores
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 600,
    messages: [
      { role: "system", content: "You are a sports betting analyst. Match picks against scores. Return ONLY a JSON array like: [{id:1,result:"win"},{id:2,result:"loss"},{id:3,result:"pending"}]. No other text." },
      { role: "user", content: "Picks:\n" + JSON.stringify(todaysPicks) + "\n\nScores:\n" + JSON.stringify(allScores) }
    ]
  });
  
  let results = [];
  try {
    const text = response.choices[0].message.content.replace(/```json|```/g, "").trim();
    results = JSON.parse(text);
  } catch(e) {
    console.log("Failed to parse results:", e.message);
    return;
  }
  
  // Update DB with results
  for (const r of results) {
    const pick = db.picks.find(p => p.id === r.id);
    if (pick) {
      pick.result = r.result;
      if (r.result === "win") db.allTimeWins++;
      if (r.result === "loss") db.allTimeLosses++;
    }
  }
  
  await saveDB(db);
  
  // Build results summary
  const wins = results.filter(r => r.result === "win").length;
  const losses = results.filter(r => r.result === "loss").length;
  const pending = results.filter(r => r.result === "pending").length;
  const total = db.allTimeWins + db.allTimeLosses;
  const pct = total > 0 ? ((db.allTimeWins / total) * 100).toFixed(1) : "0.0";
  
  let msg = "📊 RESULTS — " + new Date().toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric", timeZone:"America/New_York"}) + "\n";
  msg += "NYC Daily Picks | DraftKings & FanDuel\n\n";
  
  for (const pick of todaysPicks) {
    const r = results.find(x => x.id === pick.id);
    const icon = r && r.result === "win" ? "✅ HIT" : r && r.result === "loss" ? "❌ MISS" : "⏳ PENDING";
    msg += "Pick #" + pick.id + ": " + pick.text + " — " + icon + "\n";
  }
  
  msg += "\n📅 Today: " + wins + "-" + losses;
  if (pending > 0) msg += " (" + pending + " pending)";
  msg += "\n📈 All-Time: " + db.allTimeWins + "-" + db.allTimeLosses + " (" + pct + "%)";
  msg += "\n\n⚠️ For entertainment only. Bet responsibly. 21+";
  
  await postToChannel(msg);
  
  // Log results
  if (!existsSync("./logs")) await mkdir("./logs");
  await appendFile("./logs/results-" + today() + ".txt", "\n" + "=".repeat(60) + "\n" + new Date().toISOString() + "\n" + msg + "\n");
  
  console.log("✅ Results auto-posted to channel!");
  console.log("Today: " + wins + "-" + losses + " | All-Time: " + db.allTimeWins + "-" + db.allTimeLosses);
}
