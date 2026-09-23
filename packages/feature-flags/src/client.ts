import { initialize, type Unleash } from "unleash-client";

let client: Unleash | null = null;

export function initFlags(config: { url: string; token: string; appName: string }) {
  client = initialize({
    url: config.url,
    appName: config.appName,
    customHeaders: { Authorization: config.token },
  });
  return client;
}

export function getClient(): Unleash {
  if (!client) throw new Error("Feature flags no inicializados: llamá initFlags() en el boot");
  return client;
}