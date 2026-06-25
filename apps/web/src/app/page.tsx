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
    <div style={{ padding: "2rem" }}>
      <h1>Watch-Dog — Métricas en tiempo real</h1>

      {session?.user && !session.user.emailVerified && (
        <div style={{
          backgroundColor: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1rem",
        }}>
          ⚠️ <strong>Verificá tu email</strong> — Revisá tu bandeja de entrada y hacé click en el link que te mandamos.
        </div>
      )}

      {isLoading && <p>Cargando...</p>}
      {isError && <p>Error al cargar los datos</p>}
      {data && METRIC_TYPES.map((type) => {
        const filtered = data
          .filter((d) => d.metricsType === type)
          .map((d) => ({
            value: parseFloat((d.value ?? 0).toFixed(2)),
            hora: new Date(d.createdAt ?? new Date()).toLocaleTimeString(),
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
          </div>
        );
      })}
    </div>
  );
}