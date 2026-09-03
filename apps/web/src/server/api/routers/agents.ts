import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, workspaceProcedure } from "@/server/api/trpc";
import { dbW } from "@/server/db";
import { agentsTable } from "@watchdog/db";
import { randomBytes, createHash } from "node:crypto";
import { audit } from "@/server/audit";

const hashApiKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");

export const agentsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plainKey = "wd_" + randomBytes(32).toString("hex");
      const hashedKey = hashApiKey(plainKey);

      const agent = await dbW.transaction(async (tx) => {
        const [agent] = await tx
          .insert(agentsTable)
          .values({
            workspaceId: input.workspaceId,
            name: input.name,
            description: input.description,
            apiKey: hashedKey,
          })
          .returning({ id: agentsTable.id, name: agentsTable.name });

        if (!agent) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No se pudo crear el agente",
          });
        }

        await audit(tx, ctx, {
          workspaceId: input.workspaceId,
          action: "apikey.created",
          resource: { type: "agent", id: agent.id },
        });
        return agent;
      });
      // NA SOLA VEZ
      return { agent, apiKey: plainKey };
    }),
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await dbW
        .select({
          id: agentsTable.id,
          name: agentsTable.name,
          description: agentsTable.description,
          active: agentsTable.active,
          lastHeartbeat: agentsTable.lastHeartbeat,
          createdAt: agentsTable.createdAt,
          revokedAt: agentsTable.revokedAt,
        })
        .from(agentsTable)
        .where(
          and(
            eq(agentsTable.workspaceId, input.workspaceId),
            isNull(agentsTable.deletedAt),
          ),
        );
    }),

  getById: workspaceProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [agent] = await dbW
        .select({
          id: agentsTable.id,
          name: agentsTable.name,
          description: agentsTable.description,
          active: agentsTable.active,
          lastHeartbeat: agentsTable.lastHeartbeat,
          createdAt: agentsTable.createdAt,
          revokedAt: agentsTable.revokedAt,
        })
        .from(agentsTable)
        .where(
          and(
            eq(agentsTable.id, input.agentId),
            eq(agentsTable.workspaceId, ctx.workspace.id),
            isNull(agentsTable.deletedAt),
          ),
        );

      if (!agent) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return agent;
    }),

  rotate: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verificamos que el agente existe y no está revocado
      const [agent] = await dbW
        .select()
        .from(agentsTable)
        .where(
          and(
            eq(agentsTable.id, input.agentId),
            isNull(agentsTable.revokedAt),
            isNull(agentsTable.deletedAt),
          ),
        );

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agente no encontrado o revocado",
        });
      }

      // 2. Generamos una nueva key
      const plainKey = "wd_" + randomBytes(32).toString("hex");

      // 3. La hasheamos
      const hashedKey = hashApiKey(plainKey);

      // 4. Reemplazamos el hash viejo
      await dbW.transaction(async (tx) => {
        await tx
          .update(agentsTable)
          .set({ apiKey: hashedKey })
          .where(eq(agentsTable.id, input.agentId));

        await audit(tx, ctx, {
          workspaceId: agent.workspaceId,
          action: "apikey.rotated",
          resource: { type: "agent", id: input.agentId },
        });
      });

      // 5. Retornamos la nueva key en plaintext UNA SOLA VEZ
      return { apiKey: plainKey };
    }),
  revoke: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [agent] = await dbW
        .select()
        .from(agentsTable)
        .where(
          and(
            eq(agentsTable.id, input.agentId),
            isNull(agentsTable.revokedAt),
            isNull(agentsTable.deletedAt),
          ),
        );

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agente no encontrado o ya revocado",
        });
      }
      await dbW.transaction(async (tx) => {
        await tx
          .update(agentsTable)
          .set({ revokedAt: new Date() })
          .where(eq(agentsTable.id, input.agentId));

        await audit(tx, ctx, {
          workspaceId: agent.workspaceId,
          action: "apikey.revoked",
          resource: { type: "agent", id: input.agentId },
        });
      });

      return { success: true };
    }),
});
