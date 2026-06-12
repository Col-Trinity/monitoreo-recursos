ALTER TABLE "sessions" RENAME COLUMN "expires_at" TO "expires";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "email_verified_at" TO "email_verified";--> statement-breakpoint
DROP INDEX "sessions_expires_at_idx";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "session_token" varchar;--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "session_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD PRIMARY KEY ("session_token");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" varchar;--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires");