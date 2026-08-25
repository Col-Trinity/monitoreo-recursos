import {
  createTRPCRouter,
  workspaceProcedure,
  memberProcedure,
} from "@/server/api/trpc";
import { metricsTable, queryMetrics } from "@watchdog/db";
import { agentsTable } from "@watchdog/db/schema";
import { desc, eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const metricsRouter = createTRPCRouter({
  getAll: workspaceProcedure.query(async ({ ctx }) => {
    return await ctx.db
      .select({ metrics: metricsTable })
      .from(metricsTable)
      .innerJoin(agentsTable, eq(metricsTable.agentId, agentsTable.id))
      .where(eq(agentsTable.workspaceId, ctx.workspace.id))
      .orderBy(desc(metricsTable.createdAt))
      .limit(20);
  }),
  getByAgent: memberProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
        metric: z.enum(["cpu", "memory", "disk", "network"]),
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [agent] = await ctx.db
        .select()
        .from(agentsTable)
        .where(
          and(
            eq(agentsTable.id, input.agentId),
            eq(agentsTable.workspaceId, ctx.workspace.id),
          ),
        );

      if (!agent) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await queryMetrics({
        agentId: input.agentId,
        metric: input.metric,
        from: input.from,
        to: input.to,
      });
    }),
  getByWorkspace: memberProcedure
    .input(
      z.object({
        metric: z.enum(["cpu", "memory", "disk", "network"]),
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const agents = await ctx.db
        .select()
        .from(agentsTable)
        .where(
          and(
            eq(agentsTable.workspaceId, ctx.workspace.id),
            isNull(agentsTable.deletedAt),
          ),
        );

      return await Promise.all(
        agents.map(async (agent) => ({
          agentId: agent.id,
          agentName: agent.name,
          points: await queryMetrics({
            agentId: agent.id,
            metric: input.metric,
            from: input.from,
            to: input.to,
          }),
        })),
      );
    }),
});
