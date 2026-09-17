import type { ActionHandler } from "./types";
import { createEmailAction } from "./email";
import { createWebhookAction } from "./webhook";
import { createBetterstackAction } from "./betterstack";
import { ActionType } from "@watchdog/shared-types";

export function createActionHandler(type: ActionType): ActionHandler<Record<string, unknown>> {
  switch (type) {
    case ActionType.EMAIL:
      return createEmailAction() as unknown as ActionHandler<Record<string, unknown>>;
    case ActionType.WEBHOOK:
      return createWebhookAction() as unknown as ActionHandler<Record<string, unknown>>;
    case ActionType.BETTERSTACK:
      return createBetterstackAction() as unknown as ActionHandler<Record<string, unknown>>;
    default:
      throw new Error(`unknown action type: ${type as string}`);
  }
}
