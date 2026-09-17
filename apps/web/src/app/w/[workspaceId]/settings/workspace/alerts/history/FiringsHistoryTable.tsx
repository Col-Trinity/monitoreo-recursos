"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";

interface Props {
  workspaceId: string;
  // Si se pasa, el filtro de regla queda fijo en este id y el <select> de
  // regla se oculta (usado en la página de detalle de una regla puntual).
  fixedRuleId?: string;
}

const REFETCH_MS = 8000;

export default function FiringsHistoryTable({ workspaceId, fixedRuleId }: Props) {
  const [ruleId, setRuleId] = useState(fixedRuleId ?? "");
  const [agentId, setAgentId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: rules } = api.alertHistory.rules.useQuery(
    { workspaceId },
    { enabled: !fixedRuleId },
  );
  const { data: agents } = api.alertHistory.agents.useQuery({ workspaceId });

  const { data, isLoading, isError } = api.alertHistory.list.useQuery(
    {
      workspaceId,
      ruleId: ruleId || undefined,
      agentId: agentId || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    },
    { refetchInterval: REFETCH_MS },
  );

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-3">
        {!fixedRuleId && (
          <select
            value={ruleId}
            onChange={(e) => setRuleId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="">Todas las reglas</option>
            {(rules ?? []).map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        >
          <option value="">Todos los agentes</option>
          {(agents ?? []).map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />

        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
      </div>

      {/* Estado */}
      {isLoading && <p className="text-sm text-gray-400">Cargando...</p>}
      {isError && (
        <p className="text-sm text-red-500">Error al cargar el historial</p>
      )}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-gray-400">
          No hay firings para los filtros seleccionados
        </p>
      )}

      {/* Tabla */}
      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Regla</th>
                <th className="px-4 py-3 font-medium">Agente</th>
                <th className="px-4 py-3 font-medium">Disparado</th>
                <th className="px-4 py-3 font-medium">Resuelto</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/w/${workspaceId}/settings/workspace/alerts/${event.ruleId}`}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {event.ruleName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{event.agentName}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(event.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {event.resolvedAt ? (
                      new Date(event.resolvedAt).toLocaleString()
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                        Activa
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{event.triggerValue.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {event.actions.length === 0 ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {event.actions.map((action, idx) => (
                          <span
                            key={`${action.actionType}-${idx}`}
                            title={action.error ?? undefined}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              action.status === "sent"
                                ? "bg-green-50 text-green-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {action.actionType}: {action.status === "sent" ? "OK" : "falló"}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
