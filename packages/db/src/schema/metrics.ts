import * as p from "drizzle-orm/pg-core";
import { agentsTable, workspacesTable } from "./tenancy";
import { usersTable } from "./auth";

// TODO: Abel - check if `id` can be replaced with `agentId` in composite PK (TimescaleDB requires created_at in PK)
// TODO: Add all possible metrics
export const metricsEnum = p.pgEnum("metrics_type", ["memory", "disk", "cpu", "network"]);
export const metricsTable = p.pgTable(
  "metrics",
  {
    // TODO: DELETE PK ID AS IS UNNECESSARY
    id: p.uuid().notNull().defaultRandom(),
    agentId: p
      .uuid("agent_id")
      .references(() => agentsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),
    metricsType: metricsEnum("metrics_type").notNull(),
    value: p.doublePrecision("value"),
    hostname: p.varchar("host_name").notNull(),
    createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: p.primaryKey({ columns: [table.id, table.createdAt] }), // PK compuesto
    agentTimeIdx: p.index("agent_time_idx").on(table.agentId, table.createdAt),

    uniqMetrics: p
      .uniqueIndex("uniq_metrics")
      .on(table.createdAt, table.agentId, table.metricsType, table.hostname),
  }),
);

// metrics_1m/1h/1d son TimescaleDB continuous aggregates creadas por SQL crudo
// (ver drizzle/0017-0019). `.existing()` le dice a Drizzle que no las gestione
// (sin CREATE/DROP en migraciones) — solo las usamos para queries tipadas.
const aggregatedMetricsColumns = {
  bucketStart: p.timestamp("bucket_start", { withTimezone: true }).notNull(),
  agentId: p.uuid("agent_id").notNull(),
  hostName: p.varchar("host_name").notNull(),
  metricsType: metricsEnum("metrics_type").notNull(),
  avgValue: p.doublePrecision("avg_value"),
  minValue: p.doublePrecision("min_value"),
  maxValue: p.doublePrecision("max_value"),
  sampleCount: p.bigint("sample_count", { mode: "number" }),
};

export const metrics1mView = p
  .pgMaterializedView("metrics_1m", aggregatedMetricsColumns)
  .existing();
export const metrics1hView = p
  .pgMaterializedView("metrics_1h", aggregatedMetricsColumns)
  .existing();
export const metrics1dView = p
  .pgMaterializedView("metrics_1d", aggregatedMetricsColumns)
  .existing();

export const metricEnum = p.pgEnum("metric_type", ["memory", "disk", "cpu", "network"]);
export const operatorEnum = p.pgEnum("operator", ["gt", "lt", "eq", "gte", "lte"]);
export const alertRulesTable = p.pgTable("alert_rules", {
  id: p.uuid("id").primaryKey().defaultRandom(),
  name: p.varchar("name").notNull(),
  description: p.varchar("description"),
  agentId: p.uuid("agent_id").references(() => agentsTable.id),
  workspaceId: p
    .uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id),
  createdBy: p
    .uuid("created_by")
    .notNull()
    .references(() => usersTable.id),
  metricType: metricEnum("metric_type").notNull(),
  operator: operatorEnum("operator").notNull(),
  threshold: p.real("threshold").notNull(),
  enabled: p.boolean("enabled").notNull().default(true),
  actions: p.jsonb("actions").notNull().default([]),
  durationSeconds: p.integer("duration_seconds").notNull(),
  createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: p
    .timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: p.timestamp("deleted_at", { withTimezone: true }),
});

export const statusEnum = p.pgEnum("status", ["active", "resolved", "ack"]);
export const alertEventsTable = p.pgTable(
  "alert_events",
  {
    id: p.uuid("id").primaryKey().defaultRandom(),
    alertRuleId: p
      .uuid("alert_rule_id")
      .notNull()
      .references(() => alertRulesTable.id),
    agentId: p
      .uuid("agent_id")
      .notNull()
      .references(() => agentsTable.id),
    triggerValue: p.real("trigger_value").notNull(),
    status: statusEnum("status").notNull().default("active"),
    startedAt: p.timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    ackAt: p.timestamp("ack_at", { withTimezone: true }),
    resolvedAt: p.timestamp("resolved_at", { withTimezone: true }),
    createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: p
      .timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIdx: p.index("alert_event_status_idx").on(table.status),
    ruleStatusIdx: p.index("alert_event_rule_status_idx").on(table.alertRuleId, table.status),
    ruleStartedIdx: p.index("alert_event_rule_started_idx").on(table.alertRuleId, table.startedAt),
  }),
);

export type Metric = typeof metricsTable.$inferSelect;
export type NewMetric = typeof metricsTable.$inferInsert;

export type AlertRule = typeof alertRulesTable.$inferSelect;
export type NewAlertRule = typeof alertRulesTable.$inferInsert;

export type AlertEvent = typeof alertEventsTable.$inferSelect;
export type NewAlertEvent = typeof alertEventsTable.$inferInsert;

export const auditLogTable = p.pgTable(
  "audit_log",
  {
    id: p.uuid("id").defaultRandom().primaryKey(),
    workspaceId: p
      .uuid("workspace_id")
      .references(() => workspacesTable.id, { onDelete: "set null" }),
    userId: p.uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    action: p.text("action").notNull(),
    resourceType: p.text("resource_type").notNull(),
    resourceId: p.text("resource_id"),
    metadata: p.jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: p.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: p.index("audit_workspace_idx").on(table.workspaceId),
    userIdx: p.index("audit_user_idx").on(table.userId),
    createdAtIdx: p.index("audit_created_at_idx").on(table.createdAt),
    resourceLookupIdx: p.index("audit_resource_idx").on(table.resourceType, table.resourceId),
  }),
);

export type AuditLog = typeof auditLogTable.$inferSelect;
export type NewAuditLog = typeof auditLogTable.$inferInsert;
