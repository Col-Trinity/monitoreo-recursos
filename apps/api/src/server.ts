import Fastify from "fastify";
import cors from "@fastify/cors";
import { dbWrite, dbRead, metricsTable } from "@watchdog/db";
import { env } from "@watchdog/env";
import { metricsPayloadSchema } from "@watchdog/shared-types";
import { agentsTable } from "@watchdog/db/schema";
import { eq } from "drizzle-orm";

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

  return reply.status(200).send({ message: "ok", data: metric });
});

fastify.get("/health", async () => ({ status: "ok" }));

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
