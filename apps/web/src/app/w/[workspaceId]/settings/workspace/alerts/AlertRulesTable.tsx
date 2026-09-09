"use client";
import type { AlertRule } from "@watchdog/db";

interface Props {
  rules: AlertRule[];
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}

export function AlertRulesTable({ rules, onToggle, onDelete, isPending }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {rules.map((rule) => (
        <div key={rule.id} className="rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{rule.name}</p>
            <p className="text-xs text-gray-500">{rule.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(rule.id, !rule.enabled)}
              disabled={isPending}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                rule.enabled
                  ? "bg-green-50 text-green-600 hover:bg-green-100"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {rule.enabled ? "Activa" : "Inactiva"}
            </button>
            <button
              onClick={() => onDelete(rule.id)}
              disabled={isPending}
              className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}