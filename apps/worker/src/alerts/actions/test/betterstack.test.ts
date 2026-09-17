import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBetterstackAction, resolveBetterstackIncident } from "../betterstack";
import type { AlertEvent, AlertRule } from "@watchdog/db/schema";

vi.mock("@watchdog/env", () => ({
  env: { BETTERSTACK_API_TOKEN: "test-token" },
}));

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

describe("createBetterstackAction", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("crea un incidente con el summary y el requester_email de la alerta", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      statusText: "Created",
      json: async () => ({ data: { id: "inc-123" } }),
    } as unknown as Response);

    const action = createBetterstackAction();
    await action.execute({ rule, event }, { requesterEmail: "oncall@daztanllc.com" });

    expect(fetch).toHaveBeenCalledWith(
      "https://uptime.betterstack.com/api/v3/incidents",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
        body: expect.stringContaining("CPU alto"),
      }),
    );
  });

  it("tira un error si Better Stack responde con error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
    } as Response);

    const action = createBetterstackAction();

    await expect(
      action.execute({ rule, event }, { requesterEmail: "oncall@daztanllc.com" }),
    ).rejects.toThrow("422");
  });

  it("tira un error si falla la conexión con Better Stack", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    const action = createBetterstackAction();

    await expect(
      action.execute({ rule, event }, { requesterEmail: "oncall@daztanllc.com" }),
    ).rejects.toThrow("Betterstack network error");
  });
});

describe("resolveBetterstackIncident", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("resuelve el incidente pegándole al endpoint /resolve con su id", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, statusText: "OK" } as Response);

    await resolveBetterstackIncident("123456789");

    expect(fetch).toHaveBeenCalledWith(
      "https://uptime.betterstack.com/api/v3/incidents/123456789/resolve",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });

  it("tira un error si Better Stack responde con error al resolver", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" } as Response);

    await expect(resolveBetterstackIncident("123456789")).rejects.toThrow("404");
  });

  it("tira un error si falla la conexión al resolver", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    await expect(resolveBetterstackIncident("123456789")).rejects.toThrow("Betterstack network error");
  });
});
