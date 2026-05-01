import { spawn } from "child_process";
import cron from "node-cron";
import { autoAddPicks, autoMarkResults } from "./autotracker.js";

function startBot(name, file) {
  console.log("Starting " + name + "...");
  const proc = spawn("node", [file], { stdio: "inherit" });
  proc.on("exit", (code) => {
    console.log(name + " exited. Restarting in 3s...");
    setTimeout(() => startBot(name, file), 3000);
  });
  return proc;
}

// Always-on bots
startBot("Welcome Bot", "welcome.js");
startBot("Tracker Bot", "tracker.js");

// 9AM ET — post picks then auto-add to tracker
cron.schedule("0 9 * * *", async () => {
  console.log("Running daily picks bot...");
  const picks = spawn("node", ["bot.js"], { stdio: "inherit" });
  picks.on("exit", async (code) => {
    console.log("Picks bot finished. Auto-adding to tracker...");
    await autoAddPicks();
  });
}, { timezone: "America/New_York" });

// 11PM ET — auto-mark results and post to channel
cron.schedule("0 23 * * *", async () => {
  console.log("Running auto results...");
  await autoMarkResults();
}, { timezone: "America/New_York" });

console.log("All bots running!");
console.log("9AM: picks post + auto-added to tracker");
console.log("11PM: results auto-marked and posted");
console.log("Welcome bot and Tracker bot always listening.");
