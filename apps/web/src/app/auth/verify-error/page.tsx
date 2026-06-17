import Link from "next/link";

export default function VerifyErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-4xl">⚠️</div>
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Link inválido
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          El link de verificación expiró o ya fue usado. Los links son válidos
          por 24 horas.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/auth/signin"
            className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/auth/signup"
            className="text-sm text-indigo-600 hover:underline"
          >
            Crear cuenta nueva
          </Link>
        </div>
      </div>
    </div>
  );
}
