ALTER TABLE "metrics" RENAME COLUMN "time" TO "created_at";
--> statement-breakpoint
ALTER TABLE "metrics" DROP CONSTRAINT "metrics_pkey";
--> statement-breakpoint
DROP INDEX IF EXISTS "uniq_metrcis";
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_time_idx";
--> statement-breakpoint
SELECT create_hypertable('metrics', 'created_at', chunk_time_interval => INTERVAL '1 day');
--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_pkey" PRIMARY KEY ("id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_metrcis" ON "metrics" ("created_at", "agent_id", "metrics_type", "host_name");
--> statement-breakpoint
CREATE INDEX "agent_time_idx" ON "metrics" ("agent_id", "created_at");
    