import type { LinearClient } from "@linear/sdk";
import type { IndexConfig } from "./types.js";

export interface Context {
  client: LinearClient;
  index: IndexConfig;
  teamId: string;
  projectId: string;
  /** email lowercased → Linear user id */
  userByEmail: Map<string, string>;
  /** label name lowercased → Linear label id (scoped to team) */
  labelByName: Map<string, string>;
  apply: boolean;
}

export async function buildContext(
  client: LinearClient,
  index: IndexConfig,
  apply: boolean,
): Promise<Context> {
  // Resolve team
  const teams = await client.teams({
    filter: { key: { eq: index.project.teamKey } },
  });
  const team = teams.nodes[0];
  if (!team) {
    throw new Error(
      `Team with key "${index.project.teamKey}" not found. Check your API key's workspace.`,
    );
  }

  // Resolve project by name within the team
  const projects = await team.projects({
    filter: { name: { eq: index.project.name } },
  });
  const project = projects.nodes[0];
  if (!project) {
    throw new Error(
      `Project "${index.project.name}" not found in team ${team.key}.`,
    );
  }

  // Resolve users
  const users = await client.users({ first: 250 });
  const userByEmail = new Map<string, string>();
  for (const u of users.nodes) {
    if (u.email) userByEmail.set(u.email.toLowerCase(), u.id);
  }
  for (const a of index.assignees) {
    if (!userByEmail.has(a.email.toLowerCase())) {
      throw new Error(
        `Assignee ${a.email} not found in workspace (invite them to Linear first).`,
      );
    }
  }

  // Resolve labels scoped to team
  const labels = await team.labels({ first: 250 });
  const labelByName = new Map<string, string>();
  for (const l of labels.nodes) {
    labelByName.set(l.name.toLowerCase(), l.id);
  }

  return {
    client,
    index,
    teamId: team.id,
    projectId: project.id,
    userByEmail,
    labelByName,
    apply,
  };
}
