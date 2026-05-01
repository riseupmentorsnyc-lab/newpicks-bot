import { spawn } from "child_process";
import cron from "node-cron";
import { autoAddPicks, autoMarkResults } from "./autotracker.js";
import { runPremiumBot } from "./premium.js";

function startBot(name, file) {
  console.log("Starting " + name + "...");
  const proc = spawn("node", [file], { stdio: "inherit" });
  proc.on("exit", (code) => {
    console.log(name + " exited. Restarting in 3s...");
    setTimeout(() => startBot(name, file), 3000);
  });
  return proc;
}

// Always-on public welcome bot
startBot("Welcome Bot", "welcome.js");

// 7AM ET — premium picks posted to private channel
cron.schedule("0 7 * * *", async () => {
  console.log("Running premium picks bot...");
  await runPremiumBot();
}, { timezone: "America/New_York" });

// 9AM ET — free picks posted + auto-added to tracker
cron.schedule("0 9 * * *", async () => {
  console.log("Running daily picks bot...");
  const picks = spawn("node", ["bot.js"], { stdio: "inherit" });
  picks.on("exit", async (code) => {
    console.log("Picks posted. Auto-adding to tracker...");
    setTimeout(async () => { await autoAddPicks(); }, 5000);
  });
}, { timezone: "America/New_York" });

// 11PM ET — auto-mark results and post to channel
cron.schedule("0 23 * * *", async () => {
  console.log("Running auto results...");
  await autoMarkResults();
}, { timezone: "America/New_York" });

console.log("Full auto mode active!");
console.log("7AM: premium picks posted to VIP channel");
console.log("9AM: free picks posted + auto-tracked");
console.log("11PM: results auto-marked + posted");
console.log("Welcome bot always listening.");
