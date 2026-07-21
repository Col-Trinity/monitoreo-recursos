import { membershipsTable, workspacesTable } from "@watchdog/db/schema";
import { eq, and } from "drizzle-orm";
import type { Db } from "@watchdog/db";

export async function getWorkspaceMembership(
  database: Db,
  userId: string,
  workspaceId: string,
) {
  const [membership] = await database
    .select()
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.userId, userId),
        eq(membershipsTable.workspaceId, workspaceId),
      ),
    );

  if (!membership) {
    return null;
  }

  const [workspace] = await database
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));

  if (!workspace) {
    return null;
  }

  return { workspace, membership };
}
