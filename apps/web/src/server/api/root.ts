import { authRouter } from "./routers/auth";
import { invitationsRouter } from "./routers/invitations";
import { metricsRouter } from "./routers/metrics";
import { userWorkspacesRouter } from "./routers/workspace";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { agentsRouter } from "./routers/agents";
import { auditLogRouter } from "./routers/auditLog";

export const appRouter = createTRPCRouter({
  metrics: metricsRouter,
  auth: authRouter,
  workspaces: userWorkspacesRouter,
  invitations: invitationsRouter,
  agents: agentsRouter,
  auditLog: auditLogRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);