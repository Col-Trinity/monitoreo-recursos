import { type preHandlerAsyncHookHandler, type FastifyPluginAsync } from "fastify";
import { agentsTable, workspacesTable, type Agent, type Workspace } from "@watchdog/db";
import { eq } from "drizzle-orm";
import { dbWrite } from "@watchdog/db";
import { createHash } from "node:crypto";

declare module "fastify" {
  interface FastifyRequest {
    agent: Agent | null;
    workspace: Workspace | null;
  }
}
const authAgentPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("agent", null);
  fastify.decorateRequest("workspace", null);
};

export const authenticateAgent: preHandlerAsyncHookHandler = async (request, reply) => {
  const authorization = request.headers.authorization;
  if (!authorization) return reply.status(401).send({ error: "API key requerida" });

  const apiKey = authorization.split("Bearer ")[1];
  if (!apiKey) return reply.status(401).send({ error: "Formato inválido" });

  const hash = createHash("sha256").update(apiKey).digest("hex");
  const [agent] = await dbWrite().select().from(agentsTable).where(eq(agentsTable.apiKey, hash));

  if (!agent) return reply.status(401).send({ error: "API key inválida" });

  if (agent.revokedAt) return reply.status(403).send({ error: "Agente revocado" });

  const [workspace] = await dbWrite()
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, agent.workspaceId));

  if (!workspace) return reply.status(401).send({ error: "Workspace no encontrado" });

  request.agent = agent;
  request.workspace = workspace;
};

export default authAgentPlugin;
