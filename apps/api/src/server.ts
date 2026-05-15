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

const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const metricsQueue = new Queue("metrics", { connection });

const metricsEmitter = new EventEmitter();

const fastify = Fastify({ logger: true });

await fastify.register(cors);

fastify.addContentTypeParser("application/x-ndjson", (_request, payload, done) => {
  done(null, payload);
});
fastify.post("/metrics", async (request, reply) => {
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

fastify.post("/metrics/stream", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return reply.status(403).send({ error: "API key requerida" });

  const apiKey = authHeader.split("Bearer ")[1];
  if (!apiKey) return reply.status(401).send({ error: "Formato inválido" });

  const [agent] = await dbRead()
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.apiKey, hashApiKey(apiKey)));
  if (!agent) return reply.status(401).send({ error: "API key inválida" });

  // Creamos una interfaz para leer el stream línea por línea
  const rl = createInterface({ input: request.body as NodeJS.ReadableStream });

  rl.on("line", async (line) => {
    const parsed = MetricEnvelopeSchema.safeParse(JSON.parse(line));
    if (!parsed.success) return;

    const envelope = parsed.data;
    const hostName = envelope.host;
    const cpuPercentage = envelope.type === MetricType.CPU ? envelope.value.usage : 0;

    await metricsQueue.add("new_metric", {
      agentId: agent.id,
      metricsType: envelope.type,
      cpuPercentage,
      hostName,
    });

    metricsEmitter.emit("metric", {
      type: "metric",
      data: {
        cpuPercentage,
        hostName,
        createdAt: new Date(envelope.timestamp).toISOString(),
      },
    });
  });

  // Esperamos hasta que el agente cierre la conexión o se desconecte abruptamente
  await new Promise<void>((resolve) => {
    rl.on("close", resolve);
    rl.on("error", resolve);
  });
  return reply.status(200).send({ message: "stream closed" });
});

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
