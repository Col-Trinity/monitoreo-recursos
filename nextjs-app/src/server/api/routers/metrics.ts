import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { metricsTable } from "@/server/db/schema";

export const metricsRouter = createTRPCRouter({
  getAll: publicProcedure
    .query(async ({ ctx }) => {
      return await ctx.db.select().from(metricsTable);
    }),
});