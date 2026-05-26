import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import metricsStreamPlugin from "../../src/routes/metrics-stream";
import { EventEmitter } from "node:events";
import type { Worker } from "bullmq";

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;
let app: FastifyInstance;
let worker: Worker;
let flush: () => Promise<void>;
process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = "/var/run/docker.sock";
process.env.DOCKER_HOST = "unix:///var/run/docker.sock";
process.env.TESTCONTAINERS_RYUK_DISABLED = "true";
describe("Metrics Pipeline", () => {
  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer("timescale/timescaledb-ha:pg16").start();
    // Levantamos Redis
    redisContainer = await new RedisContainer("redis:7-alpine").start();
    // corre  migraciones
    //  PRIMERO seteamos las variables
    process.env.DATABASE_URL = pgContainer.getConnectionUri();
    process.env.REDIS_URL = redisContainer.getConnectionUrl();
    const { createDb } = await import("@watchdog/db");
    const db = createDb(pgContainer.getConnectionUri());
    await migrate(db, { migrationsFolder: "../../packages/db/drizzle" });

    const { workspacesTable, agentsTable } = await import("@watchdog/db/schema");
    const { createHash } = await import("node:crypto");

    const [workspace] = await db
      .insert(workspacesTable)
      .values({
        name: "test-workspace",
        description: "workspace para tests",
      })
      .returning();

    await db.insert(agentsTable).values({
      name: "test-agent",
      description: "agent para tests",
      workspaceId: workspace.id,
      apiKey: createHash("sha256").update("dev-api-key-12345").digest("hex"),
    });
    ({ worker, flush } = await import("../../../worker/src/processors/metrics-ingest"));

    app = Fastify();
    await app.register(cors);
    app.addContentTypeParser("application/x-ndjson", (_request, payload, done) => {
      done(null, payload);
    });
    await app.register(metricsStreamPlugin, {
      metricsEmitter: new EventEmitter(),
    });
    await app.listen({ port: 0 });

    console.log("Postgres:", pgContainer.getConnectionUri());
    console.log("Redis:", redisContainer.getConnectionUrl());
  }, 120000); // timeout de 60s porque Docker tarda en arrancar
  afterAll(async () => {
    await worker.close();
    await app.close();
    await pgContainer.stop();
    await redisContainer.stop();
  });

  it("caso feliz: métrica llega a la DB", async () => {
    const port = (app.server.address() as { port: number }).port;
    // Mandamos una métrica a la API
    const response = await fetch(`http://localhost:${port}/metrics/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-ndjson",
        Authorization: "Bearer dev-api-key-12345",
      },
      body:
        JSON.stringify({
          type: "cpu",
          timestamp: Date.now(),
          host: "servidor-test",
          value: { usage: 45.5 },
        }) + "\n",
    });

    expect(response.status).toBe(200);
    // Esperamos que el worker encole el job y luego forzamos el flush del buffer
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await flush();

    // VERIFICAMOS QUE LA MÉTRICA LLEGA A LA DB

    const { createDb, metricsTable } = await import("@watchdog/db");
    const db = createDb(pgContainer.getConnectionUri());
    const metrics = await db.select().from(metricsTable);

    expect(metrics.length).toBeGreaterThan(0);
  }, 15000);
});
