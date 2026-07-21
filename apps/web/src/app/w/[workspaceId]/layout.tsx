import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getWorkspaceMembership } from "@/server/workspace-access";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin");
  }
  const { workspaceId } = await params;
  if (!z.string().uuid().safeParse(workspaceId).success) {
    redirect("/");
  }
  const result = await getWorkspaceMembership(db, session.user.id, workspaceId);
  if (!result) {
    // TODO(tech-debt): mostrar un toast "acceso no permitido" antes de
    // redirigir. Requiere leer un query param (?error=forbidden) desde
    // page.tsx con useSearchParams y una librería de toasts (sonner o similar).
    redirect("/");
  }
  return <>{children}</>;
}
