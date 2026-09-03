import { auditLogTable, type Db } from "@watchdog/db";

export async function audit(
  db: Pick<Db, "insert">,
  ctx: { session: { user: { id: string } } },
  params: {
    workspaceId: string;
    action: string;
    resource: { type: string; id?: string };
    metadata?: Record<string, unknown>;
  },
) {
  await db.insert(auditLogTable).values({
    workspaceId: params.workspaceId,
    userId: ctx.session.user.id,
    action: params.action,
    resourceType: params.resource.type,
    resourceId: params.resource.id,
    metadata: params.metadata,
  });
}
