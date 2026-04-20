import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(url: string, opts?: { max?: number }): Db {
  const client = postgres(url, { max: opts?.max ?? 10 });
  return drizzle(client, { schema, casing: "snake_case" });
}
