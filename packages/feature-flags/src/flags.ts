import { getClient } from "./client";

export const FLAGS = ["dashboard-v2"] as const;
export type FlagName = (typeof FLAGS)[number];

export function isEnabled(
  name: FlagName,
  ctx: { userId: string; workspaceId?: string; role?: string },
): boolean {
  return getClient().isEnabled(name, {
    userId: ctx.userId,
    properties: {
      workspaceId: ctx.workspaceId,
      role: ctx.role,
    },
  });
}
