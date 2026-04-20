import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import {
  indexSchema,
  milestoneSchema,
  type IndexConfig,
  type MilestoneConfig,
} from "./types.js";

const PLAN_DIR = path.resolve(process.cwd(), "docs/linear-plan");

export function loadIndex(): IndexConfig {
  const file = path.join(PLAN_DIR, "00-index.yaml");
  const raw = fs.readFileSync(file, "utf8");
  const parsed = YAML.parse(raw);
  return indexSchema.parse(parsed);
}

/** Loads a milestone YAML by weekNumber (matches prefix `0N-*.yaml`). */
export function loadMilestone(weekNumber: number): {
  file: string;
  config: MilestoneConfig;
} {
  const prefix = String(weekNumber).padStart(2, "0") + "-";
  const match = fs
    .readdirSync(PLAN_DIR)
    .find((name) => name.startsWith(prefix) && name.endsWith(".yaml"));
  if (!match) throw new Error(`Milestone YAML for week ${weekNumber} not found`);
  const file = path.join(PLAN_DIR, match);
  const raw = fs.readFileSync(file, "utf8");
  const parsed = YAML.parse(raw);
  const config = milestoneSchema.parse(parsed);
  if (config.milestone.weekNumber !== weekNumber) {
    throw new Error(
      `${match}: weekNumber=${config.milestone.weekNumber} mismatches filename prefix ${prefix}`,
    );
  }
  return { file, config };
}

/** Compute startDate/targetDate for a milestone from the schedule. */
export function milestoneDates(
  scheduleStart: string,
  weekNumber: number,
  weekLengthDays: number,
): { startDate: string; targetDate: string } {
  const base = new Date(scheduleStart + "T00:00:00Z");
  const start = new Date(base);
  start.setUTCDate(start.getUTCDate() + (weekNumber - 1) * weekLengthDays);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + weekLengthDays - 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    targetDate: end.toISOString().slice(0, 10),
  };
}

export const PLAN_DIR_PATH = PLAN_DIR;
