import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import { accountsTable, sessionsTable, usersTable } from "@watchdog/db/schema";

import { dbW, db } from "@/server/db";
import { z } from "zod";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { verifyPassword } from "./password";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface User {
    emailVerified: Date | null;
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      emailVerified: Date | null;
    } & DefaultSession["user"];
  }
}

export const authConfig = {
  providers: [
    Credentials({
      authorize: async (credentials) => {
        const schema = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        });

        const parsed = schema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const [usuario] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email));

        if (!usuario?.passwordHash) return null;

        const ok = await verifyPassword(password, usuario.passwordHash);
        if (!ok) return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.name,
          emailVerified: usuario.emailVerified,
        };
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  adapter: DrizzleAdapter(dbW, {
    usersTable: usersTable,
    accountsTable: accountsTable,
    sessionsTable: sessionsTable,
  }),
  session: { strategy: "database" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  callbacks: {
    signIn: async ({ user, account }) => {
      if (account?.provider === "google") {
        await dbW
          .update(usersTable)
          .set({ emailVerified: new Date() })
          .where(eq(usersTable.id, user.id!));
      }
      return true;
    },
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        emailVerified: (user as { emailVerified?: Date | null }).emailVerified ?? null,
      },
    }),
  },
} satisfies NextAuthConfig;
