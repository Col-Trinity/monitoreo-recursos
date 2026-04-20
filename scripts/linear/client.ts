import { LinearClient } from "@linear/sdk";

export function makeClient(): LinearClient {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LINEAR_API_KEY missing. Add it to .env (personal API key from https://linear.app/settings/api).",
    );
  }
  return new LinearClient({ apiKey });
}
