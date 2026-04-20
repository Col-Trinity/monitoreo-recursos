import "server-only";
import { dbRead, dbWrite } from "@watchdog/db";

export const db = dbRead();
export const dbW = dbWrite();
export { metricsTable, type Metric, type NewMetric } from "@watchdog/db";
