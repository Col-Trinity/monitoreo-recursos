import type { Context } from "./resolver.js";
import { log } from "./utils.js";

/**
 * Archives legacy tickets listed in 00-index.yaml → legacyTickets.archive.
 * Idempotent: already-archived tickets are skipped.
 */
export async function archiveLegacy(ctx: Context): Promise<void> {
  const toArchive = ctx.index.legacyTickets.archive;
  if (toArchive.length === 0) {
    log.ok("No legacy tickets to archive.");
    return;
  }

  log.step(`Legacy tickets to archive: ${toArchive.length}`);

  // Fetch each by identifier (team-scoped)
  const pending: { identifier: string; issueId: string; title: string }[] = [];
  for (const entry of toArchive) {
    const issues = await ctx.client.issues({
      filter: {
        team: { id: { eq: ctx.teamId } },
        number: { eq: parseInt(entry.identifier.split("-")[1] ?? "0", 10) },
      },
      first: 1,
    });
    const issue = issues.nodes[0];
    if (!issue) {
      log.warn(`${entry.identifier} not found — skipping.`);
      continue;
    }
    if (issue.archivedAt) {
      log.plan("SKIP", `${entry.identifier} already archived: "${issue.title}"`);
      continue;
    }
    pending.push({ identifier: entry.identifier, issueId: issue.id, title: issue.title });
    log.plan("ARCHIVE", `${entry.identifier} — "${issue.title}"`);
  }

  if (pending.length === 0) {
    log.ok("Nothing to do (all already archived).");
    return;
  }

  if (!ctx.apply) {
    log.dim("(dry-run — use --apply to archive)");
    return;
  }

  for (const p of pending) {
    await ctx.client.archiveIssue(p.issueId);
    log.ok(`Archived ${p.identifier}`);
  }
}
