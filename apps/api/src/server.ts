import Fastify from "fastify";
import cors from "@fastify/cors";
import { dbWrite, metricsTable } from "@watchdog/db";
import { env } from "@watchdog/env";
import { metricsPayloadSchema } from "@watchdog/shared-types";

const fastify = Fastify({ logger: true });

await fastify.register(cors);

// TODO: Investigar como poner un SSE, recibir conexiones, validar api key, publicar data en bullMQ
// TODO: Investigar como leer BullMQ y guardar data en la base de datos
fastify.post("/metrics", async (request, reply) => {
  const parsed = metricsPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const [metric] = await dbWrite()
    .insert(metricsTable)
    .values({
      agentId: "agentePrueba", //falta obtener agentId,Leer el token del request, Buscar en BD qué agent tiene esa apiKey, Obtener el agentId
      value: parsed.data.cpu_percentage,
      metricsType: "cpu",
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
