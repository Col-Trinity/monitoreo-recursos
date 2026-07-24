"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import Link from "next/link";

export default function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [error, setError] = useState("");

  const { data: members, refetch } = api.workspaces.getMembers.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  const changeRole = api.workspaces.changeRole.useMutation({
    onSuccess: () => void refetch(),
    onError: (err) => setError(err.message),
  });

  const removeMember = api.workspaces.removeMember.useMutation({
    onSuccess: () => void refetch(),
    onError: (err) => setError(err.message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-2xl rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Miembros del workspace
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {members?.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {member.email ?? member.name ?? member.userId}
                </p>
                <p className="text-xs text-gray-500">{member.role}</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={member.role}
                  onChange={(e) =>
                    changeRole.mutate({
                      workspaceId,
                      userId: member.userId,
                      role: e.target.value as "admin" | "member" | "viewer",
                    })
                  }
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={() =>
                    removeMember.mutate({
                      workspaceId,
                      userId: member.userId,
                    })
                  }
                  disabled={removeMember.isPending}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link
            href={`/w/${workspaceId}`}
            className="font-medium text-indigo-600 hover:underline"
          >
            Volver al dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
