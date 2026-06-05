import { Redis } from "ioredis";
import { env } from "@watchdog/env";
import http from "http";
import { flush, createWorker } from "./processors/metrics-ingest"
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = createWorker(connection);

worker.on("ready", () => console.log("[worker] ready"));

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
  console.log(`[worker] health check listening on prt ${HEALTH_PORT}`);
});

const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT??"30000" );

async function shutdown() {
  console.log("[worker] shutting down...");

   const timer = setTimeout(() => {
        console.log("[worker] shutdown timeout, forcing exit")
        process.exit(1)
    }, SHUTDOWN_TIMEOUT)
  await worker.close();
  await flush();
  await connection.quit();

  clearTimeout(timer  )
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
