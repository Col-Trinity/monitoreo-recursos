import * as p from "drizzle-orm/pg-core";

export const metricsTable = p.pgTable("metrics", {
   id: p.integer().primaryKey().generatedAlwaysAsIdentity(),
  cpuPercentage: p.real().notNull(),
  serverName: p.varchar().default("local-server"),
  createdAt: p.timestamp().defaultNow().notNull(),
});
