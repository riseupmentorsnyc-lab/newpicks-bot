import OpenAI from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_FREE_CHANNEL = process.env.DISCORD_FREE_CHANNEL;
const DISCORD_VIP_CHANNEL = process.env.DISCORD_VIP_CHANNEL;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

const ODDS_BASE = "https://api.the-odds-api.com/v4";

const SPORTS = [
  { key: "basketball_nba", label: "🏀 NBA" },
  { key: "americanfootball_nfl", label: "🏈 NFL" },
  { key: "baseball_mlb", label: "⚾ MLB" },
  { key: "icehockey_nhl", label: "🏒 NHL" },
];

function isGameSoonOrToday(commenceTime) {
  const now = new Date();
  const game = new Date(commenceTime);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 2);
  return game >= now && game <= tomorrow;
}

async function fetchOdds(sportKey) {
  const url = new URL(`${ODDS_BASE}/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", ODDS_API_KEY);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("bookmakers", "draftkings,fanduel");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");
  const res = await fetch(url.toString());
  if (!res.ok) { console.warn(`⚠️ Odds API error for ${sportKey}: ${res.status}`); return []; }
  return res.json();
}

async function getAllOdds() {
  const results = [];
  for (const sport of SPORTS) {
    try {
      const games = await fetchOdds(sport.key);
      if (games.length > 0) { results.push({ ...sport, games }); console.log(`✅ ${sport.label}: ${games.length} games`); }
      else { console.log(`⏭️  ${sport.label}: no games today`); }
    } catch (e) { console.warn(`⚠️ Failed ${sport.label}:`, e.message); }
  }
  return results;
}

function formatOddsForPrompt(sportsData) {
  let text = "";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });
  text += `Today is ${today} (ET).\n\n`;
  text += `Here are today's available games with DraftKings/FanDuel odds:\n\n`;
  for (const sport of sportsData) {
    text += `=== ${sport.label} ===\n`;
    const games = sport.games.filter(g => isGameSoonOrToday(g.commence_time)).slice(0, 8);
    for (const game of games) {
      const gameTime = new Date(game.commence_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });
      text += `\n${game.away_team} @ ${game.home_team} — ${gameTime}\n`;
      const book = game.bookmakers?.find((b) => b.key === "draftkings" || b.key === "fanduel") || game.bookmakers?.[0];
      if (!book) { text += `  (no odds available)\n`; continue; }
      text += `  Book: ${book.title}\n`;
      for (const market of book.markets || []) {
        if (market.key === "h2h") { text += `  Moneyline: ${market.outcomes.map((o) => `${o.name} ${o.price > 0 ? "+" : ""}${o.price}`).join(" | ")}\n`; }
        if (market.key === "spreads") { text += `  Spread: ${market.outcomes.map((o) => `${o.name} ${o.point > 0 ? "+" : ""}${o.point} (${o.price > 0 ? "+" : ""}${o.price})`).join(" | ")}\n`; }
        if (market.key === "totals") { text += `  Total: ${market.outcomes.map((o) => `${o.name} ${o.point} (${o.price > 0 ? "+" : ""}${o.price})`).join(" | ")}\n`; }
      }
    }
    text += "\n";
  }
  return text;
}

async function generatePicks(oddsText) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const systemPrompt = `You are an expert sports analyst and handicapper with deep knowledge of NBA, NFL, MLB, and NHL. You analyze betting lines, identify value plays, and provide clear, confident picks for DraftKings and FanDuel bettors. Your style is confident, analytical, and NYC-focused. Always add a brief 1-sentence rationale for each pick. IMPORTANT: Never guarantee wins. Always frame as your analysis/opinion.`;
  const userPrompt = `${oddsText}

Based on these lines, give me today's top 5 picks for DraftKings/FanDuel bettors.

Format your response EXACTLY like this:

🎯 TODAY'S TOP PICKS — [DATE]
NYC Sports Betting Daily | DraftKings & FanDuel

─────────────────────────

Pick 1: [TEAM/BET] [LINE] ✅
Sport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel
💡 [One-sentence sharp rationale]

Pick 2: [TEAM/BET] [LINE] ✅
Sport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel
💡 [One-sentence sharp rationale]

Pick 3: [TEAM/BET] [LINE] ✅
Sport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel
💡 [One-sentence sharp rationale]

Pick 4: [TEAM/BET] [LINE] ✅
Sport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel
💡 [One-sentence sharp rationale]

Pick 5: [TEAM/BET] [LINE] ✅
Sport: [NBA/NFL/MLB/NHL] | Book: DraftKings/FanDuel
💡 [One-sentence sharp rationale]

─────────────────────────

🎰 PARLAY OF THE DAY
Legs: [Pick 1] + [Pick 2] + [Pick 3]
Approx. Payout: +[XXX] on DraftKings
💡 [One sentence on why these work together]

─────────────────────────

📊 Record this week: TBD

⚠️ These are opinions for entertainment. Bet responsibly. 21+`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1200,
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
  });
  return response.choices[0].message.content;
}

async function postToTelegram(message) {
  const channels = [
    process.env.TELEGRAM_CHANNEL_ID,
    process.env.EXTRA_CHANNEL_ID
  ].filter(Boolean);

  for (const channel of channels) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channel,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error(`Telegram error for ${channel}: ${JSON.stringify(data)}`);
      } else {
        console.log(`✅ Posted to ${channel}`);
      }
    } catch(e) {
      console.error(`Failed to post to ${channel}: ${e.message}`);
    }
  }
}


async function logPicks(message) {
  const { appendFile, mkdir } = await import("fs/promises");
  const { existsSync } = await import("fs");
  if (!existsSync("./logs")) await mkdir("./logs");
  const date = new Date().toISOString().split("T")[0];
  await appendFile(`./logs/picks-${date}.txt`, `\n${"=".repeat(60)}\n${new Date().toISOString()}\n${"=".repeat(60)}\n${message}\n`);
  console.log(`📝 Logged to ./logs/picks-${date}.txt`);
}

async function main() {
  console.log("\n🚀 Daily Picks Bot starting...\n");
  const sportsData = await getAllOdds();
  if (sportsData.length === 0) { console.log("❌ No games found today."); process.exit(0); }
  const oddsText = formatOddsForPrompt(sportsData);
  console.log("🤖 GPT-4o analyzing picks...");
  const picksMessage = await generatePicks(oddsText);
  console.log("\n✅ Picks generated:\n");
  console.log(picksMessage);
  await logPicks(picksMessage);
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    console.log("\n📨 Posting to Telegram...");
    await postToTelegram(picksMessage);
    console.log("✅ Posted to Telegram!\n");
  } else {
    console.log("\n⚠️ Telegram not configured — check your .env\n");
  }
  if (DISCORD_BOT_TOKEN && DISCORD_FREE_CHANNEL) {
    console.log("📨 Posting to Discord #free-picks...");
    await postToDiscord(picksMessage, DISCORD_FREE_CHANNEL);
    console.log("✅ Posted to Discord!\n");
  }
  console.log("✅ Done.\n");
}
async function postToDiscord(message, channelId) {
  if (!DISCORD_BOT_TOKEN || !channelId) return;
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bot ${DISCORD_BOT_TOKEN}`
      },
      body: JSON.stringify({ content: message })
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ Posted to Discord channel ${channelId}`);
    } else {
      console.error(`❌ Discord error: ${JSON.stringify(data)}`);
    }
  } catch(e) {
    console.error(`Discord post failed: ${e.message}`);
  }
}

main().catch((err) => { console.error("❌ Fatal error:", err); process.exit(1); });
