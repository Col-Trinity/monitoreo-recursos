import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWebhookAction } from "../webhook";
import type { AlertEvent, AlertRule } from "@watchdog/db/schema";

const rule = {
  name: "CPU alto",
  metricType: "cpu",
  operator: "gt",
  threshold: 90,
} as AlertRule;

const event = {
  agentId: "agent-1",
  triggerValue: 95,
  startedAt: new Date("2026-09-10T03:00:00Z"),
} as AlertEvent;

describe("createWebhookAction", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("manda un POST con la url y el payload de la alerta", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, statusText: "OK" } as Response);

    const action = createWebhookAction();
    await action.execute({ rule, event }, { url: "https://example.com/hook" });

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("tira un error si el servidor responde con error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);
    const action = createWebhookAction();
    await expect(
      action.execute({ rule, event }, { url: "https://example.com/hook" }),
    ).rejects.toThrow("500");
  });
  it("tira un error si falla la conexión con red", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    const action = createWebhookAction();

    await expect(
      action.execute({ rule, event }, { url: "https://example.com/hook" }),
    ).rejects.toThrow("Webhook network error");
  });
});
