import { env } from "@watchdog/env";
import { createDb } from "./client";
import { metricsTable } from "./schema/metrics";
import { workspacesTable, agentsTable, membershipsTable } from "./schema/tenancy";
import { usersTable } from "./schema";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");
const hashPassword = (password: string) => bcrypt.hash(password, 12);

async function seed() {
  const db = createDb(env.DATABASE_URL, { max: 1 });

  const [workspace] = await db
    .insert(workspacesTable)
    .values({
      name: "Watchodg Dev",
      description: "local development workspace",
    })
    .onConflictDoNothing()
    .returning();

  if (!workspace) {
    console.log("Workspace already exists, skipping...");
    process.exit(0);
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name: "dev user",
      email: "dev@watchdog.test",
      passwordHash: await hashPassword("password"),
    })
    .onConflictDoNothing()
    .returning();

  if (user) {
    await db
      .insert(membershipsTable)
      .values({
        userId: user.id,
        workspaceId: workspace.id,
        role: "owner",
      })
      .onConflictDoNothing();
  }

  const [agent] = await db
    .insert(agentsTable)
    .values({
      name: "agent-local",
      description: "local development agent",
      workspaceId: workspace.id,
      apiKey: hashApiKey("dev-api-key-12345"),
    })
    .onConflictDoNothing()
    .returning();

  if (!agent) {
    console.log("agent already exists, skipping...");
    process.exit(0);
  }

  const ahora = new Date();
  const metricas = [];

  for (let i = 0; i < 288; i++) {
    const fecha = new Date(ahora.getTime() - (288 - i) * 5 * 60 * 1000);
    metricas.push({
      agentId: agent.id,
      metricsType: "cpu" as const,
      value: parseFloat((Math.random() * 100).toFixed(2)),
      hostname: "localhost",
      time: fecha,
    });
  }

  await db.insert(metricsTable).values(metricas).onConflictDoNothing();
  console.log(`Seeded ${metricas.length} metrics.`);
  process.exit(0);
}

seed();
