"use client";
import { useState } from "react";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@/server/api/root";
import { api } from "@/trpc/react";
import { useParams } from "next/navigation";
import { AlertRulesTable } from "./AlertRulesTable";
import { AlertRuleForm } from "./AlertRuleForm";

function errorMessage(err: TRPCClientErrorLike<AppRouter>) {
  const zodError = err.data?.zodError;
  if (zodError) {
    const firstIssue =
      Object.values(zodError.fieldErrors).flat().find(Boolean) ??
      zodError.formErrors[0];
    if (firstIssue) return firstIssue;
  }
  return err.message;
}

export default function AlertRulesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [error, setError] = useState("");

  const { data: agentsList } = api.agents.list.useQuery(
  { workspaceId: workspaceId ?? "" },
  { enabled: !!workspaceId },
);
const { data: rules, refetch } = api.alertRules.list.useQuery(
  { workspaceId: workspaceId ?? "" },
  { enabled: !!workspaceId },
);

  const create = api.alertRules.create.useMutation({
    onSuccess: () => {
      setError("");
      void refetch();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const toggleEnabled = api.alertRules.toggleEnabled.useMutation({
    onSuccess: () => void refetch(),
    onError: (err) => setError(errorMessage(err)),
  });

  const deleteRule = api.alertRules.delete.useMutation({
    onSuccess: () => void refetch(),
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Reglas de alerta
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <AlertRuleForm
          onSubmit={(data) => {
            setError("");
            create.mutate({
              workspaceId: workspaceId ?? "",
              ...data,
              actions: data.actions.map((action) => ({
                type: action.type,
                config: action.config as never,
              })),
            });
          }}
          isPending={create.isPending}
          agents={agentsList?.map((a) => ({ id: a.id, name: a.name })) ?? []}
        />
        <div className="mt-8">
          <AlertRulesTable
            rules={rules ?? []}
            onToggle={(id, enabled) =>
              toggleEnabled.mutate({
                workspaceId: workspaceId ?? "",
                id,
                enabled,
              })
            }
            onDelete={(id) =>
              deleteRule.mutate({ workspaceId: workspaceId ?? "", id })
            }
            isPending={toggleEnabled.isPending || deleteRule.isPending}
          />
        </div>
      </div>
    </div>
  );
}
