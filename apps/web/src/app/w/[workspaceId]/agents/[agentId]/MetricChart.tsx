"use client";

import { useState, useMemo } from "react";
import { api } from "@/trpc/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
] as const;

type RangeLabel = (typeof RANGES)[number]["label"];

interface Props {
  agentId: string;
  workspaceId: string;
  metric: "cpu" | "memory" | "disk" | "network";
  label: string;
}

export default function MetricChart({ agentId, workspaceId, metric, label }: Props) {
  const [selectedRange, setSelectedRange] = useState<RangeLabel>("1h");

  const hours = RANGES.find((r) => r.label === selectedRange)!.hours;

  const { fromMs, toMs } = useMemo(() => ({
    toMs: Date.now(),
    fromMs: Date.now() - hours * 60 * 60 * 1000,
  }), [selectedRange]);

  const { data, isLoading } = api.metrics.getByAgent.useQuery(
    { agentId, workspaceId, metric, from: new Date(fromMs), to: new Date(toMs) },
    { refetchInterval: false }
  );

  const points = (data ?? []).map((d) => ({
    value: parseFloat((d.value ?? 0).toFixed(2)),
    hora: new Date(d.timestamp).toLocaleTimeString(),
  }));

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">{label}</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setSelectedRange(r.label)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${selectedRange === r.label
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
                }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="h-[180px] animate-pulse rounded-lg bg-gray-100" />
      )}

      {!isLoading && points.length === 0 && (
        <div className="flex h-[180px] items-center justify-center">
          <p className="text-sm text-gray-400">No hay datos para este rango</p>
        </div>
      )}

      {!isLoading && points.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hora" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis
              domain={metric === "network" ? ["auto", "auto"] : [0, 100]}
              tick={{ fontSize: 11, fill: "#6b7280" }}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
} 