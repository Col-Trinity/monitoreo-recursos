import * as p from "drizzle-orm/pg-core";
import { roleEnum, workspacesTable } from "./tenancy";

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

export const verificationTokenTypeEnum = p.pgEnum("verification_token_type", [
  "email_verification",
  "password_reset",
]);

export const verificationTokensTable = p.pgTable("verification_tokens", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  userId: p
    .uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: p.varchar("token").notNull().unique(),
  type: verificationTokenTypeEnum("type").notNull().default("email_verification"),
  expiresAt: p.timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invitationsTable = p.pgTable("invitations", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  workspaceId: p
    .uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  email: p.varchar("email").notNull(),
  role: roleEnum("role").notNull().default("member"),
  token: p.varchar("token").notNull().unique(),
  invitedBy: p
    .uuid("invited_by")
    .notNull()
    .references(() => usersTable.id),
  expiresAt: p.timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: p.timestamp("accepted_at", { withTimezone: true }),
  createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Invitation = typeof invitationsTable.$inferSelect;
export type NewInvitation = typeof invitationsTable.$inferInsert;

export type VerificationToken = typeof verificationTokensTable.$inferSelect;
export type NewVerificationToken = typeof verificationTokensTable.$inferInsert;

export const accountsTable = p.pgTable(
  "accounts",
  {
    userId: p
      .uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: p.varchar("type").notNull(),
    provider: p.varchar("provider").notNull(),
    providerAccountId: p.varchar("provider_account_id").notNull(),
    refresh_token: p.text("refresh_token"),
    access_token: p.text("access_token"),
    expires_at: p.integer("expires_at"),
    token_type: p.varchar("token_type"),
    scope: p.varchar("scope"),
    id_token: p.text("id_token"),
    session_state: p.varchar("session_state"),
  },
  (table) => ({
    pk: p.primaryKey({ columns: [table.provider, table.providerAccountId] }),
    userIdx: p.index("accounts_user_id_idx").on(table.userId),
  }),
);

export type Account = typeof accountsTable.$inferSelect;
export type NewAccount = typeof accountsTable.$inferInsert;

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Session = typeof sessionsTable.$inferSelect;
export type NewSession = typeof sessionsTable.$inferInsert;
