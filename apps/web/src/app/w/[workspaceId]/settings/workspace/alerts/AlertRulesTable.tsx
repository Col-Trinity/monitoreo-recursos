"use client";
import type { AlertRule } from "@watchdog/db";

interface Props {
  rules: AlertRule[];
}

export function AlertRulesTable({ rules }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {rules.map((rule) => (
        <div key={rule.id} className="rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-sm font-medium text-gray-900">{rule.name}</p>
          <p className="text-xs text-gray-500">{rule.description}</p>
        </div>
      ))}
    </div>
  );
}