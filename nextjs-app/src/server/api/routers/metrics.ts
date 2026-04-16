import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const metricsRouter = createTRPCRouter({
  getAll: publicProcedure
    .query(async ({ ctx }) => {
      return await ctx.db.metrics.findMany();
    }),
});