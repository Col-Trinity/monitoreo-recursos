import type { ActionHandler } from "./types";
import { Resend } from "resend";
import { env } from "@watchdog/env";
interface EmailActionConfig {
  to: string;
}

export function createEmailAction(): ActionHandler<EmailActionConfig> {
  const resend = new Resend(env.RESEND_API_KEY);
  return {
    execute: async (params, config) => {
      let result: Awaited<ReturnType<Resend["emails"]["send"]>>;
      try {
        result = await resend.emails.send({
          from: "Watch-Dog <noreply@watchdog.daztanllc.com>",
          to: config.to,
          subject: `Alerta: ${params.rule.name} - ${params.rule.metricType}`,
          html: `
        <h1>Alerta disparada: ${params.rule.name}</h1>
<p>La métrica <strong>${params.rule.metricType}</strong> del agente <strong>${params.event.agentId}</strong> cumplió la condición configurada.</p>
<p>Valor registrado: <strong>${params.event.triggerValue}</strong> (umbral: ${params.rule.operator} ${params.rule.threshold})</p>
<p>Disparado el: ${params.event.startedAt}</p>
      `,
        });
      } catch (cause) {
        throw new Error(`Resend network error: ${String(cause)}`);
      }

      if (result.error) {
        throw new Error(`Resend error: ${result.error.message}`);
      }
    },
  };
}
