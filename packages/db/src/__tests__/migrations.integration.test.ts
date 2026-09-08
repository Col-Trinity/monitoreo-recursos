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

  describe("alert schema (DAZ-71): soporta los ejemplos del requirement", () => {
    let workspaceId: string;
    let agentId: string;
    let userId: string;

    beforeAll(async () => {
      const [workspace] = await testSql`
        INSERT INTO workspaces (name, description)
        VALUES ('ws-daz71', 'workspace de test DAZ-71')
        RETURNING id
      `;
      if (!workspace) throw new Error("workspace insert returned no rows");
      workspaceId = workspace.id;

      const [user] = await testSql`
        INSERT INTO users (email) VALUES ('daz71@test.local') RETURNING id
      `;
      if (!user) throw new Error("user insert returned no rows");
      userId = user.id;

      const [agent] = await testSql`
        INSERT INTO agents (workspace_id, name, description, api_key)
        VALUES (${workspaceId}, 'agent-daz71', 'agente de test', 'test-api-key-daz71')
        RETURNING id
      `;
      if (!agent) throw new Error("agent insert returned no rows");
      agentId = agent.id;
    });

    it("scope = null aplica la regla a todos los agents del workspace", async () => {
      const [rule] = await testSql`
        INSERT INTO alert_rules (name, workspace_id, created_by, metric_type, operator, threshold, duration_seconds)
        VALUES ('disco lleno (todo el workspace)', ${workspaceId}, ${userId}, 'disk', 'gte', 90, 300)
        RETURNING agent_id
      `;
      expect(rule?.agent_id).toBeNull();
    });

    it("scope = agent_id limita la regla a un agent puntual", async () => {
      const [rule] = await testSql`
        INSERT INTO alert_rules (name, workspace_id, agent_id, created_by, metric_type, operator, threshold, duration_seconds)
        VALUES ('cpu alta en agent-daz71', ${workspaceId}, ${agentId}, ${userId}, 'cpu', 'gt', 90, 300)
        RETURNING agent_id
      `;
      expect(rule?.agent_id).toBe(agentId);
    });

    it("acepta los 5 operadores del requirement (gt, lt, eq, gte, lte) y rechaza uno inválido", async () => {
      for (const operator of ["gt", "lt", "eq", "gte", "lte"]) {
        const [rule] = await testSql`
          INSERT INTO alert_rules (name, workspace_id, created_by, metric_type, operator, threshold, duration_seconds)
          VALUES (${`operator-${operator}`}, ${workspaceId}, ${userId}, 'memory', ${operator}, 50, 60)
          RETURNING operator
        `;
        expect(rule?.operator).toBe(operator);
      }

      await expect(
        testSql`
          INSERT INTO alert_rules (name, workspace_id, created_by, metric_type, operator, threshold, duration_seconds)
          VALUES ('operator-invalido', ${workspaceId}, ${userId}, 'memory', 'ne', 50, 60)
        `,
      ).rejects.toThrow();
    });

    it("acepta los 4 metric_type del requirement (cpu|memory|disk|network) y rechaza uno inválido", async () => {
      for (const metricType of ["cpu", "memory", "disk", "network"]) {
        const [rule] = await testSql`
          INSERT INTO alert_rules (name, workspace_id, created_by, metric_type, operator, threshold, duration_seconds)
          VALUES (${`metric-${metricType}`}, ${workspaceId}, ${userId}, ${metricType}, 'gt', 50, 60)
          RETURNING metric_type
        `;
        expect(rule?.metric_type).toBe(metricType);
      }

      await expect(
        testSql`
          INSERT INTO alert_rules (name, workspace_id, created_by, metric_type, operator, threshold, duration_seconds)
          VALUES ('metric-invalido', ${workspaceId}, ${userId}, 'gpu', 'gt', 50, 60)
        `,
      ).rejects.toThrow();
    });

    it("actions guarda y devuelve un array de { type, config } tal cual", async () => {
      const actions = [
        { type: "email", config: { to: "oncall@daztanllc.com" } },
        { type: "webhook", config: { url: "https://hooks.example.com/alert" } },
      ];

      const [rule] = await testSql`
        INSERT INTO alert_rules (name, workspace_id, created_by, metric_type, operator, threshold, duration_seconds, actions)
        VALUES ('con acciones', ${workspaceId}, ${userId}, 'network', 'gte', 100, 300, ${JSON.stringify(actions)}::jsonb)
        RETURNING actions
      `;
      expect(rule?.actions).toEqual(actions);
    });

    it("duration_seconds soporta ventanas tipo 5 minutos (300)", async () => {
      const [rule] = await testSql`
        INSERT INTO alert_rules (name, workspace_id, created_by, metric_type, operator, threshold, duration_seconds)
        VALUES ('ventana de 5 min', ${workspaceId}, ${userId}, 'cpu', 'gt', 90, 300)
        RETURNING duration_seconds
      `;
      expect(rule?.duration_seconds).toBe(300);
    });

    it("alert_events se linkea a una regla y registra el valor disparador + timestamps de inicio/resolución", async () => {
      const [rule] = await testSql`
        INSERT INTO alert_rules (name, workspace_id, created_by, metric_type, operator, threshold, duration_seconds)
        VALUES ('regla para evento', ${workspaceId}, ${userId}, 'cpu', 'gt', 90, 300)
        RETURNING id
      `;
      if (!rule) throw new Error("alert_rules insert returned no rows");

      const [event] = await testSql`
        INSERT INTO alert_events (alert_rule_id, agent_id, trigger_value)
        VALUES (${rule.id}, ${agentId}, 95.5)
        RETURNING id, alert_rule_id, trigger_value, started_at, resolved_at
      `;
      if (!event) throw new Error("alert_events insert returned no rows");

      expect(event.alert_rule_id).toBe(rule.id);
      expect(event.trigger_value).toBe(95.5);
      expect(event.started_at).not.toBeNull();
      expect(event.resolved_at).toBeNull();

      const [resolved] = await testSql`
        UPDATE alert_events SET status = 'resolved', resolved_at = now()
        WHERE id = ${event.id}
        RETURNING resolved_at
      `;
      expect(resolved?.resolved_at).not.toBeNull();
    });

    it("rechaza un alert_event con agent_id inexistente (integridad del scope)", async () => {
      const [rule] = await testSql`
        INSERT INTO alert_rules (name, workspace_id, created_by, metric_type, operator, threshold, duration_seconds)
        VALUES ('regla para fk test', ${workspaceId}, ${userId}, 'cpu', 'gt', 90, 300)
        RETURNING id
      `;
      if (!rule) throw new Error("alert_rules insert returned no rows");

      await expect(
        testSql`
          INSERT INTO alert_events (alert_rule_id, agent_id, trigger_value)
          VALUES (${rule.id}, '00000000-0000-0000-0000-000000000000', 1)
        `,
      ).rejects.toThrow();
    });
  });
});
