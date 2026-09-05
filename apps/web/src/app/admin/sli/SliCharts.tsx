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
import { useEffect, useState } from "react";

const POLL_MS = 10_000;
const MAX_POINTS = 30; // ~5 minutos a 10s por punto

interface Point {
  hora: string;
  value: number;
}

function SliChartCard({
  title,
  unit,
  value,
  dataUpdatedAt,
  isLoading,
  isError,
}: {
  title: string;
  unit: string;
  value: number | null | undefined;
  dataUpdatedAt: number;
  isLoading: boolean;
  isError: boolean;
}) {
  const [points, setPoints] = useState<Point[]>([]);

  // dispara con cada fetch exitoso (dataUpdatedAt cambia siempre),
  // no con `value` — dos polls pueden traer el mismo número y aun así
  // ser un punto nuevo en el tiempo.
  useEffect(() => {
    if (dataUpdatedAt === 0 || value === null || value === undefined) return;
    setPoints((prev) =>
      [...prev, { hora: new Date().toLocaleTimeString(), value }].slice(
        -MAX_POINTS,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500">{unit}</p>
      </div>

      <p className="mb-3 text-2xl font-bold text-gray-900">
        {value ?? "—"}{" "}
        <span className="text-sm font-normal text-gray-400">{unit}</span>
      </p>

      {isLoading && points.length === 0 && (
        <p className="text-sm text-gray-400">Cargando...</p>
      )}
      {isError && <p className="text-sm text-red-500">Error al cargar</p>}

      {!isError && !isLoading && points.length === 0 && (
        <p className="text-sm text-gray-400">No hay datos aún</p>
      )}

      {points.length > 0 && (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hora" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
            <Tooltip
              formatter={(val) => [`${String(val)} ${unit}`, title]}
              labelFormatter={(label) => `Hora: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function SliCharts() {
  const ingestRate = api.sli.ingestRate.useQuery(undefined, {
    refetchInterval: POLL_MS,
  });
  const queueDepth = api.sli.queueDepth.useQuery(undefined, {
    refetchInterval: POLL_MS,
  });
  const replicaLag = api.sli.replicaLag.useQuery(undefined, {
    refetchInterval: POLL_MS,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SliChartCard
        title="Ingest rate"
        unit="métricas/min"
        value={ingestRate.data?.count}
        dataUpdatedAt={ingestRate.dataUpdatedAt}
        isLoading={ingestRate.isLoading}
        isError={ingestRate.isError}
      />
      <SliChartCard
        title="Queue depth"
        unit="jobs en espera"
        value={queueDepth.data?.depth}
        dataUpdatedAt={queueDepth.dataUpdatedAt}
        isLoading={queueDepth.isLoading}
        isError={queueDepth.isError}
      />
      <SliChartCard
        title="DB replica lag"
        unit="minutos"
        dataUpdatedAt={replicaLag.dataUpdatedAt}
        value={
          replicaLag.data?.lagSeconds != null
            ? parseFloat((replicaLag.data.lagSeconds / 60).toFixed(2))
            : undefined
        }
        isLoading={replicaLag.isLoading}
        isError={replicaLag.isError}
      />
    </div>
  );
}
