"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const accept = api.invitations.accept.useMutation({
    onSuccess: (data) => {
      router.push(`/?workspace=${data.workspaceId}`);
    },
    onError: (err) => {
      router.push(`/auth/signin?error=${err.message}`);
    },
  });

  useEffect(() => {
    // Si el usuario está logueado, acepta automáticamente
    if (status === "authenticated") {
      accept.mutate({ token });
    }
    // Si no está logueado, redirige al login con redirect
    if (status === "unauthenticated") {
      router.push(`/auth/signin?redirect=/invite/${token}`);
    }
  }, [status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-xl bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          Procesando invitación...
        </h1>
        <p className="text-sm text-gray-500">Espera un momento.</p>
      </div>
    </div>
  );
}
