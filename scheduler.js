import cron from "node-cron";
import { execSync } from "child_process";

console.log("⏰ Picks Bot Scheduler started.");
console.log("📅 Will post picks daily at 9:00 AM ET.\n");

cron.schedule("0 9 * * *", () => {
    console.log(`\n🚀 [${new Date().toISOString()}] Running daily picks bot...`);
    try {
      execSync("node bot.js", { stdio: "inherit" });
    } catch (e) {
      console.error("❌ Bot run failed:", e.message);
    }
  },
  { timezone: "America/New_York" }
);

process.on("SIGINT", () => { console.log("\n👋 Scheduler stopped."); process.exit(0); });
