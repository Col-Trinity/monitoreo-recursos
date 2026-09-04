import pino from "pino";
import { env } from "@watchdog/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  base: { service: "worker" },
});
