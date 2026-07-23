import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { dbW } from "@/server/db";
import { agentsTable } from "@watchdog/db";
import { randomBytes, createHash } from "node:crypto";

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
    .mutation(async ({ input }) => {
      const plainKey = "wd_" + randomBytes(32).toString("hex");
      const hashedKey = hashApiKey(plainKey);

      const [agent] = await dbW
        .insert(agentsTable)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          apiKey: hashedKey,
        })
        .returning({ id: agentsTable.id, name: agentsTable.name });

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

  rotate: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
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
      await dbW
        .update(agentsTable)
        .set({ apiKey: hashedKey })
        .where(eq(agentsTable.id, input.agentId));

      // 5. Retornamos la nueva key en plaintext UNA SOLA VEZ
      return { apiKey: plainKey };
    }),
  revoke: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
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

      await dbW
        .update(agentsTable)
        .set({ revokedAt: new Date() })
        .where(eq(agentsTable.id, input.agentId));

      return { success: true };
    }),
});
