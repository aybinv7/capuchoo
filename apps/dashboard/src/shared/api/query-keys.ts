/**
 * Every TanStack Query key in one place. App-scoped data lives under `["apps", appId, ...]` so a
 * stream reconnect can invalidate one prefix; entity keys (`channels`, `builds`) are addressed by id
 * because the live stream names entities by id.
 */
export const queryKeys = {
  me: () => ["me"] as const,
  app: (appId: string) => ["apps", appId] as const,
  appDetail: (appId: string) => ["apps", appId, "detail"] as const,
  catalog: (appId: string) => ["apps", appId, "catalog"] as const,
  stats: (appId: string, days: number) => ["apps", appId, "stats", days] as const,
  statsAll: (appId: string) => ["apps", appId, "stats"] as const,
  builds: (appId: string) => ["apps", appId, "builds"] as const,
  devicesAll: (appId: string) => ["apps", appId, "devices"] as const,
  devices: (appId: string, filters: Record<string, unknown>) =>
    ["apps", appId, "devices", filters] as const,
  /**
   * One device's detail and the head of its timeline. Outside `devicesAll`, so a report from any
   * device refetches the lists, and only that device's own report refetches its page.
   */
  device: (appId: string, deviceId: string) => ["apps", appId, "device", deviceId] as const,
  deviceDetail: (appId: string, deviceId: string) =>
    ["apps", appId, "device", deviceId, "detail"] as const,
  deviceEvents: (appId: string, deviceId: string, filter: string) =>
    ["apps", appId, "device", deviceId, "events", filter] as const,
  activityAll: (appId: string) => ["apps", appId, "activity"] as const,
  activity: (appId: string, filters: Record<string, unknown>) =>
    ["apps", appId, "activity", filters] as const,
  /**
   * Pages older than a frozen cursor. They never change, so they live outside `["apps", ...]` and
   * no reconnect or live event refetches them.
   */
  eventHistory: (scope: readonly unknown[], anchor: string) =>
    ["event-history", ...scope, anchor] as const,
  audit: (appId: string) => ["apps", appId, "audit"] as const,
  appSettings: (appId: string, section: string) => ["apps", appId, "settings", section] as const,
  appCi: (appId: string) => ["apps", appId, "ci"] as const,
  ciRefs: (appId: string) => ["apps", appId, "ci", "refs"] as const,
  githubSetup: (appId: string) => ["apps", appId, "ci", "github-setup"] as const,
  channel: (channelId: string) => ["channels", channelId] as const,
  channelHistory: (channelId: string) => ["channels", channelId, "history"] as const,
  channelServed: (channelId: string) => ["channels", channelId, "served"] as const,
  build: (buildId: string) => ["builds", buildId] as const,
  buildDetails: () => ["builds"] as const,
  /** Outside `["builds"]` so invalidating a run or matching its children never refetches a log. */
  jobLogs: (buildId: string, jobId: string, attempt: number) =>
    ["job-logs", buildId, jobId, attempt] as const,
  apiKeys: () => ["api-keys"] as const,
  organization: (organizationId: string, section: string) =>
    ["organizations", organizationId, section] as const,
  githubRepositories: (organizationId: string, installationId: string, search: string) =>
    ["organizations", organizationId, "github", installationId, "repositories", search] as const,
  githubApp: () => ["github", "app"] as const,
  demo: () => ["admin", "demo"] as const,
  invitation: (token: string) => ["invitation", token] as const,
};
