import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "@watchdog/env";
import http from "http";
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

const healthServer = http.createServer((req, res) => {
if (req.url === "/health" && req.method === "GET") {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
} else {
  res.writeHead(404);
  res.end();
}
});

const HEALTH_PORT = 3002;
healthServer.listen(HEALTH_PORT, () => {
  console.log(`[worker] health check listening on prt ${HEALTH_PORT}`)
})

async function shutdown() {
  console.log("[worker] shutting down...");
  await worker.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
