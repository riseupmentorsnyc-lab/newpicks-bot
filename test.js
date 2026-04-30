import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const GREEN = "\x1b[32m✅";
const RED = "\x1b[31m❌";
const YELLOW = "\x1b[33m⚠️";
const RESET = "\x1b[0m";

async function testOddsAPI() {
  console.log("\n── Testing The Odds API ──────────────────────────────");
  if (!process.env.ODDS_API_KEY || process.env.ODDS_API_KEY.includes("your_")) { console.log(`${RED} ODDS_API_KEY not set${RESET}`); return false; }
  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${process.env.ODDS_API_KEY}`);
    const data = await res.json();
    if (res.ok && Array.isArray(data)) { console.log(`${GREEN} Odds API connected! ${data.filter(s=>s.active).length} active sports.${RESET}`); return true; }
    else { console.log(`${RED} Odds API error: ${JSON.stringify(data)}${RESET}`); return false; }
  } catch (e) { console.log(`${RED} Odds API failed: ${e.message}${RESET}`); return false; }
}

async function testOpenAI() {
  console.log("\n── Testing OpenAI API ────────────────────────────────");
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("your_")) { console.log(`${RED} OPENAI_API_KEY not set${RESET}`); return false; }
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({ model: "gpt-4o", max_tokens: 10, messages: [{ role: "user", content: "Say OK." }] });
    console.log(`${GREEN} OpenAI connected! Response: "${res.choices[0].message.content.trim()}"${RESET}`);
    return true;
  } catch (e) { console.log(`${RED} OpenAI failed: ${e.message}${RESET}`); return false; }
}

async function testTelegram() {
  console.log("\n── Testing Telegram Bot ──────────────────────────────");
  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN.includes("your_")) { console.log(`${YELLOW} TELEGRAM_BOT_TOKEN not set${RESET}`); return null; }
  if (!process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID.includes("your")) { console.log(`${YELLOW} TELEGRAM_CHANNEL_ID not set${RESET}`); return null; }
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    const me = await meRes.json();
    if (!me.ok) { console.log(`${RED} Telegram token invalid: ${me.description}${RESET}`); return false; }
    console.log(`${GREEN} Telegram bot verified: @${me.result.username}${RESET}`);
    const msgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHANNEL_ID, text: "🤖 Bot test successful! Daily picks will post here every morning at 9AM ET. 🗽" }),
    });
    const msg = await msgRes.json();
    if (msg.ok) { console.log(`${GREEN} Test message sent to ${process.env.TELEGRAM_CHANNEL_ID}!${RESET}`); return true; }
    else { console.log(`${RED} Could not send message: ${msg.description}${RESET}`); console.log(`${YELLOW} Make sure your bot is an Admin in the channel.${RESET}`); return false; }
  } catch (e) { console.log(`${RED} Telegram failed: ${e.message}${RESET}`); return false; }
}

async function main() {
  console.log("🧪 Running API connection tests...");
  const oddsOk = await testOddsAPI();
  const openaiOk = await testOpenAI();
  const telegramOk = await testTelegram();
  console.log("\n── Summary ───────────────────────────────────────────");
  console.log(`  Odds API:  ${oddsOk ? "✅ Ready" : "❌ Fix required"}`);
  console.log(`  OpenAI:    ${openaiOk ? "✅ Ready" : "❌ Fix required"}`);
  console.log(`  Telegram:  ${telegramOk === null ? "⚠️  Not configured" : telegramOk ? "✅ Ready" : "❌ Fix required"}`);
  if (oddsOk && openaiOk) { console.log("\n🚀 All good! Run: node bot.js"); }
  else { console.log("\n⚠️  Fix the issues above, then run: node bot.js"); }
}

main();
