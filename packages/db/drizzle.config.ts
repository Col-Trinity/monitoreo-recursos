import { defineConfig } from "drizzle-kit";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile("../../.env");
} catch {}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: "snake_case",
});
