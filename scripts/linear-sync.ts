#!/usr/bin/env tsx
/**
 * Linear sync — importa milestones, tickets, deps, templates y views a
 * Watch-Dog en el workspace daztan-llc.
 *
 * Requisitos:
 *   LINEAR_API_KEY en .env (personal API key de https://linear.app/settings/api).
 *
 * Todos los comandos son dry-run por defecto. Usar --apply para ejecutar.
 */

import { archiveLegacy } from "./linear/archive.js";
import { makeClient } from "./linear/client.js";
import { loadIndex } from "./linear/config.js";
import { ensureLabels } from "./linear/labels.js";
import { syncMilestone } from "./linear/milestone.js";
import { syncRelations } from "./linear/relations.js";
import { buildContext } from "./linear/resolver.js";
import { syncTemplates } from "./linear/templates.js";
import { log, parseArgs } from "./linear/utils.js";
import { syncViews } from "./linear/views.js";

function printHelp(): void {
  console.log(`
Linear sync — Watch-Dog

Comandos:
  status                        Estado actual (read-only)
  labels     [--apply]          Asegura labels del index
  archive    [--apply]          Archiva tickets legacy
  milestone  <N> [--apply]      Sincroniza milestone N (1-13)
  relations  [--apply]          Crea relaciones 'blocks' según blockedBy en YAMLs
  templates  [--apply]          Crea issue templates (Research, ADR, Bug)
  views      [--apply]          Crea custom saved views
  help                          Esta ayuda

Ejemplos:
  pnpm linear status
  pnpm linear labels --apply
  pnpm linear archive --apply
  pnpm linear milestone 1 --apply
  pnpm linear relations --apply
  pnpm linear templates --apply
  pnpm linear views --apply
`);
}

async function main(): Promise<void> {
  const { cmd, rest, apply } = parseArgs();

  if (cmd === "help" || cmd === "--help") {
    printHelp();
    return;
  }

  const client = makeClient();
  const index = loadIndex();
  const ctx = await buildContext(client, index, apply);

  log.dim(`workspace: ${index.project.workspace}`);
  log.dim(`project:   ${index.project.name} (team ${index.project.teamKey})`);
  log.dim(`mode:      ${apply ? "APPLY" : "dry-run"}`);
  console.log("");

  switch (cmd) {
    case "status": {
      const project = await client.project(ctx.projectId);
      const milestones = await project.projectMilestones();
      const issues = await client.issues({
        filter: { project: { id: { eq: ctx.projectId } } },
        first: 250,
      });
      const views = await client.customViews({ first: 50 });
      log.step("Project state:");
      log.info(`  milestones: ${milestones.nodes.length}`);
      for (const m of milestones.nodes) {
        log.dim(`    - ${m.name}${m.targetDate ? ` (→ ${m.targetDate})` : ""}`);
      }
      log.info(`  issues:     ${issues.nodes.length}`);
      log.info(`  labels:     ${ctx.labelByName.size}`);
      log.info(`  views:      ${views.nodes.length}`);
      for (const v of views.nodes) log.dim(`    - ${v.name}`);
      log.info(`  assignees:  ${ctx.userByEmail.size} workspace users`);
      break;
    }
    case "labels":
      await ensureLabels(ctx);
      break;
    case "archive":
      await archiveLegacy(ctx);
      break;
    case "milestone": {
      const n = parseInt(rest[0] ?? "", 10);
      if (!Number.isInteger(n) || n < 1 || n > 13) {
        log.err("Uso: pnpm linear milestone <1-13> [--apply]");
        process.exit(1);
      }
      await syncMilestone(ctx, n);
      break;
    }
    case "relations":
      await syncRelations(ctx);
      break;
    case "templates":
      await syncTemplates(ctx);
      break;
    case "views":
      await syncViews(ctx);
      break;
    default:
      log.err(`Comando desconocido: ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  log.err(err instanceof Error ? err.message : String(err));
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
