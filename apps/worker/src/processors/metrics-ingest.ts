import { type MetricsIngestPayload, metricsIngestQueue, QUEUES } from "@watchdog/shared-types";
import { dbWrite, metricsTable } from "@watchdog/db";
import { Worker, type Job, Queue } from "bullmq";
import { env } from "@watchdog/env";
import { Redis } from "ioredis";
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const buffer: MetricsIngestPayload[] = [];
let bufferBytes = 0;

export async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0);
  bufferBytes = 0;
  await dbWrite()
    .insert(metricsTable)
    .values(
      batch.map((item) => ({
        agentId: item.agentId,
        metricsType: item.metricsType,
        value: item.metricValue,
        hostname: item.hostName,
      })),
    )
    .onConflictDoNothing();
  console.log(`[worker] flushed ${batch.length} metrics`);
}
setInterval(async () => {
  await flush();
}, 5000);

export const worker = new Worker(
  metricsIngestQueue.name,
  async (job: Job) => {
    const data = metricsIngestQueue.parse(job.data);
    buffer.push(data);
    bufferBytes += Buffer.byteLength(JSON.stringify(data));

    if (bufferBytes >= env.WORKER_BUFFER_MAX_BYTES) {
      await flush();
    }
  },
  {
    connection,
    concurrency: 1,
    settings: {
      backoffStrategy: (attemtsMade: number) => {
        return Math.pow(2, attemtsMade) * 1000;
      },
    },
  },
);
worker.on("failed", async (job, err) => {
  console.error(`[worker] ${job?.name}#${job?.id} failed:`, err);
  if (job && job.attemptsMade >= 3) {
    const dlq = new Queue(QUEUES.METRICS_INGEST.dlq, { connection });
    await dlq.add(metricsIngestQueue.jobName, job.data);
  }
});
