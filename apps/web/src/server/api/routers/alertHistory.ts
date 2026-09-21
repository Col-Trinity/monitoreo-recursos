import { createTRPCRouter, memberProcedure } from "@/server/api/trpc";
import { z } from "zod";
import {
  alertEventsTable,
  alertRulesTable,
  alertEventActionsTable,
  agentsTable,
} from "@watchdog/db";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";

export const alertHistoryRouter = createTRPCRouter({
  list: memberProcedure
    .input(
      z.object({
        ruleId: z.string().uuid().optional(),
        agentId: z.string().uuid().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filters = [eq(alertRulesTable.workspaceId, ctx.workspace.id)];

      if (input.ruleId) {
        filters.push(eq(alertEventsTable.alertRuleId, input.ruleId));
      }
      if (input.agentId) {
        filters.push(eq(alertEventsTable.agentId, input.agentId));
      }
      if (input.from) {
        filters.push(gte(alertEventsTable.startedAt, input.from));
      }
      if (input.to) {
        filters.push(lte(alertEventsTable.startedAt, input.to));
      }

      const events = await ctx.db
        .select({
          id: alertEventsTable.id,
          ruleId: alertEventsTable.alertRuleId,
          ruleName: alertRulesTable.name,
          agentId: alertEventsTable.agentId,
          agentName: agentsTable.name,
          triggerValue: alertEventsTable.triggerValue,
          status: alertEventsTable.status,
          startedAt: alertEventsTable.startedAt,
          resolvedAt: alertEventsTable.resolvedAt,
        })
        .from(alertEventsTable)
        .innerJoin(alertRulesTable, eq(alertEventsTable.alertRuleId, alertRulesTable.id))
        .innerJoin(agentsTable, eq(alertEventsTable.agentId, agentsTable.id))
        .where(and(...filters))
        .orderBy(desc(alertEventsTable.startedAt))
        .limit(100);

      if (events.length === 0) return [];

      const eventIds = events.map((event) => event.id);
      const actions = await ctx.db
        .select({
          alertEventId: alertEventActionsTable.alertEventId,
          actionType: alertEventActionsTable.actionType,
          status: alertEventActionsTable.status,
          error: alertEventActionsTable.error,
        })
        .from(alertEventActionsTable)
        .where(inArray(alertEventActionsTable.alertEventId, eventIds));

      const actionsByEvent = new Map<string, typeof actions>();
      for (const action of actions) {
        const list = actionsByEvent.get(action.alertEventId) ?? [];
        list.push(action);
        actionsByEvent.set(action.alertEventId, list);
      }

      return events.map((event) => ({
        ...event,
        actions: actionsByEvent.get(event.id) ?? [],
      }));
    }),

  rules: memberProcedure.query(async ({ ctx }) => {
    return await ctx.db
      .select({ id: alertRulesTable.id, name: alertRulesTable.name })
      .from(alertRulesTable)
      .where(
        and(eq(alertRulesTable.workspaceId, ctx.workspace.id), isNull(alertRulesTable.deletedAt)),
      );
  }),

  agents: memberProcedure.query(async ({ ctx }) => {
    return await ctx.db
      .select({ id: agentsTable.id, name: agentsTable.name })
      .from(agentsTable)
      .where(and(eq(agentsTable.workspaceId, ctx.workspace.id), isNull(agentsTable.deletedAt)));
  }),
});
