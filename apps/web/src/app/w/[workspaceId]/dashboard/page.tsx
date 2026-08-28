import { api } from "@/trpc/server";
import AgentChart from "./agentChart";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function DashboardPage({ params }: Props) {
  const { workspaceId } = await params;
  const agents = await api.agents.list({ workspaceId });

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Dashboard — Agentes
        </h1>

        {agents.length === 0 && (
          <p className="text-sm text-gray-500">No hay agentes aún.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => (
            <AgentChart
              key={agent.id}
              agentId={agent.id}
              agentName={agent.name}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}