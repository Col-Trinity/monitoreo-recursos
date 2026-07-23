import type { FastifyPluginAsync } from "fastify";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "@watchdog/env";
import { metricsIngestQueue } from "@watchdog/shared-types";

const adminQueuesPlugin: FastifyPluginAsync = async (fastify) => {
  if (env.NODE_ENV !== "development") {
    return;
  }

  const connection = new Redis(env.REDIS_URL!, { maxRetriesPerRequest: null });

  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(new Queue(metricsIngestQueue.name, { connection }))],
    serverAdapter,
  });

  await fastify.register(serverAdapter.registerPlugin(), { prefix: "/admin/queues" });
};

export default adminQueuesPlugin;
