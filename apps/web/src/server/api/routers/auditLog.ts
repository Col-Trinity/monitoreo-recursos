import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { auditLogTable, usersTable } from "@watchdog/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { z } from "zod";

export const auditLogRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        action: z.string().optional(),
        userId: z.string().uuid().optional(),
        resourceType: z.string().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(auditLogTable.workspaceId, ctx.workspace.id),
      ];

      if (input.action) {
        filters.push(eq(auditLogTable.action, input.action));
      }
      if (input.userId) {
        filters.push(eq(auditLogTable.userId, input.userId));
      }
      if (input.resourceType) {
        filters.push(eq(auditLogTable.resourceType, input.resourceType));
      }
      if (input.from) {
        filters.push(gte(auditLogTable.createdAt, input.from));
      }
      if (input.to) {
        filters.push(lte(auditLogTable.createdAt, input.to));
      }

      return await ctx.db
        .select({
          id: auditLogTable.id,
          action: auditLogTable.action,
          resourceType: auditLogTable.resourceType,
          resourceId: auditLogTable.resourceId,
          metadata: auditLogTable.metadata,
          createdAt: auditLogTable.createdAt,
          userId: auditLogTable.userId,
          userName: usersTable.name,
          userEmail: usersTable.email,
        })
        .from(auditLogTable)
        .leftJoin(usersTable, eq(auditLogTable.userId, usersTable.id))
        .where(and(...filters))
        .orderBy(desc(auditLogTable.createdAt))
        .limit(100);
    }),
});