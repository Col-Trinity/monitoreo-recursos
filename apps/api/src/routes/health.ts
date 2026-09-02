import type { FastifyPluginAsync } from "fastify";
import { Redis } from "ioredis";
import { Queue } from "bullmq";
import { env } from "@watchdog/env";
import { dbWrite, metricsTable } from "@watchdog/db";
import { metricsIngestQueue } from "@watchdog/shared-types";

const healthPlugin: FastifyPluginAsync = async (fastify) => {
  const connection = new Redis(env.REDIS_URL!, { maxRetriesPerRequest: null });
  const metricsQueue = new Queue(metricsIngestQueue.name, { connection });

  fastify.get("/live", async () => ({ status: "ok" }));

  fastify.get("/ready", async (_request, reply) => {
    try {
      await dbWrite().select().from(metricsTable).limit(1);
      await connection.ping();
      return { status: "ok" };
    } catch (error) {
      console.error(error);
      return reply.status(503).send({ status: "error" });
    }
  });
  fastify.get("/health", async (_request, reply) => {
    try {
      const dbStart = Date.now();
      await dbWrite().select().from(metricsTable).limit(1);
      const dbLatency = Date.now() - dbStart;

      await connection.ping();

      const queueDepth = await metricsQueue.getWaitingCount();

      return {
        status: "ok",
        database: { latencyMs: dbLatency },
        redis: { status: "ok" },
        queue: { depth: queueDepth },
      };
    } catch (error) {
      console.error(error);
      return reply.status(503).send({ status: "error" });
    }
  });
};
export default healthPlugin;
