import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { EventEmitter } from "node:events";
import type { Queue } from "bullmq";
import metricsStreamPlugin from "./metrics-stream";

describe("POST /metrics/stream", () => {
  const app = Fastify();

  beforeAll(async () => {
    // agregamos el parser de NDJSON
    app.addContentTypeParser("application/x-ndjson", (_request, payload, done) => {
      done(null, payload);
    });
    // registramos el plugin antes de los tests
    await app.register(metricsStreamPlugin, {
      metricsQueue: {} as unknown as Queue,
      metricsEmitter: new EventEmitter(),
    });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("should reject request without API key", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/metrics/stream",
    });
    expect(response.statusCode).toBe(403);
  });

  it("should reject invalid metric schema", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/metrics/stream",
      headers: {
        "Content-Type": "application/x-ndjson",
        Authorization: "Bearer invalid-key",
      },
      payload: JSON.stringify({ type: "banana", value: {} }) + "\n",
    });
    expect(response.statusCode).toBe(401);
  });
});
