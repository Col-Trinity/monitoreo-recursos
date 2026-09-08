ALTER TABLE "alert_events" DROP CONSTRAINT "alert_events_user_id_to_notify_users_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "trigger_value" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "trigger_value" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "started_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "alert_events" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_events" ADD COLUMN "agent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" DROP COLUMN "user_id_to_notify";