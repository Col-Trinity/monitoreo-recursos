import { describe, it, expect, vi } from "vitest";
import { createActionHandler } from "../factory";
import { createEmailAction } from "../email";
import { createWebhookAction } from "../webhook";
import { createBetterstackAction } from "../betterstack";

vi.mock("../email", () => ({
  createEmailAction: vi.fn().mockReturnValue({ execute: vi.fn() }),
}));
vi.mock("../webhook", () => ({
  createWebhookAction: vi.fn().mockReturnValue({ execute: vi.fn() }),
}));
vi.mock("../betterstack", () => ({
  createBetterstackAction: vi.fn().mockReturnValue({ execute: vi.fn() }),
}));

describe("createActionHandler", () => {
  it("devuelve el handler de email para type 'email'", () => {
    const handler = createActionHandler("email");

    expect(createEmailAction).toHaveBeenCalled();
    expect(handler.execute).toBeDefined();
  });

  it("devuelve el handler de webhook para type 'webhook'", () => {
    const handler = createActionHandler("webhook");

    expect(createWebhookAction).toHaveBeenCalled();
    expect(handler.execute).toBeDefined();
  });

  it("devuelve el handler de betterstack para type 'betterstack'", () => {
    const handler = createActionHandler("betterstack");

    expect(createBetterstackAction).toHaveBeenCalled();
    expect(handler.execute).toBeDefined();
  });
});
