import postgres from "postgres";
import { env } from "@watchdog/env"

const client = postgres(env.DATABASE_URL, { max: 1 });

const jobs = await client`
    SELECT * FROM timescaledb_information.jobs
    WHERE proc_name = 'policy_retention'
`;


if (jobs.length === 0) {
  console.log("⚠️  No hay retention policies activas.");
} else {
  console.log("✅ Retention policies activas:");
  console.table(jobs);
}

await client.end();