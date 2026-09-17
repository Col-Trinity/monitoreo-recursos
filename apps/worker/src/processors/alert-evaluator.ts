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

// Ancho del bucket de metrics_1m (time_bucket('1 minute', ...)).
const BUCKET_SECONDS = 60;

// Inicio de la ventana de evaluacion, dado el ultimo bucket materializado.
//
// El filtro de abajo usa gte, o sea que el bucket que cae justo en windowStart TAMBIEN
// entra. Restar durationSeconds a secas metia un bucket de mas: una regla de 60s
// promediaba 2 buckets (120s de datos) y una de 300s promediaba 6. Ese bucket viejo
// extra diluye el promedio y retrasa el disparo, asi que se descuenta un bucket para
// que el borde inclusivo caiga donde corresponde: 60s => 1 bucket, 300s => 5.
export function windowStartFor(latestBucket: Date, durationSeconds: number): Date {
  return new Date(latestBucket.getTime() - (durationSeconds - BUCKET_SECONDS) * 1000);
}

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

// Cierra los eventos abiertos de una regla. Si se pasa agentId cierra solo los de ese
// agente; sin agentId cierra todos (caso: la regla quedo deshabilitada).
async function resolveOpenEvents(ruleId: string, agentId?: string) {
  const open = await dbRead()
    .select()
    .from(alertEventsTable)
    .where(
      and(
        eq(alertEventsTable.alertRuleId, ruleId),
        eq(alertEventsTable.status, "active"),
        agentId ? eq(alertEventsTable.agentId, agentId) : undefined,
      ),
    );

  for (const event of open) {
    await dbWrite()
      .update(alertEventsTable)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(alertEventsTable.id, event.id));
    logger.info({ ruleId, agentId: event.agentId, firingId: event.id }, "alert resolved");

    if (event.betterstackIncidentId) {
      try {
        await resolveBetterstackIncident(event.betterstackIncidentId);
        logger.info({ ruleId, agentId: event.agentId }, "betterstack incident resolved");
      } catch (err) {
        logger.error(
          { ruleId, agentId: event.agentId, err },
          "error resolving betterstack incident",
        );
      }
    }
  }
}

async function evaluate(_job: Job) {
  logger.info("evaluating alert rules");

  // Se cargan todas las reglas, no solo las habilitadas: una regla deshabilitada ya no
  // dispara, pero sus eventos abiertos necesitan cerrarse (si no, quedan en active para
  // siempre y el incidente de Betterstack nunca se resuelve).
  const rules = await dbRead().select().from(alertRulesTable);

  logger.info({ count: rules.length }, "rules loaded");
  for (const rule of rules) {
    try {
      if (!rule.enabled) {
        await resolveOpenEvents(rule.id);
        continue;
      }

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

      const windowStart = windowStartFor(new Date(latest.bucketStart), rule.durationSeconds);

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
          await resolveOpenEvents(rule.id, agentId);
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
