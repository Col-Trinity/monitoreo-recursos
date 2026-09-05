import * as Sentry from "@sentry/node";
import { env } from "@watchdog/env";

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
});

import { Redis } from "ioredis";
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

worker.on("failed", (job, err) => {
  Sentry.captureException(err, {
    extra: { jobId: job?.id, jobName: job?.name },
  });
});

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

process.on("uncaughtException", (err) => {
  Sentry.captureException(err);
  console.error("[worker] uncaughtException:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
  console.error("[worker] unhandledRejection:", reason);
});