ALTER TYPE "public"."operator_enum" RENAME TO "operator";--> statement-breakpoint
ALTER TABLE "alerts_rules" RENAME TO "alert_rules";--> statement-breakpoint
ALTER TABLE "alert_events" DROP CONSTRAINT "alert_events_alert_rule_id_alerts_rules_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_rules" DROP CONSTRAINT "alerts_rules_agent_id_agents_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_rules" DROP CONSTRAINT "alerts_rules_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_rules" DROP CONSTRAINT "alerts_rules_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;