import { createTRPCRouter, protectedProcedure, currentWorkspaceProcedure } from "@/server/api/trpc";
import { membershipsTable, workspacesTable } from "@watchdog/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const userWorkspacesRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db
      .select()
      .from(membershipsTable)
      .innerJoin(workspacesTable, eq(membershipsTable.workspaceId, workspacesTable.id))
      .where(eq(membershipsTable.userId, ctx.session.user.id));
  }),

  getCurrent: currentWorkspaceProcedure.query(({ ctx }) => {
    return ctx.currentWorkspace;
  }),

  switchCurrent: protectedProcedure
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

      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [workspace] = await ctx.db
        .select()
        .from(workspacesTable)
        .where(eq(workspacesTable.id, input.workspaceId));

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const cookieStore = await cookies();
      cookieStore.set("current_workspace_slug", workspace.id);

      return workspace;
    }),
});
