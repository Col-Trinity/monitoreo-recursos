ALTER TABLE "agents" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memberships" DROP COLUMN "revoked_at";