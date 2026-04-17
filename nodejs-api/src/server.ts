import Fastify from "fastify";
import cors from "@fastify/cors";
import { db } from "./server/db";
import { metricsTable } from "./server/db/schema";

const fastify = Fastify({ logger: true });

fastify.register(cors);

fastify.post<{ Body: { cpu_percentage: number } }>(
  "/metrics",
  async (request, reply) => {
    const { cpu_percentage } = request.body;

    if (cpu_percentage === undefined || cpu_percentage === null) {
      return reply.status(400).send({
        error: "cpu_percentage es requerido",
      });
    }

    if (cpu_percentage < 0 || cpu_percentage > 100) {
      return reply.status(400).send({
        error: "cpu_percentage debe estar entre 0 y 100",
      });
    }

    try {
      const metric = await db.insert(metricsTable).values({
        cpuPercentage: cpu_percentage,
        serverName: "local-server",
      }).returning();;

      return reply.status(200).send({
        message: "Metrica guardada exitosamente",
        data: metric,
      });
    } catch (error) {
      console.error("Error guardando métrica:", error);
      return reply.status(500).send({
        error: "Error al guardar la métrica",
      });
    }
  },
);
// Para verificar que el servidor está vivo
fastify.get("/health", async (request, reply) => {
  return { status: "ok" };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: "0.0.0.0" });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  console.log("Cerrando servidor...");
  process.exit(0);
});


start();
