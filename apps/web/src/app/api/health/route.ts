import { metricsTable } from "@watchdog/db";
import { db } from "@/server/db";
import { env } from "@watchdog/env";

export async function GET() {
  try {
    const inicio = Date.now();

    await db.select().from(metricsTable).limit(1);

    const latency = Date.now() - inicio;

    const res = await fetch(`${env.API_URL}/health`);
    if (!res.ok) throw new Error("fastify down");

    return Response.json({
      status: "ok",
      database: { latencyMs: latency },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ status: "error", error: message }, { status: 503 });
  }
}
