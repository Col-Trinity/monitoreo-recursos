import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { hashPassword } from "@/server/auth/password";
import { dbW } from "@/server/db";
import { usersTable } from "@watchdog/db";

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
        throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });
      }

      const passwordHash = await hashPassword(input.password);

      const [user] = await dbW
        .insert(usersTable)
        .values({ email: input.email, passwordHash })
        .returning({ id: usersTable.id, email: usersTable.email });

      return user;
    }),
});
