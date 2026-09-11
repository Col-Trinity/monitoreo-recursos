import type { ActionHandler } from "./types";

interface WebhookActionConfig {
  url: string;
}

const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createWebhookAction(): ActionHandler<WebhookActionConfig> {
  return {
    execute: async (params, config) => {
      const payload = {
        ruleName: params.rule.name,
        metricType: params.rule.metricType,
        agentId: params.event.agentId,
        triggerValue: params.event.triggerValue,
        operator: params.rule.operator,
        threshold: params.rule.threshold,
        startedAt: params.event.startedAt,
      };

      let lastError: Error = new Error("Webhook: no se pudo enviar tras reintentos");

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let res: Response;
        try {
          res = await fetch(config.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch (cause) {
          // Falla de red: puede ser algo pasajero, vale la pena reintentar.
          lastError = new Error(`Webhook network error: ${String(cause)}`);
          if (attempt < MAX_ATTEMPTS) await sleep(200 * attempt);
          continue;
        }

        if (res.ok) return;

        if (res.status < 500) {
          // Error del cliente: el request está mal armado.
          throw new Error(`Webhook responded with ${res.status} ${res.statusText}`);
        }

        // Error del servidor: puede ser algo pasajero, vale la pena reintentar.
        lastError = new Error(`Webhook responded with ${res.status} ${res.statusText}`);
        if (attempt < MAX_ATTEMPTS) await sleep(200 * attempt);
      }

      throw lastError;
    },
  };
}
