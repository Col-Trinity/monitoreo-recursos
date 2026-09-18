import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { membershipsTable } from "@watchdog/db/schema";
import { eq } from "drizzle-orm";

interface Props {
  searchParams: Promise<{ workspace?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin");
  }

  const memberships = await db
    .select()
    .from(membershipsTable)
    .where(eq(membershipsTable.userId, session.user.id));

  // Al aceptar una invitacion se vuelve aca con ?workspace=<id>. Sin esto se caia
  // siempre en la primera membresia, asi que quien ya tenia workspace propio nunca
  // aterrizaba en el que lo acababan de invitar.
  const { workspace } = await searchParams;
  const target =
    memberships.find((m) => m.workspaceId === workspace) ?? memberships[0];

  if (!target) {
    redirect("/auth/signin");
  }

  redirect(`/w/${target.workspaceId}`);
}
