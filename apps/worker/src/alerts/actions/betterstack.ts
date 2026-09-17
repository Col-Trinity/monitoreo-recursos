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

      const data = await res.json() as { data: { id: string } };
      return data.data.id;
    },
  };
}

// Cierra un incidente ya creado en Better Stack. El evaluator es responsable de
// guardar el id que devuelve create (Better Stack API) y pasarlo acá cuando la
// alerta pase a "resolved".
export async function resolveBetterstackIncident(incidentId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BETTERSTACK_INCIDENTS_URL}/${incidentId}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.BETTERSTACK_API_TOKEN}`,
      },
    });
  } catch (cause) {
    throw new Error(`Betterstack network error: ${String(cause)}`);
  }

  if (!res.ok) {
    throw new Error(`Betterstack responded with ${res.status} ${res.statusText}`);
  }
}
