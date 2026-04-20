import { env } from "@watchdog/env";
import { createDb, type Db } from "./client";

export { createDb, type Db } from "./client";
export { metricsTable, type Metric, type NewMetric } from "./schema/metrics";

let _dbWrite: Db | undefined;
let _dbRead: Db | undefined;

export function dbWrite(): Db {
  if (!_dbWrite) _dbWrite = createDb(env.DATABASE_URL);
  return _dbWrite;
}

export function dbRead(): Db {
  if (!_dbRead) {
    _dbRead = createDb(env.DATABASE_READ_URL ?? env.DATABASE_URL);
  }
  return _dbRead;
}
