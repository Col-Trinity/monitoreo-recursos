import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDiscordAction } from "../discord";
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

const config = { url: "https://discord.com/api/webhooks/test-webhook" };

describe("createDiscordAction", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("manda el mensaje al webhook de Discord con el contenido de la alerta", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
    } as Response);

    const action = createDiscordAction();
    await action.execute({ rule, event }, config);

    expect(fetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/test-webhook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("CPU alto"),
      }),
    );
  });

  it("tira un error sin reintentar si Discord responde con error del cliente", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
    } as Response);

    const action = createDiscordAction();

    await expect(action.execute({ rule, event }, config)).rejects.toThrow("400");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reintenta si Discord responde con error del servidor y corta tras 3 intentos", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    const action = createDiscordAction();

    await expect(action.execute({ rule, event }, config)).rejects.toThrow("503");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("reintenta si falla la conexión y corta tras 3 intentos", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    const action = createDiscordAction();

    await expect(action.execute({ rule, event }, config)).rejects.toThrow("Discord network error");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("deja de reintentar apenas un intento sale bien", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue({ ok: true, status: 204, statusText: "No Content" } as Response);

    const action = createDiscordAction();
    await action.execute({ rule, event }, config);

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
