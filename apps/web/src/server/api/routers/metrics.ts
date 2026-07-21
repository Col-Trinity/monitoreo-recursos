import { createTRPCRouter, workspaceProcedure } from "@/server/api/trpc";
import { metricsTable } from "@watchdog/db";
import { agentsTable } from "@watchdog/db/schema";
import { desc, eq } from "drizzle-orm";

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
});
