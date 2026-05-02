import { spawn } from "child_process";
import cron from "node-cron";
import { autoAddPicks, autoMarkResults } from "./autotracker.js";
import { runPremiumBot } from "./premium.js";
import { generateAndPostTickets } from "./tickets.js";
import { startDiscordWelcome } from "./discord-welcome.js";
import { runAlldaySession } from "./allday.js";
import { runEarlyDrops, runHighConfidence } from "./vippicks.js";

function startBot(name, file) {
  console.log("Starting " + name + "...");
  const proc = spawn("node", [file], { stdio: "inherit" });
  proc.on("exit", (code) => {
    console.log(name + " exited. Restarting in 3s...");
    setTimeout(() => startBot(name, file), 3000);
  });
  return proc;
}

startBot("Welcome Bot", "welcome.js");

cron.schedule("0 7 * * *", async () => {
  console.log("Running premium picks bot...");
  await runPremiumBot();
}, { timezone: "America/New_York" });

// 12PM ET — afternoon premium update
cron.schedule("0 12 * * *", async () => {
  console.log("Running afternoon premium session...");
  await runAlldaySession("afternoon");
}, { timezone: "America/New_York" });

// 6PM ET — evening premium card
cron.schedule("0 18 * * *", async () => {
  console.log("Running evening premium session...");
  await runAlldaySession("evening");
}, { timezone: "America/New_York" });

// 9PM ET — late night plays
cron.schedule("0 21 * * *", async () => {
  console.log("Running late night premium session...");
  await runAlldaySession("latenight");
}, { timezone: "America/New_York" });

cron.schedule("0 9 * * *", async () => {
  console.log("Running daily picks bot...");
  const picks = spawn("node", ["bot.js"], { stdio: "inherit" });
  picks.on("exit", async (code) => {
    console.log("Picks posted. Auto-adding to tracker...");
    setTimeout(async () => { await autoAddPicks(); }, 5000);
  });
}, { timezone: "America/New_York" });

cron.schedule("0 23 * * *", async () => {
  console.log("Running auto results...");
  await autoMarkResults();
  setTimeout(async () => { await generateAndPostTickets(); }, 30000);
}, { timezone: "America/New_York" });

console.log("Full auto mode active!");
console.log("7AM: worldwide premium picks posted");
console.log("12PM: afternoon premium update");
console.log("6PM: evening premium card");
console.log("9PM: late night premium plays");
console.log("9AM: free picks posted + auto-tracked");
console.log("11PM: results auto-marked + posted");
console.log("Welcome bot always listening.");
startDiscordWelcome("1133614806637740053");
