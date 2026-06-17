import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { hashPassword } from "@/server/auth/password";
import { dbW } from "@/server/db";
import { usersTable, verificationTokensTable } from "@watchdog/db";
import { sendVerificationEmail } from "@/server/email";
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

      const token = randomBytes(32).toString("hex");

      // Lo guardamos en la DB con expiresAt = ahora + 24hs
      await dbW.insert(verificationTokensTable).values({
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Mandamos el email
      await sendVerificationEmail(user.email!, token);

      return user;
    }),
});
