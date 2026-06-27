"use client";
import { useState } from "react";
import { api } from "@/trpc/react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const forgotPassword = api.auth.forgotPassword.useMutation({
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-2xl font-semibold text-gray-900">
            Revisá tu email
          </h1>
          <p className="mb-1 text-sm text-gray-500">
            Si el email existe, te mandamos un link para resetear tu contraseña.
          </p>
          <p className="mb-6 text-sm text-gray-500">
            El link expira en 1 hora.
          </p>
          <Link
            href="/auth/signin"
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Olvidé mi contraseña
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            forgotPassword.mutate({ email });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {forgotPassword.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {forgotPassword.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={forgotPassword.isPending}
            className="mt-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {forgotPassword.isPending ? "Enviando…" : "Enviar link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link
            href="/auth/signin"
            className="font-medium text-indigo-600 hover:underline"
          >
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}
