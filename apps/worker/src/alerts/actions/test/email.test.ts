import { describe, it, expect, vi } from "vitest";
import { Resend } from "resend";
import type { AlertEvent, AlertRule } from "@watchdog/db/schema";
import { createEmailAction } from "../email";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null }),
      },
    };
  }),
}));

vi.mock("@watchdog/env", () => ({
  env: { RESEND_API_KEY: "test-key" },
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

describe("createEmailAction", () => {
  it("manda el mail con el destinatario y el contenido de la alerta", async () => {
    const action = createEmailAction();

    await action.execute({ rule, event }, { to: "oncall@daztanllc.com" });

    const resendInstance = vi.mocked(Resend).mock.results[0]!.value;
    expect(resendInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "oncall@daztanllc.com",
        subject: expect.stringContaining("CPU alto"),
      }),
    );
  });

  it("tira un error si Resend responde con error", async () => {
    vi.mocked(Resend).mockImplementationOnce(function () {
      return {
        emails: {
          send: vi.fn().mockResolvedValue({ data: null, error: { message: "invalid domain" } }),
        },
      } as unknown as Resend;
    });

    const action = createEmailAction();

    await expect(
      action.execute({ rule, event }, { to: "oncall@daztanllc.com" }),
    ).rejects.toThrow("invalid domain");
  });

  it("tira un error si falla la conexión con Resend", async () => {
    vi.mocked(Resend).mockImplementationOnce(function () {
      return {
        emails: {
          send: vi.fn().mockRejectedValue(new Error("network down")),
        },
      } as unknown as Resend;
    });

    const action = createEmailAction();

    await expect(
      action.execute({ rule, event }, { to: "oncall@daztanllc.com" }),
    ).rejects.toThrow("Resend network error");
  });
});
