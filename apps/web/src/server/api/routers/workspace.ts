import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { membershipsTable, workspacesTable } from "@watchdog/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { dbW } from "@/server/db";
import { hasPermission, Permission, Role } from "@watchdog/shared-types";

export const userWorkspacesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db
      .select()
      .from(membershipsTable)
      .innerJoin(
        workspacesTable,
        eq(membershipsTable.workspaceId, workspacesTable.id),
      )
      .where(eq(membershipsTable.userId, ctx.session.user.id));
  }),

  delete: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [membership] = await ctx.db
        .select()
        .from(membershipsTable)
        .where(
          and(
            eq(membershipsTable.userId, ctx.session.user.id),
            eq(membershipsTable.workspaceId, input.workspaceId),
          ),
        );

      if (
        !membership ||
        !hasPermission(membership.role as Role, Permission.workspaceDelete)
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const ownedWorkspaces = await ctx.db
        .select()
        .from(membershipsTable)
        .where(
          and(
            eq(membershipsTable.userId, ctx.session.user.id),
            eq(membershipsTable.role, Role.owner),
          ),
        );

      if (ownedWorkspaces.length <= 1) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete your last workspace",
        });
      }

      await dbW
        .delete(workspacesTable)
        .where(eq(workspacesTable.id, input.workspaceId));

      return { success: true };
    }),
});
