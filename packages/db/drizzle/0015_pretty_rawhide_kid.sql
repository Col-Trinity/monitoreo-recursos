ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."role";--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "revoked_at" timestamp with time zone;