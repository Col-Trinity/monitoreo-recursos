import { Worker, type Job } from "bullmq";
import { type Redis } from "ioredis";
import { logger } from "../logger";
import {
  dbRead,
  dbWrite,
  alertRulesTable,
  alertEventsTable,
  alertEventActionsTable,
  metrics1mView,
} from "@watchdog/db";
import { eq, and, gte, avg, max } from "drizzle-orm";
import { createActionHandler } from "../alerts/actions/factory";
import { resolveBetterstackIncident } from "../alerts/actions/betterstack";
import { ActionType } from "@watchdog/shared-types";

interface RuleAction {
  type: ActionType;
  config: Record<string, unknown>;
}

const QUEUE_NAME = "alert-evaluator";

// metrics_1m es una continuous aggregate creada con end_offset => INTERVAL '1 minute'
// (packages/db/drizzle/0020_living_skin.sql), asi que el minuto en curso nunca esta
// materializado y el bucket mas nuevo va 1-3 min atras de now(). Por eso la ventana se
// ancla al ultimo bucket disponible y no a now(): medida contra now(), una regla con
// durationSeconds menor al lag consulta un rango vacio y jamas puede disparar.

function meetsCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "lt":
      return value < threshold;
    case "eq":
      return value === threshold;
    case "gte":
      return value >= threshold;
    case "lte":
      return value <= threshold;
    default:
      return false;
  }
}

async function evaluate(_job: Job) {
  logger.info("evaluating alert rules");

  const rules = await dbRead()
    .select()
    .from(alertRulesTable)
    .where(eq(alertRulesTable.enabled, true));

  logger.info({ count: rules.length }, "rules loaded");
  for (const rule of rules) {
    try {
      // Ancla: el bucket mas reciente ya materializado para esta metrica.
      const [latest] = await dbRead()
        .select({ bucketStart: max(metrics1mView.bucketStart) })
        .from(metrics1mView)
        .where(
          and(
            eq(metrics1mView.metricsType, rule.metricType),
            rule.agentId ? eq(metrics1mView.agentId, rule.agentId) : undefined,
          ),
        );

      if (!latest?.bucketStart) {
        logger.info(
          { ruleId: rule.id, metricType: rule.metricType },
          "no metrics yet, skipping rule",
        );
        continue;
      }

      const windowStart = new Date(
        new Date(latest.bucketStart).getTime() - rule.durationSeconds * 1000,
      );

      logger.info(
        {
          ruleId: rule.id,
          metricType: rule.metricType,
          windowStart,
          latestBucket: latest.bucketStart,
        },
        "evaluating rule",
      );

      const metrics = await dbRead()
        .select({
          avg: avg(metrics1mView.avgValue),
          agentId: metrics1mView.agentId,
        })
        .from(metrics1mView)
        .where(
          and(
            eq(metrics1mView.metricsType, rule.metricType),
            gte(metrics1mView.bucketStart, windowStart),
            rule.agentId ? eq(metrics1mView.agentId, rule.agentId) : undefined,
          ),
        )
        .groupBy(metrics1mView.agentId);

      for (const agentMetric of metrics) {
        const avgValue = Number(agentMetric.avg ?? 0);
        const agentId = agentMetric.agentId;

        const firing = meetsCondition(avgValue, rule.operator, rule.threshold);
        logger.info({ ruleId: rule.id, agentId, avgValue, firing }, "condition evaluated");

        const [activeFiring] = await dbRead()
          .select()
          .from(alertEventsTable)
          .where(
            and(
              eq(alertEventsTable.alertRuleId, rule.id),
              eq(alertEventsTable.agentId, agentId),
              eq(alertEventsTable.status, "active"),
            ),
          );

        if (firing && !activeFiring) {
          const [event] = await dbWrite()
            .insert(alertEventsTable)
            .values({
              alertRuleId: rule.id,
              agentId: agentId,
              triggerValue: avgValue,
              status: "active",
            })
            .returning();
          logger.info({ ruleId: rule.id, agentId, avgValue }, "alert fired");

          if (event) {
            // TODO: rule.actions is jsonb with no runtime validation — this cast trusts
            // that every entry's `type` matches ActionType. Consider validating (e.g. Zod)
            // before it reaches createActionHandler.
            const actions = (rule.actions ?? []) as RuleAction[];
            for (const action of actions) {
              try {
                const result = await createActionHandler(action.type).execute(
                  { rule, event },
                  action.config,
                );
                await dbWrite().insert(alertEventActionsTable).values({
                  alertEventId: event.id,
                  actionType: action.type,
                  status: "sent",
                });
                logger.info(
                  { ruleId: rule.id, agentId, actionType: action.type },
                  "alert action sent",
                );

                // betterstack devuelve el id del incidente: lo guardamos para
                // poder cerrarlo cuando la alerta se resuelva.
                if (action.type === ActionType.BETTERSTACK && typeof result === "string") {
                  await dbWrite()
                    .update(alertEventsTable)
                    .set({ betterstackIncidentId: result })
                    .where(eq(alertEventsTable.id, event.id));
                }
              } catch (err) {
                await dbWrite()
                  .insert(alertEventActionsTable)
                  .values({
                    alertEventId: event.id,
                    actionType: action.type,
                    status: "failed",
                    error: err instanceof Error ? err.message : String(err),
                  });
                logger.error(
                  { ruleId: rule.id, agentId, actionType: action.type, err },
                  "error running alert action",
                );
              }
            }
          }
        }

        if (!firing && activeFiring) {
          await dbWrite()
            .update(alertEventsTable)
            .set({ status: "resolved", resolvedAt: new Date() })
            .where(eq(alertEventsTable.id, activeFiring.id));
          logger.info({ ruleId: rule.id, agentId, firingId: activeFiring.id }, "alert resolved");

          if (activeFiring.betterstackIncidentId) {
            try {
              await resolveBetterstackIncident(activeFiring.betterstackIncidentId);
              logger.info({ ruleId: rule.id, agentId }, "betterstack incident resolved");
            } catch (err) {
              logger.error(
                { ruleId: rule.id, agentId, err },
                "error resolving betterstack incident",
              );
            }
          }
        }
      }
    } catch (err) {
      logger.error({ ruleId: rule.id, err }, "error evaluating rule");
    }
  }
}

export function createAlertEvaluator(connection: Redis): Worker {
  return new Worker(QUEUE_NAME, evaluate, {
    connection,
    concurrency: 1,
  });
}
