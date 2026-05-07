import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import { readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

dotenv.config();

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const rwClient = client.readWrite;

function today() {
  return new Date().toISOString().split("T")[0];
}

function cleanForTwitter(text) {
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, "");
  // Remove excessive dashes
  text = text.replace(/─+/g, "---");
  // Trim to 280 chars if needed
  if (text.length > 270) {
    text = text.substring(0, 267) + "...";
  }
  return text.trim();
}

export async function tweetDailyPicks() {
  console.log("\n🐦 Posting daily picks to X/Twitter...");
  try {
    const file = "./logs/picks-" + today() + ".txt";
    if (!existsSync(file)) { console.log("No picks log found."); return; }
    
    const content = await readFile(file, "utf8");
    
    // Extract just the picks section
    const lines = content.split("\n");
    let picks = [];
    let inPicks = false;
    
    for (const line of lines) {
      if (line.includes("TODAY") || line.includes("PICKS")) inPicks = true;
      if (inPicks && line.trim()) picks.push(line);
      if (picks.length > 20) break;
    }
    
    const date = new Date().toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York"
    });

    // Post main tweet
    const mainTweet = 
      "🗽 FREE PICKS — " + date + "\n\n" +
      picks.slice(0, 8).join("\n").substring(0, 180) + "\n\n" +
      "Full picks + parlay 👇\nt.me/NYCDaliyPicks\n\n" +
      "💎 Premium (4x daily): officialshahnyc.gumroad.com/l/iimxvb\n\n" +
      "#sportsbetting #DraftKings #FanDuel #FreePicks";

    const tweet = await rwClient.v2.tweet(cleanForTwitter(mainTweet));
    console.log("✅ Main tweet posted! ID: " + tweet.data.id);
    
    // Reply with disclaimer
    await rwClient.v2.reply(
      "⚠️ All picks are opinions for entertainment only. Not financial advice. Bet responsibly. 21+ only. #GamblingAwareness",
      tweet.data.id
    );
    console.log("✅ Disclaimer reply posted!");

  } catch(e) {
    console.error("Twitter error:", e.message);
  }
}

export async function tweetResults() {
  console.log("\n🐦 Posting results to X/Twitter...");
  try {
    const file = "./logs/results-" + today() + ".txt";
    if (!existsSync(file)) { console.log("No results log found."); return; }
    
    const content = await readFile(file, "utf8");
    const lines = content.split("\n").filter(l => l.trim()).slice(0, 12);
    
    const resultTweet = lines.join("\n").substring(0, 240) + 
      "\n\nt.me/NYCDaliyPicks #sportsbetting #picks";

    await rwClient.v2.tweet(cleanForTwitter(resultTweet));
    console.log("✅ Results tweet posted!");
  } catch(e) {
    console.error("Twitter results error:", e.message);
  }
}

export async function tweetWeeklyRecord() {
  console.log("\n🐦 Posting weekly record to X/Twitter...");
  try {
    const dbFile = "./logs/tracker-db.json";
    if (!existsSync(dbFile)) { console.log("No tracker DB."); return; }
    
    const db = JSON.parse(await readFile(dbFile, "utf8"));
    const wins = db.allTimeWins || 0;
    const losses = db.allTimeLosses || 0;
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

    const recordTweet = 
      "📊 WEEKLY RECORD UPDATE\n\n" +
      "✅ Wins: " + wins + "\n" +
      "❌ Losses: " + losses + "\n" +
      "📈 Win Rate: " + pct + "%\n\n" +
      "We post every win AND every loss.\n" +
      "No hiding. No fake screenshots.\n\n" +
      "Free picks daily 👇\n" +
      "t.me/NYCDaliyPicks\n\n" +
      "#sportsbetting #DraftKings #FanDuel #transparency";

    await rwClient.v2.tweet(cleanForTwitter(recordTweet));
    console.log("✅ Weekly record tweet posted!");
  } catch(e) {
    console.error("Twitter record error:", e.message);
  }
}

export async function tweetWinningTicket(pickText, result) {
  console.log("\n🐦 Posting ticket to X/Twitter...");
  try {
    const icon = result === "win" ? "✅ HIT" : "❌ MISS";
    const tweet = 
      (result === "win" ? "🔥 WINNING TICKET\n\n" : "📊 RESULT\n\n") +
      icon + ": " + pickText + "\n\n" +
      "Full record + free picks daily:\n" +
      "t.me/NYCDaliyPicks\n\n" +
      "#sportsbetting #DraftKings #FanDuel " +
      (result === "win" ? "#Winner #FreePicks" : "#Transparency #FreePicks");

    await rwClient.v2.tweet(cleanForTwitter(tweet));
    console.log("✅ Ticket tweet posted!");
  } catch(e) {
    console.error("Twitter ticket error:", e.message);
  }
}

// Test tweet
tweetDailyPicks().catch(console.error);
