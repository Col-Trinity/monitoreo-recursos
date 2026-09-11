import type { ActionHandler } from "./types";
import { createEmailAction } from "./email";
import { createWebhookAction } from "./webhook";
import { createBetterstackAction } from "./betterstack";

export type ActionType = "email" | "webhook" | "betterstack";

export function createActionHandler(type: ActionType): ActionHandler<Record<string, unknown>> {
  switch (type) {
    case "email":
      return createEmailAction() as unknown as ActionHandler<Record<string, unknown>>;
    case "webhook":
      return createWebhookAction() as unknown as ActionHandler<Record<string, unknown>>;
    case "betterstack":
      return createBetterstackAction() as unknown as ActionHandler<Record<string, unknown>>;
  }
}
