"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const resetPassword = api.auth.resetPassword.useMutation({
    onSuccess: () => router.push("/auth/signin?reset=true"),
    onError: (err) => setError(err.message),
  });

  const handleSubmit = () => {
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    resetPassword.mutate({ token, password });
  };

  return (
    <div>
      <h1>Nueva contraseña</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <input
        type="password"
        placeholder="Nueva contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        placeholder="Confirmar contraseña"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <button
        onClick={handleSubmit}
        disabled={resetPassword.isPending}
      >
        {resetPassword.isPending ? "Guardando..." : "Guardar contraseña"}
      </button>
      <Link href="/auth/signin">Volver al login</Link>
    </div>
  );
}