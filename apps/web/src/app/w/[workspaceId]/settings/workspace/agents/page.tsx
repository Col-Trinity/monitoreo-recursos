"use client";
import { useState } from "react";
import { api } from "@/trpc/react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AgentsPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const { data: agents, refetch } = api.agents.list.useQuery(
    { workspaceId: workspaceId ?? "" },
    { enabled: !!workspaceId },
  );
  const create = api.agents.create.useMutation({
    onSuccess: (data) => {
      setApiKey(data.apiKey);
      setName("");
      setDescription("");
      void refetch();
    },
    onError: (err) => setError(err.message),
  });

  const revoke = api.agents.revoke.useMutation({
    onSuccess: () => void refetch(),
    onError: (err) => setError(err.message),
  });
  const rotate = api.agents.rotate.useMutation({
    onSuccess: (data) => {
      setApiKey(data.apiKey);
      void refetch();
    },
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setError("");
    create.mutate({
      workspaceId,
      name,
      description,
    });
  }
  function handleCopy() {
    if (!apiKey) return;
    void navigator.clipboard.writeText(apiKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Agentes</h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Modal API key — se muestra solo al crear */}
       {apiKey && (
  <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
    <p className="mb-2 text-sm font-medium text-yellow-800">
      ⚠️ Copiá esta key ahora. No la vas a poder ver de nuevo.
    </p>
    <code className="mb-3 block rounded bg-yellow-100 p-2 text-xs break-all text-yellow-900">
      {apiKey}
    </code>
    <p className="mb-2 text-sm font-medium text-yellow-800">
      Para instalar el agente en tu servidor, corré este comando:
    </p>
    <code className="mb-3 block rounded bg-yellow-100 p-2 text-xs break-all text-yellow-900">
      {`curl -sSL http://watchdog.daztanllc.com/install.sh | WATCHDOG_KEY=${apiKey} bash`}
    </code>
    <div className="flex gap-2">
      <button
        onClick={handleCopy}
        className="rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700"
      >
        {copied ? "¡Copiado!" : "Copiar key"}
      </button>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(
            `curl -sSL http://watchdog.daztanllc.com/install.sh | WATCHDOG_KEY=${apiKey} bash`
          );
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
        className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600"
      >
        Copiar comando
      </button>
      <button
        onClick={() => setApiKey(null)}
        className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300"
      >
        Cerrar
      </button>
    </div>
  </div>
)}
        {/* Formulario crear agente */}
        <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Descripción
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {create.isPending ? "Creando..." : "Crear agente"}
          </button>
        </form>

        {/* Lista de agentes */}
        <div className="flex flex-col gap-3">
          {agents?.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {agent.name}
                </p>
                <p className="text-xs text-gray-500">{agent.description}</p>
                {agent.revokedAt && (
                  <p className="text-xs text-red-500">
                    Revocado el {new Date(agent.revokedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              {!agent.revokedAt && (
                <div className="flex gap-2">
                  <button
                    onClick={() => rotate.mutate({ agentId: agent.id })}
                    disabled={rotate.isPending}
                    className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    Rotar key
                  </button>
                  <button
                    onClick={() => revoke.mutate({ agentId: agent.id })}
                    disabled={revoke.isPending}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    Revocar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link
            href="/"
            className="font-medium text-indigo-600 hover:underline"
          >
            Volver al dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
