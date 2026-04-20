# Linear workflow — Watch-Dog

Convenciones y prácticas del equipo para trabajar con Linear durante el challenge.

## Visión general

- **Workspace:** [daztan-llc](https://linear.app/daztan-llc)
- **Project:** Watch-Dog
- **Team key:** `DAZ` (tickets son `DAZ-N`)
- **Source of truth del plan:** `docs/linear-plan/*.yaml` en este repo. Cualquier cambio al roadmap se hace en esos YAMLs + `pnpm linear <cmd>`.

## Comandos del script

```bash
pnpm linear status                    # estado del proyecto (read-only)
pnpm linear labels [--apply]          # crea labels que falten
pnpm linear archive [--apply]         # archiva tickets legacy
pnpm linear milestone <N> [--apply]   # sincroniza milestone N (1-13)
pnpm linear relations [--apply]       # crea relaciones blocks/blocked-by desde YAMLs
pnpm linear templates [--apply]       # crea issue templates (Research, ADR, Bug)
pnpm linear views [--apply]           # crea saved custom views
```

Todos los comandos son **dry-run por defecto**. `--apply` ejecuta. Idempotentes: re-ejecutar solo crea lo que falta.

## Cómo arrancar cada día (devs)

1. Abrí Linear → proyecto Watch-Dog.
2. Usá la vista **"Watch-Dog — [tu nombre] (mis tickets)"** para ver solo lo tuyo agrupado por milestone.
3. Tomá el ticket con mayor prioridad del milestone en curso que **no esté bloqueado**.
4. Pasalo a `In Progress`.
5. Al finalizar, abrí PR con mensaje que incluya `Closes DAZ-N`.

## GitHub integration

La integración está **activa** en el workspace (verificado vía API).

### Branch naming (convención)

Linear genera automáticamente un branch name desde cualquier ticket:
- En el ticket → botón **"Copy branch name"** (o icono de git en la toolbar).
- Formato: `alexarmua/daz-15-disenar-schema-multi-tenant`.

Usarlo así asegura que Linear vincule el PR al ticket.

### Auto-close de issues

En la descripción del PR, incluir:
```
Closes DAZ-15
```
Al mergearse, Linear marca el ticket como `Done` automáticamente. Variantes válidas: `Closes`, `Fixes`, `Resolves`, en cualquier lugar del body.

### PR status en tickets

Una vez vinculado (por branch o commit message), dentro del ticket vas a ver:
- Estado del PR (draft / open / merged).
- Checks de CI.
- Review status.

Sin necesidad de salir de Linear.

## Templates de issues

Creados automáticamente por `pnpm linear templates --apply`:

| Template | Uso | Prefijo sugerido |
|---|---|---|
| **Research** | Investigación: preguntas, alternativas evaluadas, decisión, fuentes. | `[Research] ` |
| **ADR** | Architectural Decision Record — decisión arquitectónica inmutable. | `[ADR] ` |
| **Bug Report** | Reporte con repro, entorno, expected vs actual. | `[Bug] ` |

**Cómo usar:** al crear un ticket en Linear, hay un botón de "Template" al lado del título → elegir → completar.

## Custom views

Creadas por `pnpm linear views --apply`:

| View | Para quién | Filtro |
|---|---|---|
| Roadmap por milestone | Alex (TL) | Todos los tickets abiertos del proyecto, agrupados por milestone. |
| Research pendiente | Todos | Label `research`, estado abierto. |
| En curso | Todos | Estado `started` (In Progress). |
| Abel (mis tickets) | Abel | Assignee = abel, abiertos. |
| Gia (mis tickets) | Gia | Assignee = gia, abiertos. |

**Verificar visibilidad:** si después de `pnpm linear views --apply` no aparecen en la UI, borralos manualmente desde Linear (los IDs se logean al crear) y volvé a aplicar. Es una particularidad de cómo Linear indexa views creadas vía API que se explica en la sección "Known issues" al final.

## Dependencies (blocks/blocked-by)

Creadas por `pnpm linear relations --apply`. Los juniors las ven como:
- Ícono 🚧 al lado del título cuando el ticket está bloqueado.
- Sección "Blocking" / "Blocked by" en el ticket.
- La vista **"En curso"** solo mostraría tickets que **no están bloqueados**.

**Principio:** si un ticket tiene un blocker sin resolver, no lo agarres. Agarrá otro.

Para **agregar una dependencia nueva**:
1. Editar el YAML del milestone correspondiente.
2. En el ticket bloqueado, agregar `blockedBy: [N]` (N = índice del blocker dentro del mismo milestone, 1-based).
3. `pnpm linear relations --apply`.

## Project Updates (ritual semanal)

**Qué:** un mensaje corto publicado en el proyecto cada viernes.

**Formato sugerido** (texto plano en el input de Project Updates en Linear):
```
## Esta semana
- [DAZ-15] ERD del schema completado
- [DAZ-21] Investigación de TimescaleDB cerrada
- Blocker: pendiente review de Alex del PR #23

## Próxima semana
- [DAZ-16] Implementar schema en Drizzle
- [DAZ-22] Migrar docker-compose a Timescale

## Notas
- Seguimos en camino para cerrar M1 el viernes 26/04.
```

**Ritmo:**
- Cada junior publica su update los viernes a las 18:00.
- Alex (TL) lee los lunes a la mañana y responde con feedback asíncrono.
- **Regla:** si hay un blocker, se publica ANTES del viernes — no esperar.

**Dónde:** en Linear → proyecto Watch-Dog → tab "Updates" → "New update".

## Issue status workflow

Estados de Linear que usamos:
- **Backlog** → el ticket existe pero nadie lo está mirando todavía.
- **Todo** → aceptado, listo para tomar.
- **In Progress** → alguien lo está haciendo.
- **In Review** → PR abierto, esperando review.
- **Done** → mergeado y verificado.
- **Cancelled** → no se va a hacer (con razón en comentario).

**Regla:** nadie puede tener más de 2 tickets en `In Progress` al mismo tiempo. Forzás a cerrar antes de abrir más.

## Known issues del script

### Custom views a veces no aparecen en queries

Al crear una view via API, el mutation devuelve `success: true` y un ID válido, pero `customViews` list query puede devolver 0. La view sí está en Linear y aparece en la UI del owner. Si **no** la ves en la UI después de crear:

1. En Linear, sidebar izquierdo → "Views" → chequear si ya está.
2. Si no está, borrá cualquier view duplicada manualmente y re-ejecutá `pnpm linear views --apply`.
3. El script pasa `shared: true + teamId` para maximizar visibilidad entre miembros del equipo.

### Relations direction

En el YAML, `blockedBy: [3]` en el ticket #5 significa: "el ticket #5 está bloqueado por el #3". En Linear eso se mapea a una relación tipo `blocks` con `issueId=ticket3, relatedIssueId=ticket5` (#3 bloquea #5).

## Limitaciones pedagógicas explícitas

1. **No hay `blocked by` en CI.** El script marca la dependencia en Linear pero no impide mergear un ticket bloqueado. Es **responsabilidad del dev** respetar el orden. Si lo ignoran, se dan cuenta solos (conflictos o cambios que no funcionan).
2. **Templates no son obligatorios.** Pueden crear un ticket sin template, pero los de investigación / ADR / bugs deberían usarlos. Es preferencia; no enforced.
3. **Views son personales.** Cada dev puede crear las suyas propias adicionales sin pedir permiso.

## Quick reference

| Quiero... | Comando |
|---|---|
| Ver qué hay hoy | Linear UI → view "mis tickets" |
| Crear un ticket nuevo | Linear UI → `+` → template si aplica |
| Agregar dependencia | Editar YAML → `pnpm linear relations --apply` |
| Agregar un nuevo ticket al roadmap | Editar YAML del milestone → `pnpm linear milestone <N> --apply` |
| Cambiar metadata del milestone | Editar YAML → `pnpm linear milestone <N> --apply` |
| Archivar un ticket | Hacerlo en Linear UI directamente |
| Ver estado general | `pnpm linear status` |
