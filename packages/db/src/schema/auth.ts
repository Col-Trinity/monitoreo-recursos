import * as p from "drizzle-orm/pg-core";

export const languageEnum = p.pgEnum("language", ["en", "es", "pt"]);
export const usersTable = p.pgTable("users", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  name: p.varchar("name"),
  email: p.varchar("email").unique(),
  passwordHash: p.varchar("password_hash"),
  emailVerified: p.timestamp("email_verified", { withTimezone: true }),
  image: p.varchar("image"),
  language: languageEnum("language"),
  createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: p
    .timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: p.timestamp("deleted_at", { withTimezone: true }),
});

export const sessionsTable = p.pgTable(
  "sessions",
  {
    sessionToken: p.varchar("session_token").primaryKey(),
    userId: p
      .uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    expires: p.timestamp("expires", { withTimezone: true }).notNull(),
    tokenHash: p.varchar("token_hash"),
    createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: p.timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => ({
    userIdx: p.index("sessions_user_id_idx").on(table.userId),
    expiresIdx: p.index("sessions_expires_at_idx").on(table.expires),
  }),
);
export const verificationTokensTable = p.pgTable("verification_tokens", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  userId: p
    .uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: p.varchar("token").notNull().unique(),
  expiresAt: p.timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type VerificationToken = typeof verificationTokensTable.$inferSelect;
export type NewVerificationToken = typeof verificationTokensTable.$inferInsert;

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Session = typeof sessionsTable.$inferSelect;
export type NewSession = typeof sessionsTable.$inferInsert;
