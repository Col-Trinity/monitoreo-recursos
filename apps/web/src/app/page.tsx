"use client";
import { useSession } from "next-auth/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/trpc/react";

const METRIC_TYPES = ["cpu", "memory", "disk", "network"] as const;
const METRIC_LABELS = {
  cpu: "CPU (%)",
  memory: "Memoria (%)",
  disk: "Disco (%)",
  network: "Red (bytes)",
};

export default function Home() {
  const { data: session } = useSession();
  const { data, isLoading, isError } = api.metrics.getAll.useQuery(undefined, {
    refetchInterval: 2000,
  });

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Watch-Dog — Métricas en tiempo real
        </h1>

        {session?.user && !session.user.emailVerified && (
          <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            ⚠️ <strong>Verificá tu email</strong> — Revisá tu bandeja de entrada
            y hacé click en el link que te mandamos.
          </div>
        )}

        {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
        {isError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Error al cargar los datos
          </p>
        )}

      {isLoading && <p>Cargando...</p>}
      {isError && <p>Error al cargar los datos</p>}
      {data && METRIC_TYPES.map((type) => {
        const filtered = data
          .filter((d) => d.metrics.metricsType === type)
          .map((d) => ({
            value: parseFloat((d.metrics.value ?? 0).toFixed(2)),
            hora: new Date(d.metrics.createdAt ?? new Date()).toLocaleTimeString(),
          }));
        return (
          <div key={type} style={{ marginBottom: "1rem" }}>
            <h2>{METRIC_LABELS[type]}</h2>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={filtered}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hora" />
                <YAxis domain={type === "network" ? ["auto", "auto"] : [0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#8884d8" dot={true} />
              </LineChart>
            </ResponsiveContainer>
        {data && (
          <div className="grid gap-4 sm:grid-cols-2">
            {METRIC_TYPES.map((type) => {
              const filtered = data
                .filter((d) => d.metricsType === type)
                .map((d) => ({
                  value: parseFloat((d.value ?? 0).toFixed(2)),
                  hora: new Date(
                    d.createdAt ?? new Date(),
                  ).toLocaleTimeString(),
                }));
              return (
                <div key={type} className="rounded-xl bg-white p-4 shadow-sm">
                  <h2 className="mb-2 text-sm font-medium text-gray-700">
                    {METRIC_LABELS[type]}
                  </h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={filtered}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="hora"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <YAxis
                        domain={
                          type === "network" ? ["auto", "auto"] : [0, 100]
                        }
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
