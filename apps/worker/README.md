# `apps/worker/`

Worker de background jobs basado en [BullMQ](https://docs.bullmq.io/) sobre Redis. Escucha la cola `metrics-ingest`, acumula jobs en un buffer en memoria y hace INSERT bulk a Postgres cada 5s o cada 500 jobs.

## Por qué existe como app separada

La API (`apps/api/`) sirve HTTP con Fastify y debe responder rápido. Cualquier trabajo pesado (procesamiento de métricas en batch, notificaciones, agregaciones, retries, jobs programados) bloquea el event loop si corre en el mismo proceso.

Separar el worker te permite:

- Escalar horizontalmente independiente de la API (más workers cuando hay backlog, sin tocar la API).
- Tener reintentos, rate limiting y delayed jobs gratis vía BullMQ.
- Caer la API sin perder trabajo en cola (los jobs sobreviven en Redis).
- Correr jobs cron/scheduled sin necesitar un servicio aparte.

## Qué hay ahora

`src/index.ts` orquesta el worker e importa la lógica de procesamiento desde `src/processors/metrics-ingest.ts`.

`src/processors/metrics-ingest.ts` monta el `Worker` de BullMQ que escucha la cola `metrics-ingest` con concurrencia 1 (buffer compartido seguro). Los jobs se acumulan en un buffer en memoria y se insertan en bulk a Postgres cada 5s o cuando el buffer llega a 500 items:

```ts
export const worker = new Worker(
  metricsIngestQueue.name,
  async (job) => {
    const data = metricsIngestQueue.parse(job.data);
    buffer.push(data);
    if (buffer.length >= 500) await flush();
  },
  { connection, concurrency: 1 },
);
```

El worker ya está integrado al flujo de `task dev` — levanta junto con el resto y se conecta a Redis usando `REDIS_URL` del `.env` raíz. Si Redis está arriba, el worker queda esperando jobs.

## Inspección de colas (Bull Board)

En modo desarrollo, la API expone una UI para inspeccionar las colas y sus jobs en:

```
http://localhost:3001/admin/queues
```

Permite ver los jobs activos, en espera, completados y fallados de cada cola.

**Solo disponible en desarrollo** — en producción el endpoint devuelve 404 porque puede exponer información sensible sobre los jobs.

### ⚠️ Limitación conocida del buffer

El worker acumula jobs en memoria antes de insertarlos en Postgres. Si el worker crashea antes del flush, los jobs del buffer se pierden — aunque Redis ya los marcó como procesados. Es una decisión de diseño aceptada para este milestone.

## Cómo agregar una nueva cola

1. Agregar el contrato en `packages/shared-types/src/queues.ts`:

```ts
export const QUEUES = {
  METRICS_INGEST: { ... },
  NUEVA_COLA: {
    name: "nueva-cola",
    jobName: "nuevo-job",
    dlq: "nueva-cola-dlq",
  },
} as const;
```

2. Crear `src/processors/nueva-cola.ts` con su propio buffer y worker.

3. Importar el worker en `src/index.ts`.

## Comandos

```bash
pnpm --filter @watchdog/worker dev     # standalone con hot-reload
task dev:worker                         # idem vía Taskfile (levanta Redis si hace falta)
pnpm --filter @watchdog/worker build
```

## Qué NO poner acá

- HTTP endpoints → `apps/api/`.
- Lógica de schema de DB → `packages/db/`.
- Tipos de payloads de jobs → `packages/shared-types/` (para compartir con el productor).

## Troubleshooting

**Worker no se conecta a Redis** → verificá `REDIS_URL` en `.env` y que el container esté arriba (`docker compose ps`).

**Jobs no se procesan** → revisá que el productor esté publicando al mismo nombre de cola que el Worker escucha. Los nombres de cola están tipados en `packages/shared-types/src/queues.ts`.

**Jobs quedan "stuck"** → BullMQ tiene lock timeout. Si un worker crashea mid-job, el job se libera tras el timeout (default 30s) y otro worker lo agarra.
