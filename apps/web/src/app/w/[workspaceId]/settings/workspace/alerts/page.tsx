"use client";
import { api } from "@/trpc/react";
import { useParams } from "next/navigation";
import { AlertRulesTable } from "./AlertRulesTable";

export default function AlertRulesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

 const { data: rules } = api.alertRules.list.useQuery(
  { workspaceId: workspaceId ?? "" },
  { enabled: !!workspaceId },
);
  return (   <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Reglas de alerta
        </h1>
        <AlertRulesTable rules={rules ?? []} />
      </div>
    </div>
  );
}
