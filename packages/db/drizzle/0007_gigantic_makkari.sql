ALTER TABLE "alerts_rules" RENAME COLUMN "project_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "alert_events" DROP CONSTRAINT "alert_events_project_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_events" DROP CONSTRAINT "alert_events_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "alerts_rules" DROP CONSTRAINT "alerts_rules_project_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "resource_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."resource_type";--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('user', 'workspace', 'agent', 'alert', 'membership');--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "resource_type" SET DATA TYPE "public"."resource_type" USING "resource_type"::"public"."resource_type";--> statement-breakpoint
ALTER TABLE "alert_events" ADD COLUMN "user_id_to_notify" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_events" ADD COLUMN "ack_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_user_id_to_notify_users_id_fk" FOREIGN KEY ("user_id_to_notify") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD CONSTRAINT "alerts_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "alert_events" DROP COLUMN "user_id";