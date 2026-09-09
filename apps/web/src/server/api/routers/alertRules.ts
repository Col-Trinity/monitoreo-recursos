import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { dbW } from "@/server/db";
import { z } from "zod";
import { alertRulesTable } from "@watchdog/db";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const alertActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("email"), config: z.object({ to: z.string().email() }) }),
  z.object({ type: z.literal("webhook"), config: z.object({ url: z.string().url() }) }),
  z.object({ type: z.literal("betterstack"), config: z.object({ incident_name: z.string().min(1) }) }),
]);

const alertRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  metricType: z.enum(["cpu", "memory", "disk", "network"]),
  scope: z.string().uuid().nullable(),
  operator: z.enum(["gt", "lt", "eq", "gte", "lte"]),
  threshold: z.number().positive(),
  durationSeconds: z.number().int().positive(),
  actions: z.array(alertActionSchema).min(1),
});

export const alertRulesRouter = createTRPCRouter({
  list: adminProcedure
    .query(async ({ ctx }) => {
      return await dbW
        .select()
        .from(alertRulesTable)
        .where(eq(alertRulesTable.workspaceId, ctx.workspace.id));
    }),
  create: adminProcedure
    .input(alertRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const [rule] = await dbW
        .insert(alertRulesTable)
        .values({
          workspaceId: ctx.workspace.id,
          createdBy: ctx.session.user.id,
          name: input.name,
          description: input.description,
          metricType: input.metricType,
          agentId: input.scope,
          operator: input.operator,
          threshold: input.threshold,
          durationSeconds: input.durationSeconds,
          actions: input.actions,
          enabled: true,
        })
        .returning();

      if (!rule) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No se pudo crear la regla",
        });
      }

      return rule;
    }),
  update: adminProcedure
    .input(alertRuleSchema.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [rule] = await dbW
        .update(alertRulesTable)
        .set({
          name: input.name,
          description: input.description,
          metricType: input.metricType,
          agentId: input.scope,
          operator: input.operator,
          threshold: input.threshold,
          durationSeconds: input.durationSeconds,
          actions: input.actions,
        })
        .where(
          eq(alertRulesTable.id, input.id),
        )
        .returning();

      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return rule;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [rule] = await dbW
        .delete(alertRulesTable)
        .where(
          eq(alertRulesTable.id, input.id),
        )
        .returning();

      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return rule;
    }),

  toggleEnabled: adminProcedure
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [rule] = await dbW
        .update(alertRulesTable)
        .set({
          enabled: input.enabled,
        })
        .where(
          eq(alertRulesTable.id, input.id),
        )
        .returning();

      if (!rule) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return rule;
    }),
})
