import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { dbW } from "@/server/db";
import {
  sessionsTable,
  usersTable,
  verificationTokensTable,
} from "@watchdog/db";
import { membershipsTable, workspacesTable } from "@watchdog/db/schema";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/server/email";
import { randomBytes } from "node:crypto";

export const authRouter = createTRPCRouter({
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, input.email));

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already in use",
        });
      }

      const passwordHash = await hashPassword(input.password);

      const [user] = await dbW
        .insert(usersTable)
        .values({ email: input.email, passwordHash })
        .returning({ id: usersTable.id, email: usersTable.email });

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      const [workspace] = await dbW
        .insert(workspacesTable)
        .values({ name: "My Workspace", description: "" })
        .returning();

      if (workspace) {
        await dbW.insert(membershipsTable).values({
          userId: user.id,
          workspaceId: workspace.id,
          role: "owner",
        });
      }

      const token = randomBytes(32).toString("hex");

      // Lo guardamos en la DB con expiresAt = ahora + 24hs
      await dbW.insert(verificationTokensTable).values({
        userId: user.id,
        token,
        type: "email_verification",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Mandamos el email
      console.log("RESEND_SKIP_SEND:", process.env.RESEND_SKIP_SEND);
      await sendVerificationEmail(user.email!, token);

      return user;
    }),

  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      // Buscamos el usuario
      const [user] = await dbW
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, input.email));

      // Si no existe no decimos nada — evita enumerar emails
      if (!user) return { success: true };

      // Generamos el token con expiresAt = ahora + 1 hora
      const token = randomBytes(32).toString("hex");
      await dbW.insert(verificationTokensTable).values({
        userId: user.id,
        token,
        type: "password_reset",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
      });

      // Mandamos el email
      await sendPasswordResetEmail(user.email!, token);

      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      const [verificationToken] = await dbW
        .select()
        .from(verificationTokensTable)
        .where(
          and(
            eq(verificationTokensTable.token, input.token),
            eq(verificationTokensTable.type, "password_reset"),
            gt(verificationTokensTable.expiresAt, new Date()),
          ),
        );

      if (!verificationToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token inválido o expirado",
        });
      }

      const passwordHash = await hashPassword(input.password);
      await dbW
        .update(usersTable)
        .set({ passwordHash })
        .where(eq(usersTable.id, verificationToken.userId));

      // Invalidamos sesiones activas
      await dbW
        .delete(sessionsTable)
        .where(eq(sessionsTable.userId, verificationToken.userId));

      // Borramos el token usado
      await dbW
        .delete(verificationTokensTable)
        .where(eq(verificationTokensTable.id, verificationToken.id));

      return { success: true };
    }),
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(8),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await dbW
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, ctx.session.user.id));

      if (!user?.passwordHash) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const ok = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Contraseña actual incorrecta",
        });
      }

      const passwordHash = await hashPassword(input.newPassword);
      await dbW
        .update(usersTable)
        .set({ passwordHash })
        .where(eq(usersTable.id, user.id));

      return { success: true };
    }),
});
