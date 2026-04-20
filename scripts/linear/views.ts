import type { Context } from "./resolver.js";
import { log } from "./utils.js";

interface ViewDef {
  name: string;
  description: string;
  /** Linear filter DSL — minimal subset. */
  filterData: Record<string, unknown>;
}

/**
 * Saved custom views to scaffold. All are project-scoped to Watch-Dog.
 *
 * Linear's filter DSL is documented at https://developers.linear.app/docs/graphql/working-with-the-graphql-api/queries-and-mutations.
 * We keep filters minimal and rely on "group by milestone" being the default
 * for project-scoped views.
 */
function buildViews(projectId: string, userIdByEmail: Map<string, string>): ViewDef[] {
  const abel = userIdByEmail.get("abelastra0@gmail.com");
  const gia = userIdByEmail.get("gianellalastra4@gmail.com");

  const views: ViewDef[] = [
    {
      name: "Watch-Dog — Roadmap por milestone",
      description: "Todos los tickets abiertos del proyecto, agrupados por milestone. Vista maestra del plan.",
      filterData: {
        project: { id: { eq: projectId } },
        state: { type: { nin: ["completed", "canceled"] } },
      },
    },
    {
      name: "Watch-Dog — Research pendiente",
      description: "Tickets con label 'research' abiertos. Priorizar antes de implementación.",
      filterData: {
        project: { id: { eq: projectId } },
        state: { type: { nin: ["completed", "canceled"] } },
        labels: { some: { name: { eq: "research" } } },
      },
    },
    {
      name: "Watch-Dog — En curso",
      description: "Tickets en estado 'In Progress' o 'In Review' — qué está andando ahora.",
      filterData: {
        project: { id: { eq: projectId } },
        state: { type: { in: ["started"] } },
      },
    },
  ];

  if (abel) {
    views.push({
      name: "Watch-Dog — Abel (mis tickets)",
      description: "Tickets asignados a abelastra0@gmail.com, agrupados por milestone.",
      filterData: {
        project: { id: { eq: projectId } },
        state: { type: { nin: ["completed", "canceled"] } },
        assignee: { id: { eq: abel } },
      },
    });
  }
  if (gia) {
    views.push({
      name: "Watch-Dog — Gia (mis tickets)",
      description: "Tickets asignados a gianellalastra4@gmail.com, agrupados por milestone.",
      filterData: {
        project: { id: { eq: projectId } },
        state: { type: { nin: ["completed", "canceled"] } },
        assignee: { id: { eq: gia } },
      },
    });
  }

  return views;
}

export async function syncViews(ctx: Context): Promise<void> {
  const views = buildViews(ctx.projectId, ctx.userByEmail);

  const existing = await ctx.client.customViews({ first: 100 });
  const existingByName = new Map<string, string>();
  for (const v of existing.nodes) existingByName.set(v.name, v.id);

  log.step(`Custom views planned: ${views.length}`);
  for (const v of views) {
    if (existingByName.has(v.name)) {
      log.plan("SKIP", `"${v.name}" (exists)`);
    } else {
      log.plan("CREATE", `"${v.name}"`);
    }
  }

  if (!ctx.apply) {
    log.dim("(dry-run — use --apply to create views)");
    return;
  }

  for (const v of views) {
    if (existingByName.has(v.name)) continue;
    const payload = await ctx.client.createCustomView({
      name: v.name,
      description: v.description,
      projectId: ctx.projectId,
      teamId: ctx.teamId,
      shared: true,
      filterData: v.filterData as never,
    });
    const created = await payload.customView;
    if (!created) {
      log.err(`Failed to create view "${v.name}"`);
      continue;
    }
    log.ok(`Created view "${v.name}" (shared, id=${created.id})`);
  }
}
