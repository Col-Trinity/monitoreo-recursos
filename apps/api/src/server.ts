import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "@watchdog/env";
import { EventEmitter } from "node:events";
import metricsStreamPlugin from "./routes/metrics-stream";

const metricsEmitter = new EventEmitter();

const fastify = Fastify({ logger: true });

await fastify.register(cors);

fastify.addContentTypeParser("application/x-ndjson", (_request, payload, done) => {
  done(null, payload);
});

await fastify.register(metricsStreamPlugin, {
  metricsEmitter,
});

fastify.get("/health", async () => ({ status: "ok" }));

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

try {
  await fastify.listen({ port: env.API_PORT, host: env.API_HOST });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

process.on("SIGINT", async () => {
  fastify.log.info("Shutting down...");
  await fastify.close();
  process.exit(0);
});
