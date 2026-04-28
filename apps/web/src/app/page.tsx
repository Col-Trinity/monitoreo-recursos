"use client";

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

export default function Home() {
  const { data, isLoading, isError } = api.metrics.getAll.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const ultimos20 = data?.map((d) => ({
    ...d,
    value: parseFloat((d.value ?? 0).toFixed(2)), // era cpuPercentage
    hora: new Date(d.time ?? new Date()).toLocaleTimeString(), // era createdAt
  }));

  return (
    <div>
      {isLoading && <p>Cargando...</p>}
      {isError && <p>Error al cargar los datos</p>}

      {ultimos20 && (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={ultimos20}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hora" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="cpuPercentage"
              stroke="#8884d8"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
