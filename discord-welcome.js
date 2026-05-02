import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WHOP_LINK = "https://whop.com/joined/nyc-daily-picks/products/premium-picks-1a/";
const FREE_INVITE = "https://discord.gg/8wWA7MPdX";

let lastEventId = null;

async function sendDM(userId, message) {
  try {
    // Create DM channel
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {"Content-Type": "application/json", "Authorization": "Bot " + DISCORD_BOT_TOKEN},
      body: JSON.stringify({ recipient_id: userId })
    });
    const dm = await dmRes.json();
    if (!dm.id) { console.log("Could not create DM for user " + userId); return; }

    // Send message
    await fetch("https://discord.com/api/v10/channels/" + dm.id + "/messages", {
      method: "POST",
      headers: {"Content-Type": "application/json", "Authorization": "Bot " + DISCORD_BOT_TOKEN},
      body: JSON.stringify({ content: message })
    });
    console.log("✅ Welcome DM sent to " + userId);
  } catch(e) {
    console.error("DM error:", e.message);
  }
}

async function pollGuildEvents(guildId) {
  try {
    const res = await fetch("https://discord.com/api/v10/guilds/" + guildId + "/members?limit=1", {
      headers: {"Authorization": "Bot " + DISCORD_BOT_TOKEN}
    });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;

    const newest = data[0];
    const userId = newest.user?.id;
    const joinedAt = newest.joined_at;

    if (!userId || userId === lastEventId) return;

    // Check if joined in last 60 seconds
    const joinTime = new Date(joinedAt).getTime();
    const now = Date.now();
    if (now - joinTime > 60000) return;

    lastEventId = userId;
    console.log("New member joined: " + userId);

    const welcomeMsg = 
      "🗽 **Welcome to NYC Daily Picks!**\n\n" +
      "Thanks for joining! Here's how to get started:\n\n" +
      "📢 **FREE PICKS** — Check #free-picks every morning at 9AM ET\n" +
      "🏀 NBA, NFL, MLB, NHL, EPL, MMA & more\n\n" +
      "💎 **UPGRADE TO PREMIUM ($29.99/mo)**\n" +
      "• Early picks at 7AM (2hrs before free)\n" +
      "• Worldwide picks across every league\n" +
      "• Full breakdowns + high value parlays\n" +
      "• Access to #vip-picks, #early-drops, #high-confidence-plays\n\n" +
      "👉 Subscribe here: " + WHOP_LINK + "\n\n" +
      "⚠️ All picks are for entertainment only. Bet responsibly. 21+";

    await sendDM(userId, welcomeMsg);
  } catch(e) {
    console.error("Poll error:", e.message);
  }
}

export async function startDiscordWelcome(guildId) {
  console.log("👋 Discord welcome bot started for guild " + guildId);
  setInterval(() => pollGuildEvents(guildId), 30000);
}
