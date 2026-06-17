import { NextResponse } from "next/server";
import { dbWrite } from "@watchdog/db";
import { verificationTokensTable, usersTable } from "@watchdog/db/schema";
import { eq, and, gt } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const db = dbWrite();

  // Buscamos el token en la DB
  const [verificationToken] = await db
    .select()
    .from(verificationTokensTable)
    .where(
      and(
        eq(verificationTokensTable.token, token),
        gt(verificationTokensTable.expiresAt, new Date()) // no expiró
      )
    );

  // Si no existe o expiró
  if (!verificationToken) {
    return NextResponse.redirect(new URL("/auth/verify-error", process.env.NEXT_PUBLIC_APP_URL!));
  }

  // Marcamos el email como verificado
  await db
    .update(usersTable)
    .set({ emailVerified: new Date() })
    .where(eq(usersTable.id, verificationToken.userId));

  // Borramos el token usado
  await db
    .delete(verificationTokensTable)
    .where(eq(verificationTokensTable.id, verificationToken.id));

  // Redirigimos al ogin
  return NextResponse.redirect(new URL("/auth/signin?verified=true", process.env.NEXT_PUBLIC_APP_URL!));
}