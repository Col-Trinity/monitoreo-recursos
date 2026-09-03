import type { FastifyPluginAsync } from "fastify";
import { Queue } from "bullmq";
import type { EventEmitter } from "node:events";

import { createInterface } from "node:readline";
import { MetricType, metricsIngestQueue, MetricsContainerSchema } from "@watchdog/shared-types";

import Redis from "ioredis";
import { env } from "@watchdog/env";
import { authenticateAgent } from "../plugins/auth-agent";

import { eq } from "drizzle-orm";
import { agentsTable, dbWrite } from "@watchdog/db";

const metricsStreamPlugin: FastifyPluginAsync<{
  metricsEmitter: EventEmitter;
}> = async (fastify, opts) => {
  const connection = new Redis(env.REDIS_URL!, { maxRetriesPerRequest: null });
  const metricsQueue = new Queue(metricsIngestQueue.name, { connection });

  const HEARTBEAT_THROTTLE_MS = 30_000;

  fastify.post("/metrics/stream", { preHandler: authenticateAgent }, async (request, reply) => {
    const rl = createInterface({ input: request.body as NodeJS.ReadableStream });

    let lastHeartbeatWrite = 0;
    const writeHeartbeat = async () => {
      lastHeartbeatWrite = Date.now();
      try {
        await dbWrite()
          .update(agentsTable)
          .set({ lastHeartbeat: new Date() })
          .where(eq(agentsTable.id, request.agent!.id));
      } catch (err) {
        fastify.log.error(err, "Error actualizando lastHeartbeat");
      }
    };
    const touchHeartbeat = async () => {
      if (Date.now() - lastHeartbeatWrite < HEARTBEAT_THROTTLE_MS) return;
      await writeHeartbeat();
    };

    rl.on("line", async (line) => {
      await touchHeartbeat();
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
          await metricsQueue.add(
            metricsIngestQueue.jobName,
            {
              agentId: request.agent!.id,
              metricsType: envelope.type,
              metricValue,
              hostName,
            },
            {
              removeOnComplete: 1000,
              removeOnFail: 5000,
            },
          );
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
      rl.on("close", async () => {
        await writeHeartbeat();
        resolve();
      });
      rl.on("error", resolve); // agente se cayó
    });
    return reply.status(200).send({ message: "stream closed" });
  });
};

export default metricsStreamPlugin;
