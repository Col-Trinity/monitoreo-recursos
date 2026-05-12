ALTER TABLE "hosts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "hosts" CASCADE;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'viewer');--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
DROP INDEX "memberships_user_id_idx";--> statement-breakpoint
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_pkey";--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_workspace_id_pk" PRIMARY KEY("user_id","workspace_id");--> statement-breakpoint
ALTER TABLE "memberships" DROP COLUMN "id";