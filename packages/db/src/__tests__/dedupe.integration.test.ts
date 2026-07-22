import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "../schema";

const { metricsTable, agentsTable, workspacesTable } = schema;
const TEST_DB = "monitoreo_recursos_test";
const BASE_URL =
  process.env.TEST_DB_BASE_URL ?? "postgres://monitor_user:monitor_password@localhost:5433";
const ADMIN_URL = `${BASE_URL}/postgres`;
const TEST_DB_URL = `${BASE_URL}/${TEST_DB}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

describe("dedupe", () => {
  let adminSql: postgres.Sql;
  let testSql: postgres.Sql;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    adminSql = postgres(ADMIN_URL, { max: 1 });
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql.unsafe(`CREATE DATABASE "${TEST_DB}"`);

    testSql = postgres(TEST_DB_URL, { max: 1 });
    await testSql.unsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb`);

    db = drizzle(testSql, { schema });
    await migrate(db, { migrationsFolder });
  }, 60_000);

  afterAll(async () => {
    await testSql?.end();
    await adminSql?.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql?.end();
  });

  it("duplicate metric s ignored with onConflictoNothing", async () => {
    const [workspace] = await db
      .insert(workspacesTable)
      .values({
        name: "test-workspace",
        description: "test",
      })
      .returning();

    if (!workspace) throw new Error("workspace not created");
    const [agent] = await db
      .insert(agentsTable)
      .values({
        workspaceId: workspace.id,
        name: "test-agent",
        description: "test",
        apiKey: "test-api-key",
      })
      .returning();
    if (!agent) throw new Error("agent not created");
    const metric = {
      agentId: agent.id,
      metricsType: "cpu" as const,
      value: 45.2,
      hostname: "server-1",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    };
    await db.insert(metricsTable).values(metric).onConflictDoNothing();
    await db.insert(metricsTable).values(metric).onConflictDoNothing(); // duplicado

    const rows = await db.select().from(metricsTable);
    expect(rows).toHaveLength(1);
  });
});
