import { and, between, eq } from "drizzle-orm";
import { dbRead } from "../index";
import {
  metricsTable,
  metrics1mView,
  metrics1hView,
  metrics1dView,
  type metricsEnum,
} from "../schema/metrics";

export interface MetricPoint {
  timestamp: Date;
  value: number;
  min?: number;
  max?: number;
  sampleCount?: number;
}

type MetricName = (typeof metricsEnum.enumValues)[number]; // "memory" | "disk" | "cpu" | "network"

export function pickAggregationLevel(from: Date, to: Date): "raw" | "1m" | "1h" | "1d" {
  const rangeMs = to.getTime() - from.getTime();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (rangeMs <= 1 * hour) return "raw";
  if (rangeMs < 1 * day) return "1m";
  if (rangeMs < 30 * day) return "1h";
  return "1d";
}

export async function queryMetrics({
  agentId,
  metric,
  from,
  to,
}: {
  agentId: string;
  metric: MetricName;
  from: Date;
  to: Date;
}): Promise<MetricPoint[]> {
  const level = pickAggregationLevel(from, to);

  if (level === "raw") {
    const rows = await dbRead()
      .select({ timestamp: metricsTable.createdAt, value: metricsTable.value })
      .from(metricsTable)
      .where(
        and(
          eq(metricsTable.agentId, agentId),
          eq(metricsTable.metricsType, metric),
          between(metricsTable.createdAt, from, to),
        ),
      );

    return rows.map((r) => ({ timestamp: r.timestamp, value: r.value ?? 0 }));
  }
  const view = { "1m": metrics1mView, "1h": metrics1hView, "1d": metrics1dView }[level];

  const rows = await dbRead()
    .select({
      timestamp: view.bucketStart,
      value: view.avgValue,
      min: view.minValue,
      max: view.maxValue,
      sampleCount: view.sampleCount,
    })
    .from(view)
    .where(
      and(
        eq(view.agentId, agentId),
        eq(view.metricsType, metric),
        between(view.bucketStart, from, to),
      ),
    );

  return rows.map((r) => ({
    timestamp: r.timestamp,
    value: r.value ?? 0,
    min: r.min ?? undefined,
    max: r.max ?? undefined,
    sampleCount: r.sampleCount ?? undefined,
  }));
}
