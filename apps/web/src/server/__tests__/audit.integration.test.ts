import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "@watchdog/db/schema";
import { audit } from "../audit";

const { workspacesTable, usersTable, auditLogTable } = schema;

const TEST_DB = "monitoreo_recursos_test_audit";
const BASE_URL =
  process.env.TEST_DB_BASE_URL ??
  "postgres://monitor_user:monitor_password@localhost:5433";
const ADMIN_URL = `${BASE_URL}/postgres`;
const TEST_DB_URL = `${BASE_URL}/${TEST_DB}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(
  __dirname,
  "../../../../../packages/db/drizzle",
);

describe("audit_log (integration)", () => {
  let adminSql: postgres.Sql;
  let testSql: postgres.Sql;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let workspaceId: string;
  let userId: string;

  beforeAll(async () => {
    adminSql = postgres(ADMIN_URL, { max: 1 });
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql.unsafe(`CREATE DATABASE "${TEST_DB}"`);

    testSql = postgres(TEST_DB_URL, { max: 1 });
    await testSql.unsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb`);

    db = drizzle(testSql, { schema });
    await migrate(db, { migrationsFolder });

    const [workspace] = await db
      .insert(workspacesTable)
      .values({ name: "audit-test-workspace", description: "test" })
      .returning();
    if (!workspace) throw new Error("workspace not created");
    workspaceId = workspace.id;

    const [user] = await db
      .insert(usersTable)
      .values({ name: "Audit Test User", email: "audit-test@test.com" })
      .returning();
    if (!user) throw new Error("user not created");
    userId = user.id;
  }, 60_000);

  afterAll(async () => {
    await testSql?.end();
    await adminSql?.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql?.end();
  });

  it("audit() inserta una fila en audit_log con los datos correctos", async () => {
    await audit(
      db,
      { session: { user: { id: userId } } },
      {
        workspaceId,
        action: "member.role_changed",
        resource: { type: "membership", id: userId },
        metadata: { newRole: "admin" },
      },
    );

    const rows = await db
      .select()
      .from(auditLogTable)
      .where(eq(auditLogTable.action, "member.role_changed"));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      workspaceId,
      userId,
      action: "member.role_changed",
      resourceType: "membership",
      resourceId: userId,
      metadata: { newRole: "admin" },
    });
  });

  it("audit_log es append-only: UPDATE y DELETE son rechazados", async () => {
    const [row] = await db.select().from(auditLogTable).limit(1);
    if (!row) throw new Error("no hay filas para probar el trigger");

    // postgres-js envuelve el error real de Postgres en `.cause`
    await expect(
      db
        .update(auditLogTable)
        .set({ action: "hacked" })
        .where(eq(auditLogTable.id, row.id)),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("append-only") },
    });

    await expect(
      db.delete(auditLogTable).where(eq(auditLogTable.id, row.id)),
    ).rejects.toMatchObject({
      cause: { message: expect.stringContaining("append-only") },
    });
  });
});
