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
import { eq, and, gt, avg } from "drizzle-orm";
import { createActionHandler } from "../alerts/actions/factory";
import { ActionType } from "@watchdog/shared-types";

interface RuleAction {
    type: ActionType;
    config: Record<string, unknown>;
}

const QUEUE_NAME = "alert-evaluator";

function meetsCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
        case "gt": return value > threshold;
        case "lt": return value < threshold;
        case "eq": return value === threshold;
        case "gte": return value >= threshold;
        case "lte": return value <= threshold;
        default: return false;
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
            const sinceMs = Date.now() - rule.durationSeconds * 1000;

            logger.info({ ruleId: rule.id, metricType: rule.metricType }, "evaluating rule");

            const metrics = await dbRead()
                .select({
                    avg: avg(metrics1mView.avgValue),
                    agentId: metrics1mView.agentId,
                })
                .from(metrics1mView)
                .where(
                    and(
                        eq(metrics1mView.metricsType, rule.metricType),
                        gt(metrics1mView.bucketStart, new Date(sinceMs)),
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
                                await createActionHandler(action.type).execute({ rule, event }, action.config);
                                await dbWrite().insert(alertEventActionsTable).values({
                                    alertEventId: event.id,
                                    actionType: action.type,
                                    status: "sent",
                                });
                                logger.info({ ruleId: rule.id, agentId, actionType: action.type }, "alert action sent");
                            } catch (err) {
                                await dbWrite().insert(alertEventActionsTable).values({
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