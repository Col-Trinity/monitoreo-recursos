import { z } from "zod";

export const metricsPayloadSchema = z.object({
  cpu_percentage: z.number().min(0).max(100),
  host_name: z.string().optional(),
});

export type MetricsPayload = z.infer<typeof metricsPayloadSchema>;

export const sseMetricEventSchema = z.object({
  type: z.literal("metric"),
  data: z.object({
    id: z.number(),
    cpuPercentage: z.number(),
    hostName: z.string().nullable(),
    createdAt: z.string(),
  }),
});

export type SseMetricEvent = z.infer<typeof sseMetricEventSchema>;

export enum MetricType {
  CPU = "cpu",
  MEMORY = "memory",
  DISK = "disk",
  NETWORK = "network",
}

export const CpuValueSchema = z.object({
  usage: z.number().min(0).max(100),
});

export const MemoryValueSchema = z.object({
  used: z.number().nonnegative(),
  available: z.number().nonnegative(),
  cached: z.number().nonnegative(),
  total: z.number().nonnegative(),
  usedPercent: z.number().min(0).max(100),
});

export const DiskValueSchema = z.object({
  path: z.string(),
  used: z.number().nonnegative(),
  total: z.number().nonnegative(),
  free: z.number().nonnegative(),
  usedPercent: z.number().min(0).max(100),
});

export const NetworkValueSchema = z.object({
  name: z.string(),
  rx: z.number().nonnegative(),
  tx: z.number().nonnegative(),
  latency: z.number().nonnegative(),
});

export const MetricEnvelopeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(MetricType.CPU),
    timestamp: z.number(),
    host: z.string(),
    value: CpuValueSchema,
  }),
  z.object({
    type: z.literal(MetricType.MEMORY),
    timestamp: z.number(),
    host: z.string(),
    value: MemoryValueSchema,
  }),
  z.object({
    type: z.literal(MetricType.DISK),
    timestamp: z.number(),
    host: z.string(),
    value: DiskValueSchema,
  }),
  z.object({
    type: z.literal(MetricType.NETWORK),
    timestamp: z.number(),
    host: z.string(),
    value: NetworkValueSchema,
  }),
]);

export type MetricEnvelope = z.infer<typeof MetricEnvelopeSchema>;

export const MetricsContainerSchema = z.object({
  hostname: z.string(),
  timestamp: z.number(),
  metrics: z.array(MetricEnvelopeSchema),
});

export type MetricsContainer = z.infer<typeof MetricsContainerSchema>;
