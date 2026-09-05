import { createTRPCRouter, superAdminProcedure } from "@/server/api/trpc";
import { metricsTable } from "@watchdog/db";
import { env } from "@watchdog/env";
import { TRPCError } from "@trpc/server";
import { count, gte, sql } from "drizzle-orm";

const INGEST_RATE_WINDOW_MS = 60_000; //ventana de tiempo

export const sliRouter = createTRPCRouter({
  ingestRate: superAdminProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - INGEST_RATE_WINDOW_MS); // el momento exacto de hace 60s

    //consultamos cuantas filas en metrics son igual o mayor que el since
    const [row] = await ctx.db
      .select({ count: count() })
      .from(metricsTable)
      .where(gte(metricsTable.createdAt, since));

    return {
      count: row?.count ?? 0,
      windowMs: INGEST_RATE_WINDOW_MS,
      measuredAt: new Date(),
    };
  }),
  queueDepth: superAdminProcedure.query(async () => {
    const res = await fetch(`${env.API_URL}/health`);
    if (!res.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No se pudo consultar la api",
      });
    }

    const data = (await res.json()) as { queue?: { depth?: number } };

    return {
      depth: data.queue?.depth ?? 0,
      measuredAt: new Date(),
    };
  }),
  replicaLag: superAdminProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.execute(
      sql`select extract(epoch from (now() - pg_last_xact_replay_timestamp())) as lag_seconds`,
    );

    const lagSeconds = result[0]?.lag_seconds;

    return {
      lagSeconds: lagSeconds != null ? Number(lagSeconds) : null,
      measuredAt: new Date(),
    };
  }),
});
