"use client";
import { useState } from "react";
import { api } from "@/trpc/react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const forgotPassword = api.auth.forgotPassword.useMutation({
    onSuccess: () => setSent(true),
    onError: (err) => setError(err.message),
  });

  if (sent) {
    return (
      <div>
        <h1>Revisá tu email</h1>
        <p>Si el email existe, te mandamos un link para resetear tu contraseña.</p>
        <p>El link expira en 1 hora.</p>
        <Link href="/auth/signin">Volver al login</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Olvidé mi contraseña</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        onClick={() => forgotPassword.mutate({ email })}
        disabled={forgotPassword.isPending}
      >
        {forgotPassword.isPending ? "Enviando..." : "Enviar link"}
      </button>
      <Link href="/auth/signin">Volver al login</Link>
    </div>
  );
}