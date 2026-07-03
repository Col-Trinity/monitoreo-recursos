import { NextResponse } from "next/server";
import { dbWrite } from "@watchdog/db";
import { verificationTokensTable } from "@watchdog/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const db = dbWrite();

  await db
    .delete(verificationTokensTable)
    .where(
      and(
        eq(verificationTokensTable.token, token),
        eq(verificationTokensTable.type, "password_reset"),
      )
    );

  return NextResponse.redirect(
    new URL("/auth/signin?cancelled=true", process.env.NEXT_PUBLIC_APP_URL!)
  );
}