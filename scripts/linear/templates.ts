import type { Context } from "./resolver.js";
import { log } from "./utils.js";

interface TemplateDef {
  name: string;
  description: string;
  templateData: {
    title: string;
    description: string;
    /** 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low */
    priority?: number;
  };
}

const TEMPLATES: TemplateDef[] = [
  {
    name: "Research",
    description:
      "Ticket de investigación con espacio para alternativas, pros/cons, decisión y fuentes.",
    templateData: {
      title: "[Research] ",
      priority: 3,
      description: `## Pregunta / Goal

_¿Qué necesitamos entender o decidir?_

## Alternativas evaluadas

### Opción A
- **Pros:**
- **Cons:**

### Opción B
- **Pros:**
- **Cons:**

### Opción C
- **Pros:**
- **Cons:**

## Decisión

_¿Cuál elegimos y por qué?_

## Fuentes

- [ ] Documentación oficial:
- [ ] Artículos / blogs:
- [ ] Ejemplos de código:

## Entregable

- [ ] Documento en \`docs/architecture/\` o \`docs/operations/\`
- [ ] Decisión linkeada desde README si aplica
`,
    },
  },
  {
    name: "ADR (Architectural Decision Record)",
    description: "Registro de decisión arquitectónica. Inmutable una vez merged.",
    templateData: {
      title: "[ADR] ",
      priority: 2,
      description: `## Contexto

_¿Qué problema o situación requiere una decisión?_

## Decisión

_¿Qué decidimos hacer?_

## Consecuencias

**Positivas:**
-

**Negativas / trade-offs:**
-

## Alternativas consideradas

1.
2.

## Status

- [ ] Proposed
- [ ] Accepted
- [ ] Deprecated / Superseded by [ADR-N]

## Notas

_Cualquier contexto adicional, referencias a otros ADRs, etc._
`,
    },
  },
  {
    name: "Bug Report",
    description: "Reporte de bug con repro mínima, entorno, y expected vs actual.",
    templateData: {
      title: "[Bug] ",
      priority: 2,
      description: `## Descripción

_Descripción corta del bug._

## Pasos para reproducir

1.
2.
3.

## Comportamiento esperado

## Comportamiento actual

## Entorno

- **App/servicio:**
- **Versión / commit:**
- **OS:**
- **Browser (si aplica):**

## Logs / screenshots

\`\`\`

\`\`\`

## Hipótesis / causa probable

_Si tenés una pista._

## Criterios de aceptación

- [ ] Repro no ocurre más en el entorno original
- [ ] Test de regresión agregado
`,
    },
  },
];

/**
 * Creates issue templates at the team level. Idempotent by name.
 *
 * Note: Linear SDK's `createTemplate` takes a templateData object whose exact
 * shape varies between versions. We use `unknown` + cast since it's CLI-only.
 */
export async function syncTemplates(ctx: Context): Promise<void> {
  // Fetch existing templates via team
  const team = await ctx.client.team(ctx.teamId);
  const existing = await team.templates();
  const existingByName = new Map<string, { id: string }>();
  for (const t of existing.nodes) existingByName.set(t.name, { id: t.id });

  log.step(`Templates planned: ${TEMPLATES.length}`);

  for (const tpl of TEMPLATES) {
    const exists = existingByName.has(tpl.name);
    if (exists) {
      log.plan("SKIP", `template "${tpl.name}" (already exists)`);
      continue;
    }
    log.plan("CREATE", `template "${tpl.name}"`);
  }

  if (!ctx.apply) {
    log.dim("(dry-run — use --apply to create templates)");
    return;
  }

  for (const tpl of TEMPLATES) {
    if (existingByName.has(tpl.name)) continue;
    const payload = await (
      ctx.client as unknown as {
        createTemplate: (args: unknown) => Promise<{ success: boolean }>;
      }
    ).createTemplate({
      type: "issue",
      teamId: ctx.teamId,
      name: tpl.name,
      description: tpl.description,
      templateData: JSON.stringify(tpl.templateData),
    });
    if (!payload.success) {
      log.err(`Failed to create template "${tpl.name}"`);
      continue;
    }
    log.ok(`Created template "${tpl.name}"`);
  }
}
