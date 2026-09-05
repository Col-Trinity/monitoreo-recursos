import * as Sentry from "@sentry/node";
import { env } from "@watchdog/env";

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
});

import Fastify from "fastify";
import cors from "@fastify/cors";
import { EventEmitter } from "node:events";
import metricsStreamPlugin from "./routes/metrics-stream";
import adminQueuesPlugin from "./routes/admin-queue";
import authAgentPlugin from "./plugins/auth-agent";
import healthPlugin from "./routes/health";
import { randomUUID } from "node:crypto";

const metricsEmitter = new EventEmitter();

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
        : undefined,
    base: { service: "api" },
  },
  genReqId: () => randomUUID(), //generate Request Id
  requestIdLogLabel: "correlation_id",
});

await fastify.register(cors);

fastify.addHook("onSend", async (request, reply) => {
  reply.header("x-correlation-id", request.id);
});

fastify.addContentTypeParser("application/x-ndjson", (_request, payload, done) => {
  done(null, payload);
});

await fastify.register(authAgentPlugin);
await fastify.register(metricsStreamPlugin, { metricsEmitter });
await fastify.register(adminQueuesPlugin);
await fastify.register(healthPlugin);

fastify.get("/metrics/sse", (request, reply) => {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const onMetric = (event: unknown) => {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  metricsEmitter.on("metric", onMetric);

  request.raw.on("close", () => {
    metricsEmitter.off("metric", onMetric);
  });
});

fastify.setErrorHandler((error, _request, reply) => {
  Sentry.captureException(error);
  void reply.status(500).send({ error: "Internal Server Error" });
});

try {
  await fastify.listen({ port: env.API_PORT, host: env.API_HOST });
} catch (err) {
  Sentry.captureException(err);
  fastify.log.error(err);
  process.exit(1);
}

process.on("SIGINT", async () => {
  fastify.log.info("Shutting down...");
  await fastify.close();
  process.exit(0);
});
