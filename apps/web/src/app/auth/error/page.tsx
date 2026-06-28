import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-4xl">⚠️</div>
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Algo salió mal
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Ocurrió un error al procesar tu solicitud. Intentá de nuevo.
        </p>
        <Link
          href="/auth/signin"
          className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Volver al login
        </Link>
      </div>
    </div>
  );
}
