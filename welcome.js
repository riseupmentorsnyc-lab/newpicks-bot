import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const WHOP_LINK = "https://officialshahnyc.gumroad.com/l/iimxvb";
const CHANNEL_LINK = "https://t.me/NYCDaliyPicks";

let offset = 0;

async function sendMsg(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
  await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function handleCommand(msg) {
  const chatId = msg.chat.id;
  const cmd = (msg.text || "").trim().toLowerCase().split(" ")[0];

  if (cmd === "/start" || cmd === "/welcome") {
    await sendMsg(chatId,
      "🗽 <b>Welcome to NYC Daily Picks!</b>\n\n" +
      "Your #1 source for AI-powered daily sports picks for DraftKings & FanDuel in NYC.\n\n" +
      "We post <b>5 free picks</b> every morning at 9AM ET covering NBA, MLB, NHL & NFL.\n\n" +
      "Use the menu below to get started 👇",
      [
        [{ text: "📢 Join Free Channel", url: CHANNEL_LINK }],
        [{ text: "💎 Join Premium ($29/mo)", url: WHOP_LINK }],
        [{ text: "🎯 How It Works", callback_data: "faq" }],
        [{ text: "📊 Today\'s Picks", callback_data: "picks" }],
      ]
    );
  }

  else if (cmd === "/premium") {
    await sendMsg(chatId,
      "💎 <b>NYC Daily Picks — Premium</b>\n\n" +
      "What you get:\n" +
      "✅ Early picks (7AM vs 9AM free)\n" +
      "✅ Full game breakdowns\n" +
      "✅ Premium parlay of the day\n" +
      "✅ Win/loss record tracking\n" +
      "✅ Private members channel\n\n" +
      "<b>$29/month</b> — cancel anytime\n\n" +
      "👇 Sign up below:",
      [[{ text: "💎 Join Premium Now", url: WHOP_LINK }]]
    );
  }

  else if (cmd === "/faq" || cmd === "/how") {
    await sendMsg(chatId,
      "❓ <b>How NYC Daily Picks Works</b>\n\n" +
      "1️⃣ Our AI pulls live DraftKings & FanDuel lines every morning\n\n" +
      "2️⃣ GPT-4o analyzes matchups and finds value plays\n\n" +
      "3️⃣ We post 5 picks + a parlay by 9AM ET daily\n\n" +
      "4️⃣ Results are tracked and posted every night\n\n" +
      "5️⃣ Full win/loss record is always public — no hiding losses\n\n" +
      "📢 Free channel: 3 picks/day\n" +
      "💎 Premium: all 5 picks + early access + full breakdowns\n\n" +
      "⚠️ All picks are opinions for entertainment. 21+ only. Bet responsibly.",
      [
        [{ text: "📢 Join Free Channel", url: CHANNEL_LINK }],
        [{ text: "💎 Go Premium", url: WHOP_LINK }],
      ]
    );
  }

  else if (cmd === "/picks") {
    await sendMsg(chatId,
      "🎯 <b>Today\'s Free Picks</b>\n\n" +
      "Head to our free channel to see today\'s picks posted every morning at 9AM ET 👇",
      [[{ text: "📢 View Today\'s Picks", url: CHANNEL_LINK }]]
    );
  }

  else if (cmd === "/help") {
    await sendMsg(chatId,
      "🗽 <b>NYC Daily Picks Bot</b>\n\n" +
      "/start — Welcome message\n" +
      "/picks — Today\'s free picks\n" +
      "/premium — Join paid channel\n" +
      "/faq — How it works\n" +
      "/help — This menu"
    );
  }

  else {
    await sendMsg(chatId,
      "Hey! Use /start to see the menu or /help for all commands. 🗽",
      [[{ text: "📢 Free Channel", url: CHANNEL_LINK }, { text: "💎 Premium", url: WHOP_LINK }]]
    );
  }
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const data = query.data;

  await fetch("https://api.telegram.org/bot" + TOKEN + "/answerCallbackQuery", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: query.id }),
  });

  if (data === "faq") {
    await sendMsg(chatId,
      "❓ <b>How NYC Daily Picks Works</b>\n\n" +
      "1️⃣ Our AI pulls live DraftKings & FanDuel lines every morning\n\n" +
      "2️⃣ GPT-4o analyzes matchups and finds value plays\n\n" +
      "3️⃣ We post 5 picks + a parlay by 9AM ET daily\n\n" +
      "4️⃣ Results are tracked and posted every night\n\n" +
      "5️⃣ Full win/loss record is always public\n\n" +
      "⚠️ All picks are opinions for entertainment. 21+ only.",
      [[{ text: "💎 Go Premium", url: WHOP_LINK }]]
    );
  }

  else if (data === "picks") {
    await sendMsg(chatId,
      "🎯 <b>Today\'s Free Picks</b>\n\nHead to the free channel for today\'s picks posted at 9AM ET 👇",
      [[{ text: "📢 View Picks", url: CHANNEL_LINK }]]
    );
  }
}

async function poll() {
  try {
    const res = await fetch("https://api.telegram.org/bot" + TOKEN + "/getUpdates?offset=" + offset + "&timeout=30");
    const data = await res.json();
    if (data.ok && data.result.length > 0) {
      for (const u of data.result) {
        offset = u.update_id + 1;
        if (u.message && u.message.text) await handleCommand(u.message);
        if (u.callback_query) await handleCallback(u.callback_query);
      }
    }
  } catch (e) { console.error("Poll error:", e.message); }
  setTimeout(poll, 1000);
}

console.log("🗽 NYC Daily Picks Welcome Bot started!");
console.log("Public bot: @NYCDailyPicks_Bot");
console.log("Channel: " + CHANNEL_ID);
poll();
