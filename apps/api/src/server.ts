import Fastify from "fastify";
import cors from "@fastify/cors";
// TODO: re-add dbRead once replica is fixed
import { dbRead, dbWrite, metricsTable } from "@watchdog/db";
import { env } from "@watchdog/env";
import { metricsPayloadSchema } from "@watchdog/shared-types";
import { agentsTable } from "@watchdog/db/schema";
import { eq } from "drizzle-orm";
import { EventEmitter } from "node:events";

const metricsEmitter = new EventEmitter();

const fastify = Fastify({ logger: true });

await fastify.register(cors);

// TODO: Investigar como poner un SSE, recibir conexiones, validar api key, publicar data en bullMQ
// TODO: Investigar como leer BullMQ y guardar data en la base de datos
fastify.post("/metrics", async (request, reply) => {
  const parsed = metricsPayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const authHeader = request.headers.authorization;

  if (!authHeader) {
    console.log("API key requerida");
    return reply.status(403).send({ error: "API key requerida" });
  }

  const apiKey = authHeader.split("Bearer ")[1];
  if (!apiKey) {
    return reply.status(401).send({ error: "Formato inválido, debe ser Bearer <api_key>" });
  }

  // TODO: Hash Api-Key and search in database

  const [agent] = await dbRead().select().from(agentsTable).where(eq(agentsTable.apiKey, apiKey));

  if (!agent) {
    return reply.status(401).send({ error: "API key inválida" });
  }

  const [metric] = await dbWrite()
    .insert(metricsTable)
    .values({
      agentId: agent.id,
      metricsType: "cpu",
      value: parsed.data.cpu_percentage,
      hostname: parsed.data.server_name ?? "local-server",
    })
    .returning();

  if (!metric) {
    return reply.status(500).send({ error: "Error al guardar métrica" });
  }

  metricsEmitter.emit("metric", {
    type: "metric",
    data: {
      id: metric.id,
      cpuPercentage: metric.value,
      serverName: metric.hostname,
      createdAt: metric.createdAt.toISOString(),
    },
  });
  return reply.status(200).send({ message: "ok", data: metric });
});

fastify.get("/health", async () => ({ status: "ok" }));

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
