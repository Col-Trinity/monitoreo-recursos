import { z } from "zod/v4";
import { MetricType } from "./metrics";

export const QUEUES = {
  METRICS_INGEST: {
    name: "metrics:ingest",
    jobName: "new_metric",
  },
} as const;

export const MetricsIngestPayloadSchema = z.object({
  agentId: z.string(),
  metricsType: z.nativeEnum(MetricType),
  metricValue: z.number(),
  hostName: z.string(),
});

export type MetricsIngestPayload = z.infer<typeof MetricsIngestPayloadSchema>;

export function defineQueue<TPayload>(name: string, jobName: string, schema: z.ZodType<TPayload>) {
  return {
    name,
    jobName,
    parse: (data: unknown): TPayload => schema.parse(data),
  };
}

export const metricsIngestQueue = defineQueue(
  QUEUES.METRICS_INGEST.name,
  QUEUES.METRICS_INGEST.jobName,
  MetricsIngestPayloadSchema,
);
