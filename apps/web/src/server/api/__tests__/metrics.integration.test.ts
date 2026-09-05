import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// trpc.ts importa `auth` de @/server/auth solo para createTRPCContext, que acá no
// usamos (armamos el ctx a mano). Sin este mock, cargar trpc.ts arrastra next-auth,
// que a su vez importa next/server -- un módulo que solo resuelve bien corriendo
// dentro del build de Next, no en Vitest.
vi.mock("@/server/auth", () => ({ auth: vi.fn() }));
// server-only tira error a propósito fuera del bundler de Next; también solo lo
// arrastra createTRPCContext, que no usamos.
vi.mock("server-only", () => ({}));
// @/server/db hace `export const db = dbRead()` a nivel de módulo, que valida env
// vars apenas se importa el archivo -- antes de que nuestro beforeAll llegue a
// setearlas. No lo usamos (armamos ctx.db con la DB de test), así que lo mockeamos.
vi.mock("@/server/db", () => ({ db: {}, dbW: {} }));
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import path from "path";
import { fileURLToPath } from "url";
import { clearEnvCache } from "@watchdog/env";
import * as schema from "@watchdog/db/schema";
import { dbRead } from "@watchdog/db";
import { createCallerFactory } from "@/server/api/trpc";
import { metricsRouter } from "../routers/metrics";

const { workspacesTable, agentsTable, usersTable, membershipsTable } = schema;

const TEST_DB = "monitoreo_recursos_test_web";
const BASE_URL =
  process.env.TEST_DB_BASE_URL ??
  "postgres://monitor_user:monitor_password@localhost:5433";
const ADMIN_URL = `${BASE_URL}/postgres`;
const TEST_DB_URL = `${BASE_URL}/${TEST_DB}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(
  __dirname,
  "../../../../../../packages/db/drizzle",
);

const createCaller = createCallerFactory(metricsRouter);

describe("metrics router RBAC (integration)", () => {
  let workspaceAId: string;
  let workspaceBId: string;
  let agentBId: string;
  let userId: string;
  let adminSql: postgres.Sql;
  let testSql: postgres.Sql;
  let db: ReturnType<typeof drizzle<typeof schema>>;

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
    process.env.REDIS_URL ??= "redis://localhost:6379"; // dummy, este test no usa redis
    clearEnvCache();

    const [workspaceA] = await db
      .insert(workspacesTable)
      .values({ name: "workspace-a", description: "test" })
      .returning();
    if (!workspaceA) throw new Error("workspaceA not created");
    workspaceAId = workspaceA.id;
    const [workspaceB] = await db
      .insert(workspacesTable)
      .values({ name: "workspace-b", description: "test" })
      .returning();
    if (!workspaceB) throw new Error("workspaceB not created");
    workspaceBId = workspaceB.id;

    const [user] = await db
      .insert(usersTable)
      .values({ name: "Test User", email: "test-rbac@test.com" })
      .returning();
    if (!user) throw new Error("user not created");
    userId = user.id;

    await db.insert(membershipsTable).values({
      userId: user.id,
      workspaceId: workspaceA.id,
      role: "member",
    });

    const [agentB] = await db
      .insert(agentsTable)
      .values({
        workspaceId: workspaceB.id,
        name: "agent-b",
        description: "test",
        apiKey: "test-api-key-rbac",
      })
      .returning();
    if (!agentB) throw new Error("agentB not created");
    agentBId = agentB.id;
  }, 60_000);

  afterAll(async () => {
    await dbRead().$client.end();
    await testSql?.end();
    await adminSql?.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql?.end();

    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.DATABASE_READ_URL = originalEnv.DATABASE_READ_URL;
    process.env.REDIS_URL = originalEnv.REDIS_URL;
    clearEnvCache();
  });

  it("user sin membership al workspace -> 403", async () => {
    const caller = createCaller({
      db,
      session: {
        user: {
          id: userId,
          emailVerified: null,
          isSuperAdmin: false,
          name: "Test User",
          email: "test-rbac@test.com",
        },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      },
      headers: new Headers(),
    });

    await expect(
      caller.getByAgent({
        workspaceId: workspaceBId,
        agentId: agentBId,
        metric: "cpu",
        from: new Date("2026-01-01T00:00:00Z"),
        to: new Date("2026-01-01T01:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("agent de otro workspace -> 403", async () => {
    const caller = createCaller({
      db,
      session: {
        user: {
          id: userId,
          emailVerified: null,
          isSuperAdmin: false,
          name: "Test User",
          email: "test-rbac@test.com",
        },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      },
      headers: new Headers(),
    });

    await expect(
      caller.getByAgent({
        workspaceId: workspaceAId,
        agentId: agentBId,
        metric: "cpu",
        from: new Date("2026-01-01T00:00:00Z"),
        to: new Date("2026-01-01T01:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("getByWorkspace: user sin membership al workspace -> 403", async () => {
    const caller = createCaller({
      db,
      session: {
        user: {
          id: userId,
          emailVerified: null,
          isSuperAdmin: false,
          name: "Test User",
          email: "test-rbac@test.com",
        },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      },
      headers: new Headers(),
    });

    await expect(
      caller.getByWorkspace({
        workspaceId: workspaceBId,
        metric: "cpu",
        from: new Date("2026-01-01T00:00:00Z"),
        to: new Date("2026-01-01T01:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
