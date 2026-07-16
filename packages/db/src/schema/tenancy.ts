import * as p from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const workspacesTable = p.pgTable("workspaces", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  name: p.varchar("name").notNull(),
  description: p.varchar("description").notNull(),
  createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: p
    .timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: p.timestamp("deleted_at", { withTimezone: true }),
});

// Owner: workspace:manage, members:invite, members:change-role, agents:create,
//        agents:delete, apikeys:create, apikeys:revoke, metrics:read
// Admin: workspace:manage, members:invite, agents:create, agents:delete,
//        apikeys:create, apikeys:revoke, metrics:read
// Member: agents:create, apikeys:create, metrics:read
// Viewer: metrics:read

export const roleEnum = p.pgEnum("role", ["owner", "admin", "member", "viewer"]);
export const membershipsTable = p.pgTable(
  "memberships",
  {
    userId: p
      .uuid("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),

    workspaceId: p
      .uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, {
        onDelete: "cascade",
      }),

    role: roleEnum("role").notNull(),
    createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: p
      .timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: p.timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    userWorkspacePk: p.primaryKey({ columns: [table.userId, table.workspaceId] }),
    workspaceIdx: p.index("memberships_workspace_id_idx").on(table.workspaceId),
    uniqueUserWorkspace: p
      .uniqueIndex("memberships_user_workspace_unique")
      .on(table.userId, table.workspaceId),
  }),
);

export const agentsTable = p.pgTable(
  "agents",
  {
    id: p.uuid("id").primaryKey().defaultRandom(),
    workspaceId: p
      .uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id),

    name: p.varchar("name").notNull(),
    description: p.varchar("description").notNull(),
    apiKey: p.varchar("api_key").unique().notNull(),
    active: p.boolean("active").notNull().default(true),
    lastHeartbeat: p.timestamp("last_heartbeat", { withTimezone: true }),
    createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: p
      .timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: p.timestamp("deleted_at", { withTimezone: true }),
    revokedAt: p.timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    projectIdx: p.index("agents_workspace_id_idx").on(table.workspaceId),
  }),
);

export type Agent = typeof agentsTable.$inferSelect;
export type NewAgent = typeof agentsTable.$inferInsert;

export type Membership = typeof membershipsTable.$inferSelect;
export type NewMembership = typeof membershipsTable.$inferInsert;

export type Workspace = typeof workspacesTable.$inferSelect;
export type NewWorkspace = typeof workspacesTable.$inferInsert;
