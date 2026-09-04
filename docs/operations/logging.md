# Structured logging

Los tres servicios de backend (`apps/api`, `apps/worker`, `apps/agent`) loguean en **JSON**, con un set de campos consistente entre todos. El objetivo es poder buscar/filtrar logs en producción (donde no hay una terminal humana mirando en vivo) y poder reconstruir el recorrido completo de un request puntual a través de los tres servicios.

---

## Formato común

Todo log line trae, como mínimo:

| Campo | Significado |
|---|---|
| `level` (api/worker) / `level` (agent) | Severidad: `debug`, `info`, `warn`, `error` |
| `time` | Timestamp |
| `service` | `"api"`, `"worker"` o `"agent"` — de qué proceso vino la línea |
| `correlation_id` | Presente en los logs relacionados a una conexión de un agente puntual (ver más abajo). Ausente en logs que no están atados a ningún request (arranque del proceso, shutdown, etc.) |
| `msg` | Mensaje corto y fijo, sin datos interpolados adentro del texto |

Los datos variables (ids, tamaños, urls, errores) van como **campos separados** del JSON, nunca metidos dentro del string de `msg` — así se pueden filtrar/buscar sin parsear texto libre.

### Niveles: cuándo usar cada uno

- **`debug`** — ruido interno, útil solo en desarrollo (ej: "ticker fired"). No se muestra en producción.
- **`info`** — eventos normales y esperables ("agent started", "job received"). El nivel mínimo en producción.
- **`warn`** — algo raro pasó pero el sistema se recuperó solo (ej: timeout de un collector, reconexión).
- **`error`** — algo falló de verdad (ej: el worker no pudo insertar en la DB, un collector devolvió un error real).

---

## Por servicio

### `apps/api` (Fastify + pino)

Fastify ya trae pino integrado (`Fastify({ logger: {...} })` en `src/server.ts`). La config:

```ts
logger: {
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
      : undefined,
  base: { service: "api" },
},
genReqId: () => randomUUID(),
requestIdLogLabel: "correlation_id",
```

- En **dev**, `pino-pretty` da salida coloreada y legible en la terminal.
- En **producción**, sin `transport`, la salida es JSON puro (una línea por log).
- `genReqId` genera un `correlation_id` (UUID) una vez por conexión entrante — Fastify lo usa internamente como su `reqId`, y `requestIdLogLabel` lo renombra a `correlation_id` en los logs.
- Cualquier log hecho con `request.log.info(...)` dentro de un handler incluye automáticamente el `correlation_id` de esa request.

### `apps/worker` (pino, sin Fastify)

El worker no usa Fastify, así que arma su propia instancia de pino en `src/logger.ts`:

```ts
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: { service: "worker" },
});
```

Siempre en JSON (no tiene pretty-print para dev, a diferencia de la api). El `correlation_id` de cada job se loguea al recibirlo en `src/processors/metrics-ingest.ts`, leyéndolo de `job.data.correlationId`.

### `apps/agent` (Go, `log/slog`)

En `cmd/agent/main.go`, un handler JSON se configura como logger por defecto del proceso:

```go
level := slog.LevelInfo
if cfg.Environment != "production" {
    level = slog.LevelDebug
}
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})).With("service", "agent")
slog.SetDefault(logger)
```

`AGENT_ENV` (default `"development"`) controla el nivel mínimo, igual que `NODE_ENV` en los servicios de Node — en dev se ven los `debug`, en producción no. Siempre en JSON, no tiene pretty-print (el ticket no lo pidió para Go).

---

## Cómo viaja el `correlation_id`

El agente abre **una sola conexión POST** a `/metrics/stream` que queda viva mientras el agente corre, mandando líneas de métricas por ella. El `correlation_id` se genera **una vez por conexión**, no una vez por línea.

```
agente ──POST /metrics/stream──▶ api
                                  │
                                  │ 1. api genera correlation_id (genReqId, al llegar la conexión)
                                  │ 2. cada línea que llega arma un job con correlationId en job.data
                                  │    → metricsQueue.add(..., { ..., correlationId: request.id })
                                  │ 3. worker toma el job y loguea el mismo correlationId
                                  │
                                  │ 4. antes de que CUALQUIER respuesta salga (200, 400, 401, 503...),
                                  │    un hook onSend le pega el header x-correlation-id
                                  ▼
agente ◀── respuesta + header ─── api
    (el agente lee resp.Header.Get("X-Correlation-Id") y lo loguea)
```

Puntos importantes:

- El id nace **siempre** en la api — el agente nunca genera ni manda uno.
- Va al worker **por dentro del job** (`packages/shared-types/src/queue.ts`, campo `correlationId` en `MetricsIngestPayloadSchema`).
- Vuelve al agente **por un header HTTP**, agregado en `apps/api/src/server.ts`:

  ```ts
  fastify.addHook("onSend", async (request, reply) => {
    reply.header("x-correlation-id", request.id);
  });
  ```

  Este hook corre automáticamente para **toda** respuesta de la api, sea éxito o error — así el header llega tanto si el stream se cierra bien como si la api corta la conexión por un 401/503/400.

---

## Ejemplo real, mismo `correlation_id` en los tres servicios

**api** — al llegar la conexión:
```json
{"level":30,"time":..., "service":"api","correlation_id":"8010ab06-1c1d-429a-bcba-d740bd4def5b","msg":"incoming request", ...}
```

**worker** — al procesar cada job de esa conexión:
```json
{"level":30,"time":..., "service":"worker","correlation_id":"8010ab06-1c1d-429a-bcba-d740bd4def5b","agentId":"c7cc79fe-a543-4b2b-a354-1b9402489820","msg":"job received"}
```

**agent** — al recibir una respuesta de la api (error o cierre del stream):
```json
{"time":"...","level":"INFO","msg":"received response from server","service":"agent","correlation_id":"5db544b2-044a-4612-af31-3a46482d0d0f","status":401}
```

Buscando ese id en los tres logs (por ejemplo con `grep` en dev, o el buscador del sistema de logs en producción) se reconstruye el recorrido completo de esa conexión puntual, sin mezclarse con las de otros agentes.

---

## Ver los logs

- **Dev**: `pnpm dev` (turbo levanta los 4 servicios). La api sale con `pino-pretty` (coloreado); worker y agent salen en JSON crudo por línea.
- **Prod**: todos los servicios salen en JSON puro por línea (`stdout`), listo para que lo levante cualquier colector de logs (Docker, Kubernetes, un agregador tipo Loki/CloudWatch/etc.) sin transformación.
