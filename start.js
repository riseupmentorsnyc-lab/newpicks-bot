import { spawn } from "child_process";
import cron from "node-cron";
import { runResultsBot } from "./results.js";

function startBot(name, file) {
  console.log("Starting " + name + "...");
  const proc = spawn("node", [file], { stdio: "inherit" });
  proc.on("exit", (code) => {
    console.log(name + " exited with code " + code + ". Restarting in 3s...");
    setTimeout(() => startBot(name, file), 3000);
  });
  return proc;
}

// Always-on bots
startBot("Welcome Bot", "welcome.js");
startBot("Tracker Bot", "tracker.js");

// 9AM ET — post daily picks
cron.schedule("0 9 * * *", () => {
  console.log("Running daily picks bot...");
  const picks = spawn("node", ["bot.js"], { stdio: "inherit" });
  picks.on("exit", (code) => console.log("Picks bot finished: " + code));
}, { timezone: "America/New_York" });

// 11PM ET — auto post results
cron.schedule("0 23 * * *", () => {
  console.log("Running auto results bot...");
  runResultsBot().catch(console.error);
}, { timezone: "America/New_York" });

console.log("All bots running! Picks post daily at 9AM ET.");
console.log("Welcome bot and Tracker bot always listening.");
console.log("Results post automatically at 11PM ET.");
