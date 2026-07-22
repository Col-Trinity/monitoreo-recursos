# Auth Decision — DAZ-41

## Contexto

El proyecto usa Next.js 15, React 19, Drizzle ORM con PostgreSQL/TimescaleDB, y tiene un sistema de auth propio scaffoldeado (`apps/web/src/server/auth/`) basado en `next-auth@5.0.0-beta.25` con `@auth/drizzle-adapter@^1.11.2`.

El objetivo de esta decisión es confirmar si NextAuth v5 (ya scaffoldeado) es la mejor opción frente a Auth.js custom, Lucia, Clerk y Supabase Auth.

---

## Tabla comparativa

| Criterio                  | NextAuth v4                                                   | **NextAuth v5 (beta)**                                        | Lucia                                                               | Clerk                                                        | Supabase Auth                                            |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| Self-hosted               | ✅ BYOD                                                       | ✅ BYOD                                                       | ✅ BYOD                                                             | ❌ SaaS (servidores de Clerk)                                | ⚠️ SaaS por defecto, self-host disponible pero complejo  |
| Compatibilidad Next.js 15 | ⚠️ Problemas reportados con React 19 / App Router             | ✅ Compatible (diseñado para App Router y Next.js 15)         | ⚠️ Sin soporte oficial (deprecada)                                  | ✅ Compatible                                                | ✅ Compatible                                            |
| Integraciones             | ⚠️ Solo Next.js                                               | ✅ Next.js, SvelteKit, Express, Fastify (via `@auth/core`)    | ✅ Next.js, SvelteKit                                               | ✅ Next.js, React, Express y más                             | ✅ Next.js, SvelteKit, Remix y más                       |
| OAuth providers           | ✅ Google, GitHub, 50+ providers                              | ✅ Google, GitHub, 80+ providers                              | ⚠️ Requiere Arctic para OAuth                                       | ✅ Google, GitHub y más                                      | ✅ Google, GitHub y más                                  |
| Email/Password            | ✅ Credentials provider                                       | ✅ Credentials provider                                       | ✅ Manejo manual (más control, más código)                          | ✅ Incluido                                                  | ✅ Incluido                                              |
| Adapter Drizzle           | ✅ `@auth/drizzle-adapter`                                    | ✅ `@auth/drizzle-adapter` (mismo paquete)                    | ❌ No tiene adapter oficial                                         | ❌ No aplica (no usa tu DB)                                  | ❌ No aplica (usa su propia DB)                          |
| Propiedad de los datos    | ✅ Tu DB                                                      | ✅ Tu DB                                                      | ✅ Tu DB                                                            | ❌ Datos en servidores de Clerk                              | ⚠️ Datos en Supabase (o self-hosted)                     |
| Estado del proyecto       | ⚠️ Modo mantenimiento (sin features nuevas)                   | ✅ Beta activo, releases frecuentes                           | ❌ **Deprecada oficialmente por su creador**                        | ✅ Empresa financiada, activo                                | ✅ Activo                                                |
| Comunidad / soporte       | ✅ 28k+ stars, docs maduras                                   | ✅ Mismo repo (28k+ stars), docs en actualización             | ⚠️ 10.5k stars, sin mantenimiento futuro                            | ✅ Docs extensas, soporte comercial                          | ✅ 75k+ stars (repo principal)                           |
| Costo                     | ✅ $0, open source                                            | ✅ $0, open source                                            | ✅ $0, open source                                                  | ⚠️ Gratis hasta 10k MAU, luego $0.02/usuario/mes             | ⚠️ Gratis hasta 50k MAU, luego $0.00325/usuario/mes      |
| Costo de migración        | ⚠️ 3 tablas nuevas + renombrar campos en `users` y `sessions` | ⚠️ 3 tablas nuevas + renombrar campos en `users` y `sessions` | ⚠️ Requiere reescribir lógica de auth + migración futura inevitable | ⚠️ Datos quedan atados a Clerk, migración futura muy costosa | ⚠️ Schema separado, datos en infraestructura de Supabase |

---

## Análisis de opciones descartadas

**NextAuth v4** — incompatible con React 19 y el App Router de Next.js 15. Está en modo mantenimiento sin nuevas features. Descartar.

**Lucia** — deprecada oficialmente por su propio autor. Requeriría una segunda migración en el corto plazo. Descartar.

**Clerk** — excelente DX pero SaaS puro: los datos de usuarios viven en sus servidores. Para un sistema de monitoreo de recursos con modelo multi-tenant propio (workspaces/memberships), ceder el control de usuarios a un tercero es un riesgo innecesario y genera lock-in. El costo escala con usuarios. Descartar.

**Supabase Auth** — similar a Clerk en lo que respecta a datos: los usuarios quedarían en la DB de Supabase, separados del schema de `workspaces`/`memberships`/`agents`. Requeriría mantener dos fuentes de verdad sincronizadas. Descartar.

---

## Decisión final: NextAuth v5 (beta)

**Usar `next-auth@5.0.0-beta.25` con `@auth/drizzle-adapter@^1.11.2` — ya scaffoldeado en el proyecto.**

### Fundamento

1. **Ya está integrado** — `apps/web/src/server/auth/` tiene el setup base con `DrizzleAdapter(db)` y el handler de Next.js. El costo de cambio es $0.
2. **Compatible con el stack** — es la única opción open source con soporte oficial para Next.js 15 + React 19 + App Router + Drizzle.
3. **Control total de los datos** — los usuarios viven en nuestra PostgreSQL, junto con `workspaces`, `memberships` y `agents`. No hay fuente de verdad externa.
4. **$0 y sin lock-in** — open source, sin costo por usuario, sin dependencia de un servicio externo.
5. **Extensible** — el campo `passwordHash` en `users` convive con OAuth: se usa el Credentials provider para email/password y se agregan providers de OAuth sin colisión.

### Por qué v5 y no v4

|                                        | v4                     | v5                                    |
| -------------------------------------- | ---------------------- | ------------------------------------- |
| React 19                               | ⚠️ Problemas conocidos | ✅                                    |
| Next.js 15 App Router                  | ⚠️ Problemas conocidos | ✅                                    |
| `next/headers` async API               | ❌ No compatible       | ✅                                    |
| Soporte multi-framework (`@auth/core`) | ❌ Solo Next.js        | ✅ (útil si `apps/api` necesita auth) |
| Estado                                 | Mantenimiento          | Beta activo                           |

v4 tiene incompatibilidades documentadas con el stack actual. v5 fue diseñada para él.

### Riesgo del "beta"

`next-auth@5` lleva más de un año en beta con releases continuos y es ampliamente usado en producción. El API de configuración (`NextAuthConfig`, `DrizzleAdapter`, callbacks) es estable. El riesgo principal es un posible breaking change antes del release estable, mitigable con una versión pinned y un intervalo de actualización controlado.

---

## Cambios de schema necesarios para completar la integración

El `DrizzleAdapter` requiere que el schema exponga las tablas con los nombres y campos exactos que Auth.js espera. El schema actual necesita:

### Tabla `users` — ajustes en `packages/db/src/schema/auth.ts`

| Cambio                                                  | Detalle                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Renombrar columna `email_verified_at` → `emailVerified` | Auth.js busca la columna `emailVerified` (camelCase mapeado a snake en Drizzle) |
| Agregar campo `image` (`varchar`)                       | Requerido por el tipo `AdapterUser`                                             |

Los campos extra (`passwordHash`, `language`, `createdAt`, etc.) se conservan — Auth.js ignora columnas adicionales.

### Tabla `sessions` — reestructurar para database strategy

El proyecto requiere poder invalidar sesiones del lado del servidor (ej. cuando un admin remueve a un usuario de un workspace, el acceso se pierde de inmediato). Por eso se usa **database strategy**.

El `DrizzleAdapter` espera que la sesión se identifique por `sessionToken` (string único como PK). La tabla actual usa `id` (uuid) como PK y `tokenHash`. Hay que reestructurarla:

- Reemplazar `id` uuid + `tokenHash` por `sessionToken` varchar como PK
- Renombrar `expiresAt` → `expires`
- Los campos extra (`createdAt`, `lastUsedAt`) se pueden conservar

### Tablas nuevas requeridas

| Tabla                | Cuándo es necesaria                            |
| -------------------- | ---------------------------------------------- |
| `accounts`           | Si se agregan providers OAuth (Google, GitHub) |
| `verificationTokens` | Si se usa magic link / email verification      |
| `authenticators`     | Solo si se implementa WebAuthn/passkeys        |
