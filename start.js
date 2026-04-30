import { spawn } from "child_process";
import cron from "node-cron";

function startBot(name, file) {
  console.log("Starting " + name + "...");
  const proc = spawn("node", [file], { stdio: "inherit" });
  proc.on("exit", (code) => {
    console.log(name + " exited with code " + code + ". Restarting in 3s...");
    setTimeout(() => startBot(name, file), 3000);
  });
  return proc;
}

// Start welcome and tracker bots — always on
startBot("Welcome Bot", "welcome.js");
startBot("Tracker Bot", "tracker.js");

// Run picks bot daily at 9AM ET
cron.schedule("0 9 * * *", () => {
  console.log("Running daily picks bot...");
  const picks = spawn("node", ["bot.js"], { stdio: "inherit" });
  picks.on("exit", (code) => console.log("Picks bot finished with code " + code));
}, { timezone: "America/New_York" });

console.log("All bots running! Picks post daily at 9AM ET.");
console.log("Welcome bot and Tracker bot always listening.");
