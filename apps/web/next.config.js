// Load root monorepo .env BEFORE Next picks up its own env handling.
// Single source of truth across apps.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, "../../.env") });

await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  transpilePackages: [
    "@watchdog/db",
    "@watchdog/env",
    "@watchdog/shared-types",
  ],
};

export default config;
