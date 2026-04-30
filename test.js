/**
 * test.js — Run this FIRST to verify all your API keys work
 * Usage: node test.js
 */

import fetch from "node-fetch";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const GREEN = "\x1b[32m✅";
const RED = "\x1b[31m❌";
const YELLOW = "\x1b[33m⚠️";
const RESET = "\x1b[0m";

async function testOddsAPI() {
  console.log("\n── Testing The Odds API ──────────────────────────────");
  if (!process.env.ODDS_API_KEY || process.env.ODDS_API_KEY.includes("your_")) {
    console.log(`${RED}  ODDS_API_KEY not set in .env${RESET}`);
    return false;
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports?apiKey=${process.env.ODDS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (res.ok && Array.isArray(data)) {
      const active = data.filter((s) => s.active).length;
      console.log(`${GREEN}  Odds API connected! ${active} active sports available.${RESET}`);
      console.log(
        `${YELLOW}  Requests remaining: check your dashboard at the-odds-api.com${RESET}`
      );
      return true;
    } else {
      console.log(`${RED}  Odds API error: ${JSON.stringify(data)}${RESET}`);
      return false;
    }
  } catch (e) {
    console.log(`${RED}  Odds API failed: ${e.message}${RESET}`);
    return false;
  }
}

async function testClaudeAPI() {
  console.log("\n── Testing Anthropic Claude API ──────────────────────");
  if (
    !process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY.includes("your_")
  ) {
    console.log(`${RED}  ANTHROPIC_API_KEY not set in .env${RESET}`);
    return false;
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      messages: [{ role: "user", content: "Say OK in one word." }],
    });
    console.log(
      `${GREEN}  Claude API connected! Response: "${res.content[0].text.trim()}"${RESET}`
    );
    return true;
  } catch (e) {
    console.log(`${RED}  Claude API failed: ${e.message}${RESET}`);
    return false;
  }
}

async function testTelegram() {
  console.log("\n── Testing Telegram Bot ──────────────────────────────");
  if (
    !process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN.includes("your_")
  ) {
    console.log(`${YELLOW}  TELEGRAM_BOT_TOKEN not set — skipping.${RESET}`);
    return null;
  }
  if (
    !process.env.TELEGRAM_CHANNEL_ID ||
    process.env.TELEGRAM_CHANNEL_ID.includes("your")
  ) {
    console.log(`${YELLOW}  TELEGRAM_CHANNEL_ID not set — skipping.${RESET}`);
    return null;
  }

  try {
    // First verify the bot token
    const meRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`
    );
    const me = await meRes.json();

    if (!me.ok) {
      console.log(`${RED}  Telegram token invalid: ${me.description}${RESET}`);
      return false;
    }

    console.log(`${GREEN}  Telegram bot verified: @${me.result.username}${RESET}`);

    // Send a test message
    const msgRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHANNEL_ID,
          text: "🤖 Bot test successful! Daily picks will post here every morning at 9AM ET.",
        }),
      }
    );
    const msg = await msgRes.json();

    if (msg.ok) {
      console.log(`${GREEN}  Test message sent to ${process.env.TELEGRAM_CHANNEL_ID}!${RESET}`);
      return true;
    } else {
      console.log(`${RED}  Could not send message: ${msg.description}${RESET}`);
      console.log(
        `${YELLOW}  Make sure your bot is an admin in the channel.${RESET}`
      );
      return false;
    }
  } catch (e) {
    console.log(`${RED}  Telegram test failed: ${e.message}${RESET}`);
    return false;
  }
}

async function main() {
  console.log("🧪 Running API connection tests...");

  const oddsOk = await testOddsAPI();
  const claudeOk = await testClaudeAPI();
  const telegramOk = await testTelegram();

  console.log("\n── Summary ───────────────────────────────────────────");
  console.log(`  Odds API:  ${oddsOk ? "✅ Ready" : "❌ Fix required"}`);
  console.log(`  Claude AI: ${claudeOk ? "✅ Ready" : "❌ Fix required"}`);
  console.log(
    `  Telegram:  ${telegramOk === null ? "⚠️  Not configured" : telegramOk ? "✅ Ready" : "❌ Fix required"}`
  );

  if (oddsOk && claudeOk) {
    console.log("\n🚀 Core APIs ready! Run: node bot.js");
  } else {
    console.log(
      "\n⚠️  Fix the issues above, then run: node bot.js"
    );
  }
}

main();
