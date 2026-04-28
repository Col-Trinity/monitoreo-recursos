import * as p from "drizzle-orm/pg-core";

export const languageEnum = p.pgEnum("language", ["ingles", "español", "portugues"]);
export const usersTable = p.pgTable("users", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  name: p.varchar("name"),
  email: p.varchar("email").unique(),
  passwordHash: p.varchar("password_hash"),
  emailVerifiedAt: p.timestamp("email_verified_at"),
  language: languageEnum("language"),
  createdAt: p.timestamp("created_at").defaultNow().notNull(),
  updatedAt: p.timestamp("updated_at").defaultNow().notNull(),
  deletedAt: p.timestamp("deleted_at"),
});

export const sessionsTable = p.pgTable("sessions", {
    id: p.uuid("id").primaryKey().defaultRandom(),
    userId: p
      .uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    expiresAt: p.timestamp("expires_at").notNull(),
    tokenHash: p.varchar("token_hash"),
    createdAt: p.timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: p.timestamp("last_used_at"),
  },
  (table) => ({
    userIdx: p.index("sessions_user_id_idx").on(table.userId),
    expiresIdx: p.index("sessions_expires_at_idx").on(table.expiresAt),
  })
);

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;


export type Session = typeof sessionsTable.$inferSelect;
export type NewSession = typeof sessionsTable.$inferInsert;

