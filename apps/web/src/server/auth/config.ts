import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import { encode as defaultEncode } from "next-auth/jwt";
import { randomUUID } from "crypto";
import { accountsTable, sessionsTable, usersTable } from "@watchdog/db/schema";

import { dbW, db } from "@/server/db";
import { z } from "zod";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { verifyPassword } from "./password";
import Google from "next-auth/providers/google";

const adapter = DrizzleAdapter(dbW, {
  usersTable: usersTable,
  accountsTable: accountsTable,
  sessionsTable: sessionsTable,
});

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
    credentials?: boolean;
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
  adapter,
  session: { strategy: "database" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  jwt: {
    encode: async (params) => {
      if (params.token?.credentials) {
        const sessionToken = randomUUID();
        if (!params.token.sub) {
          throw new Error("No user ID found in token");
        }
        const createdSession = await adapter.createSession!({
          sessionToken,
          userId: params.token.sub,
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        if (!createdSession) {
          throw new Error("Failed to create session");
        }
        return sessionToken;
      }
      return defaultEncode(params);
    },
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
    jwt: async ({ token, account }) => {
      if (account?.provider === "credentials") {
        token.credentials = true;
      }
      return token;
    },
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        emailVerified:
          (user as { emailVerified?: Date | null }).emailVerified ?? null,
      },
    }),
  },
} satisfies NextAuthConfig;
