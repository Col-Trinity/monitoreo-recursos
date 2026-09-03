ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;