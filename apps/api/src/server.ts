import Fastify from "fastify";
import cors from "@fastify/cors";
import { dbRead } from "@watchdog/db";
import { env } from "@watchdog/env";
import { MetricEnvelopeSchema, MetricType } from "@watchdog/shared-types";
import { agentsTable } from "@watchdog/db/schema";
import { eq } from "drizzle-orm";
import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { createHash } from "node:crypto";
import metricsStreamPlugin from "./routes/metrics-stream"

const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const metricsQueue = new Queue("metrics", { connection });

const metricsEmitter = new EventEmitter();

const fastify = Fastify({ logger: true });

await fastify.register(cors);

await fastify.register(metricsStreamPlugin, {
  metricsQueue,
  metricsEmitter,
})

fastify.addContentTypeParser("application/x-ndjson", (_request, payload, done) => {
  done(null, payload);
});
fastify.post("/metrics", async (request, reply) => {

    fastify.log.warn("DEPRECATED: POST /metrics is deprecated, use POST /metrics/stream instead")
  const parsed = MetricEnvelopeSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(403).send({ error: "API key requerida" });
  }

  const apiKey = authHeader.split("Bearer ")[1];
  if (!apiKey) {
    return reply.status(401).send({ error: "Formato inválido, debe ser Bearer <api_key>" });
  }

  const [agent] = await dbRead()
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.apiKey, hashApiKey(apiKey)));

  if (!agent) {
    return reply.status(401).send({ error: "API key inválida" });
  }

  const envelope = parsed.data;
  const cpuPercentage = envelope.type === MetricType.CPU ? envelope.value.usage : 0;

  await metricsQueue.add("new_metric", {
    agentId: agent.id,
    metricsType: envelope.type,
    cpuPercentage,
    hostName: envelope.host,
  });

  return reply.status(200).send({ message: "ok" });
});

fastify.get("/health", async () => ({ status: "ok" }));

await fastify.register(metricsStreamPlugin, {
  metricsQueue,
  metricsEmitter,
})

fastify.get("/metrics/sse", (request, reply) => {
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
