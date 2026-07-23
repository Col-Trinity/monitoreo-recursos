import { TRPCError } from "@trpc/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { dbW } from "@/server/db";
import { invitationsTable, membershipsTable } from "@watchdog/db";
import { sendInvitationEmail } from "@/server/email";
import { randomBytes } from "node:crypto";

export const invitationsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["member", "admin"]).default("member"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const token = randomBytes(32).toString("hex");

      await dbW.insert(invitationsTable).values({
        workspaceId: input.workspaceId,
        email: input.email,
        role: input.role,
        token,
        invitedBy: ctx.session.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      });

      await sendInvitationEmail(input.email, token);

      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await dbW
        .select()
        .from(invitationsTable)
        .where(
          and(
            eq(invitationsTable.workspaceId, input.workspaceId),
            isNull(invitationsTable.acceptedAt),
            gt(invitationsTable.expiresAt, new Date()),
          ),
        );
    }),

  revoke: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await dbW
        .delete(invitationsTable)
        .where(eq(invitationsTable.id, input.invitationId));

      return { success: true };
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [invitation] = await dbW
        .select()
        .from(invitationsTable)
        .where(
          and(
            eq(invitationsTable.token, input.token),
            isNull(invitationsTable.acceptedAt),
            gt(invitationsTable.expiresAt, new Date()),
          ),
        );

      if (!invitation) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitación inválida o expirada",
        });
      }

      // Crear el membership
      await dbW
        .insert(membershipsTable)
        .values({
          userId: ctx.session.user.id,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        })
        .onConflictDoNothing();

      // Marcar como aceptada
      await dbW
        .update(invitationsTable)
        .set({ acceptedAt: new Date() })
        .where(eq(invitationsTable.id, invitation.id));

      return { workspaceId: invitation.workspaceId };
    }),
});
