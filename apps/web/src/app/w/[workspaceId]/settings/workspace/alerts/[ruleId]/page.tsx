import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/server/db";
import { membershipsTable, alertRulesTable, agentsTable } from "@watchdog/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/server/auth";
import FiringsHistoryTable from "../history/FiringsHistoryTable";

interface Props {
  params: Promise<{ workspaceId: string; ruleId: string }>;
}

const OPERATOR_LABELS: Record<string, string> = {
  gt: "mayor que",
  lt: "menor que",
  eq: "igual a",
  gte: "mayor o igual a",
  lte: "menor o igual a",
};

const METRIC_LABELS: Record<string, string> = {
  cpu: "CPU",
  memory: "Memoria",
  disk: "Disco",
  network: "Red",
};

export default async function AlertRuleDetailPage({ params }: Props) {
  const { workspaceId, ruleId } = await params;

  const session = await auth();
  if (!session) notFound();

  const [membership] = await db
    .select()
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.userId, session.user.id),
        eq(membershipsTable.workspaceId, workspaceId),
      ),
    );

  if (!membership || membership.role === "viewer") {
    notFound();
  }

  const [rule] = await db
    .select({
      id: alertRulesTable.id,
      name: alertRulesTable.name,
      description: alertRulesTable.description,
      metricType: alertRulesTable.metricType,
      operator: alertRulesTable.operator,
      threshold: alertRulesTable.threshold,
      durationSeconds: alertRulesTable.durationSeconds,
      actions: alertRulesTable.actions,
      enabled: alertRulesTable.enabled,
      agentId: alertRulesTable.agentId,
      agentName: agentsTable.name,
      createdAt: alertRulesTable.createdAt,
    })
    .from(alertRulesTable)
    .leftJoin(agentsTable, eq(alertRulesTable.agentId, agentsTable.id))
    .where(
      and(
        eq(alertRulesTable.id, ruleId),
        eq(alertRulesTable.workspaceId, workspaceId),
        isNull(alertRulesTable.deletedAt),
      ),
    );

  if (!rule) notFound();

  const actions = (rule.actions ?? []) as { type: string }[];

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/w/${workspaceId}/settings/workspace/alerts`}
          className="mb-4 inline-block text-sm text-indigo-600 hover:underline"
        >
          ← Volver a reglas
        </Link>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{rule.name}</h1>
            {rule.description && (
              <p className="mt-1 text-sm text-gray-500">{rule.description}</p>
            )}
          </div>
          <span
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              rule.enabled
                ? "bg-green-50 text-green-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {rule.enabled ? "Activa" : "Inactiva"}
          </span>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500">Métrica</p>
            <p className="text-sm font-medium text-gray-900">
              {METRIC_LABELS[rule.metricType] ?? rule.metricType}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Condición</p>
            <p className="text-sm font-medium text-gray-900">
              {OPERATOR_LABELS[rule.operator] ?? rule.operator} {rule.threshold}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Duración</p>
            <p className="text-sm font-medium text-gray-900">
              {rule.durationSeconds}s
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Alcance</p>
            <p className="text-sm font-medium text-gray-900">
              {rule.agentName ?? "Todos los agentes"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Creada</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(rule.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Acciones configuradas</p>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {actions.length === 0 ? (
                <span className="text-sm text-gray-400">—</span>
              ) : (
                actions.map((action, idx) => (
                  <span
                    key={`${action.type}-${idx}`}
                    className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600"
                  >
                    {action.type}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Firings de esta regla
        </h2>
        <FiringsHistoryTable workspaceId={workspaceId} fixedRuleId={rule.id} />
      </div>
    </div>
  );
}
