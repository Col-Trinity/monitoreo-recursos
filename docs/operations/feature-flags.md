# Feature flags con Unleash

## Qué problema resuelven

Al desplegar código nuevo siempre hay riesgo de que algo se rompa en producción. Por eso usamos pull request + CI + revisión de otros devs: esas capas atrapan la mayoría de los problemas, pero no todos — hay fallas que solo aparecen con tráfico real de usuarios en producción.

Cuando eso pasa, la solución "natural" es revertir el código y volver a desplegar, lo cual puede tardar minutos u horas. Mientras tanto, la app sigue rota.

Los feature flags (banderas de funcionalidad) separan dos momentos que solemos pensar como uno solo: **desplegar código** y **activar la funcionalidad**.

En el fondo, un feature flag es un `if` cuya condición no está escrita en el código, sino que se resuelve consultando un sistema externo en tiempo de ejecución. Por ejemplo, para una funcionalidad "nuevo checkout":

```
si "nuevo-checkout" está activado (pregunta al sistema externo):
    mostrar checkout nuevo
si no:
    mostrar checkout viejo
```

Los dos caminos —el viejo y el nuevo— ya están desplegados al mismo tiempo. Si el camino nuevo falla en producción, se puede volver al viejo cambiando el valor del flag en el sistema externo, sin necesidad de un nuevo deploy.

Esto habilita varias capacidades:

- **Revertir sin deploy**: si algo falla, se apaga el flag en vez de revertir y redesplegar código.
- **Kill switch**: apagado de emergencia — si la funcionalidad falla, se apaga en segundos.
- **Lanzamiento gradual (gradual rollout)**: activar la funcionalidad primero para un 5% del tráfico, después un 25%, y así sucesivamente, mientras se observa que no aparezcan errores.
- **Segmentación**: activarla solo para un subconjunto (ej. el equipo interno, o un país puntual) antes de habilitarla para todos los usuarios.

## Qué es Unleash

Se podrían implementar feature flags "a mano" con variables de entorno, y de hecho es una forma válida de empezar. El problema aparece cuando hay decenas de flags a la vez, algunos con reglas más finas que un simple on/off — por ejemplo "activado para el 10% de Argentina" —, todos gestionados desde archivos `.env` repartidos entre servicios: se vuelve inmanejable rápido.

Unleash es el sistema que centraliza la gestión de todos esos flags en un solo lugar. Tiene dos piezas:

- **Panel web**: donde se crean, activan, desactivan y configuran los flags (con sus estrategias de activación) sin tocar código ni hacer un deploy.
- **SDKs** (Node, Go, y otros lenguajes): la librería que se integra dentro de cada servicio y expone algo como `isEnabled("nuevo-checkout")`, que en tiempo de ejecución le pregunta a Unleash si ese flag está activo (para ese usuario/request en particular, según la estrategia configurada).

En este repo eso encaja directo con la arquitectura: `apps/web`, `apps/api` y `apps/worker` son Node, y `apps/agent` es Go — Unleash tiene SDK oficial para ambos, así que un mismo flag creado en el panel se puede consultar tanto desde el backend en Node como desde el agente en Go.

## Alternativas

- **LaunchDarkly**: el más establecido del mercado, con targeting muy granular y buen soporte de experimentación. Es SaaS puro — no tiene opción self-hosted —, y a nuestra escala (proyecto chico, sin presupuesto de feature flags) el pricing (por seats/MAU) no se justifica.
- **PostHog**: suite de product analytics (eventos, session replay, funnels) que incluye feature flags y A/B testing como una feature más, no como el producto central. Tiene versión self-hosted open source además de la cloud. Tiene sentido si ya se usa PostHog para analytics y se quiere todo en un solo lugar; para nosotros sería adoptar una herramienta grande solo por una parte chica de lo que ofrece.
- **GrowthBook**: open source, enfocado en experimentación (A/B testing) más que en feature flags puros — calcula resultados estadísticos conectándose directo a tu propio data warehouse en vez de tener el suyo. Self-hostable.

Unleash, en cambio, es open source y self-hosted por diseño, se enfoca específicamente en feature flags (no viene con analytics ni experimentation platform completa atados), y encaja con lo que necesitamos: activar/desactivar funcionalidad sin depender de un servicio de terceros ni pagar por MAU.

## Por qué self-hosted

- **Costo**: es un proyecto chico sin presupuesto para una herramienta de terceros que cobra por MAU o por seats. Unleash open source corre gratis, con el único costo siendo el cómputo que ya tenemos.
- **Consistencia con la infraestructura existente**: en `docker-compose.yml` ya corremos Postgres y Redis nosotros mismos — no usamos ninguna base de datos ni cola manejada por un tercero. Unleash como un contenedor más sigue exactamente ese mismo patrón, en vez de ser la única pieza del stack que depende de un servicio externo.
- **Los datos no salen de nuestra infraestructura**: qué flags existen, quién los puede ver y con qué reglas queda en nuestra propia base de datos, no en la de un proveedor externo.

La contra, que hay que tener presente: nosotros somos responsables de que Unleash esté levantado, de actualizarlo, y de hacerle backup a su base — con una SaaS eso lo resuelve el proveedor. Para el tamaño actual del proyecto (un contenedor más en `docker-compose.yml`) el trade-off se justifica.

## Conceptos

- **Strategies (estrategias de activación)**: definen *para quién* está activo un flag. Son las que implementan lo que ya describimos más arriba — "lanzamiento gradual" y "segmentación" no son ideas aparte, son ejemplos de strategies concretas:
  - `standard` — on/off para todos, sin condición.
  - `gradualRollout` (o `flexibleRollout`) — activo para un % del tráfico (el 5%, después el 25%, etc.).
  - `userWithId` — activo solo para una lista puntual de IDs de usuario (útil para el equipo interno).
  - Se pueden combinar varias strategies en el mismo flag (ej. activo para el equipo interno *y también* para un 10% random del resto).

- **Constraints (restricciones)**: se agregan *dentro* de una strategy para acotar más el "para quién", filtrando por atributos del contexto que le pasás a Unleash en cada consulta (país, email, plan del usuario, etc.). Por ejemplo: `gradualRollout` al 50% + constraint `country = AR` → activo para la mitad del tráfico, pero solo el que es de Argentina. No son un mecanismo separado, son el "AND" que le agregás a una strategy.

- **Variants**: cuando el flag no es un simple on/off sino que, estando activo, tiene más de un "sabor" para mostrar. Es la base de un A/B test: variante A para la mitad del tráfico que tiene el flag activo, variante B para la otra mitad, cada una con su propia config (ej. texto de un botón), y después se comparan métricas entre las dos. El SDK, en vez de devolver solo `true`/`false`, devuelve también qué variante le tocó a ese usuario.

## Cómo consultar un flag

| Dónde | Función | Archivo |
| --- | --- | --- |
| Client Components (`apps/web`) | `useFlag(name)`, `useVariant(name)` | `@unleash/proxy-client-react` |
| Server Components / tRPC (`apps/web`) | `isFlagEnabled(name)`, `getVariant(name)` | `apps/web/src/server/unleash.ts` |
| `apps/api` y `apps/worker` | `isEnabled(name, ctx)` | `packages/feature-flags` |

Si Unleash no está configurado o no responde, los flags devuelven `false`. La app nunca se rompe por un flag.

### Regla: el servidor siempre valida

`useFlag` solo decide qué se muestra. Cualquiera puede llamar a un endpoint directamente, así que si el flag protege datos, el endpoint tiene que chequear el flag por su cuenta con `isFlagEnabled`.

Cuando el flag está off, el endpoint devuelve `null` (no un error): el usuario tiene permiso, simplemente la feature no está disponible.

Ejemplo completo: flag `dashboard-v2` → `apps/web/src/server/api/routers/dashboardV2.ts` + `activeAlertsWidget.tsx` en el dashboard.

## Convención de nombres

- kebab-case.
- Prefijo por área del producto, no por app del monorepo: un mismo flag suele chequearse en el cliente y en el servidor.
- Formato: `<área>-<qué-cambia>`.

| Bien | Mal |
| --- | --- |
| `dashboard-v2` | `dashboardV2`, `web-dashboard-v2` |
| `alerts-slack-integration` | `newFeature`, `test-flag` |
| `agents-auto-update` | `flag1` |

Ojo: el nombre del flag es kebab-case, pero los archivos siguen la convención del código (camelCase, ej. `dashboardV2.ts`).

## Cuándo crear un flag y cuándo no

Crear un flag cuando:

- La feature es grande o riesgosa y queremos poder apagarla rápido sin deploy.
- Queremos mergear a `main` trabajo incompleto sin que el usuario lo vea.
- Queremos liberarla a algunos usuarios primero (por email, porcentaje, workspace).

Cambio directo (sin flag) cuando:

- Es un bugfix.
- Es un cambio chico, fácil de revertir con un revert del commit.
- Es refactor interno sin cambio visible.
- Es un cambio de base de datos (migraciones): un flag no puede "deshacer" una migración.

Cada flag es código con dos caminos que hay que mantener y testear. Si no hace falta, no se crea.

## Crear un flag

1. En el panel de Unleash: **New feature flag**.
2. Nombre según la convención de arriba.
3. Tipo: **Release** para features nuevas. Unleash lo marca como *potentially stale* cuando pasa su vida esperada, lo que ayuda con la política de limpieza.
4. En el environment que corresponda: **Add strategy** → **Gradual rollout** al 100% (o el porcentaje/constraints que se necesiten).
5. Prender el toggle del environment cuando se quiera activar.

Importante: un toggle prendido sin estrategia sigue evaluando `false`. El toggle habilita el flag en el environment; la estrategia define para quién.

### Segmentación por usuario

El cliente manda el email del usuario como `userId` en el contexto. Hoy `isFlagEnabled` del servidor no recibe contexto. Si un flag usa constraints por usuario, el cliente y el servidor pueden dar resultados distintos: hay que extender `isFlagEnabled` para aceptar contexto antes de usar ese tipo de flag.

### Tiempo de propagación

Los cambios en el panel no son instantáneos: los SDKs refrescan cada pocos segundos (probado: ~17 s en el cliente). Durante ese tiempo el cliente y el servidor pueden no coincidir. Por eso, cuando el flag está off, el componente y el endpoint no deben mostrar un error: simplemente no muestran nada.

## Política de limpieza

Los flags de tipo Release con 30 días o más se eliminan.

Orden para eliminar:

1. Primero el código: borrar los chequeos (`useFlag`, `isFlagEnabled`) y dejar solo el camino que ganó. Si el flag tenía su propio router o componente, se integra o se borra.
2. Mergear y deployar.
3. Después archivar el flag en Unleash.

Si se archiva primero en Unleash, el código todavía lo consulta, recibe `false` y la feature desaparece para todos.

Mantener el código detrás de un flag en archivos propios (como `dashboardV2.ts`) hace que la limpieza sea borrar archivos en vez de desarmar código compartido.
