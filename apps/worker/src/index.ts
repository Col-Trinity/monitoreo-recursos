import { Redis } from "ioredis";
import { env } from "@watchdog/env";
import http from "http";
import { Queue } from "bullmq";
import { metricsIngestQueue } from "@watchdog/shared-types";
import { flush, createWorker } from "./processors/metrics-ingest";
import { handleHealthRequest } from "./health";
import { logger } from "./logger";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const metricsQueue = new Queue(metricsIngestQueue.name, { connection });

const worker = createWorker(connection);

worker.on("ready", () => logger.info("worker ready"));

const healthServer = http.createServer(async (req, res) => {
  if (await handleHealthRequest(req, res, connection, metricsQueue)) return;
  res.writeHead(404);
  res.end();
});

const HEALTH_PORT = 3002;
healthServer.listen(HEALTH_PORT, () => {
  logger.info({ port: HEALTH_PORT }, "health check listening");
});

const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT ?? "30000");

async function shutdown() {
  logger.info("shutting down");

  const timer = setTimeout(() => {
    logger.warn("shutdown timeout, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
  await worker.close();
  await flush();
  await metricsQueue.close();
  await connection.quit();

  clearTimeout(timer);
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
