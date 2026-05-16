import type { FastifyPluginAsync } from "fastify"
import type { Queue } from "bullmq"
import type { EventEmitter } from "node:events"
import { agentsTable } from "@watchdog/db/schema"
import { eq } from "drizzle-orm"
import { dbRead } from "@watchdog/db"
import { createInterface } from "node:readline"
import { MetricEnvelopeSchema, MetricType } from "@watchdog/shared-types"
import { createHash } from "node:crypto"

const metricsStreamPlugin: FastifyPluginAsync<{
    metricsQueue: Queue
    metricsEmitter: EventEmitter
}> = async (fastify, opts) => {

    const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex")

    fastify.post("/metrics/stream", async (request, reply) => {
        const authHeader = request.headers.authorization
        if (!authHeader) return reply.status(403).send({ error: "API key requerida" })

        const apiKey = authHeader.split("Bearer ")[1]
        if (!apiKey) return reply.status(401).send({ error: "Formato inválido" })

        const [agent] = await dbRead()
            .select()
            .from(agentsTable)
            .where(eq(agentsTable.apiKey, hashApiKey(apiKey)))
        if (!agent) return reply.status(401).send({ error: "API key inválida" })


        const rl = createInterface({ input: request.body as NodeJS.ReadableStream })

        rl.on("line", async (line) => {
            const parsed = MetricEnvelopeSchema.safeParse(JSON.parse(line))
            if (!parsed.success) return

            const envelope = parsed.data
            const hostName = envelope.host
            const cpuPercentage = envelope.type === MetricType.CPU ? envelope.value.usage : 0

            await opts.metricsQueue.add("new_metric", {
                agentId: agent.id,
                metricsType: envelope.type,
                cpuPercentage,
                hostName,
            })

            opts.metricsEmitter.emit("metric", {
                type: "metric",
                data: {
                    cpuPercentage,
                    hostName,
                    createdAt: new Date(envelope.timestamp).toISOString(),
                },
            })
        })

        await new Promise<void>((resolve) => {
            rl.on("close", resolve)  // agente cerró limpiamente
            rl.on("error", resolve)  // agente se cayó
        })
        return reply.status(200).send({ message: "stream closed" })
    })
}

export default metricsStreamPlugin