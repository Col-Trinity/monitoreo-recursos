"use client";

import { FlagProvider } from "@unleash/proxy-client-react";
import { env } from "@/env";
export function UnleashProvider({ children }: { children: React.ReactNode }) {
  if (
    env.NEXT_PUBLIC_UNLEASH_API_URL === undefined ||
    env.NEXT_PUBLIC_UNLEASH_FRONTEND_TOKEN === undefined
  ) {
    return children;
  }

  return (
    <FlagProvider
      config={{
        url: env.NEXT_PUBLIC_UNLEASH_API_URL,
        clientKey: env.NEXT_PUBLIC_UNLEASH_FRONTEND_TOKEN,
        appName: "watchdog-web",
      }}
    >
      {children}
    </FlagProvider>
  );
}