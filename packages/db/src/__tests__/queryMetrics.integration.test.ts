import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import path from "path";
import { fileURLToPath } from "url";
import { clearEnvCache } from "@watchdog/env";
import * as schema from "../schema";
import { dbRead } from "../index";
import { queryMetrics } from "../queries/metrics";

const { workspacesTable, agentsTable } = schema;

const TEST_DB = "monitoreo_recursos_test";
const BASE_URL =
  process.env.TEST_DB_BASE_URL ?? "postgres://monitor_user:monitor_password@localhost:5433";
const ADMIN_URL = `${BASE_URL}/postgres`;
const TEST_DB_URL = `${BASE_URL}/${TEST_DB}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

// queryMetrics llama a dbRead() internamente (no recibe un cliente como parámetro,
// tal como pide el ticket: "Queries usan dbRead()"), así que para testearla contra
// datos reales apuntamos las env vars de DB a la base de test y reseteamos el cache
// de @watchdog/env antes de que dbRead() se inicialice por primera vez.
describe("queryMetrics (integration)", () => {
  let adminSql: postgres.Sql;
  let testSql: postgres.Sql;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let agentId: string;

  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_READ_URL: process.env.DATABASE_READ_URL,
    REDIS_URL: process.env.REDIS_URL,
  };

  beforeAll(async () => {
    adminSql = postgres(ADMIN_URL, { max: 1 });
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql.unsafe(`CREATE DATABASE "${TEST_DB}"`);

    testSql = postgres(TEST_DB_URL, { max: 1 });
    await testSql.unsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb`);

    db = drizzle(testSql, { schema });
    await migrate(db, { migrationsFolder });

    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.DATABASE_READ_URL = TEST_DB_URL;
    process.env.REDIS_URL ??= "redis://localhost:6379"; // dummy, queryMetrics no usa redis
    clearEnvCache();

    const [workspace] = await db
      .insert(workspacesTable)
      .values({ name: "test-workspace", description: "test" })
      .returning();
    if (!workspace) throw new Error("workspace not created");

    const [agent] = await db
      .insert(agentsTable)
      .values({
        workspaceId: workspace.id,
        name: "test-agent",
        description: "test",
        apiKey: "test-api-key-query-metrics",
      })
      .returning();
    if (!agent) throw new Error("agent not created");
    agentId = agent.id;
  }, 60_000);

  afterAll(async () => {
    await dbRead().$client.end(); // cerrar el pool antes de dropear la DB, si no el DROP falla
    await testSql?.end();
    await adminSql?.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql?.end();

    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.DATABASE_READ_URL = originalEnv.DATABASE_READ_URL;
    process.env.REDIS_URL = originalEnv.REDIS_URL;
    clearEnvCache();
  });

  it("rango de última hora devuelve puntos crudos, sin min/max/sampleCount", async () => {
    const to = new Date("2026-01-01T12:00:00Z");
    const from = new Date(to.getTime() - 30 * 60_000); // 30 min atrás

    await testSql`
      INSERT INTO metrics (agent_id, metrics_type, value, host_name, created_at)
      VALUES
        (${agentId}, 'cpu', 10, 'host-1', ${new Date(to.getTime() - 20 * 60_000).toISOString()}),
        (${agentId}, 'cpu', 20, 'host-1', ${new Date(to.getTime() - 10 * 60_000).toISOString()})
    `;

    const result = await queryMetrics({ agentId, metric: "cpu", from, to });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.value).sort()).toEqual([10, 20]);
    expect(result[0]?.min).toBeUndefined();
    expect(result[0]?.max).toBeUndefined();
    expect(result[0]?.sampleCount).toBeUndefined();
  });

  it("rango de varios días devuelve puntos agregados por hora, con min/max/sampleCount", async () => {
    const start = new Date("2026-02-01T00:00:00Z");

    for (let i = 0; i < 60; i++) {
      await testSql`
        INSERT INTO metrics (agent_id, metrics_type, value, host_name, created_at)
        VALUES (${agentId}, 'memory', ${i}, 'host-1', ${new Date(start.getTime() + i * 60_000).toISOString()})
      `;
    }
    await testSql`CALL refresh_continuous_aggregate('metrics_1m', NULL, NULL)`;
    await testSql`CALL refresh_continuous_aggregate('metrics_1h', NULL, NULL)`;

    const from = start;
    const to = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 días después → nivel "1h"

    const result = await queryMetrics({ agentId, metric: "memory", from, to });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.min).toEqual(expect.any(Number));
    expect(result[0]?.max).toEqual(expect.any(Number));
    expect(result[0]?.sampleCount).toEqual(expect.any(Number));
  });
});
