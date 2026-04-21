
 import { env } from "@watchdog/env";
import { createDb } from "./client";
import { metricsTable } from "./schema/metrics";

async function seed() {
  const db = createDb(env.DATABASE_URL, { max: 1 });
  const ahora = new Date();
  const metricas = [];

  for (let i = 0; i < 288; i++) {
    const fecha = new Date(ahora.getTime() - (288 - i) * 5 * 60 * 1000);
    metricas.push({
      cpuPercentage: parseFloat((Math.random() * 100).toFixed(2)),
      createdAt: fecha,
    });
  }

  await db.insert(metricsTable).values(metricas).onConflictDoNothing();
  console.log(`Seeded ${metricas.length} metrics.`);
  process.exit(0);
}

seed();
