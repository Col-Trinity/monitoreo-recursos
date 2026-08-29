import { metricsTable } from "@watchdog/db";
import { db, dbW } from "@/server/db";
export async function GET() {
  try {
    await Promise.all([
      dbW.select().from(metricsTable).limit(1),
      db.select().from(metricsTable).limit(1),
    ]);

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
