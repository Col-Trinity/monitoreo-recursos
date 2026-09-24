import { and, count, eq } from "drizzle-orm";
import { alertEventsTable, alertRulesTable } from "@watchdog/db";

import { createTRPCRouter, memberProcedure } from "@/server/api/trpc";
import { isFlagEnabled } from "@/server/unleash";

export const dashboardV2Router = createTRPCRouter({
  activeAlertsCount: memberProcedure.query(async ({ ctx }) => {
    if (!(await isFlagEnabled("dashboard-v2"))) {
      return null;
    }

    const [row] = await ctx.db
      .select({ value: count() })
      .from(alertEventsTable)
      .innerJoin(
        alertRulesTable,
        eq(alertEventsTable.alertRuleId, alertRulesTable.id),
      )
      .where(
        and(
          eq(alertRulesTable.workspaceId, ctx.workspace.id),
          eq(alertEventsTable.status, "active"),
        ),
      );

    return { activeAlerts: row?.value ?? 0 };
  }),
});