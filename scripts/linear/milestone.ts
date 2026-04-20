import type { Context } from "./resolver.js";
import { loadMilestone, milestoneDates } from "./config.js";
import { labelIdsFor, ensureLabels } from "./labels.js";
import { log } from "./utils.js";
import type { Ticket } from "./types.js";

/**
 * Syncs a single milestone and its tickets.
 * Idempotent at milestone granularity: if a milestone with the same name
 * exists on the project, it's reused (and description/targetDate are updated).
 * Tickets: we check by (milestone, title) — existing ones skipped.
 */
export async function syncMilestone(ctx: Context, weekNumber: number): Promise<void> {
  const { file, config } = loadMilestone(weekNumber);
  const { milestone, tickets } = config;

  log.step(`Milestone M${weekNumber}: ${milestone.name}`);
  log.dim(`  source: ${file}`);
  log.dim(`  tickets: ${tickets.length}`);

  // Ensure labels used by this milestone's tickets exist
  const neededLabels = new Set(tickets.flatMap((t) => t.labels));
  const missing = [...neededLabels].filter((n) => !ctx.labelByName.has(n.toLowerCase()));
  if (missing.length > 0) {
    log.warn(`${missing.length} label(s) missing, syncing labels first…`);
    await ensureLabels(ctx);
  }

  const { startDate, targetDate } = milestoneDates(
    ctx.index.schedule.startDate,
    weekNumber,
    ctx.index.schedule.weekLengthDays,
  );

  // Step 1: resolve or create milestone
  const project = await ctx.client.project(ctx.projectId);
  const existing = await project.projectMilestones();
  let milestoneObj = existing.nodes.find((m) => m.name === milestone.name);

  if (milestoneObj) {
    log.plan("UPDATE", `milestone already exists: "${milestone.name}"`);
  } else {
    log.plan("CREATE", `milestone "${milestone.name}" (${startDate} → ${targetDate})`);
  }

  // Step 2: list existing ticket titles in this milestone (idempotency)
  const existingTitles = new Set<string>();
  if (milestoneObj) {
    const existingIssues = await ctx.client.issues({
      filter: {
        project: { id: { eq: ctx.projectId } },
        projectMilestone: { id: { eq: milestoneObj.id } },
      },
      first: 250,
    });
    for (const i of existingIssues.nodes) existingTitles.add(i.title);
  }

  const toCreate: Ticket[] = tickets.filter((t) => !existingTitles.has(t.title));
  const toSkip: Ticket[] = tickets.filter((t) => existingTitles.has(t.title));

  for (const t of toSkip) log.plan("SKIP", `ticket "${t.title}" (already exists)`);
  for (const t of toCreate)
    log.plan(
      "CREATE",
      `ticket "${t.title}" [${t.labels.join(",") || "no-labels"}] → ${t.assignee}`,
    );

  if (!ctx.apply) {
    log.dim("(dry-run — use --apply to write)");
    return;
  }

  // Apply: milestone
  if (!milestoneObj) {
    const payload = await ctx.client.createProjectMilestone({
      projectId: ctx.projectId,
      name: milestone.name,
      description: milestone.description,
      targetDate,
    });
    milestoneObj = await payload.projectMilestone;
    if (!milestoneObj) throw new Error(`Failed to create milestone ${milestone.name}`);
    log.ok(`Created milestone "${milestone.name}"`);
  } else {
    await ctx.client.updateProjectMilestone(milestoneObj.id, {
      description: milestone.description,
      targetDate,
    });
    log.ok(`Updated milestone "${milestone.name}"`);
  }

  // Apply: tickets
  for (const t of toCreate) {
    const assigneeId = ctx.userByEmail.get(t.assignee.toLowerCase());
    const labelIds = labelIdsFor(ctx, t.labels);
    const payload = await ctx.client.createIssue({
      teamId: ctx.teamId,
      projectId: ctx.projectId,
      projectMilestoneId: milestoneObj.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      estimate: t.estimate,
      labelIds,
      assigneeId,
    });
    const issue = await payload.issue;
    log.ok(`Created ${issue?.identifier ?? "?"}: ${t.title}`);
  }

  log.ok(`M${weekNumber} done — ${toCreate.length} created, ${toSkip.length} skipped.`);
}
