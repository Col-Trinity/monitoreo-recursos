CREATE TYPE "public"."action_result_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TABLE "alert_event_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_event_id" uuid NOT NULL,
	"action_type" varchar NOT NULL,
	"status" "action_result_status" NOT NULL,
	"error" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_event_actions" ADD CONSTRAINT "alert_event_actions_alert_event_id_alert_events_id_fk" FOREIGN KEY ("alert_event_id") REFERENCES "public"."alert_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_event_action_event_idx" ON "alert_event_actions" USING btree ("alert_event_id");