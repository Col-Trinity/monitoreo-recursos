import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "@watchdog/db/schema";
import { createHash, randomBytes } from "node:crypto";
import { Role, hasPermission, Permission } from "@watchdog/shared-types";
import { eq, and, isNull } from "drizzle-orm";
const { workspacesTable, usersTable, membershipsTable, agentsTable } = schema;

const TEST_DB = "monitoreo_recursos_test_authz";
const BASE_URL =
  process.env.TEST_DB_BASE_URL ??
  "postgres://monitor_user:monitor_password@localhost:5433";
const ADMIN_URL = `${BASE_URL}/postgres`;
const TEST_DB_URL = `${BASE_URL}/${TEST_DB}`;
const API_URL = process.env.API_URL ?? "http://localhost:3001";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(
  __dirname,
  "../../../../../packages/db/drizzle",
);

const hashApiKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");

describe("authz integration tests", () => {
  let adminSql: postgres.Sql;
  let testSql: postgres.Sql;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  let workspaceAId: string;
  let workspaceBId: string;

  // Un usuario por rol en workspace A
  const users: Record<Role, { id: string }> = {} as Record<
    Role,
    { id: string }
  >;

  // Usuario que pertenece solo a workspace B
  let userBId: string;

  // Agente con key válida
  let validApiKey: string;
  let revokedApiKey: string;

  beforeAll(async () => {
    adminSql = postgres(ADMIN_URL, { max: 1 });
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql.unsafe(`CREATE DATABASE "${TEST_DB}"`);

    testSql = postgres(TEST_DB_URL, { max: 1 });
    await testSql.unsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb`);

    db = drizzle(testSql, { schema });
    await migrate(db, { migrationsFolder });

    // Crear workspace A y B
    const [workspaceA] = await db
      .insert(workspacesTable)
      .values({ name: "workspace-a", description: "test" })
      .returning();
    if (!workspaceA) throw new Error("workspace A not created");
    workspaceAId = workspaceA.id;

    const [workspaceB] = await db
      .insert(workspacesTable)
      .values({ name: "workspace-b", description: "test" })
      .returning();
    if (!workspaceB) throw new Error("workspace B not created");
    workspaceBId = workspaceB.id;

    // Crear un usuario por cada rol en workspace A
    for (const role of Object.values(Role)) {
      const [user] = await db
        .insert(usersTable)
        .values({ name: `user-${role}`, email: `${role}@authz-test.com` })
        .returning();
      if (!user) throw new Error(`user ${role} not created`);
      users[role] = { id: user.id };

      await db.insert(membershipsTable).values({
        userId: user.id,
        workspaceId: workspaceAId,
        role,
      });
    }

    // Crear usuario que solo pertenece a workspace B
    const [userB] = await db
      .insert(usersTable)
      .values({ name: "user-b", email: "userb@authz-test.com" })
      .returning();
    if (!userB) throw new Error("user B not created");
    userBId = userB.id;

    await db.insert(membershipsTable).values({
      userId: userBId,
      workspaceId: workspaceBId,
      role: Role.owner,
    });

    // Crear agente con key valida en workspace A
    validApiKey = "wd_" + randomBytes(32).toString("hex");
    await db.insert(agentsTable).values({
      name: "agent-valid",
      description: "test",
      workspaceId: workspaceAId,
      apiKey: hashApiKey(validApiKey),
    });

    // Crear agente revocado
    revokedApiKey = "wd_" + randomBytes(32).toString("hex");
    const [revokedAgent] = await db
      .insert(agentsTable)
      .values({
        name: "agent-revoked",
        description: "test",
        workspaceId: workspaceAId,
        apiKey: hashApiKey(revokedApiKey),
      })
      .returning();
    if (!revokedAgent) throw new Error("revoked agent not created");

    await db
      .update(agentsTable)
      .set({ revokedAt: new Date() })
      .where(eq(agentsTable.id, revokedAgent.id));
  }, 60_000);

  afterAll(async () => {
    await testSql?.end();
    await adminSql?.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminSql?.end();
  });

  // ─── Test matrix: hasPermission cubre todos los roles x permisos ───

  describe("rolePermissions matrix", () => {
    const cases: Array<{
      role: Role;
      permission: Permission;
      expected: boolean;
    }> = [
      // owner puede todo
      {
        role: Role.owner,
        permission: Permission.workspaceManage,
        expected: true,
      },
      {
        role: Role.owner,
        permission: Permission.workspaceDelete,
        expected: true,
      },
      {
        role: Role.owner,
        permission: Permission.membersInvite,
        expected: true,
      },
      {
        role: Role.owner,
        permission: Permission.membersChangeRole,
        expected: true,
      },
      { role: Role.owner, permission: Permission.agentsCreate, expected: true },
      { role: Role.owner, permission: Permission.agentsDelete, expected: true },
      {
        role: Role.owner,
        permission: Permission.apikeysCreate,
        expected: true,
      },
      {
        role: Role.owner,
        permission: Permission.apikeysRevoke,
        expected: true,
      },
      { role: Role.owner, permission: Permission.metricsRead, expected: true },
      // admin no puede workspaceDelete ni membersChangeRole
      {
        role: Role.admin,
        permission: Permission.workspaceManage,
        expected: true,
      },
      {
        role: Role.admin,
        permission: Permission.workspaceDelete,
        expected: false,
      },
      {
        role: Role.admin,
        permission: Permission.membersInvite,
        expected: true,
      },
      {
        role: Role.admin,
        permission: Permission.membersChangeRole,
        expected: false,
      },
      { role: Role.admin, permission: Permission.agentsCreate, expected: true },
      { role: Role.admin, permission: Permission.agentsDelete, expected: true },
      {
        role: Role.admin,
        permission: Permission.apikeysCreate,
        expected: true,
      },
      {
        role: Role.admin,
        permission: Permission.apikeysRevoke,
        expected: true,
      },
      { role: Role.admin, permission: Permission.metricsRead, expected: true },
      // member solo puede agentsCreate, apikeysCreate, metricsRead
      {
        role: Role.member,
        permission: Permission.workspaceManage,
        expected: false,
      },
      {
        role: Role.member,
        permission: Permission.workspaceDelete,
        expected: false,
      },
      {
        role: Role.member,
        permission: Permission.membersInvite,
        expected: false,
      },
      {
        role: Role.member,
        permission: Permission.membersChangeRole,
        expected: false,
      },
      {
        role: Role.member,
        permission: Permission.agentsCreate,
        expected: true,
      },
      {
        role: Role.member,
        permission: Permission.agentsDelete,
        expected: false,
      },
      {
        role: Role.member,
        permission: Permission.apikeysCreate,
        expected: true,
      },
      {
        role: Role.member,
        permission: Permission.apikeysRevoke,
        expected: false,
      },
      { role: Role.member, permission: Permission.metricsRead, expected: true },
      // viewer solo puede metricsRead
      {
        role: Role.viewer,
        permission: Permission.workspaceManage,
        expected: false,
      },
      {
        role: Role.viewer,
        permission: Permission.workspaceDelete,
        expected: false,
      },
      {
        role: Role.viewer,
        permission: Permission.membersInvite,
        expected: false,
      },
      {
        role: Role.viewer,
        permission: Permission.membersChangeRole,
        expected: false,
      },
      {
        role: Role.viewer,
        permission: Permission.agentsCreate,
        expected: false,
      },
      {
        role: Role.viewer,
        permission: Permission.agentsDelete,
        expected: false,
      },
      {
        role: Role.viewer,
        permission: Permission.apikeysCreate,
        expected: false,
      },
      {
        role: Role.viewer,
        permission: Permission.apikeysRevoke,
        expected: false,
      },
      { role: Role.viewer, permission: Permission.metricsRead, expected: true },
    ];

    for (const { role, permission, expected } of cases) {
      it(`${role} ${expected ? "puede" : "NO puede"} ${permission}`, () => {
        expect(hasPermission(role, permission)).toBe(expected);
      });
    }
  });

  // ─── Test cross-workspace ───

  describe("cross-workspace isolation", () => {
    it("usuario de workspace B no tiene permisos en workspace A", async () => {
      // Verificar que userB no tiene membership en workspace A
      const [membership] = await db
        .select()
        .from(membershipsTable)
        .where(
          and(
            eq(membershipsTable.userId, userBId),
            eq(membershipsTable.workspaceId, workspaceAId),
            isNull(membershipsTable.deletedAt),
          ),
        );

      expect(membership).toBeUndefined();
    });

    it("usuario de workspace A no tiene permisos en workspace B", async () => {
      const { eq, and, isNull } = await import("drizzle-orm");

      const [membership] = await db
        .select()
        .from(membershipsTable)
        .where(
          and(
            eq(membershipsTable.userId, users[Role.owner].id),
            eq(membershipsTable.workspaceId, workspaceBId),
            isNull(membershipsTable.deletedAt),
          ),
        );

      expect(membership).toBeUndefined();
    });
  });
});
