DROP INDEX "uniq_metrcis";--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_metrics" ON "metrics" USING btree ("created_at","agent_id","metrics_type","host_name");