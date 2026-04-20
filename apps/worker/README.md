# `apps/worker/`

Worker de background jobs basado en [BullMQ](https://docs.bullmq.io/) sobre Redis. **Hoy está scaffoldeado pero no conectado** — no hay productores enviándole jobs todavía.

## Por qué existe como app separada

La API (`apps/api/`) sirve HTTP con Fastify y debe responder rápido. Cualquier trabajo pesado (procesamiento de métricas en batch, notificaciones, agregaciones, retries, jobs programados) bloquea el event loop si corre en el mismo proceso.

Separar el worker te permite:
- Escalar horizontalmente independiente de la API (más workers cuando hay backlog, sin tocar la API).
- Tener reintentos, rate limiting y delayed jobs gratis vía BullMQ.
- Caer la API sin perder trabajo en cola (los jobs sobreviven en Redis).
- Correr jobs cron/scheduled sin necesitar un servicio aparte.

## Qué hay ahora

`src/index.ts` monta un `Worker` de BullMQ que escucha la cola `"default"` con concurrencia 4 y simplemente logea los jobs que recibe. Es un stub — ningún código del monorepo publica jobs todavía.

```ts
const worker = new Worker("default", async (job) => {
  console.log(`[worker] processing ${job.name}#${job.id}`, job.data);
  return { ok: true };
}, { connection, concurrency: 4 });
```

El worker ya está integrado al flujo de `task dev` — levanta junto con el resto y se conecta a Redis usando `REDIS_URL` del `.env` raíz. Si Redis está arriba, el worker queda esperando jobs.

## Cómo se va a usar (cuando toque conectarlo)

**Publicar un job desde la API (o cualquier otro lugar):**
```ts
// Lógica en la api de escritura (lee http, publica en la queue)
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "@watchdog/env";

const queue = new Queue("metrics-aggregation", {
  connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }),
});

await queue.add("aggregate-hour", { serverName, bucketStart });
```

**Consumir desde el worker:** agregar un nuevo `Worker` en `src/index.ts` (o split en `src/processors/<name>.ts` cuando haya varios) apuntando al mismo nombre de cola:

```ts
// Donde quieras poner el codigo para leer de la cola y publicar en BD
new Worker("metrics-aggregation", async (job) => {
  if (job.name === "aggregate-hour") {
    // ...
  }
}, { connection, concurrency: 2 });
```

**Nombres de cola compartidos:** mover los nombres a `packages/shared-types` para evitar typos entre productor y consumidor. Investigar si se puede hacer algo para evitar usar todo el boilerplate de new Queue, poniendo un texto y crear helpers que tengan todo el código.

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

**Jobs no se procesan** → revisá que el productor esté publicando al **mismo nombre de cola** que el Worker escucha. Los strings no son tipados.

**Jobs quedan "stuck"** → BullMQ tiene lock timeout. Si un worker crashea mid-job, el job se libera tras el timeout (default 30s) y otro worker lo agarra.
