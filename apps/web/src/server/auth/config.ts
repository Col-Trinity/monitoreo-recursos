import { type DefaultSession, type NextAuthConfig } from "next-auth";
import { type JWT } from "next-auth/jwt";

import { db } from "@/server/db";
import { z } from "zod";
import Credentials from "next-auth/providers/credentials";
import { usersTable } from "@watchdog/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "./password";

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

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    emailVerified: Date | null;
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
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  callbacks: {
    jwt({
      token,
      user,
    }: {
      token: JWT;
      user?: { id?: string; emailVerified?: Date | null };
    }) {
      if (user) {
        token.id = user.id!;
        token.emailVerified = user.emailVerified ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.emailVerified = token.emailVerified;
      return session;
    },
  },
} satisfies NextAuthConfig;
