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
});
