import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),
  DATABASE_READ_URL: z.string().url().optional(),

  REDIS_URL: z.string().url(),

  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default("0.0.0.0"),

  NEXT_PUBLIC_API_URL: z.string().url().optional(),

  AUTH_SECRET: z.string().optional(),

  AGENT_API_URL: z.string().url().optional(),
  AGENT_SAMPLE_INTERVAL: z.string().default("5s"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const msg = Object.entries(flat)
      .map(([k, v]) => `  ${k}: ${v?.join(", ")}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${msg}`);
  }
  cached = parsed.data;
  return cached;
}

export const env = new Proxy({} as Env, {
  get(_t, prop: string) {
    return loadEnv()[prop as keyof Env];
  },
});
