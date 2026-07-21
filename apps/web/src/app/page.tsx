import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { membershipsTable } from "@watchdog/db/schema";
import { eq } from "drizzle-orm";

export default async function Home() {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin");
  }

  const [membership] = await db
    .select()
    .from(membershipsTable)
    .where(eq(membershipsTable.userId, session.user.id));

  redirect(`/w/${membership!.workspaceId}`);
}
