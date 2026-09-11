import type { ActionHandler } from "./types";
import { env } from "@watchdog/env";

interface BetterstackActionConfig {
  requesterEmail: string;
}

const BETTERSTACK_INCIDENTS_URL = "https://uptime.betterstack.com/api/v3/incidents";

export function createBetterstackAction(): ActionHandler<BetterstackActionConfig> {
  return {
    execute: async (params, config) => {
      const payload = {
        summary: `${params.rule.name} - ${params.rule.metricType}`,
        requester_email: config.requesterEmail,
        description: `Valor: ${params.event.triggerValue} (umbral: ${params.rule.operator} ${params.rule.threshold})`,
      };

      let res: Response;
      try {
        res = await fetch(BETTERSTACK_INCIDENTS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.BETTERSTACK_API_TOKEN}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (cause) {
        throw new Error(`Betterstack network error: ${String(cause)}`);
      }

      if (!res.ok) {
        throw new Error(`Betterstack responded with ${res.status} ${res.statusText}`);
      }
    },
  };
}
