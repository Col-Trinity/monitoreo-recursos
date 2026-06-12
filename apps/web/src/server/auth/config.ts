import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";

import { db } from "@/server/db";
import { z } from "zod";
import Credentials from "next-auth/providers/credentials";
import { usersTable } from "@watchdog/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "./password";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
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

        const userIfExist = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email));

        const [usuario] = userIfExist;
        if (!usuario?.passwordHash) return null;

        const compare = await verifyPassword(password, usuario.passwordHash);
        return compare ? usuario : null;
      },
    }),
  ],
  adapter: DrizzleAdapter(db),
  session: { strategy: "database" },
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
} satisfies NextAuthConfig;
