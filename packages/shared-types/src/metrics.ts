import { z } from "zod";

export const metricsPayloadSchema = z.object({
  cpu_percentage: z.number().min(0).max(100),
  server_name: z.string().optional(),
});

export type MetricsPayload = z.infer<typeof metricsPayloadSchema>;

export const sseMetricEventSchema = z.object({
  type: z.literal("metric"),
  data: z.object({
    id: z.number(),
    cpuPercentage: z.number(),
    serverName: z.string().nullable(),
    createdAt: z.string(),
  }),
});

export type SseMetricEvent = z.infer<typeof sseMetricEventSchema>;
