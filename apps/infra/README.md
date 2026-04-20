# `apps/infra/`

Pseudo-apps que **no corren código propio**: cada subcarpeta envuelve un `docker compose logs -f <servicio>` y existe solo para que Turbo lo muestre como un pane separado en el TUI de `task dev`.

## Por qué existen

Los containers (Postgres, replica, Redis) viven en `docker-compose.yml` en la raíz y se levantan en modo detached (`docker compose up -d`) por el target `docker:up` del Taskfile. En detached no ves sus logs.

Turbo agrupa output por `<workspace>#<task>` — un pane por workspace. Para tener logs **separados por servicio** dentro del mismo TUI (y no mezclados ni en una terminal aparte), cada servicio necesita su propio workspace. Eso es todo lo que hace cada carpeta acá:

```
apps/infra/
├── postgres-db/          → tail de logs del primary
├── postgres-db-replica/  → tail de logs de la replica
└── redis/                → tail de logs de Redis
```

Cada `package.json` solo tiene un script `dev` que hace `cd` a la raíz del monorepo y corre `docker compose logs -f <servicio>`.

## Qué NO va acá

- Código de aplicación (usar `apps/api`, `apps/worker`, etc.)
- Configuración de los containers — eso vive en `docker-compose.yml` en la raíz
- Scripts de migración o seed — esos van en `packages/db` o `scripts/`

## Cómo agregar un servicio nuevo

1. Agregalo a `docker-compose.yml` en la raíz.
2. Creá `apps/infra/<nombre>/package.json` copiando cualquiera de los existentes y cambiando:
   - `name` → `@watchdog/infra-<nombre>`
   - el argumento final de `docker compose logs -f` al nombre del servicio en compose
3. `pnpm install` y ya lo levanta `task dev`.

## Excluir de `dev` temporalmente

```bash
pnpm turbo run dev --filter='!@watchdog/infra-*'
```
