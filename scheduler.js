/**
 * scheduler.js
 * Runs the bot automatically every day at 9:00 AM ET.
 * Run with: node scheduler.js  (keep this process alive on your server)
 *
 * Alternative: use a cron job instead —
 *   crontab -e
 *   0 9 * * * cd /path/to/picks-bot && node bot.js >> logs/cron.log 2>&1
 */

import cron from "node-cron";
import { execSync } from "child_process";

console.log("⏰ Picks Bot Scheduler started.");
console.log("📅 Will post picks daily at 9:00 AM ET.\n");

// "0 9 * * *" = 9:00 AM every day
// Adjust timezone as needed
cron.schedule(
  "0 9 * * *",
  () => {
    console.log(`\n🚀 [${new Date().toISOString()}] Running daily picks bot...`);
    try {
      execSync("node bot.js", { stdio: "inherit" });
    } catch (e) {
      console.error("❌ Bot run failed:", e.message);
    }
  },
  {
    timezone: "America/New_York",
  }
);

// Keep process alive
process.on("SIGINT", () => {
  console.log("\n👋 Scheduler stopped.");
  process.exit(0);
});
