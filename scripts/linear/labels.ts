import type { Context } from "./resolver.js";
import { log } from "./utils.js";

/**
 * Ensures all labels from 00-index.yaml exist on the team.
 * Populates ctx.labelByName with new ids on --apply.
 */
export async function ensureLabels(ctx: Context): Promise<void> {
  const missing = ctx.index.labels.filter(
    (l) => !ctx.labelByName.has(l.name.toLowerCase()),
  );
  if (missing.length === 0) {
    log.ok(`Labels already exist (${ctx.index.labels.length} total).`);
    return;
  }

  log.step(`Labels to create: ${missing.length}`);
  for (const l of missing) log.plan("CREATE", `${l.name} (${l.color})`);

  if (!ctx.apply) {
    log.dim("(dry-run — use --apply to create)");
    return;
  }

  for (const l of missing) {
    const res = await ctx.client.createIssueLabel({
      name: l.name,
      color: l.color,
      teamId: ctx.teamId,
    });
    const created = await res.issueLabel;
    if (!created) throw new Error(`Failed to create label ${l.name}`);
    ctx.labelByName.set(l.name.toLowerCase(), created.id);
    log.ok(`Created label ${l.name}`);
  }
}

/** Resolves label names from YAML to Linear ids. Assumes ensureLabels ran. */
export function labelIdsFor(ctx: Context, names: string[]): string[] {
  const ids: string[] = [];
  for (const name of names) {
    const id = ctx.labelByName.get(name.toLowerCase());
    if (id) ids.push(id);
    else log.warn(`Label "${name}" not found, skipping`);
  }
  return ids;
}
