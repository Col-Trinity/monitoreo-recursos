"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

interface Props {
  workspaceId: string;
}

const ACTION_OPTIONS = [
  { value: "", label: "Todas las acciones" },
  { value: "agent.created", label: "Agente creado" },
  { value: "agent.api_key_rotated", label: "API key rotada" },
  { value: "agent.revoked", label: "Agente revocado" },
  { value: "member.role_changed", label: "Rol cambiado" },
  { value: "member.removed", label: "Miembro removido" },
  { value: "invitation.created", label: "Invitacion creada" },
  { value: "invitation.revoked", label: "Invitacion revocada" },
  { value: "invitation.accepted", label: "Invitacion aceptada" },
  { value: "workspace.deleted", label: "Workspace eliminado" },
];

const RESOURCE_OPTIONS = [
  { value: "", label: "Todos los recursos" },
  { value: "agent", label: "Agente" },
  { value: "membership", label: "Miembro" },
  { value: "invitation", label: "Invitacion" },
  { value: "workspace", label: "Workspace" },
];

export default function AuditLogTable({ workspaceId }: Props) {
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading, isError } = api.auditLog.list.useQuery({
    workspaceId,
    action: action || undefined,
    resourceType: resourceType || undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  function exportCSV() {
    if (!data) return;

    const headers = ["Fecha", "Accion", "Usuario", "Recurso", "ID Recurso"];
    const rows = data.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.action,
      log.userEmail ?? "Usuario eliminado",
      log.resourceType,
      log.resourceId ?? "-",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${workspaceId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        >
          {RESOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
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

        <button
          onClick={exportCSV}
          disabled={!data || data.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      {/* Estado */}
      {isLoading && <p className="text-sm text-gray-400">Cargando...</p>}
      {isError && <p className="text-sm text-red-500">Error al cargar los logs</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-gray-400">No hay registros para los filtros seleccionados</p>
      )}

      {/* Tabla */}
      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Accion</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Recurso</th>
                <th className="px-4 py-3 font-medium">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {log.userEmail ?? (
                      <span className="text-gray-400">Usuario eliminado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.resourceType}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {log.resourceId ?? "-"}
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