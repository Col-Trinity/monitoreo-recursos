import { initialize } from "unleash-client";
import { env } from "@watchdog/env";

let unleashInstance: ReturnType<typeof initialize> | null = null;

function getUnleashClient() {
  if (unleashInstance !== null) {
    return unleashInstance;
  }

  if (env.UNLEASH_BACKEND_TOKEN === undefined || env.UNLEASH_API_URL === undefined) {
    return null;
  }

  unleashInstance = initialize({
    url: env.UNLEASH_API_URL,
    appName: "watchdog-web",
    customHeaders: {
      Authorization: env.UNLEASH_BACKEND_TOKEN,
    },
  });

  return unleashInstance;
}

function waitForUnleashReady(client: ReturnType<typeof initialize>) {
  return new Promise<void>((resolve) => {
    if (client.isSynchronized()) {
      resolve();
      return;
    }

    client.on("ready", () => {
      resolve();
    });
  });
}

async function getReadyUnleashClient() {
  const client = getUnleashClient();

  if (client === null) {
    return null;
  }

  await waitForUnleashReady(client);

  return client;
}

async function isFlagEnabled(flagName: string) {
  const client = await getReadyUnleashClient();

  if (client === null) {
    return false;
  }

  return client.isEnabled(flagName);
}

async function getVariant(flagName: string) {
  const client = await getReadyUnleashClient();

  if (client === null) {
    return { name: "disabled", enabled: false };
  }

  return client.getVariant(flagName);
}

export { isFlagEnabled, getVariant };