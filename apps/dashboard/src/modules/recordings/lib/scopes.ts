import type { RecordingRuleScope } from "@capuchoo/core";
import type { RecordingRule } from "../types/recordings.types";

export interface ScopeKey {
  scope: RecordingRuleScope;
  /** Channel or device id; null for the app. */
  id: string | null;
}

export function parseScope(raw: string): ScopeKey {
  const [scope, id] = raw.split(":");
  if ((scope === "channel" || scope === "device") && id) return { scope, id };
  return { scope: "app", id: null };
}

export const formatScope = (key: ScopeKey) => (key.id ? `${key.scope}:${key.id}` : "app");

export function ruleFor(rules: readonly RecordingRule[], key: ScopeKey): RecordingRule | null {
  return (
    rules.find(
      (rule) =>
        rule.scope === key.scope &&
        (key.scope === "app" ||
          (key.scope === "channel" && rule.channel_id === key.id) ||
          (key.scope === "device" && rule.device_uuid === key.id)),
    ) ?? null
  );
}
