import type { ActionHandler } from "./types";

interface DiscordActionConfig {
  url: string;
}

const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDiscordAction(): ActionHandler<DiscordActionConfig> {
  return {
    execute: async (params, config) => {
      const embed = {
        title: `🚨 Alerta: ${params.rule.name}`,
        color: 0xff0000,
        fields: [
          { name: "Métrica",   value: params.rule.metricType,                              inline: true  },
          { name: "Agente",    value: params.event.agentId,                                inline: true  },
          { name: "Valor",     value: String(params.event.triggerValue),                   inline: true  },
          { name: "Condición", value: `${params.rule.operator} ${params.rule.threshold}`,  inline: true  },
          { name: "Desde",     value: params.event.startedAt.toISOString(),                inline: false },
        ],
      };

      const payload = { embeds: [embed] };

      let lastError: Error = new Error("Discord: no se pudo enviar tras reintentos");

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
          lastError = new Error(`Discord network error: ${String(cause)}`);
          if (attempt < MAX_ATTEMPTS) await sleep(200 * attempt);
          continue;
        }

        if (res.ok) return;

        if (res.status < 500) {
          // Error del cliente: el request está mal armado.
          throw new Error(`Discord responded with ${res.status} ${res.statusText}`);
        }

        // Error del servidor: puede ser algo pasajero, vale la pena reintentar.
        lastError = new Error(`Discord responded with ${res.status} ${res.statusText}`);
        if (attempt < MAX_ATTEMPTS) await sleep(200 * attempt);
      }

      throw lastError;
    },
  };
}