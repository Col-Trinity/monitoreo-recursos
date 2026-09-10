import type { AlertEvent, AlertRule } from "@watchdog/db/schema";

interface ActionHandlerParams {
  event: AlertEvent;
  rule: AlertRule;
}

export interface ActionHandler<TConfig> {
  execute(params: ActionHandlerParams, config: TConfig): Promise<void>;
}
