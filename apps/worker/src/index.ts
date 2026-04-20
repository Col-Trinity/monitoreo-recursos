import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "@watchdog/env";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  "default",
  async (job: Job) => {
    console.log(`[worker] processing ${job.name}#${job.id}`, job.data);
    return { ok: true };
  },
  { connection, concurrency: 4 },
);

worker.on("ready", () => console.log("[worker] ready"));
worker.on("failed", (job, err) => console.error(`[worker] ${job?.name}#${job?.id} failed:`, err));

async function shutdown() {
  console.log("[worker] shutting down...");
  await worker.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
