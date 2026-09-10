import { Worker, type Job } from "bullmq";
import { type Redis } from "ioredis";
import { logger } from "../logger";
import { dbRead, dbWrite, alertRulesTable, alertEventsTable, metrics1mView } from "@watchdog/db";
import { eq, and, isNull, gt, lt, gte, lte, avg } from "drizzle-orm";
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
        const since = new Date(Date.now() - rule.durationSeconds * 1000);

        // query métricas del período
        const metrics = await dbRead()
            .select({
                avg: avg(metrics1mView.avgValue),
                agentId: metrics1mView.agentId,
            })
            .from(metrics1mView)
            .where(
                and(
                    eq(metrics1mView.metricsType, rule.metricType),
                    gt(metrics1mView.bucketStart, since),
                    rule.agentId
                        ? eq(metrics1mView.agentId, rule.agentId)
                        : undefined,
                ),
            );
        const avgValue = Number(metrics[0]?.avg ?? 0);
        logger.info({ ruleId: rule.id, avgValue }, "metric evaluated");

        const firing = meetsCondition(avgValue, rule.operator, rule.threshold);
        logger.info({ ruleId: rule.id, avgValue, firing }, "condition evaluated");

        // Paso 4: buscar firing activo
        const [activeFiring] = await dbRead()
            .select()
            .from(alertEventsTable)
            .where(
                and(
                    eq(alertEventsTable.alertRuleId, rule.id),
                    eq(alertEventsTable.status, "active"),
                ),
            );

        if (firing && !activeFiring) {
            // Crear nuevo firing
            await dbWrite()
                .insert(alertEventsTable)
                .values({
                    alertRuleId: rule.id,
                    agentId: metrics[0]?.agentId ?? rule.agentId ?? "",
                    triggerValue: avgValue,
                    status: "active",
                });
            logger.info({ ruleId: rule.id, avgValue }, "alert fired");
        }

        if (!firing && activeFiring) {
            // Resolver firing activo
            await dbWrite()
                .update(alertEventsTable)
                .set({
                    status: "resolved",
                    resolvedAt: new Date(),
                })
                .where(eq(alertEventsTable.id, activeFiring.id));
            logger.info({ ruleId: rule.id, firingId: activeFiring.id }, "alert resolved");
        }

    }
}

export function createAlertEvaluator(connection: Redis): Worker {
    return new Worker(QUEUE_NAME, evaluate, {
        connection,
        concurrency: 1,
    });
}