"use client";
import { api } from "@/trpc/react";
import { useParams } from "next/navigation";

export default function AlertRulesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

 const { data: rules } = api.alertRules.list.useQuery(
  { workspaceId: workspaceId ?? "" },
  { enabled: !!workspaceId },
);
  return (
    <div>
      <h1>Reglas de alerta</h1>
    </div>
  );
}
