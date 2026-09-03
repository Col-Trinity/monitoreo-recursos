import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import MetricChart from "./MetricChart";
interface Props {
  params: Promise<{ workspaceId: string; agentId: string }>;
}

const METRICS = [
  { key: "cpu", label: "CPU (%)" },
  { key: "memory", label: "Memoria (%)" },
  { key: "disk", label: "Disco (%)" },
  { key: "network", label: "Red (bytes)" },
] as const;

export default async function AgentDetailPage({ params }: Props) {
  const { workspaceId, agentId } = await params;

  const agent = await api.agents.getById({ workspaceId, agentId }).catch(() => null);

  if (!agent) notFound();

  const status = agent.revokedAt
    ? "Revocado"
    : agent.active
      ? "Activo"
      : "Inactivo";

  const statusColor = agent.revokedAt
    ? "text-red-600 bg-red-50"
    : agent.active
      ? "text-green-600 bg-green-50"
      : "text-gray-600 bg-gray-100";

  const isOnline =
    agent.lastHeartbeat !== null &&
    new Date().getTime() - new Date(agent.lastHeartbeat).getTime() < 2 * 60 * 1000;
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-3xl">

        {/* Metadata */}
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">{agent.name}</h1>
          {agent.description && (
            <p className="mt-1 text-sm text-gray-500">{agent.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
            <span>
              <span className="font-medium">Último heartbeat: </span>
              {agent.lastHeartbeat
                ? new Date(agent.lastHeartbeat).toLocaleString()
                : "Nunca"}
            </span>
            <span>
              <span className="font-medium">Creado: </span>
              {new Date(agent.createdAt).toLocaleDateString()}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
              {status}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${isOnline ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                }`}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        {/* Charts */}
        <div className="flex flex-col gap-4">
          {METRICS.map((metric) => (
            <MetricChart
              key={metric.key}
              agentId={agentId}
              workspaceId={workspaceId}
              metric={metric.key}
              label={metric.label}
            />
          ))}
        </div>

      </div>
    </div>
  );
}