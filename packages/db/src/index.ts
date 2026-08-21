import { env } from "@watchdog/env";
import { createDb, type Db } from "./client";

export { createDb, type Db } from "./client";
export {
  metricsTable,
  metrics1mView,
  metrics1hView,
  metrics1dView,
  type Metric,
  type NewMetric,
} from "./schema/metrics";
export {
  usersTable,
  sessionsTable,
  verificationTokensTable,
  accountsTable,
  type User,
  type NewUser,
  type Session,
  type NewSession,
  type VerificationToken,
  type NewVerificationToken,
  type Account,
  type NewAccount,
} from "./schema/auth";

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

export { invitationsTable, type Invitation, type NewInvitation } from "./schema/auth";

export {
  membershipsTable,
  workspacesTable,
  agentsTable,
  type Agent,
  type NewAgent,
  type Workspace,
  type NewWorkspace,
} from "./schema/tenancy";
