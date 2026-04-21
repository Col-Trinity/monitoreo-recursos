import { metricsTable } from "@watchdog/db";
import { db } from "@/server/db";

export async function GET() {
  try {
    await db.select().from(metricsTable).limit(1);

    const res = await fetch(`http://localhost:3001/health`);
    if (!res.ok) throw new Error("fastify down");

    return Response.json({ status: "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ status: "error", error: message }, { status: 500 });
  }
}
