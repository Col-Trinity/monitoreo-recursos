import * as p from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const workspacesTable = p.pgTable("workspaces", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  name: p.varchar("name").notNull(),
  description: p.varchar("description").notNull(),
  createdAt: p.timestamp("created_at").defaultNow().notNull(),
  updatedAt: p.timestamp("updated_at").defaultNow().notNull(),
  deletedAt: p.timestamp("deleted_at"),
});

export const roleEnum = p.pgEnum("role", ["owner", "admin", "member", "viewer"]);
export const membershipsTable = p.pgTable(
  "memberships",
  {
    id: p.uuid("id").primaryKey().defaultRandom(),
    userId: p
      .uuid("user_id")
      .notNull()
      .references(() => usersTable.id),

    workspaceId: p
      .uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id),

    role: roleEnum("role").notNull(),
    createdAt: p.timestamp("created_at").defaultNow().notNull(),
    updatedAt: p.timestamp("updated_at").defaultNow().notNull(),
    deletedAt: p.timestamp("deleted_at"),
  },
  (table) => ({
    userIdx: p.index("memberships_user_id_idx").on(table.userId),

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
    lastHeartbeat: p.timestamp("last_heartbeat"),
    createdAt: p.timestamp("created_at").defaultNow().notNull(),
    updatedAt: p.timestamp("updated_at").defaultNow().notNull(),
    deletedAt: p.timestamp("deleted_at"),
  },
  (table) => ({
    projectIdx: p.index("agents_workspace_id_idx").on(table.workspaceId),
  }),
);

export const hostsTable = p.pgTable(
  "hosts",
  {
    id: p.uuid("id").primaryKey().defaultRandom(),
    hostName: p.varchar("host_name").notNull(),
    port: p.integer("port"),
    agentId: p
      .uuid("agent_id")
      .notNull()
      .references(() => agentsTable.id),
    createdAt: p.timestamp("created_at").defaultNow().notNull(),
    updatedAt: p.timestamp("updated_at").defaultNow().notNull(),
    deletedAt: p.timestamp("deleted_at"),
  },
  (table) => ({
    agentIdx: p.index("hosts_agent_id_idx").on(table.agentId),
    uniqueAgentHost: p
      .uniqueIndex("hosts_agent_id_host_name_unique")
      .on(table.agentId, table.hostName),
  }),
);

export type Agent = typeof agentsTable.$inferSelect;
export type NewAgent = typeof agentsTable.$inferInsert;

export type Membership = typeof membershipsTable.$inferSelect;
export type NewMembership = typeof membershipsTable.$inferInsert;

export type Workspace = typeof workspacesTable.$inferSelect;
export type NewWorkspace = typeof workspacesTable.$inferInsert;
