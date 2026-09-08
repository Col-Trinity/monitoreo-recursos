CREATE TYPE "public"."operator_enum" AS ENUM('gt', 'lt', 'eq', 'gte', 'lte');--> statement-breakpoint
ALTER TYPE "public"."trigger_type" RENAME TO "metric_type";--> statement-breakpoint
ALTER TABLE "alerts_rules" RENAME COLUMN "created_by_user_id" TO "created_by";--> statement-breakpoint
ALTER TABLE "alerts_rules" RENAME COLUMN "trigger_type" TO "metric_type";--> statement-breakpoint
ALTER TABLE "alerts_rules" DROP CONSTRAINT "alerts_rules_created_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "alerts_rules" ALTER COLUMN "metric_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."metric_type";--> statement-breakpoint
CREATE TYPE "public"."metric_type" AS ENUM('memory', 'disk', 'cpu', 'network');--> statement-breakpoint
ALTER TABLE "alerts_rules" ALTER COLUMN "metric_type" SET DATA TYPE "public"."metric_type" USING "metric_type"::"public"."metric_type";--> statement-breakpoint
ALTER TABLE "alerts_rules" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "alerts_rules" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD COLUMN "name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD COLUMN "description" varchar;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD COLUMN "agent_id" uuid;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD COLUMN "operator" "operator_enum" NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD COLUMN "threshold" real NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD COLUMN "actions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD COLUMN "duration_seconds" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD CONSTRAINT "alerts_rules_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_rules" ADD CONSTRAINT "alerts_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts_rules" DROP COLUMN "notified_user_id";--> statement-breakpoint
ALTER TABLE "alerts_rules" DROP COLUMN "metadata";