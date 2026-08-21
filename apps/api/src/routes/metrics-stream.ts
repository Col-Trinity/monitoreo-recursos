import type { FastifyPluginAsync } from "fastify";
import { Queue } from "bullmq";
import type { EventEmitter } from "node:events";

import { createInterface } from "node:readline";
import { MetricType, metricsIngestQueue, MetricsContainerSchema } from "@watchdog/shared-types";

import Redis from "ioredis";
import { env } from "@watchdog/env";
import { authenticateAgent } from "../plugins/auth-agent";

const metricsStreamPlugin: FastifyPluginAsync<{
  metricsEmitter: EventEmitter;
}> = async (fastify, opts) => {
  const connection = new Redis(env.REDIS_URL!, { maxRetriesPerRequest: null });
  const metricsQueue = new Queue(metricsIngestQueue.name, { connection });

  fastify.post("/metrics/stream", { preHandler: authenticateAgent }, async (request, reply) => {
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
            metricValue = Math.min(envelope.value.usage, 100);
            break;
          case MetricType.MEMORY:
          case MetricType.DISK:
            metricValue = Math.min(envelope.value.usedPercent, 100);
            break;
          case MetricType.NETWORK:
            metricValue = envelope.value.rx;
            break;
        }

        try {
          await metricsQueue.add(metricsIngestQueue.jobName, {
            agentId: request.agent!.id,
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
