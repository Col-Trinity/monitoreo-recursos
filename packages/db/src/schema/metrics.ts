import * as p from "drizzle-orm/pg-core";
import { agentsTable, workspacesTable } from "./tenancy";
import { usersTable } from "./auth";

export const metricsEnum = p.pgEnum("metrics_type", ["memory", "disk", "cpu", "network"]);
export const metricsTable = p.pgTable(
  "metrics",
  {
    id: p.uuid().notNull().defaultRandom(),
    agentId: p
      .uuid()
      .references(() => agentsTable.id)
      .notNull(),
    metricsType: metricsEnum("metrics_type").notNull(),
    value: p.doublePrecision("value"),
    hostname: p.varchar("host_name").notNull(),
    createdAt: p.timestamp("created_at").defaultNow().notNull()
  },
  (table) => ({
    pk: p.primaryKey({ columns: [table.id, table.createdAt] }), // PK compuesto
    agentTimeIdx: p.index("agent_time_idx").on(table.agentId, table.createdAt),

    uniqMetrics: p
      .uniqueIndex("uniq_metrcis")
      .on(table.createdAt, table.agentId, table.metricsType, table.hostname),
  }),
);

export const triggerEnum = p.pgEnum("trigger_type", ["memory", "disk", "cpu", "network", "custom"]);
export const alertsRuleTable = p.pgTable("alerts_rules", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  workspaceId: p
    .uuid("project_id")
    .notNull()
    .references(() => workspacesTable.id),
  createByUserId: p
    .uuid("created_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  notifiedUserId: p.varchar("notified_user_id"),
  trigger_type: triggerEnum("trigger_type"),
  metadata: p.json("metadata"),
  createdAt: p.timestamp(),
  updatedAt: p.timestamp("updated_at").defaultNow().notNull(),
  deletedAt: p.timestamp("deleted_at"),
});

export const statusEnum = p.pgEnum("status", ["active", "resolved", "ack"]);
export const alertEventTable = p.pgTable(
  "alert_events",
  {
    id: p.uuid("id").primaryKey().defaultRandom(),
    alertRuleId: p
      .uuid("alert_rule_id")
      .notNull()
      .references(() => alertsRuleTable.id),
    workspaceId: p
      .uuid("project_id")
      .notNull()
      .references(() => workspacesTable.id),
    userId: p
      .uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    triggerValue: p.integer("trigger_value"),
    startedAt: p.timestamp("started_at").notNull(),
    resolvedAt: p.timestamp("resolved_at"),
    status: statusEnum("status"),
    createdAt: p.timestamp(),
    updatedAt: p.timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: p.index("alert_event_status_idx").on(table.status),
    ruleStatusIdx: p.index("alert_event_rule_status_idx").on(table.alertRuleId, table.status),
    ruleStartedIdx: p.index("alert_event_rule_started_idx").on(table.alertRuleId, table.startedAt),
  }),
);

export const resourceTypeEnum = p.pgEnum("resource_type", [
  "user",
  "workspace",
  "agent",
  "host",
  "alert",
  "membership",
]);

export const actionEnum = p.pgEnum("action", [
  "created",
  "updated",
  "deleted",
  "invited",
  "login",
  "logout",
]);

export const auditLogTable = p.pgTable(
  "audit_log",
  {
    id: p.uuid("id").primaryKey().defaultRandom(),
    userId: p
      .uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    ipAddress: p.varchar("ip_address"),
    userAgent: p.varchar("user_agent"),
    workspaceId: p
      .uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id),
    resourceId: p.uuid("resource_id").notNull(),
    resourceType:resourceTypeEnum("resource_type"),
    action: actionEnum("action"),

    changes: p.json("changes"),
    createdAt: p.timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: p.index("audit_user_idx").on(table.userId),
    workspaceIdx: p.index("audit_workspace_idx").on(table.workspaceId),
    createdAtIdx: p.index("audit_created_at_idx").on(table.createdAt),
    resourceLookupIdx: p.index("audit_resource_idx").on(table.resourceType, table.resourceId),
  }),
);

export type Metric = typeof metricsTable.$inferSelect;
export type NewMetric = typeof metricsTable.$inferInsert;

export type AlertRule = typeof alertsRuleTable.$inferSelect;
export type NewAlertRule = typeof alertsRuleTable.$inferInsert;

export type AlertEvent = typeof alertEventTable.$inferSelect;
export type NewAlertEvent = typeof alertEventTable.$inferInsert;

export type AuditLog = typeof auditLogTable.$inferSelect;
export type NewAuditLog = typeof auditLogTable.$inferInsert;
