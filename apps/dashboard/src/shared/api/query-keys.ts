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
  deviceEvents: (
    appId: string,
    deviceId: string,
    filter: string,
    from: string | null,
    to: string | null,
  ) => ["apps", appId, "device", deviceId, "events", filter, from, to] as const,
  /** Counts per bucket over one window; under the device's prefix so its reports refresh it. */
  deviceActivity: (appId: string, deviceId: string, window: Record<string, unknown>) =>
    ["apps", appId, "device", deviceId, "activity", window] as const,
  activityAll: (appId: string) => ["apps", appId, "activity"] as const,
  /** What a channel's devices report: refetched on telemetry and when its pointer moves. */
  channelInsightsAll: (appId: string) => ["apps", appId, "channel"] as const,
  channelInsights: (appId: string, channelId: string) =>
    ["apps", appId, "channel", channelId] as const,
  channelRollout: (appId: string, channelId: string, tz: string) =>
    ["apps", appId, "channel", channelId, "rollout", tz] as const,
  channelActivity: (appId: string, channelId: string, window: Record<string, unknown>) =>
    ["apps", appId, "channel", channelId, "activity", window] as const,
  /** Runs and deploys that targeted a channel; apart from insights, so telemetry never refetches them. */
  channelBuildsAll: (appId: string) => ["apps", appId, "channel-builds"] as const,
  channelBuilds: (appId: string, channelId: string) =>
    ["apps", appId, "channel-builds", channelId] as const,
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
