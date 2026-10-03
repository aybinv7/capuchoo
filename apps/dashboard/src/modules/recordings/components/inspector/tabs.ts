export const INSPECTOR_TABS = [
  "activity",
  "console",
  "network",
  "database",
  "telemetry",
  "perf",
  "data",
] as const;

export type InspectorTab = (typeof INSPECTOR_TABS)[number];

export function isInspectorTab(value: unknown): value is InspectorTab {
  return INSPECTOR_TABS.includes(value as InspectorTab);
}
