import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import path from "path";
import { fileURLToPath } from "url";

const TEST_DB = "monitoreo_recursos_test";
const BASE_URL =
  process.env.TEST_DB_BASE_URL ?? "postgres://monitor_user:monitor_password@localhost:5433";
const ADMIN_URL = `${BASE_URL}/postgres`;
const TEST_DB_URL = `${BASE_URL}/${TEST_DB}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

describe("migrations", () => {
  let adminSql: postgres.Sql;
  let testSql: postgres.Sql;

  beforeAll(async () => {
    adminSql = postgres(ADMIN_URL, { max: 1 });
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql.unsafe(`CREATE DATABASE "${TEST_DB}"`);

    testSql = postgres(TEST_DB_URL, { max: 1 });
    await testSql.unsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb`);

    const db = drizzle(testSql);
    await migrate(db, { migrationsFolder });
  }, 60_000);

  afterAll(async () => {
    await testSql?.end();
    await adminSql?.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql?.end();
  });

  it("all timestamp columns use timestamptz", async () => {
    const rows = await testSql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type = 'timestamp without time zone'
    `;
    expect(rows, `Columns missing timezone:\n${JSON.stringify(rows, null, 2)}`).toHaveLength(0);
  });

  describe("continuous aggregates", () => {
    it("metrics_1m agrega 60 filas de una hora de datos crudos, y metrics_1h refleja el agregado", async () => {
      const [workspace] = await testSql`
        INSERT INTO workspaces (name, description)
        VALUES ('test-workspace', 'workspace de test')
        RETURNING id
      `;
      if (!workspace) throw new Error("workspace insert returned no rows");

      const [agent] = await testSql`
        INSERT INTO agents (workspace_id, name, description, api_key)
        VALUES (${workspace.id}, 'test-agent', 'agente de test', 'test-api-key-cagg')
        RETURNING id
      `;
      if (!agent) throw new Error("agent insert returned no rows");

      const start = new Date("2026-01-01T00:00:00Z");
      for (let i = 0; i < 60; i++) {
        await testSql`
          INSERT INTO metrics (agent_id, metrics_type, value, host_name, created_at)
          VALUES (${agent.id}, 'cpu', ${i}, 'host-1', ${new Date(start.getTime() + i * 60_000).toISOString()})
        `;
      }

      await testSql`CALL refresh_continuous_aggregate('metrics_1m', NULL, NULL)`;
      await testSql`CALL refresh_continuous_aggregate('metrics_1h', NULL, NULL)`;

      const oneMinuteRows = await testSql`SELECT * FROM metrics_1m WHERE agent_id = ${agent.id}`;
      expect(oneMinuteRows).toHaveLength(60);

      const oneHourRows = await testSql`SELECT * FROM metrics_1h WHERE agent_id = ${agent.id} LIMIT 10`;
      expect(oneHourRows.length).toBeGreaterThan(0);
      expect(oneHourRows[0]).toMatchObject({
        agent_id: agent.id,
        host_name: "host-1",
        metrics_type: "cpu",
      });
    });
  });
});
