# Health endpoints

Los cuatro servicios (`apps/web`, `apps/api`, `apps/worker`, `apps/agent`) exponen tres endpoints de salud, cada uno pensado para un consumidor distinto:

- **`/live`** — "¿el proceso está vivo?". Siempre devuelve `200` si el proceso puede responder HTTP, sin chequear dependencias externas. Lo usa el orquestador (Kubernetes/Docker) como *liveness probe* para decidir si reiniciar el proceso. Reiniciar no arregla una DB caída, por eso `/live` no depende de eso.
- **`/ready`** — "¿puede recibir tráfico/trabajo?". Chequea las dependencias críticas (DB, Redis, o la conexión al servidor según el servicio) y devuelve `503` si alguna falla. Lo usa el orquestador como *readiness probe*, sin reiniciar el proceso — solo deja de enviarle tráfico hasta que vuelva a dar `200`.
- **`/health`** — igual que `/ready` pero con detalle de diagnóstico (latencias, contadores, profundidad de cola). Pensado para dashboards y debugging humano, no para decisiones automáticas.

---

## `apps/web` (Next.js)

Puerto: `3000` (default de `next dev`/`next start`).

| Endpoint | Archivo | Chequea | Éxito | Falla |
|---|---|---|---|---|
| `/api/live` | `apps/web/src/app/api/live/route.ts` | nada | `200 { status: "ok" }` | — |
| `/api/ready` | `apps/web/src/app/api/ready/route.ts` | Postgres primario (`dbW`) y réplica (`db`) en paralelo | `200 { status: "ok" }` | `503 { status: "error" }` |
| `/api/health` | `apps/web/src/app/api/health/route.ts` | Postgres (réplica) + Fastify de `apps/api` vía `GET ${API_URL}/health` | `200 { status: "ok", database: { latencyMs } }` | `503 { status: "error", error }` |

Notas:
- `API_URL` (en `@watchdog/env`) es la URL server-to-server hacia `apps/api` (default `http://localhost:3001`), distinta de `NEXT_PUBLIC_API_URL` que usa el browser.
- El `db` exportado de `apps/web/src/server/db.ts` apunta a la réplica (`dbRead()`). `/api/ready` es el único de los tres que chequea el primario (`dbW`) explícitamente, en paralelo con la réplica.

---

## `apps/api` (Fastify)

Puerto: `API_PORT` (default `3001`). Plugin: `apps/api/src/routes/health.ts`, registrado en `server.ts`.

| Endpoint | Chequea | Éxito | Falla |
|---|---|---|---|
| `/live` | nada | `200 { status: "ok" }` | — |
| `/ready` | Postgres (`dbWrite`) + Redis (`ping`) | `200 { status: "ok" }` | `503 { status: "error" }` |
| `/health` | igual que `/ready` + profundidad de la cola `metrics-ingest` (`getWaitingCount`) | `200 { status: "ok", database: { latencyMs }, redis: { status: "ok" }, queue: { depth } }` | `503 { status: "error" }` |

---

## `apps/worker` (BullMQ, servidor HTTP nativo)

Puerto: `3002` (hardcodeado en `apps/worker/src/index.ts`). Lógica en `apps/worker/src/health.ts` (`handleHealthRequest`), sin Fastify — rutea a mano por `req.url`.

| Endpoint | Chequea | Éxito | Falla |
|---|---|---|---|
| `/live` | nada | `200 { status: "ok" }` | — |
| `/ready` | Postgres (`dbWrite`) + Redis (`ping`) | `200 { status: "ok" }` | `503 { status: "error" }` |
| `/health` | igual que `/ready` + profundidad de la cola (`metricsQueue.getWaitingCount`) | `200 { status: "ok", database: { latencyMs }, redis: { status: "ok" }, queue: { depth } }` | `503 { status: "error" }` |

Los checks de `/ready` y `/health` están envueltos con un timeout de 2s (`withTimeout` en `health.ts`). Es necesario porque la conexión de Redis del worker se crea con `maxRetriesPerRequest: null` (reintenta indefinidamente en vez de tirar error) — sin el timeout, un `ping()` durante una reconexión dejaría la respuesta HTTP colgada en vez de devolver `503` rápido.

---

## `apps/agent` (Go)

Puerto: `AGENT_HEALTH_PORT` (default `3003`). Lógica en `apps/agent/cmd/agent/health.go`, usando un `http.NewServeMux()` explícito.

El agent no tiene DB ni Redis propios — su única dependencia es la conexión SSE persistente hacia `apps/api` (`internal/transport/sse_client.go`). El estado de esa conexión se expone vía `SSEClient.IsConnected()` (un `atomic.Bool`, en `true` mientras el loop de lectura está activo).

| Endpoint | Chequea | Éxito | Falla |
|---|---|---|---|
| `/live` | nada | `200 { status: "ok" }` | — |
| `/ready` | `sse.IsConnected()` | `200 { status: "ok" }` | `503 { status: "error" }` |
| `/health` | igual que `/ready` | `200 { status: "ok", sse_reconnects_total, buffer_size }` | `503 { status: "error" }` |

---

## Cómo probar caída de dependencias localmente

- **Postgres/Redis** (afecta `apps/web`, `apps/api`, `apps/worker`): `docker compose stop postgres redis`. El primario de Postgres corre en el puerto `5433`; si existe un contenedor de réplica (`postgres-replica`, puerto `5434`) es independiente y hay que pararlo aparte para simular caída total.
- **Conexión del agent** (afecta `apps/agent`): requiere una API key de agente inválida, o parar `apps/api`. Para probar el camino "conectado" hace falta un agente sembrado en la DB — correr `packages/db/src/seed.ts`, que crea uno con la key `dev-api-key-12345` (coincide con el default de `AGENT_API_KEY` si no se lo pisa).
