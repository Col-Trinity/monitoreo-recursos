# Watchdog — Monitoreo de Recursos

Monorepo con agente Go, API Fastify, worker BullMQ y frontend Next.js.

## Stack

- **Orquestación:** pnpm workspaces + Turborepo + Taskfile + `go.work`
- **Runtime:** Node 20+, Go 1.26+, PostgreSQL 16 (primary + replica), Redis 7
- **Apps:** `agent` (Go), `api` (Fastify), `worker` (BullMQ), `web` (Next.js 15)
- **Packages compartidos:** `db` (Drizzle), `env` (zod), `shared-types`, `tsconfig`

## Requisitos

- Docker + Docker Compose
- Node.js 20+, pnpm 10+
- Go 1.26+
- [Taskfile](https://taskfile.dev/installation/) (`brew install go-task`)

## Setup (una vez)

```bash
cp .env.example .env
task setup
```

Esto instala dependencias (pnpm + `air` para hot-reload de Go), levanta Postgres + replica + Redis, y corre migraciones.

## Desarrollo diario

```bash
task dev          # levanta TODO: docker + api + worker + web + agent, con hot-reload
```

Parciales (si necesitás debug aislado):

```bash
task dev:ts       # solo api + worker + web (sin Go)
task dev:api
task dev:web
task dev:worker
task dev:agent
```

Turbo agrupa los logs con prefijo por app (TUI interactiva). `Ctrl+C` baja todo y detiene los containers.

## Base de datos

```bash
task db:generate   # genera nueva migración desde packages/db/src/schema
task db:migrate    # aplica migraciones pendientes
task db:studio     # abre Drizzle Studio
task db:reset      # DROP + recrea + re-migra (destructivo, pide confirmación)
```

El schema vive en `packages/db/src/schema/` y es **la única fuente de verdad**; api y web lo consumen vía `@watchdog/db`.

## Tests

```bash
task test                    # todos
pnpm turbo run test:unit
pnpm turbo run test:integration
pnpm turbo run test:e2e
```

## Layout

```
watchdog/
├── apps/
│   ├── agent/       Go — recolector de métricas (cmd/, internal/)
│   ├── api/         Fastify — HTTP + SSE
│   ├── worker/      BullMQ — background jobs
│   └── web/         Next.js — UI + tRPC
├── packages/
│   ├── db/          Drizzle schema + read/write clients
│   ├── env/         parser de env (zod)
│   ├── shared-types/  contratos compartidos api ↔ web ↔ worker
│   └── tsconfig/    tsconfig base (node, nextjs)
├── scripts/
├── go.work
├── pnpm-workspace.yaml
├── turbo.json
├── Taskfile.yml
├── docker-compose.yml
└── .env.example
```

## Ports locales

| Servicio | Puerto |
|---|---|
| web (Next.js) | 3000 |
| api (Fastify) | 3001 |
| postgres primary | 5433 |
| postgres replica | 5434 |
| redis | 6379 |

## Read/write split

```ts
import { dbWrite, dbRead } from "@watchdog/db";

await dbWrite().insert(metricsTable).values(...);
const rows = await dbRead().select().from(metricsTable);
```

Usá `dbWrite()` para mutaciones y `dbRead()` para queries de solo lectura (pega a la replica cuando `DATABASE_READ_URL` está seteada).

## Troubleshooting

**"air: command not found"** → `task tools:install` o `go install github.com/air-verse/air@latest`.

**Postgres no arranca** → `task docker:nuke && task setup`.

**Puertos ocupados** → editar mapeos en `docker-compose.yml` y `.env`.
