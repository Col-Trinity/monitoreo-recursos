import type { ActionHandler } from "./types";

interface WebhookActionConfig {
  url: string;
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
      let res: Response;
      try {
        res = await fetch(config.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (cause) {
        throw new Error(`Webhook network error: ${String(cause)}`);
      }

      if (!res.ok) {
        throw new Error(`Webhook responded with ${res.status} ${res.statusText}`);
      }
    },
  };
}
