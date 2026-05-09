import { env } from "@watchdog/env";
import { createDb } from "../src/client";
import { metricsTable } from "../src/schema/metrics";
import { agentsTable } from "../src/schema";
import { and, eq, gte } from "drizzle-orm";

const HOSTS = ["servidor-1", "servidor-2", "servidor-3", "servidor-4", "servidor-5", "servidor-6"];
const TIPOS = ["cpu", "memory", "disk", "network"] as const;
const DIAS = 30;
const LOTE = 10000;

async function benchmark() {
  const db = createDb(env.DATABASE_URL, { max: 1 });

  const [agent] = await db.select().from(agentsTable).limit(1);

  if (!agent) {
    console.log("No hay agents en la base de datos, corré db:seed primero");
    process.exit(1);
  }
  // Limpiamos la tabla antes de insertar
  console.log("Limpiando tabla metrics...");
  await db.delete(metricsTable);
  console.log("Tabla limpia ");

  console.log(`Usando agent: ${agent.id}`);

  //generate data
  const ahora = new Date();
  const filas = [];

  for (let dia = 0; dia < DIAS; dia++) {
    for (let minuto = 0; minuto < 1440; minuto++) {
      for (const host of HOSTS) {
        for (const tipo of TIPOS) {
          const fecha = new Date(
            ahora.getTime() - (DIAS - dia) * 1440 * 60 * 1000 + minuto * 60 * 1000,
          );
          filas.push({
            agentId: agent.id,
            metricsType: tipo,
            value: parseFloat((Math.random() * 100).toFixed(2)),
            hostname: host,
            createdAt: fecha,
          });
        }
      }
    }
  }

  console.log(`Generadas ${filas.length} filas`);

  const inicioInsert = Date.now();
  console.log(`Insertando ${filas.length} filas en lotes de ${LOTE}...`);

  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    await db.insert(metricsTable).values(lote);
    console.log(`Insertadas ${i + lote.length} / ${filas.length} filas`);
  }

  const finInsert = Date.now();
  console.log(`Insert total tardó: ${finInsert - inicioInsert}ms`);

  // measurement of metrics
  console.log(`\nMidiendo queries...`);
  const tiempos = [];

  for (let i = 0; i < 100; i++) {
    // const ayer = new Date(ahora.getTime() - 1440 * 60 * 1000);
    const ayer = new Date(ahora.getTime() - Math.random() * 1440 * 60 * 1000);

    const inicio = Date.now();

    await db
      .select()
      .from(metricsTable)
      .where(and(eq(metricsTable.agentId, agent.id), gte(metricsTable.createdAt, ayer)));

    const fin = Date.now();
    tiempos.push(fin - inicio);
  }

  tiempos.sort((a, b) => a - b);

  console.log(`P50: ${tiempos[49]}ms`);
  console.log(`P99: ${tiempos[98]}ms`);

  // exit program
  process.exit(0);
}

benchmark();
