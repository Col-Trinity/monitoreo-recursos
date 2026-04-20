import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { Context } from "./resolver.js";
import { loadMilestone, PLAN_DIR_PATH } from "./config.js";
import { log } from "./utils.js";

/**
 * Creates issue "blocks" relations based on `blockedBy` fields in each milestone YAML.
 *
 * Matching strategy (per milestone):
 *   - Fetch all issues in the milestone ordered by createdAt ASC.
 *   - Index N in the YAML ↔ issue N in that ordered list.
 *   - `blockedBy: [i]` in YAML ticket N → Linear relation (issue[i] blocks issue[N]).
 *
 * Idempotent: already-existing relations are skipped.
 */
export async function syncRelations(ctx: Context): Promise<void> {
  // Discover milestone files by prefix
  const files = fs
    .readdirSync(PLAN_DIR_PATH)
    .filter((f) => /^\d{2}-.*\.yaml$/.test(f) && !f.startsWith("00-"))
    .sort();

  let totalPlanned = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const week = parseInt(file.slice(0, 2), 10);
    const { config } = loadMilestone(week);
    const hasDeps = config.tickets.some((t) => (t.blockedBy ?? []).length > 0);
    if (!hasDeps) continue;

    log.step(`M${week}: ${config.milestone.name}`);

    // Resolve milestone id
    const project = await ctx.client.project(ctx.projectId);
    const milestones = await project.projectMilestones();
    const milestoneObj = milestones.nodes.find(
      (m) => m.name === config.milestone.name,
    );
    if (!milestoneObj) {
      log.warn(`  milestone not in Linear, skipping`);
      continue;
    }

    // Fetch issues of this milestone ordered by createdAt ASC
    const issues = await ctx.client.issues({
      filter: {
        project: { id: { eq: ctx.projectId } },
        projectMilestone: { id: { eq: milestoneObj.id } },
      },
      orderBy: "createdAt" as unknown as never,
      first: 250,
    });
    // The default orderBy from Linear is by updatedAt; we need manual sort
    const ordered = issues.nodes.slice().sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return da - db;
    });

    if (ordered.length !== config.tickets.length) {
      log.warn(
        `  ticket count mismatch: Linear=${ordered.length} YAML=${config.tickets.length}. Skipping M${week}.`,
      );
      continue;
    }

    // Existing relations in this milestone (to avoid duplicates)
    const existingRelations = new Set<string>();
    for (const issue of ordered) {
      const rels = await issue.relations();
      for (const r of rels.nodes) {
        if (r.type === "blocks") {
          const related = await r.relatedIssue;
          if (related) existingRelations.add(`${issue.id}->${related.id}`);
        }
      }
    }

    for (let i = 0; i < config.tickets.length; i++) {
      const ticket = config.tickets[i]!;
      const blocked = ticket.blockedBy ?? [];
      if (blocked.length === 0) continue;

      const blockedIssue = ordered[i]!;
      for (const blockerIdx of blocked) {
        if (blockerIdx < 1 || blockerIdx > ordered.length || blockerIdx === i + 1) {
          log.warn(
            `  invalid blockedBy=${blockerIdx} in "${ticket.title}" (self or out of range)`,
          );
          continue;
        }
        const blockerIssue = ordered[blockerIdx - 1]!;
        const key = `${blockerIssue.id}->${blockedIssue.id}`;
        totalPlanned++;

        if (existingRelations.has(key)) {
          log.plan("SKIP", `${blockerIssue.identifier} blocks ${blockedIssue.identifier} (exists)`);
          totalSkipped++;
          continue;
        }

        log.plan(
          "CREATE",
          `${blockerIssue.identifier} blocks ${blockedIssue.identifier}`,
        );

        if (ctx.apply) {
          await ctx.client.createIssueRelation({
            issueId: blockerIssue.id,
            relatedIssueId: blockedIssue.id,
            type: "blocks" as unknown as never,
          });
          totalCreated++;
        }
      }
    }
  }

  log.info("");
  log.info(
    `Relations: planned=${totalPlanned}, ${ctx.apply ? `created=${totalCreated}` : "(dry-run)"}, skipped=${totalSkipped}`,
  );
  if (!ctx.apply && totalPlanned > totalSkipped) {
    log.dim("(dry-run — use --apply to create)");
  }
}
