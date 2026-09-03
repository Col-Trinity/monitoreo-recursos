ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "resource_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "resource_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "resource_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "resource_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "action" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "ip_address";--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "user_agent";--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "changes";--> statement-breakpoint
DROP TYPE "public"."action";--> statement-breakpoint
DROP TYPE "public"."resource_type";