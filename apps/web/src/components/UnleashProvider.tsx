"use client";

import { FlagProvider } from "@unleash/proxy-client-react";
import { useSession } from "next-auth/react";
import { env } from "@/env";

export function UnleashProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (
    env.NEXT_PUBLIC_UNLEASH_API_URL === undefined ||
    env.NEXT_PUBLIC_UNLEASH_FRONTEND_TOKEN === undefined
  ) {
    return children;
  }

  if (status === "loading") {
    return children;
  }

  return (
    <FlagProvider
      config={{
        url: env.NEXT_PUBLIC_UNLEASH_API_URL,
        clientKey: env.NEXT_PUBLIC_UNLEASH_FRONTEND_TOKEN,
        appName: "watchdog-web",
        context: {
          userId: session?.user?.email ?? undefined,
        },
      }}
    >
      {children}
    </FlagProvider>
  );
}
