import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { EventEmitter } from "node:events";
import type { Worker } from "bullmq";
import { GenericContainer } from "testcontainers";
import { StartedTestContainer } from "testcontainers";
import Redis from "ioredis";

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;
let app: FastifyInstance;
let worker: Worker;
let flush: () => Promise<void>;
let agentContainer: StartedTestContainer | undefined;
process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = "/var/run/docker.sock";
process.env.DOCKER_HOST = "unix:///var/run/docker.sock";
process.env.TESTCONTAINERS_RYUK_DISABLED = "true";
process.env.REDIS_URL = "redis://localhost:6380"; // siempre el mismo

describe("Metrics Pipeline", () => {
  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer("timescale/timescaledb-ha:pg16").start();
    // Levantamos Redis

    redisContainer = await new RedisContainer("redis:7-alpine")
      .withExposedPorts({ container: 6379, host: 6380 }) // puerto fijo 6380
      .start();

      console.log("Redis container levantado en:", redisContainer.getConnectionUrl());
    // Esperamos que Redis esté listo
    await new Promise((resolve) => setTimeout(resolve, 1000));

    //  PRIMERO seteamos las variables
    process.env.DATABASE_URL = pgContainer.getConnectionUri();
    process.env.REDIS_URL = redisContainer.getConnectionUrl();

    const { clearEnvCache } = await import("@watchdog/env");
    clearEnvCache(); // limpiamos el cache para que tome las nuevas variables
    console.log("env cache limpiado, REDIS_URL:", process.env.REDIS_URL);


    const { default: metricsStreamPlugin } = await import("../../src/routes/metrics-stream");
console.log("plugin importado");
    const { createDb } = await import("@watchdog/db");
    const db = createDb(pgContainer.getConnectionUri());
    // corre  migraciones
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
    console.log("REDIS_URL antes del worker:", process.env.REDIS_URL);

    const { createWorker, flush: workerFlush } = await import("../../../worker/src/processors/metrics-ingest");
    flush = workerFlush; // asignás a la variable global
    const connection = new Redis("redis://localhost:6380", { maxRetriesPerRequest: null });


// Verificamos que la conexión funciona antes de seguir
await new Promise((resolve, reject) => {
  connection.on("ready", resolve);
  connection.on("error", reject);
});
console.log("Redis connection ready!");

    worker = createWorker(connection);
    app = Fastify();
    await app.register(cors);
    app.addContentTypeParser("application/x-ndjson", (_request, payload, done) => {
      done(null, payload);
    });
    await app.register(metricsStreamPlugin, {
      metricsEmitter: new EventEmitter(),
    });
    await app.listen({ port: 3099, host: "0.0.0.0"});

    // levantamos contenedor de docker para el agent, que es el que va a enviar las métricas a la API. Lo hacemos con testcontainers para asegurarnos que está en la misma red y puede acceder a la API por su IP interna.
    const builtImage = await GenericContainer
      .fromDockerfile("../../apps/agent") // path relativo al Dockerfile
      .build();
    agentContainer = await builtImage
      .withEnvironment({
        AGENT_API_URL: "http://172.17.0.1:3099", // IP del host desde el container
        AGENT_API_KEY: "dev-api-key-12345",
        AGENT_SAMPLE_INTERVAL: "1s", // cada 1 segundo para que el test no tarde mucho
      })
      .start();

    console.log("Postgres:", pgContainer.getConnectionUri());
    console.log("Redis:", redisContainer.getConnectionUrl());
  }, 120000); // timeout de 120s porque Docker tarda en arrancar
  afterAll(async () => {
    await agentContainer?.stop();
    await worker.close();
    await app.close();
    await pgContainer.stop();
    await redisContainer.stop();
  });

  it("caso feliz: métrica llega a la DB", async () => {
    // Esperamos que el worker encole el job y luego forzamos el flush del buffer para que procese el job inmediatamente. Damos un timeout de 3 segundos para asegurarnos que el job se procese antes de consultar la DB.
    await new Promise((resolve) => setTimeout(resolve, 6000));
    await flush();

    const { createDb, metricsTable } = await import("@watchdog/db");
    const db = createDb(pgContainer.getConnectionUri());
    const metrics = await db.select().from(metricsTable);
    console.log("métricas en DB:", metrics.length, metrics); // verificamos cuántas métricas llegaron y cuáles son, para debuggear en caso de que el test falle. Si el worker no está procesando los jobs correctamente, este array estará vacío o no tendrá las métricas esperadas.
    // VERIFICAMOS QUE LA MÉTRICA LLEGA A LA DB
    expect(metrics.length).toBeGreaterThan(0);
  }, 15000);
});
