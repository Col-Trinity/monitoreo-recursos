"use client";

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
import { useState, useEffect } from "react";
import Link from "next/link";

interface Props {
  agentId: string;
  agentName: string;
  workspaceId: string;
}

const getRange = () => {
  const to = new Date();
  const from = new Date(to.getTime() - 10 * 60 * 1000);
  return { from, to };
};

export default function AgentChart({ agentId, agentName, workspaceId }: Props) {
  const [range, setRange] = useState(getRange);

  useEffect(() => {
    const interval = setInterval(() => {
      setRange(getRange());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const { data, isLoading, isError } = api.metrics.getByAgent.useQuery(
    {
      agentId,
      workspaceId,
      metric: "cpu",
      from: range.from,
      to: range.to,
    },
    { refetchInterval: false }
  );

  const points = (data ?? []).map((d) => ({
    value: parseFloat((d.value ?? 0).toFixed(2)),
    hora: new Date(d.timestamp).toLocaleTimeString(),
  }));

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <Link
        href={`/w/${workspaceId}/agents/${agentId}`}
        className="mb-1 text-sm font-semibold text-gray-800 hover:underline"
      >
        {agentName}
      </Link>      <p className="mb-3 text-xs text-gray-500">CPU (%)</p>

      {isLoading && <p className="text-sm text-gray-400">Cargando...</p>}
      {isError && <p className="text-sm text-red-500">Error al cargar</p>}

      {!isLoading && !isError && points.length === 0 && (
        <p className="text-sm text-gray-400">No hay datos aún</p>
      )}

      {points.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hora" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} />
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