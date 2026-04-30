import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const TOKEN = process.env.TRACKER_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;

let picks = [];
let pickCounter = 1;
let offset = 0;

function isAdmin(chatId) { return String(chatId) === String(ADMIN_ID); }
function today() { return new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }); }
function todaysPicks() { return picks.filter((p) => p.date === today()); }
function recordSummary() {
  const wins = picks.filter((p) => p.result === "win").length;
  const losses = picks.filter((p) => p.result === "loss").length;
  const total = wins + losses;
  const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
  return { wins, losses, total, pct };
}
async function sendMsg(chatId, text) {
  await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}
async function postChannel(text) {
  await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID, text, parse_mode: "HTML" }),
  });
}
async function handleCommand(msg) {
  const chatId = msg.chat.id;
  const parts = (msg.text || "").trim().split(" ");
  const cmd = parts[0].toLowerCase();
  if (String(chatId) !== String(ADMIN_ID)) { await sendMsg(chatId, "You are not authorized."); return; }
  if (cmd === "/addpick") {
    const t = parts.slice(1).join(" ");
    if (!t) { await sendMsg(chatId, "Usage: /addpick Knicks -4.5 (-110)"); return; }
    const p = { id: pickCounter++, text: t, result: "pending", date: today() };
    picks.push(p);
    await sendMsg(chatId, "Pick #" + p.id + " added: " + t + " | Status: Pending");
  } else if (cmd === "/win") {
    const p = picks.find((x) => x.id === parseInt(parts[1]));
    if (!p) { await sendMsg(chatId, "Pick not found."); return; }
    p.result = "win";
    await sendMsg(chatId, "Pick #" + p.id + " marked WIN: " + p.text);
  } else if (cmd === "/loss") {
    const p = picks.find((x) => x.id === parseInt(parts[1]));
    if (!p) { await sendMsg(chatId, "Pick not found."); return; }
    p.result = "loss";
    await sendMsg(chatId, "Pick #" + p.id + " marked LOSS: " + p.text);
  } else if (cmd === "/today") {
    const tp = todaysPicks();
    if (tp.length === 0) { await sendMsg(chatId, "No picks today. Use /addpick"); return; }
    let out = "PICKS - " + today() + "\n\n";
    for (const p of tp) out += "#" + p.id + " " + (p.result==="win" ? "WIN" : p.result==="loss" ? "LOSS" : "PENDING") + " " + p.text + "\n";
    await sendMsg(chatId, out);
  } else if (cmd === "/listpicks") {
    const tp = todaysPicks();
    if (tp.length === 0) { await sendMsg(chatId, "No picks today."); return; }
    let out = "ALL PICKS TODAY\n\n";
    for (const p of tp) out += "ID:" + p.id + " " + p.result.toUpperCase() + " | " + p.text + "\n";
    await sendMsg(chatId, out);
  } else if (cmd === "/record") {
    const { wins, losses, total, pct } = recordSummary();
    await sendMsg(chatId, "RECORD\n\nWins: " + wins + "\nLosses: " + losses + "\nWin Rate: " + pct + "%\nTotal: " + total);
  } else if (cmd === "/summary") {
    const tp = todaysPicks();
    if (tp.length === 0) { await sendMsg(chatId, "No picks to summarize."); return; }
    const { wins, losses, pct } = recordSummary();
    let out = "RESULTS - " + today() + "\nNYC Daily Picks\n\n";
    for (const p of tp) out += "Pick #" + p.id + ": " + p.text + " - " + (p.result==="win"?"HIT":p.result==="loss"?"MISS":"PENDING") + "\n";
    const tw = tp.filter((p) => p.result==="win").length;
    const tl = tp.filter((p) => p.result==="loss").length;
    out += "\nToday: " + tw + "-" + tl + "\nAll-Time: " + wins + "-" + losses + " (" + pct + "%)\n\nBet responsibly. 21+";
    await postChannel(out);
    await sendMsg(chatId, "Results posted to channel!");
  } else if (cmd === "/help" || cmd === "/start") {
    await sendMsg(chatId, "NYC Picks Tracker\n\n/addpick [text]\n/win [id]\n/loss [id]\n/today\n/listpicks\n/record\n/summary\n/help");
  } else {
    await sendMsg(chatId, "Unknown command. Send /help");
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
      }
    }
  } catch (e) { console.error("Poll error:", e.message); }
  setTimeout(poll, 1000);
}
console.log("NYC Picks Tracker Bot started!");
console.log("Admin ID: " + ADMIN_ID);
console.log("Channel: " + CHANNEL_ID);
poll();
