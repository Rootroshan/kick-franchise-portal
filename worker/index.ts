import * as Sentry from "@sentry/node";
import { Worker, type Job } from "bullmq";
import { getQueue, redisConnection, QUEUE_NAME } from "./queue";
import { publishScheduledAnnouncements, expireAnnouncements } from "./jobs/announcements";
import { sendOverdueTaskReminders } from "./jobs/tasks";
import { runMonthlyRebateReports, runQuarterlyRebateReports } from "./jobs/rebates";
import { cleanupDeadSubscriptions } from "./jobs/push";

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}

type JobName =
  | "announcements.publish"
  | "announcements.expire"
  | "tasks.overdue"
  | "rebates.report.monthly"
  | "rebates.report.quarterly"
  | "push.cleanup";

async function handlers(job: Job<unknown, unknown, JobName>) {
  switch (job.name) {
    case "announcements.publish":
      return publishScheduledAnnouncements();
    case "announcements.expire":
      return expireAnnouncements();
    case "tasks.overdue":
      return sendOverdueTaskReminders();
    case "rebates.report.monthly":
      return runMonthlyRebateReports();
    case "rebates.report.quarterly":
      return runQuarterlyRebateReports();
    case "push.cleanup":
      return cleanupDeadSubscriptions();
    default:
      throw new Error(`Unknown job: ${job.name}`);
  }
}

async function main() {
  const worker = new Worker(QUEUE_NAME, handlers, {
    connection: redisConnection(),
    concurrency: 5,
  });

  worker.on("completed", (job, result) => {
    console.log(`[worker] ${job.name} completed`, result);
  });
  worker.on("failed", (job, err) => {
    console.error(`[worker] ${job?.name} failed:`, err);
    Sentry.captureException(err, { tags: { job: job?.name } });
  });

  const queue = getQueue();

  // Register repeatable jobs. BullMQ dedupes by jobId + repeat pattern, so
  // this is safe to run on every worker boot without creating duplicates.
  await queue.upsertJobScheduler("announcements-publish", { pattern: "*/1 * * * *" }, { name: "announcements.publish" });
  await queue.upsertJobScheduler("announcements-expire", { pattern: "*/5 * * * *" }, { name: "announcements.expire" });
  await queue.upsertJobScheduler("tasks-overdue", { pattern: "0 * * * *" }, { name: "tasks.overdue" });
  await queue.upsertJobScheduler("rebates-monthly", { pattern: "0 2 1 * *" }, { name: "rebates.report.monthly" });
  await queue.upsertJobScheduler("rebates-quarterly", { pattern: "0 2 1 1,4,7,10 *" }, { name: "rebates.report.quarterly" });
  await queue.upsertJobScheduler("push-cleanup", { pattern: "0 */6 * * *" }, { name: "push.cleanup" });

  console.log("[worker] started, listening for jobs on queue:", QUEUE_NAME);

  process.on("SIGTERM", async () => {
    await worker.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
