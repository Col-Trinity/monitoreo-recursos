import type { FastifyPluginAsync } from "fastify";
import { Queue } from "bullmq";
import type { EventEmitter } from "node:events";
import { agentsTable } from "@watchdog/db/schema";
import { eq } from "drizzle-orm";
import { dbWrite } from "@watchdog/db";
import { createInterface } from "node:readline";
import { MetricType, metricsIngestQueue, MetricsContainerSchema } from "@watchdog/shared-types";
import { createHash } from "node:crypto";
import Redis from "ioredis";
import { env } from "@watchdog/env";

const metricsStreamPlugin: FastifyPluginAsync<{
  metricsEmitter: EventEmitter;
}> = async (fastify, opts) => {
  const connection = new Redis(env.REDIS_URL!, { maxRetriesPerRequest: null });
  const metricsQueue = new Queue(metricsIngestQueue.name, { connection });
  const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

  fastify.post("/metrics/stream", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) return reply.status(403).send({ error: "API key requerida" });

    const apiKey = authHeader.split("Bearer ")[1];
    if (!apiKey) return reply.status(401).send({ error: "Formato inválido" });
    //  Busca en la DB si existe un agente con ese hash
    const [agent] = await dbWrite()
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.apiKey, hashApiKey(apiKey)));
    if (!agent) return reply.status(401).send({ error: "API key inválida" });

    const rl = createInterface({ input: request.body as NodeJS.ReadableStream });

    rl.on("line", async (line) => {
      const parsed = MetricsContainerSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        reply.status(400).send({ error: "Invalid metric schema" });
        rl.close();
        return;
      }

      const container = parsed.data;

      for (const envelope of container.metrics) {
        const hostName = envelope.host;
        let metricValue: number;

        switch (envelope.type) {
          case MetricType.CPU:
            metricValue = envelope.value.usage;
            break;
          case MetricType.MEMORY:
          case MetricType.DISK:
            metricValue = envelope.value.usedPercent;
            break;
          case MetricType.NETWORK:
            metricValue = envelope.value.rx;
            break;
        }

        try {
          await metricsQueue.add(metricsIngestQueue.jobName, {
            agentId: agent.id,
            metricsType: envelope.type,
            metricValue,
            hostName,
          });
        } catch (err) {
          fastify.log.error(err, "Redis unavailable");
          reply.status(503).send({ error: "Service unavailable, retry later" });
          rl.close();
          return;
        }

        opts.metricsEmitter.emit("metric", {
          type: "metric",
          data: {
            metricValue,
            hostName,
            createdAt: new Date(envelope.timestamp).toISOString(),
          },
        });
      }
    });

    await new Promise<void>((resolve) => {
      rl.on("close", resolve); // agente cerró limpiamente
      rl.on("error", resolve); // agente se cayó
    });
    return reply.status(200).send({ message: "stream closed" });
  });
};

export default metricsStreamPlugin;
