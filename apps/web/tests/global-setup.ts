import { execSync, spawn } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import net from "net";
import dotenv from "dotenv";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

// Cargar .env antes de cualquier cosa — Playwright no lo carga automáticamente
dotenv.config({ path: join(ROOT, ".env") });
const PIDS_FILE = "/tmp/playwright-pids.json";
const AGENT_BIN = "/tmp/watchdog-e2e-agent";
const API_KEY = "dev-api-key-12345";

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect(port, "localhost", () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
  });
}

async function waitForPort(port: number, ms = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await isPortOpen(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Puerto ${port} no respondió en ${ms}ms`);
}

async function waitForAllMetricTypes(timeoutMs = 60000): Promise<void> {
  const { createDb, metricsTable } = await import("@watchdog/db");
  const { gt } = await import("drizzle-orm");
  const db = createDb(process.env.DATABASE_URL!);
  const TYPES = ["cpu", "memory", "disk", "network"] as const;

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // Solo métricas de los últimos 60 segundos — datos del agente, no del seed
    const cutoff = new Date(Date.now() - 60_000);
    const rows = await db
      .select({ type: metricsTable.metricsType })
      .from(metricsTable)
      .where(gt(metricsTable.createdAt, cutoff));

    const found = new Set(rows.map((r) => r.type));
    if (TYPES.every((t) => found.has(t))) return;

    console.log(
      `Esperando métricas del agente... tipos recibidos: ${[...found].join(", ") || "ninguno"}`,
    );
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("El agente no envió los 4 tipos de métrica en 60s");
}

export default async function globalSetup() {
  const pids: number[] = [];

  // En CI no hay .env — lo creamos desde las vars del workflow
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) {
    writeFileSync(
      envPath,
      [
        `DATABASE_URL=${process.env.DATABASE_URL}`,
        `REDIS_URL=${process.env.REDIS_URL ?? "redis://localhost:6379"}`,
        `API_PORT=3001`,
        `API_HOST=0.0.0.0`,
        `NEXT_PUBLIC_API_URL=http://localhost:3001`,
        `AGENT_API_URL=http://localhost:3001`,
        `AGENT_SAMPLE_INTERVAL=2s`,
        `AGENT_PUBLISH_INTERVAL=3s`,
      ].join("\n"),
    );
  }

  // 1. Docker
  execSync("docker compose up -d postgres redis", {
    cwd: ROOT,
    stdio: "inherit",
  });

  // 2. Esperar Postgres
  for (let i = 0; i < 30; i++) {
    try {
      execSync(
        "docker compose exec -T postgres pg_isready -U monitor_user -d monitoreo_recursos",
        { cwd: ROOT, stdio: "pipe" },
      );
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // 3. Migrations
  execSync("pnpm --filter @watchdog/db db:migrate", {
    cwd: ROOT,
    stdio: "inherit",
  });

  // 4. Seed — crea el workspace y el agente con su API key
  try {
    execSync("pnpm --filter @watchdog/db db:seed", {
      cwd: ROOT,
      stdio: "pipe",
    });
  } catch {
    // ya existe, ignorar
  }

  // 5. API — necesaria para que el agente envíe métricas
  if (!(await isPortOpen(3001))) {
    const api = spawn("pnpm", ["--filter", "@watchdog/api", "dev"], {
      cwd: ROOT,
      env: { ...process.env },
      detached: true,
      stdio: "ignore",
    });
    api.unref();
    pids.push(api.pid!);
    await waitForPort(3001);
  }

  // 6. Worker — consume la queue de Redis y escribe a la DB
  const worker = spawn("pnpm", ["--filter", "@watchdog/worker", "dev"], {
    cwd: ROOT,
    env: { ...process.env },
    detached: true,
    stdio: "ignore",
  });
  worker.unref();
  pids.push(worker.pid!);

  // Darle tiempo al worker para conectarse a Redis
  await new Promise((r) => setTimeout(r, 2000));

  // 7. Compilar y arrancar el agente Go
  execSync(`go build -o ${AGENT_BIN} ./cmd/agent`, {
    cwd: join(ROOT, "apps/agent"),
    stdio: "pipe",
  });

  const agent = spawn(AGENT_BIN, [], {
    env: {
      ...process.env,
      AGENT_API_URL: "http://localhost:3001",
      AGENT_API_KEY: API_KEY,
      AGENT_SAMPLE_INTERVAL: "2s",
      AGENT_PUBLISH_INTERVAL: "3s",
    },
    detached: true,
    stdio: "ignore",
  });
  agent.unref();
  pids.push(agent.pid!);

  writeFileSync(PIDS_FILE, JSON.stringify(pids));

  // 8. Esperar hasta que los 4 tipos de métrica lleguen a la DB
  await waitForAllMetricTypes();
}
