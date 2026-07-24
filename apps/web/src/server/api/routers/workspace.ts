import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  membershipsTable,
  usersTable,
  workspacesTable,
} from "@watchdog/db/schema";
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

  getMembers: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
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

      return await ctx.db
        .select({
          userId: membershipsTable.userId,
          role: membershipsTable.role,
          email: usersTable.email,
          name: usersTable.name,
        })
        .from(membershipsTable)
        .innerJoin(usersTable, eq(membershipsTable.userId, usersTable.id))
        .where(eq(membershipsTable.workspaceId, input.workspaceId));
    }),

  changeRole: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(["admin", "member", "viewer"]),
      }),
    )
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
        !hasPermission(membership.role as Role, Permission.membersChangeRole)
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await dbW
        .update(membershipsTable)
        .set({ role: input.role })
        .where(
          and(
            eq(membershipsTable.userId, input.userId),
            eq(membershipsTable.workspaceId, input.workspaceId),
          ),
        );

      return { success: true };
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // No  podés sacar a vos
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No podés removerte a vos mismo",
        });
      }

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
        !hasPermission(membership.role as Role, Permission.membersInvite)
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await dbW
        .delete(membershipsTable)
        .where(
          and(
            eq(membershipsTable.userId, input.userId),
            eq(membershipsTable.workspaceId, input.workspaceId),
          ),
        );

      return { success: true };
    }),
});
