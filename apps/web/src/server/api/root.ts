import { authRouter } from "./routers/auth";
import { invitationsRouter } from "./routers/invitations";
import { metricsRouter } from "./routers/metrics";
import { userWorkspacesRouter } from "./routers/workspace";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { agentsRouter } from "./routers/agents";
/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  metrics: metricsRouter,
  auth: authRouter,
  workspaces: userWorkspacesRouter,
  invitations: invitationsRouter,
  agents: agentsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
