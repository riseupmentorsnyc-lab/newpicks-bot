import fetch from "node-fetch";
import dotenv from "dotenv";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { createCanvas, loadImage } from "canvas";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const EXTRA_CHANNEL_ID = process.env.EXTRA_CHANNEL_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_FREE_CHANNEL = process.env.DISCORD_FREE_CHANNEL;

function today() {
  return new Date().toISOString().split("T")[0];
}

async function generateTicketImage(pick, result) {
  const width = 800;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  const isWin = result === "win";
  ctx.fillStyle = isWin ? "#0a1628" : "#1a0a0a";
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = isWin ? "#00ff88" : "#ff4444";
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Header bar
  ctx.fillStyle = isWin ? "#00ff88" : "#ff4444";
  ctx.fillRect(10, 10, width - 20, 70);

  // Header text
  ctx.fillStyle = "#000000";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText("NYC DAILY PICKS", width / 2, 55);

  // Result badge
  ctx.fillStyle = isWin ? "#00ff88" : "#ff4444";
  ctx.beginPath();
  ctx.roundRect(width / 2 - 100, 100, 200, 60, 10);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.font = "bold 32px Arial";
  ctx.fillText(isWin ? "✅ WON" : "❌ LOST", width / 2, 140);

  // Pick details
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  ctx.fillText(pick.text, width / 2, 210);

  ctx.fillStyle = "#aaaaaa";
  ctx.font = "18px Arial";
  ctx.fillText(pick.sport + " | " + (pick.book || "DraftKings/FanDuel"), width / 2, 245);

  // Date
  ctx.fillStyle = "#888888";
  ctx.font = "16px Arial";
  ctx.fillText(new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" }), width / 2, 285);

  // Divider
  ctx.strokeStyle = isWin ? "#00ff88" : "#ff4444";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 310);
  ctx.lineTo(width - 50, 310);
  ctx.stroke();

  // Footer
  ctx.fillStyle = "#888888";
  ctx.font = "14px Arial";
  ctx.fillText("t.me/NYCDaliyPicks | For entertainment only. 21+", width / 2, 345);

  ctx.fillStyle = isWin ? "#00ff88" : "#ff4444";
  ctx.font = "bold 16px Arial";
  ctx.fillText("@NYCDailyPicks_Bot", width / 2, 375);

  return canvas.toBuffer("image/png");
}

async function postImageToTelegram(imageBuffer, caption, chatId) {
  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("photo", imageBuffer, { filename: "ticket.png", contentType: "image/png" });

  const res = await fetch("https://api.telegram.org/bot" + TOKEN + "/sendPhoto", {
    method: "POST",
    body: form,
    headers: form.getHeaders()
  });
  const data = await res.json();
  if (!data.ok) console.error("Telegram photo error:", JSON.stringify(data));
  else console.log("✅ Ticket posted to " + chatId);
}

async function postImageToDiscord(imageBuffer, caption, channelId) {
  if (!DISCORD_BOT_TOKEN || !channelId) return;
  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("content", caption);
  form.append("file", imageBuffer, { filename: "ticket.png", contentType: "image/png" });

  const res = await fetch("https://discord.com/api/v10/channels/" + channelId + "/messages", {
    method: "POST",
    body: form,
    headers: { ...form.getHeaders(), "Authorization": "Bot " + DISCORD_BOT_TOKEN }
  });
  const data = await res.json();
  if (data.id) console.log("✅ Ticket posted to Discord");
  else console.error("Discord photo error:", JSON.stringify(data));
}

export async function generateAndPostTickets() {
  console.log("\n🎫 Generating betting tickets...");

  const dbFile = "./logs/tracker-db.json";
  if (!existsSync(dbFile)) { console.log("No tracker DB found."); return; }

  const db = JSON.parse(await readFile(dbFile, "utf8"));
  const todaysPicks = db.picks.filter(p => p.date === today() && p.result !== "pending");

  if (todaysPicks.length === 0) { console.log("No completed picks today."); return; }

  if (!existsSync("./logs/tickets")) await mkdir("./logs/tickets", { recursive: true });

  for (const pick of todaysPicks) {
    try {
      console.log("Generating ticket for: " + pick.text + " (" + pick.result + ")");
      const imageBuffer = await generateTicketImage(pick, pick.result);

      // Save locally
      await writeFile("./logs/tickets/" + today() + "-pick" + pick.id + ".png", imageBuffer);

      const caption = (pick.result === "win" ? "✅ WINNING TICKET" : "❌ LOSING TICKET") +
        "\n" + pick.text +
        "\n\nNYC Daily Picks | t.me/NYCDaliyPicks\n⚠️ Entertainment only. 21+";

      // Post to Telegram channels
      await postImageToTelegram(imageBuffer, caption, CHANNEL_ID);
      if (EXTRA_CHANNEL_ID) await postImageToTelegram(imageBuffer, caption, EXTRA_CHANNEL_ID);

      // Post to Discord
      await postImageToDiscord(imageBuffer, caption, DISCORD_FREE_CHANNEL);

      // Small delay between tickets
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {
      console.error("Ticket error for pick " + pick.id + ":", e.message);
    }
  }

  console.log("✅ All tickets generated and posted!");
}

generateAndPostTickets().catch(console.error);
