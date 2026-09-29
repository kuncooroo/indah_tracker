/**
 * Manual / Task Scheduler runner:
 *   npx tsx scripts/run-deadline-reminders.ts
 *
 * Atau via HTTP:
 *   curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3001/api/cron/deadline-reminders
 */
import "dotenv/config";
import { runDeadlineReminderJob } from "../src/lib/reminder-job";

async function main() {
  console.log("[cron] deadline reminders starting…");
  const result = await runDeadlineReminderJob();
  console.log(JSON.stringify(result, null, 2));
  if (result.emailError) {
    console.error("[cron] email error:", result.emailError);
    process.exitCode = 1;
  }
  if (result.telegramError) {
    console.error("[cron] telegram error:", result.telegramError);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
