import { defineConfig } from "drizzle-kit";
import { env } from "@watchdog/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  casing: "snake_case",
});
