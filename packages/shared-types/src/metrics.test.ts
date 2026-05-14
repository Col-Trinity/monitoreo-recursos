import { describe, it, expect } from "vitest"
import { MetricEnvelopeSchema } from "./metrics"

describe("MetricEnvelopeSchema", () => {
  it("should validate a valid CPU metric", () => {
    const metric = {
      type: "cpu",
      timestamp: 1778779763566,
      host: "server-local",
      value: {
        usage: 23,
      },
    }
    const result = MetricEnvelopeSchema.safeParse(metric)
    expect(result.success).toBe(true)
  })

  it("should reject an invalid metric type", () => {
    const metric = {
      type: "banana",
      timestamp: 1778779763566,
      host: "server-local",
      value: {
        usage: 23,
      },
    }
    const result = MetricEnvelopeSchema.safeParse(metric)
    expect(result.success).toBe(false)
  })

  it("should reject an invalid value metric", () => {
    const metric = {
      type: "cpu",
      timestamp: 1778779763566,
      host: "server-local",
      value: {
        disponible: 23,
      },
    }
    const result = MetricEnvelopeSchema.safeParse(metric)
    expect(result.success).toBe(false)
  })
})