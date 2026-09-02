import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { config as loadDotenv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  testDir: "./tests",
  testMatch: "tests/e2e/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @watchdog/api dev",
      url: "http://localhost:3001/health",
      reuseExistingServer: true, // si ya está corriendo, la reutiliza
      timeout: 180_000,
    },
    {
      command: "pnpm --filter @watchdog/worker dev",
      url: "http://localhost:3002/health",
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command:
        "pnpm build && RESEND_SKIP_SEND=true AUTH_TRUST_HOST=true pnpm start",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
