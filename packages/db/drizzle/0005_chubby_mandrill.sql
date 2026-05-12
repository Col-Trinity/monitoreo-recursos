ALTER TABLE "users" ALTER COLUMN "language" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."language";--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'es', 'pt');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "language" SET DATA TYPE "public"."language" USING "language"::"public"."language";