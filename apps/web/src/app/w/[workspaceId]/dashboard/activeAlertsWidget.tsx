"use client";

import { useFlag } from "@unleash/proxy-client-react";

import { api } from "@/trpc/react";

interface Props {
  workspaceId: string;
}

export default function ActiveAlertsWidget({ workspaceId }: Props) {
  const isEnabled = useFlag("dashboard-v2");

  const { data } = api.dashboardV2.activeAlertsCount.useQuery(
    { workspaceId },
    { enabled: isEnabled },
  );

  if (!isEnabled || !data) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">Alertas activas</p>
      <p className="text-3xl font-semibold text-gray-900">
        {data.activeAlerts}
      </p>
    </div>
  );
}