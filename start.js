import { spawn } from "child_process";
import cron from "node-cron";

function startBot(name, file) {
  console.log("Starting " + name + "...");
  const proc = spawn("node", [file], { 
    stdio: "inherit",
    env: process.env
  });
  proc.on("exit", (code) => {
    console.log(name + " exited. Restarting in 3s...");
    setTimeout(() => startBot(name, file), 3000);
  });
  return proc;
}

startBot("Welcome Bot", "welcome.js");
startBot("Tracker Bot", "tracker.js");

cron.schedule("0 9 * * *", () => {
  console.log("Running daily picks bot...");
  const picks = spawn("node", ["bot.js"], { stdio: "inherit", env: process.env });
  picks.on("exit", (code) => console.log("Picks bot finished: " + code));
}, { timezone: "America/New_York" });

console.log("ENV CHECK:", JSON.stringify({tok: process.env.TELEGRAM_BOT_TOKEN?.slice(0,8), ch: process.env.TELEGRAM_CHANNEL_ID, admin: process.env.ADMIN_TELEGRAM_ID}));
console.log("All bots running! Picks post daily at 9AM ET.");
console.log("Welcome bot and Tracker bot always listening.");
