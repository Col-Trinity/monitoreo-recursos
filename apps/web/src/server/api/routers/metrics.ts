import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { metricsTable } from "@watchdog/db";
import { desc } from "drizzle-orm";

export const metricsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db
      .select()
      .from(metricsTable)
      .orderBy(desc(metricsTable.time))
      .limit(20);
  }),
});
