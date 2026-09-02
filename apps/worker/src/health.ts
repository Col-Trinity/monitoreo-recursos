import { dbWrite, metricsTable } from "@watchdog/db";
import type http from "http";
import type { Redis } from "ioredis";
import type { Queue } from "bullmq";

const HEALTH_CHECK_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("health check timed out")), ms),
    ),
  ]);
}

export async function handleHealthRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  connection: Redis,
  metricsQueue: Queue,
): Promise<boolean> {
  if (req.url === "/live" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return true;
  }

  if (req.url === "/ready" && req.method === "GET") {
    try {
      await withTimeout(dbWrite().select().from(metricsTable).limit(1), HEALTH_CHECK_TIMEOUT_MS);
      await withTimeout(connection.ping(), HEALTH_CHECK_TIMEOUT_MS);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    } catch (error) {
      console.error(error);
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "error" }));
    }
    return true;
  }

  if (req.url === "/health" && req.method === "GET") {
    try {
      const dbStart = Date.now();
      await withTimeout(dbWrite().select().from(metricsTable).limit(1), HEALTH_CHECK_TIMEOUT_MS);
      const dbLatency = Date.now() - dbStart;

      await withTimeout(connection.ping(), HEALTH_CHECK_TIMEOUT_MS);
      const queueDepth = await withTimeout(metricsQueue.getWaitingCount(), HEALTH_CHECK_TIMEOUT_MS);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          database: { latencyMs: dbLatency },
          redis: { status: "ok" },
          queue: { depth: queueDepth },
        }),
      );
    } catch (error) {
      console.error(error);
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "error" }));
    }
    return true;
  }

  return false;
}
